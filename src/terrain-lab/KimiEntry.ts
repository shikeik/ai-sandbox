// ========== Kimi 挑战入口 ==========
// 职责：通过 HTTP API 与 Kimi 进行回合制交互

import type { AppState } from "./state.js"
import {
	NUM_LAYERS, NUM_COLS, ELEMENTS, ELEM_AIR, ELEM_HERO, ELEM_GROUND,
	ELEM_SLIME, ELEM_DEMON, ELEM_COIN, DEFAULT_TERRAIN_CONFIG
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import {
	getLayerPool, randElemFromPool
} from "./terrain.js"
import { setupHighDPICanvas } from "@/engine/utils/canvas.js"
import { drawEmoji } from "./renderer.js"

// ========== 常量 ==========
const MAP_LENGTH = 32  // 地图总长度
const VIEWPORT_COLS = 5  // 视野窗口宽度

export class KimiEntry {
	private state: AppState
	private container: HTMLElement | null = null
	private canvas: HTMLCanvasElement | null = null
	private ctx: CanvasRenderingContext2D | null = null

	// 游戏状态
	private fullMap: number[][] | null = null
	private heroCol = 0
	private terrainConfig: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG }

	// 单元格尺寸
	private cellW = 0
	private cellH = 0
	private gapX = 4
	private gapY = 4

	constructor(state: AppState) {
		this.state = state
	}

	init(): void {
		this.container = document.getElementById("tab-kimi")
		if (!this.container) return

		// 替换内容为游戏界面
		this.renderLayout()

		// 初始化 canvas
		const canvas = document.getElementById("kimi-canvas") as HTMLCanvasElement
		if (canvas) {
			this.canvas = canvas
			const result = setupHighDPICanvas(canvas)
			this.ctx = result.ctx
		}

		// 绑定按钮事件
		this.bindEvents()

		// 初始化游戏
		this.resetGame()

		console.log("[KIMI] Kimi 挑战入口初始化完成")
	}

	onTabActivate(): void {
		console.log("[KIMI] Tab 激活")
		if (this.canvas && this.fullMap) {
			this.drawViewport()
		}
	}

	// ========== 布局渲染 ==========

	private renderLayout(): void {
		if (!this.container) return

		this.container.innerHTML = `
			<div class="challenge-layout">
				<div class="panel" style="grid-column: 1 / -1;">
					<div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
						<span>🤖 Kimi 挑战 - 5×3 视野</span>
						<div style="display:flex;gap:10px;align-items:center;">
							<span style="font-size:11px;color:#9aa0a6;">狐狸位置: <span id="kimi-hero-pos">0/31</span></span>
							<button class="btn-primary" id="btn-kimi-reset">重置</button>
							<button class="btn-accent" id="btn-kimi-step" disabled>单步</button>
							<button class="btn-secondary" id="btn-kimi-start">开始</button>
						</div>
					</div>

					<!-- 5×3 视野画布 -->
					<canvas id="kimi-canvas" style="width:100%;max-width:500px;height:300px;background:#0b0c0f;border-radius:8px;display:block;margin:0 auto;"></canvas>

					<!-- 状态信息 -->
					<div class="challenge-result waiting" id="kimi-status" style="margin-top:10px;">
						点击「重置」生成地图，等待 Kimi 连接...
					</div>

					<!-- 调试信息：完整地图预览 -->
					<div class="panel-title" style="margin-top:14px;">完整地图预览 (32格)</div>
					<div id="kimi-map-preview" style="font-family:monospace;font-size:10px;line-height:1.4;background:#0b0c0f;padding:10px;border-radius:8px;overflow-x:auto;white-space:pre;color:#bdc1c6;"></div>
				</div>
			</div>
		`
	}

	private bindEvents(): void {
		const btnReset = document.getElementById("btn-kimi-reset")
		const btnStep = document.getElementById("btn-kimi-step")
		const btnStart = document.getElementById("btn-kimi-start")

		btnReset?.addEventListener("click", () => this.resetGame())
		btnStep?.addEventListener("click", () => this.step())
		btnStart?.addEventListener("click", () => this.start())
	}

	// ========== 游戏逻辑 ==========

	/**
	 * 重置游戏 - 生成新地图
	 */
	private resetGame(): void {
		this.heroCol = 0
		this.fullMap = this.generateMap()
		this.updateHeroPosDisplay()
		this.drawViewport()
		this.updateMapPreview()
		this.updateStatus("地图已生成，狐狸在起点 (0, 地上层)")
	}

	/**
	 * 生成 32×3 完整地图
	 */
	private generateMap(): number[][] {
		const map: number[][] = [[], [], []]

		const pools = [
			getLayerPool(0, this.terrainConfig),
			getLayerPool(1, this.terrainConfig),
			getLayerPool(2, this.terrainConfig),
		]

		for (let layer = 0; layer < NUM_LAYERS; layer++) {
			for (let col = 0; col < MAP_LENGTH; col++) {
				map[layer]![col] = randElemFromPool(pools[layer]!)
			}
		}

		// 确保第0列第1层是狐狸 (x0, 地上层)
		map[1]![0] = ELEM_HERO

		// 确保第0列第2层是平地（起始安全）
		map[2]![0] = ELEM_GROUND

		// 确保第31列第2层是平地（终点）
		map[2]![31] = ELEM_GROUND

		// 移除其他狐狸
		for (let col = 1; col < MAP_LENGTH; col++) {
			if (map[1]![col] === ELEM_HERO) {
				map[1]![col] = ELEM_AIR
			}
		}

		return map
	}

	/**
	 * 获取 5×3 视野窗口
	 */
	private getViewport(): number[][] {
		const viewport: number[][] = [[], [], []]

		if (!this.fullMap) {
			return [
				Array(VIEWPORT_COLS).fill(ELEM_AIR),
				[ELEM_HERO, ...Array(VIEWPORT_COLS - 1).fill(ELEM_AIR)],
				Array(VIEWPORT_COLS).fill(ELEM_GROUND),
			]
		}

		for (let layer = 0; layer < NUM_LAYERS; layer++) {
			for (let i = 0; i < VIEWPORT_COLS; i++) {
				const mapCol = this.heroCol + i
				if (mapCol < MAP_LENGTH) {
					viewport[layer][i] = this.fullMap[layer]![mapCol]!
				} else {
					viewport[layer][i] = ELEM_AIR
				}
			}
		}

		// 确保视野中狐狸在0列（清除其他列的狐狸）
		for (let c = 1; c < VIEWPORT_COLS; c++) {
			if (viewport[1][c] === ELEM_HERO) {
				viewport[1][c] = ELEM_AIR
			}
		}
		viewport[1][0] = ELEM_HERO

		return viewport
	}

	// ========== 渲染 ==========

	/**
	 * 绘制 5×3 视野
	 * 坐标系：y 向下为正，r=0 在上方显示天上层，r=2 在下方显示地面层
	 */
	private drawViewport(): void {
		if (!this.canvas || !this.ctx) return

		const viewport = this.getViewport()

		// 清空
		this.ctx.fillStyle = "#0b0c0f"
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

		// 获取 css 尺寸（因为 ctx 已经 setTransform(dpr) 了）
		const cssWidth = this.canvas.width / (window.devicePixelRatio || 1)
		const cssHeight = this.canvas.height / (window.devicePixelRatio || 1)

		// 布局参数（css 像素）
		const paddingX = 50
		const paddingY = 30
		const labelW = 36   // 左侧层标签宽度
		const labelH = 16   // 顶部列标签高度

		// 计算单元格尺寸
		const availableWidth = cssWidth - paddingX * 2 - labelW
		const availableHeight = cssHeight - paddingY * 2 - labelH

		this.cellW = Math.floor((availableWidth - (VIEWPORT_COLS - 1) * this.gapX) / VIEWPORT_COLS)
		this.cellH = Math.min(
			this.cellW,
			Math.floor((availableHeight - (NUM_LAYERS - 1) * this.gapY) / NUM_LAYERS)
		)

		// 居中起始位置
		const totalW = VIEWPORT_COLS * this.cellW + (VIEWPORT_COLS - 1) * this.gapX
		const totalH = NUM_LAYERS * this.cellH + (NUM_LAYERS - 1) * this.gapY
		const startX = (cssWidth - totalW - labelW) / 2 + labelW
		const startY = (cssHeight - totalH - labelH) / 2 + labelH

		// 层映射：r=0(上方)=layer0(天上), r=1=layer1(地上), r=2(下方)=layer2(地面)
		// 这样天上在上方显示，地面在下方显示
		const layerNames = ["天上", "地上", "地面"]
		const layerMap = [0, 1, 2]

		// 设置字体
		this.ctx.fillStyle = "#9aa0a6"
		this.ctx.font = "12px sans-serif"
		this.ctx.textAlign = "center"
		this.ctx.textBaseline = "middle"

		// 绘制层标签（左侧）
		for (let r = 0; r < NUM_LAYERS; r++) {
			const y = startY + r * (this.cellH + this.gapY) + this.cellH / 2
			this.ctx.fillText(layerNames[r], startX - labelW / 2 - 4, y)
		}

		// 绘制列标签（顶部）
		const labelTopY = startY - labelH / 2
		for (let c = 0; c < VIEWPORT_COLS; c++) {
			const colNum = this.heroCol + c
			const x = startX + c * (this.cellW + this.gapX) + this.cellW / 2
			this.ctx.fillText(`x${colNum}`, x, labelTopY)
		}

		// 绘制网格和元素
		for (let r = 0; r < NUM_LAYERS; r++) {
			const dataLayer = layerMap[r]
			for (let c = 0; c < VIEWPORT_COLS; c++) {
				const x = startX + c * (this.cellW + this.gapX)
				const y = startY + r * (this.cellH + this.gapY)

				// 网格边框
				this.ctx.strokeStyle = "#3c4043"
				this.ctx.lineWidth = 1
				this.ctx.strokeRect(x, y, this.cellW, this.cellH)

				// 元素 emoji
				const elemId = viewport[dataLayer][c]
				const emoji = ELEMENTS[elemId]?.emoji ?? " "
				drawEmoji(this.ctx, emoji, x + this.cellW / 2, y + this.cellH / 2, Math.min(this.cellW, this.cellH) * 0.55)
			}
		}

		// 高亮狐狸位置（画蓝框）- 狐狸固定在地上层（layer 1，对应 r=1）
		const foxX = startX
		const foxY = startY + 1 * (this.cellH + this.gapY)
		this.ctx.strokeStyle = "#8ab4f8"
		this.ctx.lineWidth = 3
		this.ctx.strokeRect(foxX + 2, foxY + 2, this.cellW - 4, this.cellH - 4)
	}

	/**
	 * 更新完整地图预览（文字版）
	 */
	private updateMapPreview(): void {
		const preview = document.getElementById("kimi-map-preview")
		if (!preview || !this.fullMap) return

		const layerNames = ["天:", "地:", "面:"]
		let text = ""

		for (let layer = 0; layer < NUM_LAYERS; layer++) {
			text += layerNames[layer] + " "
			for (let col = 0; col < MAP_LENGTH; col++) {
				const elemId = this.fullMap[layer]![col]!
				const emoji = ELEMENTS[elemId]?.emoji ?? "?"
				text += emoji
			}
			text += "\n"
		}

		// 标记狐狸位置（用 ▲ 避免和 🦊 混淆）
		text += "    " + " ".repeat(this.heroCol) + "▲"

		preview.textContent = text
	}

	// ========== UI 更新 ==========

	private updateHeroPosDisplay(): void {
		const el = document.getElementById("kimi-hero-pos")
		if (el) el.textContent = `${this.heroCol}/31`
	}

	private updateStatus(msg: string): void {
		const el = document.getElementById("kimi-status")
		if (el) el.innerHTML = msg
	}

	// ========== 控制 ==========

	private step(): void {
		// TODO: 单步执行，等待 Kimi 输入
		console.log("[KIMI] 单步")
	}

	private start(): void {
		// TODO: 开始游戏，循环等待 Kimi 输入
		console.log("[KIMI] 开始")
	}
}
