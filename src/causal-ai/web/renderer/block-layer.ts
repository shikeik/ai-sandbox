// ========== 方块层渲染（墙、地面、门、终点） ==========

import type { LocalView, Cell } from "../types"
import { OBJECT_LAYER_MAP } from "./object-layers"

const COLORS = {
	wall: "#3d4856",
	wallTop: "#5a6a7d",
	wallSide: "#2d3744",
	floor: "#1e2630",
	floorAlt: "#232d38",
	doorClosed: "#c53030",
	doorOpen: "#38a169",
	goal: "#805ad5"
}

export class BlockLayer {
	private cellElements: Map<string, HTMLElement> = new Map()
	private cellCache: Map<string, { tileType: string; doorOpen?: boolean }> = new Map()

	constructor(
		private container: HTMLElement,
		private cellSize: number,
		private borderRadius: number
	) {}

	renderAll(view: LocalView, gap: number): void {
		this.cellElements.clear()
		this.cellCache.clear()
		this.container.innerHTML = ""

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			const left = x * (this.cellSize + gap)
			const top = y * (this.cellSize + gap)
			this.renderCell(key, cell, x, y, left, top)
		}
	}

	update(view: LocalView): void {
		for (const [key, cell] of view.cells) {
			this.updateCell(key, cell)
		}
	}

	clear(): void {
		this.container.innerHTML = ""
		this.cellElements.clear()
		this.cellCache.clear()
	}

	private renderCell(key: string, cell: Cell | undefined, x: number, y: number, left: number, top: number): void {
		const el = document.createElement("div")
		el.className = "ca-block"
		el.dataset.key = key
		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.cellSize}px;
			height: ${this.cellSize}px;
			border-radius: ${this.borderRadius}px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 20px;
		`

		this.applyStyle(el, cell, x, y)
		this.renderContent(el, cell)

		this.container.appendChild(el)
		this.cellElements.set(key, el)

		const doorObj = cell?.objects.find(o => o.type === "门")
		this.cellCache.set(key, {
			tileType: cell?.tile.type || "void",
			doorOpen: doorObj?.state?.open as boolean | undefined
		})
	}

	private updateCell(key: string, cell: Cell | undefined): void {
		const el = this.cellElements.get(key)
		if (!el) return

		const cached = this.cellCache.get(key)
		const doorObj = cell?.objects.find(o => o.type === "门")
		const currentDoorOpen = doorObj?.state?.open as boolean | undefined

		const doorStateChanged = cached && cached.doorOpen !== currentDoorOpen && currentDoorOpen !== undefined
		const isOpening = doorStateChanged && currentDoorOpen === true

		const [x, y] = key.split(",").map(Number)

		if (isOpening) {
			el.style.animation = "ca-pop-out 0.15s ease-in forwards"

			setTimeout(() => {
				this.applyStyle(el, cell, x, y)
				this.renderContent(el, cell)
				el.style.animation = "ca-pop-in 0.25s ease-out"
				setTimeout(() => {
					el.style.animation = ""
				}, 250)
			}, 150)
		} else {
			this.applyStyle(el, cell, x, y)
			this.renderContent(el, cell)
		}

		this.cellCache.set(key, {
			tileType: cell?.tile.type || "void",
			doorOpen: currentDoorOpen
		})
	}

	private applyStyle(el: HTMLElement, cell: Cell | undefined, x: number, y: number): void {
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

	private renderContent(el: HTMLElement, cell: Cell | undefined): void {
		el.innerHTML = ""

		if (!cell || cell.objects.length === 0) return

		const blockObjects = cell.objects.filter(o => {
			const layer = OBJECT_LAYER_MAP[o.type]
			return layer <= 10
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
					el.style.background = `${COLORS.doorOpen}25`
					el.style.border = `2px solid ${COLORS.doorOpen}`
					objEl.textContent = "🚪"
					objEl.style.opacity = "0.6"
					objEl.style.filter = "grayscale(0.3)"
				} else {
					el.style.background = `repeating-linear-gradient(45deg, ${COLORS.doorClosed}, ${COLORS.doorClosed} 4px, #9b2c2c 4px, #9b2c2c 8px)`
					el.style.border = `2px solid ${COLORS.doorClosed}`
					objEl.textContent = "🔒"
					objEl.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
				}
				el.appendChild(objEl)
				break
			case "终点":
				el.style.background = `${COLORS.goal}20`
				el.style.border = `2px solid ${COLORS.goal}`
				el.style.boxShadow = `0 0 12px ${COLORS.goal}40`
				objEl.textContent = "🏁"
				objEl.style.filter = "drop-shadow(0 0 6px rgba(159, 122, 234, 0.8))"
				objEl.style.animation = "ca-pulse 1.5s ease-in-out infinite"
				el.appendChild(objEl)
				break
			}
		}
	}

	private applyWallStyle(el: HTMLElement): void {
		el.style.background = `linear-gradient(145deg, ${COLORS.wallTop} 0%, ${COLORS.wall} 50%, ${COLORS.wallSide} 100%)`
		el.style.border = "1px solid #4a5568"
		el.style.boxShadow = "inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)"
	}

	private applyFloorStyle(el: HTMLElement, x: number, y: number): void {
		const isAlt = (x + y) % 2 === 1
		const baseColor = isAlt ? COLORS.floorAlt : COLORS.floor
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
