// ========== 因果链 AI Web 版 - DOM 渲染器（相机跟随版） ==========
// 参考 brain-lab 的相机系统，实现全地图渲染 + 真实相机跟随

import type { LocalView, Cell, GameObject, ActionType } from "./types"

// 渲染配置
const RENDER_CONFIG = {
	cellSize: 36,
	gap: 3,
	borderRadius: 6,
	viewportSize: 320,
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

const DIRECTION_ARROWS: Record<string, string> = {
	"上": "↑",
	"下": "↓",
	"左": "←",
	"右": "→"
}

type ViewMode = "local" | "global"

/**
 * DOM 渲染器 - 相机跟随模式
 * 
 * 架构：
 * 1. 全地图渲染：初始化时渲染所有格子，之后不再重建
 * 2. 相机系统：通过 CSS transform 移动 world-content 实现跟随
 * 3. 增量更新：只更新对象状态发生变化的格子
 * 4. 玩家独立元素：在世界坐标中平滑移动
 */
export class WorldRenderer {
	private container: HTMLElement
	private viewMode: ViewMode = "local"
	
	private viewportEl: HTMLElement | null = null
	private worldContentEl: HTMLElement | null = null
	private agentElement: HTMLElement | null = null
	private agentDirectionEl: HTMLElement | null = null
	private positionHud: HTMLElement | null = null

	private worldWidth: number = 0
	private worldHeight: number = 0
	private gridWidth: number = 0
	private gridHeight: number = 0

	private cameraX: number = 0
	private cameraY: number = 0

	private currentAgentPos: { x: number; y: number } = { x: 0, y: 0 }
	private currentFacing: string = "右"

	private cellCache: Map<string, CellCache> = new Map()
	private cellElements: Map<string, HTMLElement> = new Map()

	private isInitialized: boolean = false

	constructor(containerId: string) {
		const container = document.getElementById(containerId)
		if (!container) {
			throw new Error(`未找到容器元素: ${containerId}`)
		}
		this.container = container
	}

	setViewMode(mode: ViewMode): void {
		this.viewMode = mode
		this.isInitialized = false
		this.cellCache.clear()
		this.cellElements.clear()
	}

	getViewMode(): ViewMode {
		return this.viewMode
	}

	toggleViewMode(): ViewMode {
		this.viewMode = this.viewMode === "local" ? "global" : "local"
		this.isInitialized = false
		this.cellCache.clear()
		this.cellElements.clear()
		return this.viewMode
	}

	render(
		view: LocalView,
		agentPos?: { x: number; y: number },
		facing?: ActionType
	): void {
		const { width, height } = view

		if (facing && facing !== this.currentFacing) {
			this.currentFacing = facing
			this.updateAgentDirection()
		}

		if (agentPos) {
			this.currentAgentPos = agentPos
		}

		if (!this.isInitialized || this.gridWidth !== width || this.gridHeight !== height) {
			this.createWorldStructure(width, height)
			this.renderAllCells(view)
			this.isInitialized = true
		} else {
			this.renderChangedCells(view)
		}

		if (agentPos && this.agentElement) {
			this.moveAgentTo(agentPos.x, agentPos.y)
		}

		if (agentPos) {
			this.updateCamera(agentPos.x, agentPos.y)
			this.updatePositionHud(agentPos.x, agentPos.y)
		}
	}

	private createWorldStructure(width: number, height: number): void {
		this.gridWidth = width
		this.gridHeight = height
		this.cellCache.clear()
		this.cellElements.clear()

		const { cellSize, gap, viewportSize } = RENDER_CONFIG
		
		this.worldWidth = width * (cellSize + gap) - gap
		this.worldHeight = height * (cellSize + gap) - gap

		this.container.innerHTML = ""

		this.container.innerHTML = `
			<div class="ca-world-viewport" style="
				width: ${this.viewMode === "local" ? viewportSize + "px" : "100%"};
				height: ${this.viewMode === "local" ? viewportSize + "px" : "100%"};
				max-width: 100%;
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
					width: ${this.worldWidth}px;
					height: ${this.worldHeight}px;
					transform: translate(0px, 0px);
					transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
					will-change: transform;
				">
					<div class="ca-grid-layer" style="
						width: 100%;
						height: 100%;
						position: relative;
					"></div>
					<div class="ca-objects-layer" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						pointer-events: none;
					"></div>
				</div>
			</div>
		`

		this.viewportEl = this.container.querySelector(".ca-world-viewport") as HTMLElement
		this.worldContentEl = this.container.querySelector(".ca-world-content") as HTMLElement
		this.positionHud = this.container.querySelector(".ca-position-hud") as HTMLElement

		this.createAgentElement()
	}

	private renderAllCells(view: LocalView): void {
		const gridLayer = this.worldContentEl?.querySelector(".ca-grid-layer")
		if (!gridLayer) return

		gridLayer.innerHTML = ""
		const { cellSize, gap } = RENDER_CONFIG

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			
			const left = x * (cellSize + gap)
			const top = y * (cellSize + gap)

			const cellEl = document.createElement("div")
			cellEl.className = "ca-cell"
			cellEl.dataset.x = String(x)
			cellEl.dataset.y = String(y)
			cellEl.style.cssText = `
				position: absolute;
				left: ${left}px;
				top: ${top}px;
				width: ${cellSize}px;
				height: ${cellSize}px;
				border-radius: ${RENDER_CONFIG.borderRadius}px;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 20px;
			`

			this.applyCellStyle(cellEl, cell, x, y)
			this.renderCellContent(cellEl, cell)

			gridLayer.appendChild(cellEl)
			this.cellElements.set(key, cellEl)
			this.cellCache.set(key, this.createCellCache(cell))
		}
	}

	private renderChangedCells(view: LocalView): void {
		for (const [key, cell] of view.cells) {
			const cached = this.cellCache.get(key)
			
			if (!cached || this.hasCellChanged(cached, cell)) {
				const cellEl = this.cellElements.get(key)
				if (cellEl) {
					const [x, y] = key.split(",").map(Number)
					this.applyCellStyle(cellEl, cell, x, y)
					this.renderCellContent(cellEl, cell)
					this.cellCache.set(key, this.createCellCache(cell))
				}
			}
		}
	}

	private applyCellStyle(el: HTMLElement, cell: Cell | undefined, x: number, y: number): void {
		if (!cell) {
			this.applyVoidStyle(el)
			return
		}

		switch (cell.tile.type) {
		case "wall":
			this.applyWallStyle(el)
			break
		case "void":
			this.applyVoidStyle(el)
			break
		default:
			this.applyFloorStyle(el, x, y)
		}
	}

	private renderCellContent(el: HTMLElement, cell: Cell | undefined): void {
		el.innerHTML = ""

		if (!cell || cell.objects.length === 0) return

		const obj = cell.objects.find(o => o.type !== "agent")
		if (!obj) return

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
		case "钥匙":
			objEl.textContent = "🔑"
			objEl.style.filter = "drop-shadow(0 1px 3px rgba(246, 173, 85, 0.5))"
			objEl.style.animation = "ca-float 2s ease-in-out infinite"
			el.appendChild(objEl)
			break
		case "门":
			if (obj.state?.open) {
				el.style.background = `${RENDER_CONFIG.colors.doorOpen}25`
				el.style.border = `2px solid ${RENDER_CONFIG.colors.doorOpen}`
				objEl.textContent = "🚪"
				objEl.style.opacity = "0.6"
				objEl.style.filter = "grayscale(0.3)"
			} else {
				el.style.background = `repeating-linear-gradient(45deg, ${RENDER_CONFIG.colors.doorClosed}, ${RENDER_CONFIG.colors.doorClosed} 4px, #9b2c2c 4px, #9b2c2c 8px)`
				el.style.border = `2px solid ${RENDER_CONFIG.colors.doorClosed}`
				objEl.textContent = "🔒"
				objEl.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
			}
			el.appendChild(objEl)
			break
		case "终点":
			el.style.background = `${RENDER_CONFIG.colors.goal}20`
			el.style.border = `2px solid ${RENDER_CONFIG.colors.goal}`
			el.style.boxShadow = `0 0 12px ${RENDER_CONFIG.colors.goal}40`
			objEl.textContent = "🏁"
			objEl.style.filter = "drop-shadow(0 0 6px rgba(159, 122, 234, 0.8))"
			objEl.style.animation = "ca-pulse 1.5s ease-in-out infinite"
			el.appendChild(objEl)
			break
		}
	}

	private createAgentElement(): void {
		if (!this.worldContentEl) return

		const { cellSize } = RENDER_CONFIG

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
			transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
			filter: drop-shadow(0 2px 6px rgba(78, 161, 211, 0.5));
			pointer-events: none;
			will-change: transform;
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

		this.worldContentEl.appendChild(this.agentElement)
	}

	private moveAgentTo(x: number, y: number): void {
		if (!this.agentElement) return

		const { cellSize, gap } = RENDER_CONFIG
		const left = x * (cellSize + gap)
		const top = y * (cellSize + gap)

		// 使用 transform 代替 left/top，与相机系统保持一致，确保完全同步
		this.agentElement.style.transform = `translate(${left}px, ${top}px)`
	}

	private updateCamera(heroX: number, heroY: number): void {
		if (!this.viewportEl || !this.worldContentEl) return

		const { cellSize, gap } = RENDER_CONFIG
		
		const heroPixelX = heroX * (cellSize + gap)
		const heroPixelY = heroY * (cellSize + gap)

		const viewportWidth = this.viewportEl.clientWidth
		const viewportHeight = this.viewportEl.clientHeight

		this.cameraX = heroPixelX - viewportWidth / 2 + cellSize / 2
		this.cameraY = heroPixelY - viewportHeight / 2 + cellSize / 2

		this.worldContentEl.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`
	}

	private updateAgentDirection(): void {
		if (this.agentDirectionEl && this.currentFacing in DIRECTION_ARROWS) {
			this.agentDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
		}
	}

	private updatePositionHud(x: number, y: number): void {
		if (this.positionHud) {
			this.positionHud.textContent = `(${x}, ${y})`
		}
	}

	private applyWallStyle(el: HTMLElement): void {
		const { colors } = RENDER_CONFIG
		el.style.background = `linear-gradient(145deg, ${colors.wallTop} 0%, ${colors.wall} 50%, ${colors.wallSide} 100%)`
		el.style.border = "1px solid #4a5568"
		el.style.boxShadow = "inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)"
	}

	private applyFloorStyle(el: HTMLElement, x: number, y: number): void {
		const { colors } = RENDER_CONFIG
		const isAlt = (x + y) % 2 === 1
		const baseColor = isAlt ? colors.floorAlt : colors.floor
		el.style.background = baseColor
		el.style.border = `1px solid ${isAlt ? "#2a3540" : "#263038"}`
		el.style.boxShadow = "none"
	}

	private applyVoidStyle(el: HTMLElement): void {
		const baseColor = "#151b26"
		el.style.background = baseColor
		el.style.border = "1px solid #2a3545"
		el.style.boxShadow = "none"
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

	private hasCellChanged(cached: CellCache, current: Cell | undefined): boolean {
		if (!current) return cached.tileType !== "void"
		if (cached.tileType !== current.tile.type) return true

		const currentObjects = current.objects
			.filter(o => o.type !== "agent")
			.map(o => `${o.type}:${JSON.stringify(o.state)}`)
			.sort()
			.join(",")

		return cached.objectsKey !== currentObjects
	}

	private createCellCache(cell: Cell | undefined): CellCache {
		if (!cell) {
			return { tileType: "void", objectsKey: "" }
		}

		const objectsKey = cell.objects
			.filter(o => o.type !== "agent")
			.map(o => `${o.type}:${JSON.stringify(o.state)}`)
			.sort()
			.join(",")

		return { tileType: cell.tile.type, objectsKey }
	}
}

interface CellCache {
	tileType: string
	objectsKey: string
}

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
