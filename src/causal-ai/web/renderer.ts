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
	VOID = 0,      // 虚空/背景
	BLOCK = 10,    // 方块：地面、墙、门
	ENTITY = 20,   // 实体：玩家
	ITEM = 30,     // 道具：钥匙
}

// 对象类型到层级的映射
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

	private cameraX: number = 0
	private cameraY: number = 0

	private currentAgentPos: { x: number; y: number } = { x: 0, y: 0 }
	private currentFacing: string = "右"

	// 动态元素缓存（方块层之上的对象）
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
		} else {
			this.updateDynamicLayers(view)
		}

		if (agentPos) {
			if (!this.isInitialized) {
				this.setCameraImmediate(agentPos.x, agentPos.y)
			} else {
				this.updateCamera(agentPos.x, agentPos.y)
			}
			this.updatePositionHud(agentPos.x, agentPos.y)
		}
	}

	// ========== 世界结构创建 ==========

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
					transform: translate(0px, 0px);
					will-change: transform;
				">
					<!-- Layer 0: 虚空/背景（由方块层透明处显示） -->
					<!-- Layer 1: 方块层 -->
					<div class="ca-layer-blocks" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: ${RenderLayer.BLOCK};
					"></div>
					<!-- Layer 2: 实体层 -->
					<div class="ca-layer-entities" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: ${RenderLayer.ENTITY};
						pointer-events: none;
					"></div>
					<!-- Layer 3: 道具层 -->
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

	// ========== 分层渲染 ==========

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

			// 渲染方块层（地形 + 门等方块对象）
			this.renderBlockCell(blocksLayer as HTMLElement, cell, x, y, left, top)

			// 收集该格子的动态对象
			const dynamicObjects = cell.objects.filter(o => o.type !== "agent" && OBJECT_LAYER_MAP[o.type] > RenderLayer.BLOCK)
			
			for (const obj of dynamicObjects) {
				const layer = OBJECT_LAYER_MAP[obj.type]
				const container = layer === RenderLayer.ENTITY ? entitiesLayer : itemsLayer
				this.renderDynamicObject(container as HTMLElement, obj, x, y, left, top)
			}
		}

		// 创建玩家实体
		this.createPlayerEntity(entitiesLayer as HTMLElement)
	}

	private updateDynamicLayers(view: LocalView): void {
		const entitiesLayer = this.worldContentEl?.querySelector(".ca-layer-entities")
		const itemsLayer = this.worldContentEl?.querySelector(".ca-layer-items")
		
		if (!entitiesLayer || !itemsLayer) return

		const { cellSize, gap } = RENDER_CONFIG
		
		// 收集当前应该存在的动态对象
		const currentDynamicKeys = new Set<string>()

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			const left = x * (cellSize + gap)
			const top = y * (cellSize + gap)

			// 更新方块层（处理门状态变化等）
			this.updateBlockCell(key, cell)

			// 处理动态对象
			const dynamicObjects = cell.objects.filter(o => o.type !== "agent" && OBJECT_LAYER_MAP[o.type] > RenderLayer.BLOCK)
			
			for (const obj of dynamicObjects) {
				const objKey = `${obj.type}:${x},${y}`
				currentDynamicKeys.add(objKey)

				const layer = OBJECT_LAYER_MAP[obj.type]
				const container = layer === RenderLayer.ENTITY ? entitiesLayer : itemsLayer
				
				// 检查是否已存在
				let el = this.dynamicElements.get(objKey)
				if (!el) {
					el = this.renderDynamicObject(container as HTMLElement, obj, x, y, left, top)
				}
			}
		}

		// 处理不再存在的动态对象（播放消失动画）
		for (const [key, el] of this.dynamicElements) {
			if (!currentDynamicKeys.has(key)) {
				// 播放 pop-out 动画后移除
				el.style.animation = "ca-pop-out 0.3s ease-in forwards"
				setTimeout(() => {
					el.remove()
				}, 300)
				this.dynamicElements.delete(key)
			}
		}

		// 更新玩家位置
		this.updatePlayerPosition()
	}

	// ========== 方块层渲染 ==========

	private blockCellElements: Map<string, HTMLElement> = new Map()
	private blockCellCache: Map<string, { tileType: string; doorOpen?: boolean }> = new Map()

	private renderBlockCell(
		container: HTMLElement,
		cell: Cell | undefined,
		x: number,
		y: number,
		left: number,
		top: number
	): void {
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

		// 初始化缓存
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

		// 检测门状态变化
		const doorStateChanged = cached && cached.doorOpen !== currentDoorOpen && currentDoorOpen !== undefined
		const isOpening = doorStateChanged && currentDoorOpen === true

		const [x, y] = key.split(",").map(Number)

		// 门状态变化时：锁先 pop-out，然后渲染门并 pop-in
		if (isOpening) {
			// 锁 pop-out 动画
			el.style.animation = "ca-pop-out 0.2s ease-in forwards"
			
			setTimeout(() => {
				// 更新为门
				this.applyBlockStyle(el, cell, x, y)
				this.renderBlockContent(el, cell)
				// 门 pop-in 动画
				el.style.animation = "ca-pop-in 0.3s ease-out"
				setTimeout(() => {
					el.style.animation = ""
				}, 300)
			}, 200)
		} else {
			// 普通更新（无动画）
			this.applyBlockStyle(el, cell, x, y)
			this.renderBlockContent(el, cell)
		}

		// 更新缓存
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

		// 只渲染方块层的对象
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

	// ========== 动态对象渲染 ==========

	private renderDynamicObject(
		container: HTMLElement,
		obj: GameObject,
		x: number,
		y: number,
		left: number,
		top: number
	): HTMLElement {
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
		this.updatePlayerPosition()
	}

	private updatePlayerPosition(): void {
		if (!this.playerElement) return

		const { cellSize, gap } = RENDER_CONFIG
		const { x, y } = this.currentAgentPos
		const left = x * (cellSize + gap)
		const top = y * (cellSize + gap)

		this.playerElement.style.left = `${left}px`
		this.playerElement.style.top = `${top}px`
	}

	private updatePlayerDirection(): void {
		if (this.playerDirectionEl && this.currentFacing in DIRECTION_ARROWS) {
			this.playerDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
		}
	}

	// ========== 相机系统 ==========

	private updateCamera(heroX: number, heroY: number): void {
		if (!this.viewportEl || !this.worldContentEl) return

		const { cellSize, gap } = RENDER_CONFIG
		
		const heroPixelX = heroX * (cellSize + gap)
		const heroPixelY = heroY * (cellSize + gap)

		const viewportWidth = this.viewportEl.clientWidth
		const viewportHeight = this.viewportEl.clientHeight

		this.cameraX = heroPixelX - viewportWidth / 2 + cellSize / 2
		this.cameraY = heroPixelY - viewportHeight / 2 + cellSize / 2

		// 直接同步，无过渡动画，避免滞后
		this.worldContentEl.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`
	}

	private setCameraImmediate(heroX: number, heroY: number): void {
		if (!this.viewportEl || !this.worldContentEl) return

		const { cellSize, gap } = RENDER_CONFIG
		
		const heroPixelX = heroX * (cellSize + gap)
		const heroPixelY = heroY * (cellSize + gap)

		const viewportWidth = this.viewportEl.clientWidth
		const viewportHeight = this.viewportEl.clientHeight

		this.cameraX = heroPixelX - viewportWidth / 2 + cellSize / 2
		this.cameraY = heroPixelY - viewportHeight / 2 + cellSize / 2

		this.worldContentEl.style.transition = "none"
		this.worldContentEl.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`
	}

	private updatePositionHud(x: number, y: number): void {
		if (this.positionHud) {
			this.positionHud.textContent = `(${x}, ${y})`
		}
	}

	// ========== 样式方法 ==========

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

// CSS 动画
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
