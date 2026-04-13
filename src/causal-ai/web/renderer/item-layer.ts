// ========== 道具层渲染（钥匙等） ==========

import type { LocalView, GameObject } from "../types"
import { OBJECT_LAYER_MAP } from "./object-layers"

export class ItemLayer {
	private elements: Map<string, HTMLElement> = new Map()

	constructor(private container: HTMLElement, private cellSize: number) {}

	renderAll(view: LocalView, gap: number): void {
		this.elements.clear()
		this.container.innerHTML = ""

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			const items = cell.objects.filter(o => {
				const layer = OBJECT_LAYER_MAP[o.type]
				return layer > 10
			})
			for (const obj of items) {
				const left = x * (this.cellSize + gap)
				const top = y * (this.cellSize + gap)
				this.renderObject(obj, x, y, left, top)
			}
		}
	}

	update(view: LocalView, gap: number): void {
		const currentKeys = new Set<string>()

		for (const [key, cell] of view.cells) {
			const [x, y] = key.split(",").map(Number)
			const items = cell.objects.filter(o => {
				const layer = OBJECT_LAYER_MAP[o.type]
				return layer > 10
			})
			for (const obj of items) {
				const objKey = `${obj.type}:${x},${y}`
				currentKeys.add(objKey)
				let el = this.elements.get(objKey)
				if (!el) {
					const left = x * (this.cellSize + gap)
					const top = y * (this.cellSize + gap)
					el = this.renderObject(obj, x, y, left, top)
				}
			}
		}

		for (const [key, el] of this.elements) {
			if (!currentKeys.has(key)) {
				el.style.animation = "ca-pop-out 0.2s ease-in forwards"
				setTimeout(() => el.remove(), 200)
				this.elements.delete(key)
			}
		}
	}

	clear(): void {
		this.container.innerHTML = ""
		this.elements.clear()
	}

	private renderObject(obj: GameObject, x: number, y: number, left: number, top: number): HTMLElement {
		const key = `${obj.type}:${x},${y}`
		const el = document.createElement("div")
		el.className = `ca-dynamic ca-${obj.type}`
		el.dataset.key = key
		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.cellSize}px;
			height: ${this.cellSize}px;
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

		this.container.appendChild(el)
		this.elements.set(key, el)
		return el
	}
}
