/**
 * 神经元区域管理器
 * 简化版：仅保留网络结构视图
 */

import { NetworkView } from "./NetworkView.js"
import { NeuralNetwork } from "@ai/NeuralNetwork.js"

interface MenuItem {
	id: string
	label: string
}

interface WeightRowConfig {
	key: "ground" | "singlePit" | "doublePit"
	label: string
	color: string
	defaultWeight: number
}

const MENU_CONFIG = {
	modes: [
		{ id: "player", label: "👤玩家" },
		{ id: "ai", label: "🤖AI" },
		{ id: "train", label: "📊训练" }
	],
	speeds: [
		{ id: "step", label: "单步" },
		{ id: "slow", label: "慢速" },
		{ id: "normal", label: "中速" },
		{ id: "fast", label: "快速" },
		{ id: "max", label: "极速" }
	],
	explores: [
		{ id: "none", label: "🚫无探索" },
		{ id: "fixed", label: "🎯固定50%" },
		{ id: "dynamic", label: "⚡动态" }
	]
}

const STYLE = {
	active: {
		color: "#0f0",
		background: "rgba(0,255,0,0.15)",
		border: "1px solid #0f0"
	},
	inactive: {
		color: "#fff",
		background: "rgba(255,255,255,0.05)",
		border: "1px solid transparent"
	}
}

interface AIConfigGlobal {
	DEFAULT_MODE?: string
	DEFAULT_SPEED?: string
}

declare global {
	interface Window {
		AI_CONFIG?: AIConfigGlobal
	}
}

export class NeuronAreaManager {
	private container: HTMLElement
	private currentView: NetworkView | null = null
	private currentMode: string
	private currentSpeed: string
	private currentExploreMode: string
	private isSeedLocked: boolean = false
	private currentSeed: number | null = null
	private seedInputEl: HTMLInputElement | null = null
	private lockBtnEl: HTMLButtonElement | null = null
	private modeItems: HTMLElement[] = []
	private speedItems: HTMLElement[] = []
	private exploreItems: HTMLElement[] = []
	private weightSliders: Record<string, HTMLInputElement> = {}
	private weightToggles: Record<string, HTMLInputElement> = {}
	private isVisible: boolean = true

	onModeChange?: (mode: "player" | "ai" | "train") => void
	onSpeedChange?: (speed: string) => void
	onExploreModeChange?: (mode: "none" | "fixed" | "dynamic") => void
	onSeedLockChange?: (isLocked: boolean) => void
	onSeedChange?: (seed: number) => void
	onWeightChange?: (key: string, value: number) => void
	onElementToggle?: (key: string, enabled: boolean) => void
	onViewChange?: (viewName: string) => void

	constructor(containerId: string) {
		const el = document.getElementById(containerId)
		if (!el) {
			throw new Error(`NeuronAreaManager: 找不到元素 #${containerId}`)
		}
		this.container = el
		this.currentMode = window.AI_CONFIG?.DEFAULT_MODE || "player"
		this.currentSpeed = window.AI_CONFIG?.DEFAULT_SPEED || "step"
		this.currentExploreMode = "none"
		this.init()
	}

	init(): void {
		const placeholder = this.container.querySelector("#neuron-placeholder")
		if (placeholder) placeholder.remove()

		this.currentView = new NetworkView("neuron-area")
		this.createControlButton()
	}

	createControlButton(): void {
		const menuContainer = document.getElementById("neuron-menu-container")
		if (!menuContainer) return

		const { btn, menu } = this._createMenuElements()

		menu.appendChild(this._createModeRow())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createSpeedGrid())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createExploreRow())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createSeedRow())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createWeightControls())

		btn.addEventListener("click", () => this._toggleMenu(btn, menu))

		menuContainer.appendChild(btn)
		menuContainer.appendChild(menu)

		menu.style.display = "none"
	}

	private _createMenuElements(): { btn: HTMLButtonElement, menu: HTMLDivElement } {
		const btn = document.createElement("button")
		btn.id = "view-menu-btn"
		btn.className = "ctrl-btn icon-only"
		btn.innerHTML = "☰"
		btn.title = "菜单"

		const menu = document.createElement("div")
		menu.id = "view-menu-dropdown"
		menu.className = "neuron-menu-dropdown"

		return { btn, menu }
	}

	private _createDivider(): HTMLDivElement {
		const divider = document.createElement("div")
		divider.className = "neuron-menu-divider"
		return divider
	}

	private _createModeRow(): HTMLDivElement {
		const modeRow = document.createElement("div")
		modeRow.className = "neuron-menu-row"

		MENU_CONFIG.modes.forEach(item => {
			const el = this._createButton({
				item,
				isActive: item.id === this.currentMode,
				className: "neuron-mode-btn",
				datasetKey: "mode",
				onClick: () => this._handleModeChange(item.id)
			})
			this.modeItems.push(el)
			modeRow.appendChild(el)
		})
		return modeRow
	}

	private _handleModeChange(newMode: string): void {
		this.currentMode = newMode
		this.updateModeHighlight()
		if (this.onModeChange) this.onModeChange(newMode as "player" | "ai" | "train")
	}

	private _createSpeedGrid(): HTMLDivElement {
		const speedGrid = document.createElement("div")
		speedGrid.className = "neuron-menu-grid"

		MENU_CONFIG.speeds.forEach(item => {
			const el = this._createButton({
				item,
				isActive: item.id === this.currentSpeed,
				className: "neuron-speed-btn",
				datasetKey: "speed",
				onClick: () => this._handleSpeedChange(item.id)
			})
			this.speedItems.push(el)
			speedGrid.appendChild(el)
		})
		return speedGrid
	}

	private _handleSpeedChange(newSpeed: string): void {
		this.currentSpeed = newSpeed
		this.updateSpeedHighlight()
		if (this.onSpeedChange) this.onSpeedChange(newSpeed)
	}

	private _createExploreRow(): HTMLDivElement {
		const exploreRow = document.createElement("div")
		exploreRow.className = "neuron-menu-row"

		MENU_CONFIG.explores.forEach(item => {
			const el = this._createButton({
				item,
				isActive: item.id === this.currentExploreMode,
				className: "neuron-explore-btn",
				datasetKey: "explore",
				onClick: () => this._handleExploreChange(item.id)
			})
			this.exploreItems.push(el)
			exploreRow.appendChild(el)
		})
		return exploreRow
	}

	private _handleExploreChange(newMode: string): void {
		this.currentExploreMode = newMode
		this.updateExploreHighlight()
		if (this.onExploreModeChange) this.onExploreModeChange(newMode as "none" | "fixed" | "dynamic")
	}

	private _createSeedRow(): HTMLDivElement {
		const seedRow = document.createElement("div")
		seedRow.className = "neuron-menu-row"
		seedRow.style.gap = "6px"

		this.lockBtnEl = document.createElement("button")
		this.lockBtnEl.className = "ctrl-btn icon-only"
		this.lockBtnEl.style.width = "24px"
		this.lockBtnEl.style.height = "24px"
		this.lockBtnEl.style.fontSize = "12px"
		this._updateLockBtn()
		this.lockBtnEl.addEventListener("click", () => this._toggleSeedLock())
		seedRow.appendChild(this.lockBtnEl)

		this.seedInputEl = document.createElement("input")
		this.seedInputEl.type = "text"
		this.seedInputEl.className = "seed-input"
		this.seedInputEl.placeholder = "随机种子"
		this.seedInputEl.style.cssText = `
			flex: 1;
			height: 24px;
			background: rgba(0,0,0,0.3);
			border: 1px solid rgba(0,255,0,0.3);
			border-radius: 3px;
			color: #0f0;
			font-size: 11px;
			font-family: monospace;
			padding: 0 6px;
			outline: none;
		`
		this.seedInputEl.addEventListener("change", () => this._handleSeedInput())
		this.seedInputEl.addEventListener("focus", () => {
			this.seedInputEl!.style.borderColor = "#0f0"
		})
		this.seedInputEl.addEventListener("blur", () => {
			this.seedInputEl!.style.borderColor = "rgba(0,255,0,0.3)"
		})
		seedRow.appendChild(this.seedInputEl)

		const diceBtn = document.createElement("button")
		diceBtn.className = "ctrl-btn icon-only"
		diceBtn.innerHTML = "🎲"
		diceBtn.style.width = "24px"
		diceBtn.style.height = "24px"
		diceBtn.style.fontSize = "12px"
		diceBtn.title = "随机种子"
		diceBtn.addEventListener("click", () => this._randomizeSeed())
		seedRow.appendChild(diceBtn)

		return seedRow
	}

	private _updateLockBtn(): void {
		if (!this.lockBtnEl) return
		this.lockBtnEl.innerHTML = this.isSeedLocked ? "🔒" : "🔓"
		this.lockBtnEl.title = this.isSeedLocked ? "种子已锁定" : "种子未锁定（每局随机）"
		this.lockBtnEl.style.opacity = this.isSeedLocked ? "1" : "0.5"
	}

	private _toggleSeedLock(): void {
		this.isSeedLocked = !this.isSeedLocked
		this._updateLockBtn()
		if (this.onSeedLockChange) this.onSeedLockChange(this.isSeedLocked)
	}

	private _handleSeedInput(): void {
		if (!this.seedInputEl) return
		const value = this.seedInputEl.value.trim()
		const seed = value ? parseInt(value, 10) : null
		if (seed === null || isNaN(seed)) {
			return
		}
		this.currentSeed = seed
		if (this.onSeedChange) this.onSeedChange(seed)
	}

	private _randomizeSeed(): void {
		const newSeed = Date.now()
		this.currentSeed = newSeed
		if (this.seedInputEl) {
			this.seedInputEl.value = String(newSeed)
		}
		if (this.onSeedChange) this.onSeedChange(newSeed)
	}

	updateSeedDisplay(seed: number): void {
		if (!this.isSeedLocked && this.seedInputEl) {
			this.seedInputEl.value = String(seed)
			this.currentSeed = seed
		}
	}

	private _createWeightControls(): HTMLDivElement {
		const container = document.createElement("div")
		container.className = "weight-controls"
		container.style.cssText = `
			padding: 6px;
			background: rgba(0,0,0,0.2);
			border-radius: 4px;
		`

		const title = document.createElement("div")
		title.textContent = "地形元素权重"
		title.style.cssText = `
			font-size: 10px;
			color: rgba(255,255,255,0.6);
			margin-bottom: 8px;
			text-align: center;
		`
		container.appendChild(title)

		const elements: WeightRowConfig[] = [
			{ key: "ground", label: "🟩平地", color: "#27ae60", defaultWeight: 50 },
			{ key: "singlePit", label: "⬛单坑", color: "#e74c3c", defaultWeight: 30 },
			{ key: "doublePit", label: "⬛⬛双坑", color: "#c0392b", defaultWeight: 20 }
		]

		elements.forEach(el => {
			container.appendChild(this._createWeightRow(el))
		})

		return container
	}

	private _createWeightRow({ key, label, color, defaultWeight }: WeightRowConfig): HTMLDivElement {
		const row = document.createElement("div")
		row.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 6px;
			font-size: 11px;
		`

		const toggle = document.createElement("input")
		toggle.type = "checkbox"
		toggle.checked = true
		toggle.style.cssText = `
			width: 14px;
			height: 14px;
			accent-color: #0f0;
			cursor: pointer;
		`
		toggle.addEventListener("change", () => {
			this._handleWeightToggle(key, toggle.checked)
		})
		this.weightToggles[key] = toggle

		const labelEl = document.createElement("span")
		labelEl.textContent = label
		labelEl.style.cssText = `
			width: 55px;
			color: ${color};
		`

		const slider = document.createElement("input")
		slider.type = "range"
		slider.min = "0"
		slider.max = "100"
		slider.value = String(defaultWeight)
		slider.style.cssText = `
			flex: 1;
			height: 4px;
			accent-color: ${color};
			cursor: pointer;
		`
		slider.addEventListener("input", () => {
			this._handleWeightChange(key, parseInt(slider.value))
		})
		this.weightSliders[key] = slider

		const valueDisplay = document.createElement("span")
		valueDisplay.textContent = String(defaultWeight)
		valueDisplay.style.cssText = `
			width: 24px;
			text-align: right;
			color: ${color};
			font-family: monospace;
		`
		slider.addEventListener("input", () => {
			valueDisplay.textContent = slider.value
		})

		row.appendChild(toggle)
		row.appendChild(labelEl)
		row.appendChild(slider)
		row.appendChild(valueDisplay)

		return row
	}

	private _handleWeightChange(key: string, value: number): void {
		if (this.onWeightChange) {
			this.onWeightChange(key, value)
		}
	}

	private _handleWeightToggle(key: string, enabled: boolean): void {
		if (this.weightSliders[key]) {
			this.weightSliders[key].disabled = !enabled
			this.weightSliders[key].style.opacity = enabled ? "1" : "0.3"
		}
		if (this.onElementToggle) {
			this.onElementToggle(key, enabled)
		}
	}

	getWeightConfig(): { weights: Record<string, number>, enabled: Record<string, boolean> } {
		const weights: Record<string, number> = {}
		const enabled: Record<string, boolean> = {}
		
		for (const key of ["ground", "singlePit", "doublePit"]) {
			weights[key] = this.weightSliders[key] 
				? parseInt(this.weightSliders[key].value) 
				: 50
			enabled[key] = this.weightToggles[key] 
				? this.weightToggles[key].checked 
				: true
		}
		
		return { weights, enabled }
	}

	private _createButton({ 
		item, 
		isActive, 
		className, 
		datasetKey, 
		onClick 
	}: { 
		item: MenuItem
		isActive: boolean
		className: string
		datasetKey: string
		onClick: () => void
	}): HTMLElement {
		const el = document.createElement("div")
		;(el.dataset as Record<string, string>)[datasetKey] = item.id
		el.textContent = item.label
		el.className = `${className} ${isActive ? "active" : "inactive"}`
		el.addEventListener("click", onClick)
		this._attachHover(el, () => (el.dataset as Record<string, string>)[datasetKey] === this._getCurrentValue(datasetKey))
		return el
	}

	private _getCurrentValue(datasetKey: string): string {
		switch (datasetKey) {
			case "mode": return this.currentMode
			case "speed": return this.currentSpeed
			case "explore": return this.currentExploreMode
			default: return ""
		}
	}

	private _attachHover(el: HTMLElement, isActiveCheck: () => boolean): void {
		el.addEventListener("mouseenter", () => {
			if (!isActiveCheck()) el.style.background = "rgba(255,255,255,0.1)"
		})
		el.addEventListener("mouseleave", () => {
			if (!isActiveCheck()) el.style.background = "rgba(255,255,255,0.05)"
		})
	}

	private _toggleMenu(btn: HTMLButtonElement, menu: HTMLDivElement): void {
		const isOpen = menu.style.display === "none"
		menu.style.display = isOpen ? "block" : "none"
		btn.classList.toggle("active", isOpen)
	}

	/**
	 * 切换神经元区域显隐
	 */
	toggle(): void {
		this.isVisible = !this.isVisible
		this._updateCollapsedState()
	}

	/**
	 * 显示神经元区域
	 */
	show(): void {
		this.isVisible = true
		this._updateCollapsedState()
	}

	/**
	 * 隐藏神经元区域
	 */
	hide(): void {
		this.isVisible = false
		this._updateCollapsedState()
	}

	/**
	 * 同步折叠状态到 DOM
	 */
	private _updateCollapsedState(): void {
		this.container.classList.toggle("collapsed", !this.isVisible)
	}

	/**
	 * 获取当前显隐状态
	 */
	getVisible(): boolean {
		return this.isVisible
	}

	render(
		network: NeuralNetwork, 
		inputs: number[] | null = null, 
		action: number | null = null, 
		isPreview: boolean = false, 
		isResize: boolean = false, 
		weightChanges: number[][][] | null = null
	): void {
		if (this.currentView) {
			this.currentView.render(network, inputs, action, isPreview, isResize, weightChanges)
		}
	}

	updateModeHighlight(): void {
		this._updateHighlight(this.modeItems, "mode")
	}

	updateSpeedHighlight(): void {
		this._updateHighlight(this.speedItems, "speed")
	}

	updateExploreHighlight(): void {
		this._updateHighlight(this.exploreItems, "explore")
	}

	private _updateHighlight(items: HTMLElement[], datasetKey: string): void {
		const currentValue = this._getCurrentValue(datasetKey)
		items.forEach(el => {
			const isActive = (el.dataset as Record<string, string>)[datasetKey] === currentValue
			this._applyButtonStyle(el, isActive, datasetKey)
		})
	}

	private _applyButtonStyle(el: HTMLElement, isActive: boolean, type: string): void {
		const baseClass = `neuron-${type}-btn`
		el.className = `${baseClass} ${isActive ? "active" : "inactive"}`
		
		const style = isActive ? STYLE.active : STYLE.inactive
		el.style.color = style.color
		el.style.background = style.background
		el.style.border = style.border
	}
}

export default NeuronAreaManager
