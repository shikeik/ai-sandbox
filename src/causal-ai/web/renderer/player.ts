// ========== 玩家实体渲染 ==========

const DIRECTION_ARROWS: Record<string, string> = {
	"上": "↑",
	"下": "↓",
	"左": "←",
	"右": "→"
}

export class PlayerRenderer {
	private element: HTMLElement | null = null
	private directionEl: HTMLElement | null = null

	constructor(private container: HTMLElement, private cellSize: number) {}

	create(facing: string): HTMLElement {
		this.element = document.createElement("div")
		this.element.className = "ca-player"
		this.element.style.cssText = `
			position: absolute;
			width: ${this.cellSize}px;
			height: ${this.cellSize}px;
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
		robotIcon.style.cssText = "display: block; transform-origin: center;"
		this.element.appendChild(robotIcon)

		this.directionEl = document.createElement("span")
		this.directionEl.className = "ca-player-direction"
		this.directionEl.textContent = DIRECTION_ARROWS[facing] ?? "→"
		this.directionEl.style.cssText = `
			position: absolute;
			top: -2px;
			right: -2px;
			font-size: 12px;
			background: #4ea1d3;
			color: #fff;
			border-radius: 50%;
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 1px 3px rgba(0,0,0,0.4);
		`
		this.element.appendChild(this.directionEl)

		this.container.appendChild(this.element)
		return this.element
	}

	setImmediate(x: number, y: number, gap: number): void {
		if (!this.element) return
		const left = x * (this.cellSize + gap)
		const top = y * (this.cellSize + gap)
		this.element.style.transition = "none"
		this.element.style.left = `${left}px`
		this.element.style.top = `${top}px`
	}

	moveTo(x: number, y: number, gap: number): void {
		if (!this.element) return
		const left = x * (this.cellSize + gap)
		const top = y * (this.cellSize + gap)
		this.element.style.transition = "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
		this.element.style.left = `${left}px`
		this.element.style.top = `${top}px`
	}

	updateDirection(facing: string): void {
		if (this.directionEl && facing in DIRECTION_ARROWS) {
			this.directionEl.textContent = DIRECTION_ARROWS[facing]
		}
	}

	getElement(): HTMLElement | null {
		return this.element
	}
}
