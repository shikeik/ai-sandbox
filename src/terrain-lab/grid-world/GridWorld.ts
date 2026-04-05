// ========== 格子世界系统 - 核心类 ==========
// 职责：统一的地形数据模型 + 游戏逻辑 + 渲染 + 动画

import type { ActionType } from "../types.js"
import type {
	ElementDef,
	GridWorldConfig,
	GridWorldState,
	ActionCheckResult,
	ActionResult,
	RenderOptions,
} from "./types.js"
import { GridWorldRenderer } from "./GridWorldRenderer.js"
import { GridWorldAnimator } from "./GridWorldAnimator.js"
import { GridWorldEditor } from "./GridWorldEditor.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 默认元素定义（与 constants.ts 同步）==========

export const DEFAULT_ELEMENTS: ElementDef[] = [
	{ id: 0, name: "空气", emoji: "⬛", layer: [0, 1, 2] },
	{ id: 1, name: "狐狸", emoji: "🦊", layer: 1 },
	{ id: 2, name: "平地", emoji: "🟩", layer: 2, isSolid: true },
	{ id: 3, name: "史莱姆", emoji: "🦠", layer: 1, isEnemy: true, blocksWalk: true },
	{ id: 4, name: "恶魔", emoji: "👿", layer: 0, isEnemy: true, blocksJump: true },
	{ id: 5, name: "金币", emoji: "🪙", layer: [0, 1], isCollectible: true },
]

// 层名称
const LAYER_NAMES = ["天上", "地上", "地面"]

// ========== 格子世界核心类 ==========

export class GridWorld {
	// 配置
	private config: GridWorldConfig
	private elements: ElementDef[]
	private logger: Logger

	// 状态
	private state: GridWorldState

	// 子系统
	private renderer: GridWorldRenderer
	private animator: GridWorldAnimator
	private editor: GridWorldEditor | null = null

	// 运行时
	private animationCallbacks: {
		onFrame?: (progress: number, slimeKilled: boolean) => void
		onComplete?: (result: ActionResult) => void
	} = {}

	constructor(config: GridWorldConfig) {
		this.config = config
		this.elements = config.elements
		this.logger = new Logger("GRID-WORLD")

		// 初始化状态
		this.state = {
			grid: this.createEmptyGrid(),
			heroCol: 0,
			heroRow: 1,
			cameraCol: 0,
			animation: {
				isPlaying: false,
				startTime: 0,
				progress: 0,
				action: null,
				slimeKilled: false,
			},
		}

		// 初始化子系统
		this.renderer = new GridWorldRenderer(this.elements, config.height, config.scale)
		this.animator = new GridWorldAnimator()

		console.log("GRID-WORLD", `创建完成 | size=${config.width}x${config.height}, viewport=${config.viewportWidth ?? "全部"}`)
	}

	// ========== 初始化方法 ==========

	/**
	 * 启用编辑器功能
	 */
	enableEditor(): GridWorldEditor {
		this.editor = new GridWorldEditor(
			this.elements,
			this.config.height,
			this.config.width
		)
		console.log("GRID-WORLD", "编辑器功能已启用")
		return this.editor
	}

	/**
	 * 获取编辑器（如果已启用）
	 */
	getEditor(): GridWorldEditor | null {
		return this.editor
	}

	// ========== 网格操作 ==========

	private createEmptyGrid(): number[][] {
		return Array.from({ length: this.config.height }, () =>
			Array(this.config.width).fill(0)
		)
	}

	/**
	 * 获取完整网格
	 */
	getGrid(): number[][] {
		return this.state.grid.map(row => [...row])
	}

	/**
	 * 设置网格
	 */
	setGrid(grid: number[][]): void {
		if (grid.length !== this.config.height || grid[0]?.length !== this.config.width) {
			console.error(`网格尺寸不匹配 | expected=${this.config.width}x${this.config.height}, actual=${grid[0]?.length}x${grid.length}`)
			return
		}
		this.state.grid = grid.map(row => [...row])
		// 同步更新 heroCol，避免后续 setHeroCol 清除错误位置的元素
		for (let c = 0; c < this.config.width; c++) {
			if (this.state.grid[1][c] === 1) {
				this.state.heroCol = c
				break
			}
		}
		console.log("GRID-WORLD", `网格已更新 | heroCol=${this.state.heroCol}`)
	}

	/**
	 * 设置指定格子的元素
	 */
	setCell(row: number, col: number, elementId: number): void {
		if (row < 0 || row >= this.config.height || col < 0 || col >= this.config.width) {
			return
		}

		// 特殊处理：放置狐狸时清除其他位置的狐狸
		if (elementId === 1) {
			for (let c = 0; c < this.config.width; c++) {
				if (this.state.grid[1][c] === 1) {
					this.state.grid[1][c] = 0
				}
			}
			this.state.heroCol = col
		}

		this.state.grid[row][col] = elementId
	}

	/**
	 * 获取指定格子的元素
	 */
	getCell(row: number, col: number): number {
		if (row < 0 || row >= this.config.height || col < 0 || col >= this.config.width) {
			return -1
		}
		return this.state.grid[row][col]
	}

	/**
	 * 获取视野窗口
	 */
	getViewport(startCol: number, width: number): number[][] {
		const viewport: number[][] = Array.from({ length: this.config.height }, () => [])

		for (let row = 0; row < this.config.height; row++) {
			for (let i = 0; i < width; i++) {
				const col = startCol + i
				if (col >= 0 && col < this.config.width) {
					viewport[row][i] = this.state.grid[row][col]
				} else {
					viewport[row][i] = 0  // 空气
				}
			}
		}

		return viewport
	}

	// ========== 主角操作 ==========

	/**
	 * 设置主角位置
	 */
	setHeroCol(col: number): void {
		// 清除原位置狐狸
		if (this.state.heroCol >= 0 && this.state.heroCol < this.config.width) {
			this.state.grid[1][this.state.heroCol] = 0
		}

		// 更新位置
		this.state.heroCol = Math.max(0, Math.min(col, this.config.width - 1))
		this.state.grid[1][this.state.heroCol] = 1

		console.log("GRID-WORLD", `主角位置更新 | col=${this.state.heroCol}`)
	}

	getHeroCol(): number {
		return this.state.heroCol
	}

	// ========== 相机操作 ==========

	/**
	 * 设置相机位置
	 */
	setCameraCol(col: number): void {
		const maxCamera = Math.max(0, this.config.width - (this.config.viewportWidth ?? this.config.width))
		this.state.cameraCol = Math.max(0, Math.min(col, maxCamera))
	}

	getCameraCol(): number {
		return this.state.cameraCol
	}

	/**
	 * 相机跟随主角
	 */
	followHero(enable: boolean): void {
		if (enable && this.config.viewportWidth) {
			// 狐狸固定在视野左侧第0列（而不是中间）
			const targetCamera = Math.max(0, this.state.heroCol)
			this.setCameraCol(targetCamera)
		}
	}

	// ========== 动作检查 ==========

	/**
	 * 检查动作是否合法
	 */
	checkAction(action: ActionType): ActionCheckResult {
		const heroCol = this.state.heroCol
		const col1 = heroCol + 1
		const col2 = heroCol + 2
		const col3 = heroCol + 3

		// 边界检查
		if (col1 >= this.config.width) {
			return {
				ok: false,
				reasons: [`前1(x${col1})超出地图边界`],
				targetCol: heroCol,
				isJump: false,
			}
		}

		// 获取元素
		const getElemName = (row: number, col: number): string => {
			if (col >= this.config.width) return "空气"
			const id = this.state.grid[row]?.[col]
			return this.elements[id]?.name ?? "空气"
		}

		const sky0 = getElemName(0, col1)
		const sky1 = getElemName(0, col2)
		const sky2 = getElemName(0, col3)
		const ground0 = getElemName(2, col1)
		const ground1 = getElemName(2, col2)
		const ground2 = getElemName(2, col3)
		const mid0 = getElemName(1, col1)
		const mid1 = getElemName(1, col2)
		const mid2 = getElemName(1, col3)

		const reasons: string[] = []
		let targetCol = heroCol
		let isJump = false
		let ok = false

		switch (action) {
			case "走":
				targetCol = col1
				isJump = false
				if (ground0 !== "平地" && ground0 !== "未知") {
					reasons.push(`前1(x${col1})地面不是平地`)
				}
				// 注意：走不检查天上恶魔（在地上走路不影响）
				if (mid0 === "史莱姆") {
					reasons.push(`前1(x${col1})地上有史莱姆`)
				}
				ok = reasons.length === 0
				break

			case "跳":
				targetCol = col2
				isJump = true
				if (col2 >= this.config.width) {
					reasons.push(`前2(x${col2})超出地图边界`)
				} else {
					if (sky0 === "恶魔") {
						reasons.push(`前1(x${col1})天上有恶魔`)
					}
					if (ground1 !== "平地" && ground1 !== "未知") {
						reasons.push(`前2(x${col2})地面不是平地`)
					}
					if (sky1 === "恶魔") {
						reasons.push(`前2(x${col2})天上有恶魔`)
					}
					if (mid1 === "史莱姆") {
						reasons.push(`前2(x${col2})地上有史莱姆`)
					}
				}
				ok = reasons.length === 0
				break

			case "远跳":
				targetCol = col3
				isJump = true
				if (col3 >= this.config.width) {
					reasons.push(`前3(x${col3})超出地图边界`)
				} else {
					if (sky0 === "恶魔") {
						reasons.push(`前1(x${col1})天上有恶魔`)
					}
					if (sky1 === "恶魔") {
						reasons.push(`前2(x${col2})天上有恶魔`)
					}
					if (ground2 !== "平地" && ground2 !== "未知") {
						reasons.push(`前3(x${col3})地面不是平地`)
					}
					if (sky2 === "恶魔") {
						reasons.push(`前3(x${col3})天上有恶魔`)
					}
					if (mid2 === "史莱姆") {
						reasons.push(`前3(x${col3})地上有史莱姆`)
					}
				}
				ok = reasons.length === 0
				break

			case "走A":
				targetCol = col1
				isJump = false
				if (mid0 !== "史莱姆") {
					reasons.push(`前1(x${col1})地上没有史莱姆`)
				}
				if (ground0 !== "平地" && ground0 !== "未知") {
					reasons.push(`前1(x${col1})地面不是平地`)
				}
				ok = reasons.length === 0
				break
		}

		return { ok, reasons, targetCol, isJump }
	}

	// ========== 动作执行 ==========

	/**
	 * 执行动作（无动画，立即完成）
	 */
	executeAction(action: ActionType): ActionResult {
		const check = this.checkAction(action)
		const fromCol = this.state.heroCol

		const result: ActionResult = {
			action,
			fromCol,
			targetCol: check.targetCol,
			isValid: check.ok,
			isJump: check.isJump,
			isDeath: false,
			killedEnemies: [],
			collectedItems: [],
		}

		if (!check.ok) {
			console.log("GRID-WORLD", `动作非法 | action=${action}, reasons=${check.reasons.join("; ")}`)
			return result
		}

		// 处理击杀（走A）
		if (action === "走A") {
			result.killedEnemies.push({ row: 1, col: fromCol + 1 })
			this.state.grid[1][fromCol + 1] = 0  // 移除史莱姆
			console.log("GRID-WORLD", `走A击杀史莱姆 | col=${fromCol + 1}`)
		}

		// 移动主角
		this.setHeroCol(check.targetCol)

		// 检查落地死亡（落地位置必须是平地）
		const landingGround = this.state.grid[2][check.targetCol]
		if (landingGround !== 2) {  // 2 = 平地
			result.isDeath = true
			result.deathReason = "落地位置不是平地"
			console.log("GRID-WORLD", `死亡判定 | col=${check.targetCol}, reason=${result.deathReason}`)
		}

		console.log("GRID-WORLD", `动作执行 | action=${action}, from=${fromCol}, to=${check.targetCol}, death=${result.isDeath}`)
		return result
	}

	/**
	 * 播放动作动画（带动画效果）
	 */
	async playAction(
		action: ActionType,
		options?: {
			speed?: number
			onFrame?: (progress: number, slimeKilled: boolean) => void
		}
	): Promise<ActionResult> {
		const check = this.checkAction(action)
		const fromCol = this.state.heroCol

		// 即使动作非法也返回结果，但不动画
		if (!check.ok) {
			return {
				action,
				fromCol,
				targetCol: fromCol,
				isValid: false,
				isJump: false,
				isDeath: false,
				killedEnemies: [],
				collectedItems: [],
			}
		}

		console.log("GRID-WORLD", `开始播放动作动画 | action=${action}`)

		// 调整动画速度
		const speed = options?.speed ?? 1

		// 播放动画
		await this.animator.play(action, options?.onFrame)

		// 动画完成后执行逻辑
		const result = this.executeAction(action)

		console.log("GRID-WORLD", `动作动画完成 | action=${action}, result=${result.isValid ? "成功" : "失败"}`)
		return result
	}

	// ========== 渲染 ==========

	/**
	 * 渲染当前状态
	 */
	render(options: RenderOptions): void {
		const viewportWidth = this.config.viewportWidth ?? this.config.width
		const viewport = this.getViewport(this.state.cameraCol, viewportWidth)

		this.renderer.render(viewport, {
			...options,
			heroCol: this.state.heroCol,
			cameraCol: this.state.cameraCol,
		})
	}

	/**
	 * 渲染动画帧
	 */
	renderAnimation(
		options: RenderOptions,
		action: ActionType,
		progress: number,
		slimeKilled: boolean
	): void {
		let layout = this.renderer.getLastLayout()
		
		// 如果没有 layout，先计算一个（首次渲染时）
		if (!layout) {
			const rect = options.canvas.getBoundingClientRect()
			const viewportWidth = this.config.viewportWidth ?? this.config.width
			layout = this.renderer.calculateLayout(rect.width, rect.height, viewportWidth)
		}

		const viewportWidth = this.config.viewportWidth ?? this.config.width
		const viewport = this.getViewport(this.state.cameraCol, viewportWidth)

		// 计算动画位置
		const { cellW, cellH, gapX, gapY, startX, startY } = layout
		const heroScreenCol = this.state.heroCol - this.state.cameraCol

		const startHeroX = startX + heroScreenCol * (cellW + gapX) + cellW / 2
		const startHeroY = startY + 1 * (cellH + gapY) + cellH / 2
		const targetX = startX + (heroScreenCol + this.animator.getTargetColOffset(action)) * (cellW + gapX) + cellW / 2

		const pos = this.animator.calculatePosition(action, progress, startHeroX, startHeroY, targetX, cellH)

		this.renderer.renderAnimation(viewport, {
			...options,
			cameraCol: this.state.cameraCol,
			hideHeroAtCol: heroScreenCol,  // 隐藏原位置狐狸
			hideSlimeAtCol: slimeKilled ? this.state.heroCol + 1 : null,
		}, heroScreenCol, pos.x, pos.y)
	}

	/**
	 * 清空画布
	 */
	clear(canvas: HTMLCanvasElement, message?: string): void {
		this.renderer.clear(canvas, message)
	}

	// ========== 交互辅助 ==========

	/**
	 * 获取指定像素位置的格子（用于编辑）
	 */
	getCellAtPosition(mx: number, my: number, canvasWidth: number, canvasHeight: number): { row: number; col: number } | null {
		const viewportWidth = this.config.viewportWidth ?? this.config.width
		const cellPos = this.renderer.getCellAtPosition(mx, my, canvasWidth, canvasHeight, viewportWidth)
		if (!cellPos) return null

		// 转换为世界坐标
		return {
			row: cellPos.row,
			col: this.state.cameraCol + cellPos.col,
		}
	}

	// ========== 工具方法 ==========

	/**
	 * 随机生成地形
	 */
	generateRandom(layerPools: number[][]): void {
		for (let row = 0; row < this.config.height; row++) {
			const pool = layerPools[row] ?? [0]
			for (let col = 0; col < this.config.width; col++) {
				if (row === 1 && col === 0) {
					this.state.grid[row][col] = 1  // 狐狸
				} else {
					this.state.grid[row][col] = pool[Math.floor(Math.random() * pool.length)]
				}
			}
		}
		this.state.heroCol = 0
		console.log("GRID-WORLD", "随机地形生成完成")
	}

	/**
	 * 获取配置
	 */
	getConfig(): GridWorldConfig {
		return { ...this.config }
	}

	/**
	 * 获取状态
	 */
	getState(): GridWorldState {
		return {
			grid: this.state.grid.map(row => [...row]),
			heroCol: this.state.heroCol,
			heroRow: this.state.heroRow,
			cameraCol: this.state.cameraCol,
			animation: { ...this.state.animation },
		}
	}

	/**
	 * 销毁
	 */
	destroy(): void {
		this.animator.destroy()
		console.log("GRID-WORLD", "已销毁")
	}
}

// ========== 导出创建函数 ==========

export function createGridWorld(config: GridWorldConfig): GridWorld {
	return new GridWorld(config)
}
