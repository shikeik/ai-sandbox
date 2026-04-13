// ========== 因果链 AI Web 版 - DOM 渲染器（层级系统版） ==========
// 层级架构（从低到高）：
// Layer 0: 虚空/背景
// Layer 1: 方块（地面、墙、门）
// Layer 2: 实体（玩家）
// Layer 3: 道具（钥匙）

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

// ========== 层级定义 ==========
enum RenderLayer {
	VOID = 0,
	BLOCK = 10,
	ENTITY = 20,
	ITEM = 30,
}

const OBJECT_LAYER_MAP: Record<string, RenderLayer> = {
	"墙": RenderLayer.BLOCK,
	"门": RenderLayer.BLOCK,
	"agent": RenderLayer.ENTITY,
	"钥匙": RenderLayer.ITEM,
	"终点": RenderLayer.BLOCK,
}

type ViewMode = "local" | "global"

export class WorldRenderer {
	private container: HTMLElement
	private viewMode: ViewMode = "local"
	
	private viewportEl: HTMLElement | null = null
	private worldContentEl: HTMLElement | null = null
	private positionHud: HTMLElement | null = null

	private worldWidth: number = 0
	private worldHeight: number = 0
	private gridWidth: number = 0
	private gridHeight: number = 0

	private currentAgentPos: { x: number; y: number } = { x: 0, y: 0 }
	private currentFacing: string = "右"

	private dynamicElements: Map<string, HTMLElement> = new Map()
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
		this.dynamicElements.clear()
	}

	getViewMode(): ViewMode {
		return this.viewMode
	}

	toggleViewMode(): ViewMode {
		this.viewMode = this.viewMode === "local" ? "global" : "local"
		this.isInitialized = false
		this.dynamicElements.clear()
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
			this.updatePlayerDirection()
		}

		if (agentPos) {
			this.currentAgentPos = agentPos
		}

		if (!this.isInitialized || this.gridWidth !== width || this.gridHeight !== height) {
			this.createWorldStructure(width, height)
			this.renderAllLayers(view)
			this.isInitialized = true
			if (agentPos) {
				this.setPlayerImmediate(agentPos.x, agentPos.y)
				this.syncCamera()
			}
		} else {
			this.updateDynamicLayers(view)
			if (agentPos) {
				this.movePlayerTo(agentPos.x, agentPos.y)
			}
		}

		if (agentPos) {
			this.updatePositionHud(agentPos.x, agentPos.y)
		}
	}

	private createWorldStructure(width: number, height: number): void {
		this.gridWidth = width
		this.gridHeight = height
		this.dynamicElements.clear()

		const { cellSize, gap, viewportSize } = RENDER_CONFIG
		
		this.worldWidth = width * (cellSize + gap) - gap
		this.worldHeight = height * (cellSize + gap) - gap

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
					will-change: transform;
				">
					<div class="ca-layer-blocks" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: ${RenderLayer.BLOCK};
					"></div>
					<div class="ca-layer-entities" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: ${RenderLayer.ENTITY};
						pointer-events: none;
					"></div>
					<div class="ca-layer-items" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: ${RenderLayer.ITEM};
						pointer-events: none;
					"></div>
				</div>
			</div>
		`

		this.viewportEl = this.container.querySelector(".ca-world-viewport") as HTMLElement
		this.worldContentEl = this.container.querySelector(".ca-world-content") as HTMLElement
		this.positionHud = this.container.querySelector(".ca-position-hud") as HTMLElement
	}

	private renderAllLayers(view: LocalView): void {
		const blocksLayer = this.worldContentEl?.querySelector(".ca-layer-blocks")
		const entitiesLayer = this.worldContentEl?.querySelector(".ca-layer-entities")
		const itemsLayer = this.worldContentEl?.querySelector(".ca-layer-items")
		
		if (!blocksLayer || !entitiesLayer || !itemsLayer) return

		const { cellSize, gap } = RENDER_CONFIG

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			const left = x * (cellSize + gap)
			const top = y * (cellSize + gap)

			this.renderBlockCell(blocksLayer as HTMLElement, cell, x, y, left, top)

			const dynamicObjects = cell.objects.filter(o => o.type !== "agent" && OBJECT_LAYER_MAP[o.type] > RenderLayer.BLOCK)
			
			for (const obj of dynamicObjects) {
				const layer = OBJECT_LAYER_MAP[obj.type]
				const container = layer === RenderLayer.ENTITY ? entitiesLayer : itemsLayer
				this.renderDynamicObject(container as HTMLElement, obj, x, y, left, top)
			}
		}

		this.createPlayerEntity(entitiesLayer as HTMLElement)
	}

	private updateDynamicLayers(view: LocalView): void {
		const blocksLayer = this.worldContentEl?.querySelector(".ca-layer-blocks")
		const itemsLayer = this.worldContentEl?.querySelector(".ca-layer-items")
		
		if (!blocksLayer || !itemsLayer) return

		const { cellSize, gap } = RENDER_CONFIG
		const currentDynamicKeys = new Set<string>()

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			
			this.updateBlockCell(key, cell)

			const dynamicObjects = cell.objects.filter(o => o.type !== "agent" && OBJECT_LAYER_MAP[o.type] > RenderLayer.BLOCK)
			
			for (const obj of dynamicObjects) {
				const objKey = `${obj.type}:${x},${y}`
				currentDynamicKeys.add(objKey)

				let el = this.dynamicElements.get(objKey)
				if (!el) {
					const left = x * (cellSize + gap)
					const top = y * (cellSize + gap)
					el = this.renderDynamicObject(itemsLayer as HTMLElement, obj, x, y, left, top)
				}
			}
		}

		for (const [key, el] of this.dynamicElements) {
			if (!currentDynamicKeys.has(key)) {
				el.style.animation = "ca-pop-out 0.2s ease-in forwards"
				setTimeout(() => el.remove(), 200)
				this.dynamicElements.delete(key)
			}
		}
	}

	private blockCellElements: Map<string, HTMLElement> = new Map()
	private blockCellCache: Map<string, { tileType: string; doorOpen?: boolean }> = new Map()

	private renderBlockCell(container: HTMLElement, cell: Cell | undefined, x: number, y: number, left: number, top: number): void {
		const { cellSize } = RENDER_CONFIG
		const key = `${x},${y}`

		const el = document.createElement("div")
		el.className = "ca-block"
		el.dataset.key = key
		el.style.cssText = `
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

		this.applyBlockStyle(el, cell, x, y)
		this.renderBlockContent(el, cell)

		container.appendChild(el)
		this.blockCellElements.set(key, el)

		const doorObj = cell?.objects.find(o => o.type === "门")
		this.blockCellCache.set(key, {
			tileType: cell?.tile.type || "void",
			doorOpen: doorObj?.state?.open as boolean | undefined
		})
	}

	private updateBlockCell(key: string, cell: Cell | undefined): void {
		const el = this.blockCellElements.get(key)
		if (!el) return

		const cached = this.blockCellCache.get(key)
		const doorObj = cell?.objects.find(o => o.type === "门")
		const currentDoorOpen = doorObj?.state?.open as boolean | undefined

		const doorStateChanged = cached && cached.doorOpen !== currentDoorOpen && currentDoorOpen !== undefined
		const isOpening = doorStateChanged && currentDoorOpen === true

		const [x, y] = key.split(",").map(Number)

		if (isOpening) {
			el.style.animation = "ca-pop-out 0.15s ease-in forwards"
			
			setTimeout(() => {
				this.applyBlockStyle(el, cell, x, y)
				this.renderBlockContent(el, cell)
				el.style.animation = "ca-pop-in 0.25s ease-out"
				setTimeout(() => {
					el.style.animation = ""
				}, 250)
			}, 150)
		} else {
			this.applyBlockStyle(el, cell, x, y)
			this.renderBlockContent(el, cell)
		}

		this.blockCellCache.set(key, {
			tileType: cell?.tile.type || "void",
			doorOpen: currentDoorOpen
		})
	}

	private applyBlockStyle(el: HTMLElement, cell: Cell | undefined, x: number, y: number): void {
		if (!cell || cell.tile.type === "void") {
			this.applyVoidStyle(el)
			return
		}

		switch (cell.tile.type) {
		case "wall":
			this.applyWallStyle(el)
			break
		default:
			this.applyFloorStyle(el, x, y)
		}
	}

	private renderBlockContent(el: HTMLElement, cell: Cell | undefined): void {
		el.innerHTML = ""

		if (!cell || cell.objects.length === 0) return

		const blockObjects = cell.objects.filter(o => {
			const layer = OBJECT_LAYER_MAP[o.type]
			return layer === RenderLayer.BLOCK
		})

		for (const obj of blockObjects) {
			const objEl = document.createElement("div")
			objEl.className = "ca-block-object"
			objEl.style.cssText = `
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 22px;
				pointer-events: none;
			`

			switch (obj.type) {
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
	}

	private renderDynamicObject(container: HTMLElement, obj: GameObject, x: number, y: number, left: number, top: number): HTMLElement {
		const { cellSize } = RENDER_CONFIG
		const key = `${obj.type}:${x},${y}`

		const el = document.createElement("div")
		el.className = `ca-dynamic ca-${obj.type}`
		el.dataset.key = key
		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${cellSize}px;
			height: ${cellSize}px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 22px;
			pointer-events: none;
			animation: ca-pop-in 0.3s ease-out;
		`

		switch (obj.type) {
		case "钥匙":
			el.textContent = "🔑"
			el.style.filter = "drop-shadow(0 1px 3px rgba(246, 173, 85, 0.5))"
			el.style.animation = "ca-float 2s ease-in-out infinite, ca-pop-in 0.3s ease-out"
			break
		}

		container.appendChild(el)
		this.dynamicElements.set(key, el)
		return el
	}

	// ========== 玩家实体 ==========

	private playerElement: HTMLElement | null = null
	private playerDirectionEl: HTMLElement | null = null

	private createPlayerEntity(container: HTMLElement): void {
		const { cellSize } = RENDER_CONFIG

		this.playerElement = document.createElement("div")
		this.playerElement.className = "ca-player"
		this.playerElement.style.cssText = `
			position: absolute;
			width: ${cellSize}px;
			height: ${cellSize}px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 22px;
			z-index: 1;
			filter: drop-shadow(0 2px 6px rgba(78, 161, 211, 0.5));
			pointer-events: none;
		`

		const robotIcon = document.createElement("span")
		robotIcon.textContent = "🤖"
		robotIcon.style.cssText = `
			display: block;
			transform-origin: center;
		`
		this.playerElement.appendChild(robotIcon)

		this.playerDirectionEl = document.createElement("span")
		this.playerDirectionEl.className = "ca-player-direction"
		this.playerDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
		this.playerDirectionEl.style.cssText = `
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
		this.playerElement.appendChild(this.playerDirectionEl)

		container.appendChild(this.playerElement)
	}

	/** 直接设置玩家位置（无动画，用于初始化） */
	private setPlayerImmediate(x: number, y: number): void {
		if (!this.playerElement) return

		const { cellSize, gap } = RENDER_CONFIG
		const left = x * (cellSize + gap)
		const top = y * (cellSize + gap)

		this.playerElement.style.transition = "none"
		this.playerElement.style.left = `${left}px`
		this.playerElement.style.top = `${top}px`
	}

	private cameraRafId: number | null = null

	/** 移动玩家到目标位置（带动画），并启动相机实时跟随 */
	private movePlayerTo(x: number, y: number): void {
		if (!this.playerElement) return

		const { cellSize, gap } = RENDER_CONFIG
		const left = x * (cellSize + gap)
		const top = y * (cellSize + gap)

		// 设置玩家目标位置（CSS transition 会处理插值）
		this.playerElement.style.transition = "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
		this.playerElement.style.left = `${left}px`
		this.playerElement.style.top = `${top}px`

		// 启动相机跟随
		this.startCameraTracking()
	}

	/** 
	 * 启动相机实时跟踪
	 * 
	 * 核心逻辑：
	 * 1. 读取玩家实际渲染位置：offsetLeft/offsetTop（相对于 world-content）
	 * 2. 玩家中心在世界坐标系中的位置 = 渲染位置 + 格子半宽
	 * 3. 相机偏移 = 视口中心 - 玩家中心
	 * 4. world-content 应用偏移（负值）
	 */
	private startCameraTracking(): void {
		if (this.cameraRafId) return

		const { cellSize } = RENDER_CONFIG

		const track = () => {
			if (!this.playerElement || !this.viewportEl || !this.worldContentEl) return

			// 读取玩家实际渲染位置（CSS transition 插值后的值）
			// offsetLeft/Top 返回相对于 offsetParent（world-content）的位置
			const playerRenderX = this.playerElement.offsetLeft
			const playerRenderY = this.playerElement.offsetTop

			// 玩家中心在世界坐标系中的位置
			const playerCenterX = playerRenderX + cellSize / 2
			const playerCenterY = playerRenderY + cellSize / 2

			// 视口中心
			const viewportWidth = this.viewportEl.clientWidth
			const viewportHeight = this.viewportEl.clientHeight
			const viewportCenterX = viewportWidth / 2
			const viewportCenterY = viewportHeight / 2

			// 相机需要应用的偏移：让视口中心对准玩家中心
			// 如果玩家在 (100, 100)，视口中心是 (160, 160)，那么 world-content 需要向左上移动
			// offset = viewportCenter - playerCenter = 160 - 100 = 60
			// 但 world-content 已经在 (0,0)，所以 transform = translate(60, 60)？不对
			
			// 重新理解：
			// world-content 在 (0,0) 时，玩家在 world-content 中的 (left, top) 位置
			// 玩家在屏幕上的绝对位置 = world-content 位置 + 玩家在 world-content 中的位置
			// 我们希望玩家中心在屏幕中心，即：
			// cameraOffset + playerCenterX = viewportCenterX
			// cameraOffset = viewportCenterX - playerCenterX
			const cameraOffsetX = viewportCenterX - playerCenterX
			const cameraOffsetY = viewportCenterY - playerCenterY

			// 应用相机变换（直接设置，无 transition，实现实时跟随）
			this.worldContentEl.style.transform = `translate(${cameraOffsetX}px, ${cameraOffsetY}px)`

			this.cameraRafId = requestAnimationFrame(track)
		}

		this.cameraRafId = requestAnimationFrame(track)
	}

	/** 同步相机到玩家当前位置（用于初始化） */
	private syncCamera(): void {
		if (!this.playerElement || !this.viewportEl || !this.worldContentEl) return

		// 取消 RAF
		if (this.cameraRafId) {
			cancelAnimationFrame(this.cameraRafId)
			this.cameraRafId = null
		}

		const { cellSize } = RENDER_CONFIG

		// 强制重绘确保 offsetLeft/Top 是最新值
		void this.playerElement.offsetHeight

		const playerRenderX = this.playerElement.offsetLeft
		const playerRenderY = this.playerElement.offsetTop

		const playerCenterX = playerRenderX + cellSize / 2
		const playerCenterY = playerRenderY + cellSize / 2

		const viewportWidth = this.viewportEl.clientWidth
		const viewportHeight = this.viewportEl.clientHeight

		const cameraOffsetX = viewportWidth / 2 - playerCenterX
		const cameraOffsetY = viewportHeight / 2 - playerCenterY

		this.worldContentEl.style.transform = `translate(${cameraOffsetX}px, ${cameraOffsetY}px)`
	}

	private updatePlayerDirection(): void {
		if (this.playerDirectionEl && this.currentFacing in DIRECTION_ARROWS) {
			this.playerDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
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
}

const style = document.createElement("style")
style.textContent = `
	@keyframes ca-pop-in {
		0% { transform: scale(0.5); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
	@keyframes ca-pop-out {
		0% { transform: scale(1); opacity: 1; }
		100% { transform: scale(0.5); opacity: 0; }
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
