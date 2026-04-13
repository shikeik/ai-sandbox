// ========== 因果链 AI Web 版 - DOM 渲染器（分层架构版） ==========
// 层级架构（从低到高）：
// Layer 0: 虚空/背景
// Layer 1: 方块（地面、墙、门、终点）
// Layer 2: 实体（玩家）
// Layer 3: 道具（钥匙）

import type { LocalView, Action } from "../types"
import { injectStyles } from "./styles"
import { Camera } from "./camera"
import { PlayerRenderer } from "./player"
import { BlockLayer } from "./block-layer"
import { ItemLayer } from "./item-layer"

const RENDER_CONFIG = {
	cellSize: 36,
	gap: 3,
	borderRadius: 6,
	viewportSize: 320,
	colors: {
		background: "#0a0a14"
	}
} as const

type ViewMode = "local" | "global"

export class WorldRenderer {
	private container: HTMLElement
	private viewMode: ViewMode = "local"

	private viewportEl: HTMLElement | null = null
	private worldContentEl: HTMLElement | null = null
	private positionHud: HTMLElement | null = null

	private gridWidth: number = 0
	private gridHeight: number = 0

	private currentAgentPos: { x: number; y: number } = { x: 0, y: 0 }
	private currentFacing: string = "右"

	private isInitialized: boolean = false
	private camera: Camera | null = null
	private playerRenderer: PlayerRenderer | null = null
	private blockLayer: BlockLayer | null = null
	private itemLayer: ItemLayer | null = null

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
	}

	getViewMode(): ViewMode {
		return this.viewMode
	}

	toggleViewMode(): ViewMode {
		this.viewMode = this.viewMode === "local" ? "global" : "local"
		this.isInitialized = false
		return this.viewMode
	}

	render(
		view: LocalView,
		agentPos?: { x: number; y: number },
		facing?: Action
	): void {
		const { width, height } = view

		if (facing && facing !== this.currentFacing) {
			this.currentFacing = facing
			this.playerRenderer?.updateDirection(facing)
		}

		if (agentPos) {
			this.currentAgentPos = agentPos
		}

		if (!this.isInitialized || this.gridWidth !== width || this.gridHeight !== height) {
			this.createWorldStructure(width, height)
			this.renderAllLayers(view)
			this.isInitialized = true
			if (agentPos) {
				this.playerRenderer?.setImmediate(agentPos.x, agentPos.y, RENDER_CONFIG.gap)
				this.camera?.sync()
			}
		} else {
			this.updateLayers(view)
			if (agentPos) {
				this.playerRenderer?.moveTo(agentPos.x, agentPos.y, RENDER_CONFIG.gap)
				this.camera?.startTracking()
			}
		}

		if (agentPos) {
			this.updatePositionHud(agentPos.x, agentPos.y)
		}
	}

	private createWorldStructure(width: number, height: number): void {
		this.gridWidth = width
		this.gridHeight = height

		const { cellSize, gap, viewportSize, colors } = RENDER_CONFIG
		const worldWidth = width * (cellSize + gap) - gap
		const worldHeight = height * (cellSize + gap) - gap

		this.container.innerHTML = `
			<div class="ca-world-viewport" style="
				width: ${this.viewMode === "local" ? viewportSize + "px" : "100%"};
				height: ${this.viewMode === "local" ? viewportSize + "px" : "100%"};
				max-width: 100%;
				overflow: hidden;
				position: relative;
				background: ${colors.background};
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
					width: ${worldWidth}px;
					height: ${worldHeight}px;
					will-change: transform;
				">
					<div class="ca-layer-blocks" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: 10;
					"></div>
					<div class="ca-layer-entities" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: 20;
						pointer-events: none;
					"></div>
					<div class="ca-layer-items" style="
						width: 100%;
						height: 100%;
						position: absolute;
						top: 0;
						left: 0;
						z-index: 30;
						pointer-events: none;
					"></div>
				</div>
			</div>
		`

		this.viewportEl = this.container.querySelector(".ca-world-viewport") as HTMLElement
		this.worldContentEl = this.container.querySelector(".ca-world-content") as HTMLElement
		this.positionHud = this.container.querySelector(".ca-position-hud") as HTMLElement

		const blocksLayer = this.worldContentEl.querySelector(".ca-layer-blocks") as HTMLElement
		const entitiesLayer = this.worldContentEl.querySelector(".ca-layer-entities") as HTMLElement
		const itemsLayer = this.worldContentEl.querySelector(".ca-layer-items") as HTMLElement

		this.blockLayer = new BlockLayer(blocksLayer, cellSize, RENDER_CONFIG.borderRadius)
		this.itemLayer = new ItemLayer(itemsLayer, cellSize)
		this.playerRenderer = new PlayerRenderer(entitiesLayer, cellSize)
		this.camera = new Camera(
			this.viewportEl,
			this.worldContentEl,
			() => this.playerRenderer?.getElement() ?? null,
			cellSize
		)
	}

	private renderAllLayers(view: LocalView): void {
		this.blockLayer?.renderAll(view, RENDER_CONFIG.gap)
		this.itemLayer?.renderAll(view, RENDER_CONFIG.gap)
		this.playerRenderer?.create(this.currentFacing)
	}

	private updateLayers(view: LocalView): void {
		this.blockLayer?.update(view)
		this.itemLayer?.update(view, RENDER_CONFIG.gap)
	}

	private updatePositionHud(x: number, y: number): void {
		if (this.positionHud) {
			this.positionHud.textContent = `(${x}, ${y})`
		}
	}
}

// 注入全局动画样式
injectStyles()
