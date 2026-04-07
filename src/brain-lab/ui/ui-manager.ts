// ========== UI 管理器 - 所有 DOM 操作收口 ==========

import type { APIStateResponse, APIMoveResponse } from "../types/api.js"

/** Toast 类型 */
type ToastType = "info" | "success" | "error"

/**
 * UI 管理器 - 负责所有 DOM 操作
 * 
 * 职责：
 * - 所有 DOM 元素获取收口
 * - UI 更新方法封装
 * - 样式/文本统一处理
 */
export class UIManager {
	private elements: Map<string, HTMLElement> = new Map()
	private toastTimeout: number | null = null

	constructor() {
		this.cacheElements()
	}

	/**
	 * 缓存常用 DOM 元素
	 */
	private cacheElements(): void {
		const ids = [
			"world-container",
			"message",
			"console-panel",
		]

		ids.forEach((id) => {
			const el = document.getElementById(id)
			if (el) this.elements.set(id, el)
		})
	}

	/**
	 * 获取缓存的元素
	 */
	getElement(id: string): HTMLElement | null {
		return this.elements.get(id) || document.getElementById(id)
	}

	// ========== Tab 切换 ==========

	/**
	 * 切换 Tab
	 */
	switchTab(tab: string): void {
		// 更新 Tab 按钮状态
		document.querySelectorAll(".tab-btn").forEach((btn) => {
			const isActive = btn.getAttribute("data-tab") === tab
			btn.classList.toggle("active", isActive)
		})

		// 更新内容显示
		document.querySelectorAll(".tab-content").forEach((content) => {
			const isActive = content.id === `tab-${tab}`
			content.classList.toggle("active", isActive)
		})
	}

	// ========== 位置显示 ==========

	/**
	 * 更新位置 HUD
	 */
	updatePositionHUD(pos: { x: number; y: number }): void {
		const hud = document.querySelector(".position-hud")
		if (hud) hud.textContent = `(${pos.x}, ${pos.y})`
	}

	/**
	 * 从 API 响应更新位置
	 */
	updatePositionFromAPI(data: APIStateResponse | APIMoveResponse): void {
		if ("hero" in data && data.hero) {
			this.updatePositionHUD(data.hero)
		} else if ("to" in data && data.to) {
			this.updatePositionHUD(data.to)
		}
	}

	// ========== Toast 提示 ==========

	/**
	 * 显示 Toast
	 */
	showToast(message: string, _type: ToastType = "info"): void {
		const el = this.getElement("message")
		if (!el) return

		// 清除旧的 timeout
		if (this.toastTimeout) {
			clearTimeout(this.toastTimeout)
		}

		// 更新内容并显示
		el.textContent = message
		el.classList.add("show")

		// 1.5秒后消失
		this.toastTimeout = window.setTimeout(() => {
			el.classList.remove("show")
			this.toastTimeout = null
		}, 1500)
	}

	// ========== 世界容器 ==========

	/**
	 * 清空世界容器
	 */
	clearWorldContainer(): void {
		const container = this.getElement("world-container")
		if (container) container.innerHTML = ""
	}

	/**
	 * 获取世界容器
	 */
	getWorldContainer(): HTMLElement | null {
		return this.getElement("world-container")
	}

	/**
	 * 在世界容器中显示错误
	 */
	showErrorInWorld(message: string): void {
		const container = this.getElement("world-container")
		if (container) {
			container.innerHTML = `<div style="color:red;padding:20px;">${message}</div>`
		}
	}

	// ========== 转场效果 ==========

	/**
	 * 创建死亡转场遮罩
	 */
	createDeathOverlay(): { skull: HTMLElement; overlay: HTMLElement } | null {
		const container = this.getElement("world-container")
		if (!container) return null

		// 确保容器有定位
		const position = container.style.position
		if (!position || position === "static") {
			container.style.position = "relative"
		}

		// 创建骷髅头
		let skullEl = document.getElementById("brain-lab-skull")
		if (!skullEl) {
			skullEl = document.createElement("div")
			skullEl.id = "brain-lab-skull"
			skullEl.textContent = "💀"
			skullEl.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				font-size: 48px;
				font-weight: bold;
				text-shadow: 0 0 30px #e74c3c;
				opacity: 0;
				pointer-events: none;
				z-index: 2000;
				transition: opacity 0.4s ease-in-out;
			`
			container.appendChild(skullEl)
		}

		// 创建遮罩
		let overlay = document.querySelector(".brain-lab-overlay") as HTMLElement
		if (!overlay) {
			overlay = document.createElement("div")
			overlay.className = "brain-lab-overlay"
			overlay.style.cssText = `
				position: absolute;
				inset: 0;
				background: #000;
				opacity: 0;
				pointer-events: none;
				z-index: 1600;
				transition: opacity 0.4s ease-in-out;
				border-radius: 12px;
			`
			container.appendChild(overlay)
		}

		return { skull: skullEl, overlay }
	}

	/**
	 * 创建胜利转场奖杯
	 */
	createVictoryTrophy(): { trophy: HTMLElement; overlay: HTMLElement } | null {
		const container = this.getElement("world-container")
		if (!container) return null

		// 确保容器有定位
		const position = container.style.position
		if (!position || position === "static") {
			container.style.position = "relative"
		}

		// 移除旧奖杯
		const oldTrophy = document.getElementById("brain-lab-trophy")
		if (oldTrophy) oldTrophy.remove()

		// 创建新奖杯
		const trophyEl = document.createElement("div")
		trophyEl.id = "brain-lab-trophy"
		trophyEl.textContent = "🏆"
		trophyEl.style.cssText = `
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 56px;
			font-weight: bold;
			text-shadow: 0 0 30px #f1c40f;
			opacity: 0;
			pointer-events: none;
			z-index: 2000;
			transition: opacity 0.4s ease-in-out;
		`
		container.appendChild(trophyEl)

		// 获取或创建遮罩
		let overlay = document.querySelector(".brain-lab-overlay") as HTMLElement
		if (!overlay) {
			overlay = document.createElement("div")
			overlay.className = "brain-lab-overlay"
			overlay.style.cssText = `
				position: absolute;
				inset: 0;
				background: #000;
				opacity: 0;
				pointer-events: none;
				z-index: 1600;
				transition: opacity 0.4s ease-in-out;
				border-radius: 12px;
			`
			container.appendChild(overlay)
		}

		return { trophy: trophyEl, overlay }
	}

	/**
	 * 显示转场元素
	 */
	showTransitionElements(
		elements: { skull?: HTMLElement; trophy?: HTMLElement; overlay: HTMLElement },
		fadeDuration: number = 400
	): void {
		if (elements.skull) elements.skull.style.opacity = "1"
		if (elements.trophy) elements.trophy.style.opacity = "1"
		if (fadeDuration !== 400) {
			elements.overlay.style.transition = `opacity ${fadeDuration}ms ease-in-out`
		}
		elements.overlay.style.opacity = "1"
	}

	/**
	 * 隐藏转场元素
	 */
	hideTransitionElement(
		element: HTMLElement,
		delay: number = 0
	): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(() => {
				element.style.opacity = "0"
				resolve()
			}, delay)
		})
	}

	/**
	 * 渐隐遮罩
	 */
	fadeOutOverlay(overlay: HTMLElement, duration: number = 600): Promise<void> {
		return new Promise((resolve) => {
			overlay.style.transition = `opacity ${duration}ms ease-in-out`
			overlay.style.opacity = "0"
			setTimeout(resolve, duration)
		})
	}
}
