// ========== 因果链 AI Web 版 - DOM 渲染器（增量更新版） ==========
// 参考 brain-lab 的视觉风格，使用增量更新避免全量重绘

import type { LocalView, Cell, GameObject, ActionType } from "./types"

// 渲染配置
const RENDER_CONFIG = {
	cellSize: 36,        // 局部视野固定大小
	gap: 3,
	borderRadius: 6,
	minCellSize: 20,     // 全局视野最小格子
	maxCellSize: 36,     // 全局视野最大格子
	containerSize: 320,  // 容器大小
	colors: {
		background: "#0a0a14",
		wall: "#3d4856",
		wallTop: "#5a6a7d",
		wallSide: "#2d3744",
		floor: "#1e2630",
		floorAlt: "#232d38",
		void: "#050508",
		voidBorder: "#0a0a0f",
		agent: "#4ea1d3",
		key: "#f6ad55",
		doorClosed: "#c53030",
		doorOpen: "#38a169",
		goal: "#805ad5",
	}
} as const

// 方向箭头映射
const DIRECTION_ARROWS: Record<string, string> = {
	"上": "↑",
	"下": "↓",
	"左": "←",
	"右": "→"
}

type ViewMode = "local" | "global"

/**
 * DOM 渲染器 - 增量更新模式
 * 
 * 优化策略：
 * 1. 地形只渲染一次（墙/地板不会变）
 * 2. 玩家作为独立 DOM 元素移动，不触动格子
 * 3. 对象变化时只更新对应格子
 * 4. 移动时只更新旧位置和新位置的对象显示
 */
export class WorldRenderer {
	private container: HTMLElement
	private viewMode: ViewMode = "local"
	private worldContent: HTMLElement | null = null
	private agentElement: HTMLElement | null = null
	private agentDirectionEl: HTMLElement | null = null
	private positionHud: HTMLElement | null = null

	// 当前世界尺寸
	private currentWidth: number = 0
	private currentHeight: number = 0
	private currentFacing: string = "右"

	// 缓存当前视野数据，用于增量比较
	private cellCache: Map<string, CellCache> = new Map()

	// 上一次玩家位置（用于增量更新）
	private lastAgentPos: { x: number; y: number } | null = null

	// 当前实际使用的 cellSize（全局视野时可能自适应）
	private currentCellSize: number = RENDER_CONFIG.cellSize

	constructor(containerId: string) {
		const container = document.getElementById(containerId)
		if (!container) {
			throw new Error(`未找到容器元素: ${containerId}`)
		}
		this.container = container
	}

	/**
	 * 计算全局视野的自适应 cellSize
	 */
	private calcGlobalCellSize(width: number, height: number): number {
		const { containerSize, gap, minCellSize, maxCellSize } = RENDER_CONFIG
		const maxCells = Math.max(width, height)
		// 计算能放入容器的 cellSize
		const cellSize = Math.floor((containerSize - (maxCells - 1) * gap) / maxCells)
		// 限制在合理范围内
		return Math.max(minCellSize, Math.min(maxCellSize, cellSize))
	}

	setViewMode(mode: ViewMode): void {
		this.viewMode = mode
		// 切换模式时清空缓存，强制重新渲染
		this.cellCache.clear()
		this.lastAgentPos = null
	}

	getViewMode(): ViewMode {
		return this.viewMode
	}

	toggleViewMode(): ViewMode {
		this.viewMode = this.viewMode === "local" ? "global" : "local"
		this.cellCache.clear()
		this.lastAgentPos = null
		return this.viewMode
	}

	/**
	 * 渲染视野 - 智能增量更新
	 */
	render(
		view: LocalView,
		agentPos?: { x: number; y: number },
		facing?: ActionType
	): void {
		// 更新朝向（只更新方向指示器，不重绘）
		if (facing && facing !== this.currentFacing) {
			this.currentFacing = facing
			this.updateAgentDirection()
		}

		if (this.viewMode === "local") {
			this.renderLocalView(view, agentPos)
		} else {
			this.renderGlobalView(view, agentPos)
		}
	}

	// 渲染局部视野
	private renderLocalView(view: LocalView, agentPos?: { x: number; y: number }): void {
		const { width, height } = view

		// 尺寸变化时重建世界
		if (!this.worldContent || this.currentWidth !== width || this.currentHeight !== height) {
			this.createWorldStructure(width, height, false)  // 局部视野固定大小
			this.renderAllCells(view, true, agentPos)
			return
		}

		// 局部视野优化：只移动玩家，对象实际变化时才更新格子
		this.renderLocalViewOptimized(view, agentPos)
	}

	/**
	 * 局部视野优化渲染
	 * 策略：玩家移动只更新玩家位置，对象变化才更新格子
	 */
	private renderLocalViewOptimized(
		view: LocalView,
		agentPos?: { x: number; y: number }
	): void {
		const { width, height } = view
		const halfWidth = Math.floor(width / 2)
		const halfHeight = Math.floor(height / 2)

		// 玩家必须在世界中才能计算世界坐标
		if (!agentPos) {
			// 降级：全量渲染
			this.renderAllCells(view, true)
			return
		}

		// 1. 移动玩家到中心（始终在中间）
		if (this.agentElement) {
			this.moveAgentTo(halfWidth, halfHeight)
			this.lastAgentPos = { x: halfWidth, y: halfHeight }
		}

		// 2. 只更新对象有变化的格子（比如拾取钥匙、开门）
		// 使用世界坐标作为缓存键（关键！）
		for (const [key, cell] of view.cells) {
			const [dx, dy] = key.split(",").map(Number)
			const screenX = dx + halfWidth
			const screenY = dy + halfHeight

			// 计算世界坐标
			const worldX = agentPos.x + dx
			const worldY = agentPos.y + dy
			const worldKey = `world:${worldX},${worldY}`

			const cached = this.cellCache.get(worldKey)

			if (!cached || this.hasCellChanged(cached, cell)) {
				const isAlt = (screenX + screenY) % 2 === 1
				this.renderCell(screenX, screenY, cell, isAlt)
				this.cellCache.set(worldKey, this.createCellCache(cell))
			}
		}
	}

	// 渲染全局视野
	private renderGlobalView(view: LocalView, agentPos?: { x: number; y: number }): void {
		const { width, height } = view

		// 尺寸变化时重建世界
		if (!this.worldContent || this.currentWidth !== width || this.currentHeight !== height) {
			this.createWorldStructure(width, height, true)  // 全局视野自适应大小
			this.renderAllCells(view, false, agentPos)
			return
		}

		// 移动玩家
		if (agentPos && this.agentElement) {
			this.moveAgentTo(agentPos.x, agentPos.y)
			this.lastAgentPos = { x: agentPos.x, y: agentPos.y }
		}

		// 增量更新格子
		this.renderChangedCells(view)

		// 更新位置 HUD
		if (agentPos) {
			this.updatePositionHud(agentPos.x, agentPos.y)
		}
	}

	/**
	 * 首次渲染所有格子（全量）
	 */
	private renderAllCells(
		view: LocalView,
		isLocal: boolean,
		agentPos?: { x: number; y: number }
	): void {
		const { width, height } = view
		const halfWidth = Math.floor(width / 2)
		const halfHeight = Math.floor(height / 2)

		// 清空缓存
		this.cellCache.clear()

		for (const [key, cell] of view.cells) {
			let x: number, y: number, isAgentHere: boolean, cacheKey: string

			if (isLocal) {
				// 局部视野：key 是 "dx,dy"
				const [dx, dy] = key.split(",").map(Number)
				x = dx + halfWidth
				y = dy + halfHeight
				isAgentHere = dx === 0 && dy === 0
				// 缓存键使用世界坐标
				const worldX = agentPos ? agentPos.x + dx : dx
				const worldY = agentPos ? agentPos.y + dy : dy
				cacheKey = `world:${worldX},${worldY}`
			} else {
				// 全局视野：key 是 "x,y"
				[x, y] = key.split(",").map(Number)
				isAgentHere = !!(agentPos && agentPos.x === x && agentPos.y === y)
				cacheKey = `${x},${y}`
			}

			const isAlt = (x + y) % 2 === 1
			this.renderCell(x, y, cell, isAlt)

			// 缓存当前状态
			this.cellCache.set(cacheKey, this.createCellCache(cell))

			// 设置玩家初始位置
			if (isAgentHere && this.agentElement) {
				this.moveAgentTo(x, y)
				this.lastAgentPos = { x, y }
			}
		}
	}

	/**
	 * 全局视野增量更新
	 */
	private renderChangedCells(view: LocalView): void {
		// 全局视野：只更新有变化的格子
		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			const cacheKey = `${x},${y}`
			const cached = this.cellCache.get(cacheKey)

			if (!cached || this.hasCellChanged(cached, cell)) {
				const isAlt = (x + y) % 2 === 1
				this.renderCell(x, y, cell, isAlt)
				this.cellCache.set(cacheKey, this.createCellCache(cell))
			}
		}
	}

	/**
	 * 检查格子是否变化
	 */
	private hasCellChanged(cached: CellCache, current: Cell | undefined): boolean {
		if (!current) return cached.tileType !== "void"

		// 比较地形
		if (cached.tileType !== current.tile.type) return true

		// 比较对象（只比较类型和关键状态）
		const currentObjects = current.objects
			.filter(o => o.type !== "agent")
			.map(o => `${o.type}:${JSON.stringify(o.state)}`)
			.sort()
			.join(",")

		return cached.objectsKey !== currentObjects
	}

	/**
	 * 创建格子缓存
	 */
	private createCellCache(cell: Cell | undefined): CellCache {
		if (!cell) {
			return { tileType: "void", objectsKey: "" }
		}

		const objectsKey = cell.objects
			.filter(o => o.type !== "agent")
			.map(o => `${o.type}:${JSON.stringify(o.state)}`)
			.sort()
			.join(",")

		return {
			tileType: cell.tile.type,
			objectsKey
		}
	}

	// 创建世界结构
	private createWorldStructure(width: number, height: number, isGlobal: boolean = false): void {
		this.currentWidth = width
		this.currentHeight = height
		this.cellCache.clear()
		this.lastAgentPos = null

		// 全局视野使用自适应 cellSize
		this.currentCellSize = isGlobal 
			? this.calcGlobalCellSize(width, height)
			: RENDER_CONFIG.cellSize

		const { gap } = RENDER_CONFIG
		const cellSize = this.currentCellSize
		const worldWidth = width * (cellSize + gap) - gap
		const worldHeight = height * (cellSize + gap) - gap

		this.container.innerHTML = `
			<div class="ca-world-viewport" style="
				width: 100%;
				height: 100%;
				overflow: hidden;
				position: relative;
				background: ${RENDER_CONFIG.colors.background};
				border-radius: 12px;
				border: 1px solid #2a2a3e;
			">
				<div class="ca-position-hud" style="
					position: absolute;
					top: 8px;
					left: 50%;
					transform: translateX(-50%);
					background: rgba(0, 0, 0, 0.7);
					backdrop-filter: blur(4px);
					padding: 4px 12px;
					border-radius: 12px;
					border: 1px solid rgba(255, 255, 255, 0.1);
					font-size: 12px;
					font-weight: 500;
					color: #fff;
					z-index: 100;
					text-shadow: 0 1px 2px rgba(0,0,0,0.5);
				">(0, 0)</div>
				<div class="ca-world-content" style="
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					width: ${worldWidth}px;
					height: ${worldHeight}px;
				">
					${this.generateGridHTML(width, height)}
				</div>
			</div>
		`

		this.worldContent = this.container.querySelector(".ca-world-content") as HTMLElement
		this.positionHud = this.container.querySelector(".ca-position-hud") as HTMLElement

		this.createAgentElement()
	}

	// 生成格子 HTML
	private generateGridHTML(width: number, height: number): string {
		const { gap, borderRadius } = RENDER_CONFIG
		const cellSize = this.currentCellSize
		let html = ""

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const left = x * (cellSize + gap)
				const top = y * (cellSize + gap)
				html += `
					<div class="ca-cell" data-x="${x}" data-y="${y}" style="
						position: absolute;
						left: ${left}px;
						top: ${top}px;
						width: ${cellSize}px;
						height: ${cellSize}px;
						border-radius: ${borderRadius}px;
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 20px;
					"></div>
				`
			}
		}

		return html
	}

	// 创建玩家元素
	private createAgentElement(): void {
		if (!this.worldContent) return

		const cellSize = this.currentCellSize

		this.agentElement = document.createElement("div")
		this.agentElement.className = "ca-agent"
		this.agentElement.style.cssText = `
			position: absolute;
			width: ${cellSize}px;
			height: ${cellSize}px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 26px;
			z-index: 50;
			transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
			filter: drop-shadow(0 2px 6px rgba(78, 161, 211, 0.5));
			pointer-events: none;
		`

		const robotIcon = document.createElement("span")
		robotIcon.textContent = "🤖"
		robotIcon.style.cssText = `
			display: block;
			transform-origin: center;
			transition: transform 0.2s ease;
		`
		this.agentElement.appendChild(robotIcon)

		this.agentDirectionEl = document.createElement("span")
		this.agentDirectionEl.className = "ca-agent-direction"
		this.agentDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
		this.agentDirectionEl.style.cssText = `
			position: absolute;
			top: -2px;
			right: -2px;
			font-size: 12px;
			background: ${RENDER_CONFIG.colors.agent};
			color: #fff;
			border-radius: 50%;
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 1px 3px rgba(0,0,0,0.4);
		`
		this.agentElement.appendChild(this.agentDirectionEl)

		this.worldContent.appendChild(this.agentElement)
	}

	// 移动玩家到指定格子
	private moveAgentTo(x: number, y: number): void {
		if (!this.agentElement) return

		const { gap } = RENDER_CONFIG
		const cellSize = this.currentCellSize
		const left = x * (cellSize + gap)
		const top = y * (cellSize + gap)
		this.agentElement.style.left = `${left}px`
		this.agentElement.style.top = `${top}px`
	}

	// 更新玩家方向指示器
	private updateAgentDirection(): void {
		if (this.agentDirectionEl && this.currentFacing in DIRECTION_ARROWS) {
			this.agentDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
		}
	}

	/**
	 * 渲染单个格子（全量渲染，用于首次或变化时）
	 */
	private renderCell(x: number, y: number, cell: Cell | undefined, isAlt: boolean): void {
		if (!this.worldContent) return

		const cellEl = this.worldContent.querySelector(`[data-x="${x}"][data-y="${y}"]`) as HTMLElement
		if (!cellEl) return

		// 清空内容
		cellEl.innerHTML = ""

		if (!cell) {
			this.applyVoidStyle(cellEl, isAlt)
			return
		}

		// 应用地形样式
		switch (cell.tile.type) {
		case "wall":
			this.applyWallStyle(cellEl)
			break
		case "void":
			this.applyVoidStyle(cellEl, isAlt)
			break
		default:
			this.applyFloorStyle(cellEl, isAlt)
		}

		// 渲染对象
		if (cell.objects.length > 0) {
			const obj = cell.objects.find(o => o.type !== "agent") || cell.objects[0]
			if (obj) {
				this.renderObjectToCell(cellEl, obj)
			}
		}
	}

	// 样式应用方法
	private applyWallStyle(el: HTMLElement): void {
		const { colors } = RENDER_CONFIG
		el.style.background = `linear-gradient(145deg, ${colors.wallTop} 0%, ${colors.wall} 50%, ${colors.wallSide} 100%)`
		el.style.border = "1px solid #4a5568"
		el.style.boxShadow = "inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)"
	}

	private applyFloorStyle(el: HTMLElement, isAlt: boolean): void {
		const { colors } = RENDER_CONFIG
		const baseColor = isAlt ? colors.floorAlt : colors.floor
		el.style.background = baseColor
		el.style.border = `1px solid ${isAlt ? "#2a3540" : "#263038"}`
		el.style.boxShadow = "none"
	}

	private applyVoidStyle(el: HTMLElement, isAlt: boolean): void {
		// 虚空：更亮的底色 + 斜线纹理 + 明显网格线
		const baseColor = isAlt ? "#1a2230" : "#151b26"
		el.style.background = baseColor
		el.style.border = "1px solid #2a3545"
		el.style.boxShadow = "none"
		
		// 添加斜线纹理（更明显的白色线条）
		el.style.backgroundImage = `
			repeating-linear-gradient(
				45deg,
				transparent,
				transparent 5px,
				rgba(255,255,255,0.12) 5px,
				rgba(255,255,255,0.12) 7px
			)
		`
	}

	// 渲染对象到格子
	private renderObjectToCell(cellEl: HTMLElement, obj: GameObject): void {
		const objEl = document.createElement("div")
		objEl.className = "ca-object"
		objEl.style.cssText = `
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 22px;
			pointer-events: none;
			animation: ca-pop-in 0.3s ease-out;
		`

		switch (obj.type) {
		case "agent":
			break
		case "钥匙":
			objEl.textContent = "🔑"
			objEl.style.filter = "drop-shadow(0 1px 3px rgba(246, 173, 85, 0.5))"
			objEl.style.animation = "ca-float 2s ease-in-out infinite"
			cellEl.appendChild(objEl)
			break
		case "门":
			if (obj.state?.open) {
				cellEl.style.background = `${RENDER_CONFIG.colors.doorOpen}25`
				cellEl.style.border = `2px solid ${RENDER_CONFIG.colors.doorOpen}`
				objEl.textContent = "🚪"
				objEl.style.opacity = "0.6"
				objEl.style.filter = "grayscale(0.3)"
			} else {
				cellEl.style.background = `repeating-linear-gradient(45deg, ${RENDER_CONFIG.colors.doorClosed}, ${RENDER_CONFIG.colors.doorClosed} 4px, #9b2c2c 4px, #9b2c2c 8px)`
				cellEl.style.border = `2px solid ${RENDER_CONFIG.colors.doorClosed}`
				objEl.textContent = "🔒"
				objEl.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
			}
			cellEl.appendChild(objEl)
			break
		case "终点":
			cellEl.style.background = `${RENDER_CONFIG.colors.goal}20`
			cellEl.style.border = `2px solid ${RENDER_CONFIG.colors.goal}`
			cellEl.style.boxShadow = `0 0 12px ${RENDER_CONFIG.colors.goal}40`
			objEl.textContent = "🏁"
			objEl.style.filter = "drop-shadow(0 0 6px rgba(159, 122, 234, 0.8))"
			objEl.style.animation = "ca-pulse 1.5s ease-in-out infinite"
			cellEl.appendChild(objEl)
			break
		}
	}

	// 更新位置 HUD
	private updatePositionHud(x: number, y: number): void {
		if (this.positionHud) {
			this.positionHud.textContent = `(${x}, ${y})`
		}
	}
}

// 格子缓存类型
interface CellCache {
	tileType: string
	objectsKey: string
}

// CSS 动画
const style = document.createElement("style")
style.textContent = `
	@keyframes ca-pop-in {
		0% { transform: scale(0.5); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
	@keyframes ca-float {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-2px); }
	}
	@keyframes ca-pulse {
		0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(159, 122, 234, 0.6)); }
		50% { transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(159, 122, 234, 0.9)); }
	}
`
document.head.appendChild(style)
