// ========== 因果链 AI Web 版 - DOM 渲染器 ==========
// 参考 brain-lab 的视觉风格，使用 DOM + CSS 实现更美观的渲染

import type { LocalView, Cell, GameObject, ActionType } from "./types"

// 渲染配置
const RENDER_CONFIG = {
	cellSize: 36,      // 格子大小（像素）
	gap: 3,            // 格子间距（像素）
	borderRadius: 6,   // 格子圆角
	colors: {
		background: "#0a0a14",    // 深色背景
		wall: "#3d4856",          // 墙 - 深灰蓝
		wallTop: "#5a6a7d",       // 墙顶部高光
		wallSide: "#2d3744",      // 墙侧面阴影
		floor: "#1e2630",         // 地板 - 深色
		floorAlt: "#232d38",      // 地板交替色
		void: "#050508",          // 虚空 - 比背景更深
		voidBorder: "#0a0a0f",    // 虚空边框
		agent: "#4ea1d3",         // 玩家 - 蓝色
		key: "#f6ad55",           // 钥匙 - 橙色
		doorClosed: "#c53030",    // 门关 - 深红色
		doorOpen: "#38a169",      // 门开 - 绿色
		goal: "#805ad5",          // 终点 - 紫色
	}
} as const

// 方向箭头映射
const DIRECTION_ARROWS: Record<string, string> = {
	"上": "↑",
	"下": "↓",
	"左": "←",
	"右": "→"
}



// 视野类型
type ViewMode = "local" | "global"

/**
 * DOM 渲染器 - 负责将世界状态渲染为 DOM
 * 参考 brain-lab 的视觉设计
 */
export class WorldRenderer {
	private container: HTMLElement
	private viewMode: ViewMode = "local"
	private worldContent: HTMLElement | null = null
	private agentElement: HTMLElement | null = null
	private agentDirectionEl: HTMLElement | null = null
	private positionHud: HTMLElement | null = null

	// 当前世界尺寸（格子数）
	private currentWidth: number = 0
	private currentHeight: number = 0
	// 当前视野尺寸
	private viewWidth: number = 0
	private viewHeight: number = 0
	// 当前玩家朝向
	private currentFacing: string = "右"

	constructor(containerId: string) {
		const container = document.getElementById(containerId)
		if (!container) {
			throw new Error(`未找到容器元素: ${containerId}`)
		}
		this.container = container
	}

	// 设置视野模式
	setViewMode(mode: ViewMode): void {
		this.viewMode = mode
	}

	// 获取当前视野模式
	getViewMode(): ViewMode {
		return this.viewMode
	}

	// 切换视野模式
	toggleViewMode(): ViewMode {
		this.viewMode = this.viewMode === "local" ? "global" : "local"
		return this.viewMode
	}

	// 渲染视野
	render(view: LocalView, agentPos?: { x: number; y: number }, facing?: ActionType): void {
		// 更新朝向
		if (facing) {
			this.currentFacing = facing
			this.updateAgentDirection()
		}

		if (this.viewMode === "local") {
			this.renderLocalView(view)
		} else {
			this.renderGlobalView(view, agentPos)
		}
	}

	// 渲染局部视野
	private renderLocalView(view: LocalView): void {
		const { width, height } = view
		this.viewWidth = width
		this.viewHeight = height

		// 检查是否需要重新创建世界（尺寸变化时）
		if (!this.worldContent || this.currentWidth !== width || this.currentHeight !== height) {
			this.createWorldStructure(width, height)
		}

		const halfWidth = Math.floor(width / 2)
		const halfHeight = Math.floor(height / 2)

		// 渲染每个格子
		for (let dy = -halfHeight; dy <= halfHeight; dy++) {
			for (let dx = -halfWidth; dx <= halfWidth; dx++) {
				const cell = view.cells.get(`${dx},${dy}`)
				const screenX = dx + halfWidth
				const screenY = dy + halfHeight
				// 使用交替颜色创建棋盘格效果
				const isAlt = (screenX + screenY) % 2 === 1
				this.updateCell(screenX, screenY, cell, dx === 0 && dy === 0, isAlt)
			}
		}

		// 更新位置 HUD
		this.updatePositionHud(0, 0)
	}

	// 渲染全局视野
	private renderGlobalView(view: LocalView, agentPos?: { x: number; y: number }): void {
		const { width, height } = view
		this.viewWidth = width
		this.viewHeight = height

		// 检查是否需要重新创建世界
		if (!this.worldContent || this.currentWidth !== width || this.currentHeight !== height) {
			this.createWorldStructure(width, height)
		}

		// 渲染每个格子
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const cell = view.cells.get(`${x},${y}`)
				const isAgentPos = !!(agentPos && agentPos.x === x && agentPos.y === y)
				// 使用交替颜色创建棋盘格效果
				const isAlt = (x + y) % 2 === 1
				this.updateCell(x, y, cell, isAgentPos, isAlt)
			}
		}

		// 更新位置 HUD
		if (agentPos) {
			this.updatePositionHud(agentPos.x, agentPos.y)
		}
	}

	// 创建世界结构
	private createWorldStructure(width: number, height: number): void {
		this.currentWidth = width
		this.currentHeight = height

		const { cellSize, gap } = RENDER_CONFIG
		const worldWidth = width * (cellSize + gap) - gap
		const worldHeight = height * (cellSize + gap) - gap

		// 清空容器并创建视口
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
				<!-- 位置显示 -->
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
				<!-- 世界内容 -->
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

		// 创建玩家元素
		this.createAgentElement()
	}

	// 生成格子 HTML
	private generateGridHTML(width: number, height: number): string {
		const { cellSize, gap, borderRadius } = RENDER_CONFIG
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
						transition: all 0.2s ease;
					"></div>
				`
			}
		}

		return html
	}

	// 创建玩家元素
	private createAgentElement(): void {
		if (!this.worldContent) return

		const { cellSize } = RENDER_CONFIG
		
		// 玩家容器
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
		`

		// 机器人图标
		const robotIcon = document.createElement("span")
		robotIcon.textContent = "🤖"
		robotIcon.style.cssText = `
			display: block;
			transform-origin: center;
			transition: transform 0.2s ease;
		`
		this.agentElement.appendChild(robotIcon)

		// 方向指示器
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

	// 更新玩家方向指示器
	private updateAgentDirection(): void {
		if (this.agentDirectionEl && this.currentFacing in DIRECTION_ARROWS) {
			this.agentDirectionEl.textContent = DIRECTION_ARROWS[this.currentFacing]
		}
	}

	// 更新单个格子
	private updateCell(
		x: number, 
		y: number, 
		cell: Cell | undefined, 
		isAgentHere: boolean,
		isAlt: boolean = false
	): void {
		if (!this.worldContent) return

		const cellEl = this.worldContent.querySelector(`[data-x="${x}"][data-y="${y}"]`) as HTMLElement
		if (!cellEl) return

		// 清空格子内容
		cellEl.innerHTML = ""

		if (!cell) {
			// 虚空 - 不可见区域
			this.applyVoidStyle(cellEl)
			return
		}

		// 根据地形类型设置样式
		switch (cell.tile.type) {
		case "wall":
			this.applyWallStyle(cellEl)
			break
		case "void":
			this.applyVoidStyle(cellEl)
			break
		default:
			// floor 或其他可行走区域
			this.applyFloorStyle(cellEl, isAlt)
		}

		// 如果有对象，渲染对象
		if (cell.objects.length > 0) {
			// 优先显示非玩家对象
			const obj = cell.objects.find(o => o.type !== "agent") || cell.objects[0]
			if (obj) {
				this.renderObjectToCell(cellEl, obj)
			}
		}

		// 如果玩家在这里，更新玩家位置
		if (isAgentHere && this.agentElement) {
			const { cellSize, gap } = RENDER_CONFIG
			const left = x * (cellSize + gap)
			const top = y * (cellSize + gap)
			this.agentElement.style.left = `${left}px`
			this.agentElement.style.top = `${top}px`
		}
	}

	// 应用墙的样式
	private applyWallStyle(el: HTMLElement): void {
		const { colors } = RENDER_CONFIG
		el.style.background = `
			linear-gradient(145deg, ${colors.wallTop} 0%, ${colors.wall} 50%, ${colors.wallSide} 100%)
		`
		el.style.border = "1px solid #4a5568"
		el.style.boxShadow = "inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)"
	}

	// 应用地板样式
	private applyFloorStyle(el: HTMLElement, isAlt: boolean): void {
		const { colors } = RENDER_CONFIG
		const baseColor = isAlt ? colors.floorAlt : colors.floor
		el.style.background = baseColor
		el.style.border = `1px solid ${isAlt ? "#2a3540" : "#263038"}`
		el.style.boxShadow = "none"
	}

	// 应用虚空样式
	private applyVoidStyle(el: HTMLElement): void {
		const { colors } = RENDER_CONFIG
		el.style.background = colors.void
		el.style.border = `1px solid ${colors.voidBorder}`
		el.style.boxShadow = "none"
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
			// 玩家由独立的 agentElement 渲染，这里不显示
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
				cellEl.style.background = `
					repeating-linear-gradient(
						45deg,
						${RENDER_CONFIG.colors.doorClosed},
						${RENDER_CONFIG.colors.doorClosed} 4px,
						#9b2c2c 4px,
						#9b2c2c 8px
					)
				`
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

// 添加 CSS 动画
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
