/**
 * 神经元区域管理器
 * 简化版：仅保留网络结构视图
 */

import { NetworkView } from './NetworkView.js'

// ========== 菜单配置常量 ==========
const MENU_CONFIG = {
	modes: [
		{ id: 'player', label: '👤玩家' },
		{ id: 'ai', label: '🤖AI' },
		{ id: 'train', label: '📊训练' }
	],
	speeds: [
		{ id: 'step', label: '单步' },
		{ id: 'slow', label: '慢速' },
		{ id: 'normal', label: '中速' },
		{ id: 'fast', label: '快速' },
		{ id: 'max', label: '极速' }
	],
	explores: [
		{ id: 'none', label: '🚫无探索' },
		{ id: 'fixed', label: '🎯固定50%' },
		{ id: 'dynamic', label: '⚡动态' }
	]
}

const STYLE = {
	active: {
		color: '#0f0',
		background: 'rgba(0,255,0,0.15)',
		border: '1px solid #0f0'
	},
	inactive: {
		color: '#fff',
		background: 'rgba(255,255,255,0.05)',
		border: '1px solid transparent'
	}
}

export class NeuronAreaManager {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.currentView = null
		// 从全局配置读取默认值
		this.currentMode = window.AI_CONFIG?.DEFAULT_MODE || 'player'
		this.currentSpeed = window.AI_CONFIG?.DEFAULT_SPEED || 'step'
		this.currentExploreMode = 'none'  // 探索模式：none/fixed/dynamic
		// 种子控制状态
		this.isSeedLocked = false
		this.currentSeed = null
		this.seedInputEl = null
		this.lockBtnEl = null
		
		this.modeItems = []          // 模式按钮引用
		this.speedItems = []         // 速度按钮引用
		this.exploreItems = []       // 探索模式按钮引用
		this.init()
	}

	init() {
		// 移除 placeholder
		const placeholder = this.container.querySelector('#neuron-placeholder')
		if (placeholder) placeholder.remove()

		// 直接创建网络视图
		this.currentView = new NetworkView('neuron-area')

		// 创建控制按钮（训练模式和速度）
		this.createControlButton()
	}

	// ========== 菜单创建 ==========

	createControlButton() {
		const menuContainer = document.getElementById('neuron-menu-container')
		if (!menuContainer) return

		const { btn, menu } = this._createMenuElements()

		// 创建菜单组
		menu.appendChild(this._createModeRow())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createSpeedGrid())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createExploreRow())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createSeedRow())
		menu.appendChild(this._createDivider())
		menu.appendChild(this._createWeightControls())

		// 绑定切换事件
		btn.addEventListener('click', () => this._toggleMenu(btn, menu))

		menuContainer.appendChild(btn)
		menuContainer.appendChild(menu)

		// 初始化菜单状态为隐藏
		menu.style.display = 'none'
		console.log('[NEURON_UI]', '菜单初始化完成 | 默认状态=隐藏')
	}

	_createMenuElements() {
		const btn = document.createElement('button')
		btn.id = 'view-menu-btn'
		btn.className = 'ctrl-btn icon-only'
		btn.innerHTML = '☰'
		btn.title = '菜单'

		const menu = document.createElement('div')
		menu.id = 'view-menu-dropdown'
		menu.className = 'neuron-menu-dropdown'

		return { btn, menu }
	}

	_createDivider() {
		const divider = document.createElement('div')
		divider.className = 'neuron-menu-divider'
		return divider
	}

	// ========== 模式选择行 ==========

	_createModeRow() {
		const modeRow = document.createElement('div')
		modeRow.className = 'neuron-menu-row'

		MENU_CONFIG.modes.forEach(item => {
			const el = this._createButton({
				item,
				isActive: item.id === this.currentMode,
				className: 'neuron-mode-btn',
				datasetKey: 'mode',
				onClick: () => this._handleModeChange(item.id)
			})
			this.modeItems.push(el)
			modeRow.appendChild(el)
		})
		console.log('[NEURON_UI]', `创建模式按钮 | 数量=${MENU_CONFIG.modes.length} 默认=${this.currentMode}`)
		return modeRow
	}

	_handleModeChange(newMode) {
		console.log('[NEURON_UI]', `模式切换 | 旧=${this.currentMode} → 新=${newMode}`)
		this.currentMode = newMode
		this.updateModeHighlight()
		if (this.onModeChange) this.onModeChange(newMode)
	}

	// ========== 速度选择网格 ==========

	_createSpeedGrid() {
		const speedGrid = document.createElement('div')
		speedGrid.className = 'neuron-menu-grid'

		MENU_CONFIG.speeds.forEach(item => {
			const el = this._createButton({
				item,
				isActive: item.id === this.currentSpeed,
				className: 'neuron-speed-btn',
				datasetKey: 'speed',
				onClick: () => this._handleSpeedChange(item.id)
			})
			this.speedItems.push(el)
			speedGrid.appendChild(el)
		})
		return speedGrid
	}

	_handleSpeedChange(newSpeed) {
		console.log('[NEURON_UI]', `速度切换 | ${this.currentSpeed} → ${newSpeed}`)
		this.currentSpeed = newSpeed
		this.updateSpeedHighlight()
		if (this.onSpeedChange) this.onSpeedChange(newSpeed)
	}

	// ========== 探索模式选择行 ==========

	_createExploreRow() {
		const exploreRow = document.createElement('div')
		exploreRow.className = 'neuron-menu-row'

		MENU_CONFIG.explores.forEach(item => {
			const el = this._createButton({
				item,
				isActive: item.id === this.currentExploreMode,
				className: 'neuron-explore-btn',
				datasetKey: 'explore',
				onClick: () => this._handleExploreChange(item.id)
			})
			this.exploreItems.push(el)
			exploreRow.appendChild(el)
		})
		console.log('[NEURON_UI]', `创建探索模式按钮 | 数量=${MENU_CONFIG.explores.length} 默认=${this.currentExploreMode}`)
		return exploreRow
	}

	_handleExploreChange(newMode) {
		console.log('[NEURON_UI]', `探索模式切换 | 旧=${this.currentExploreMode} → 新=${newMode}`)
		this.currentExploreMode = newMode
		this.updateExploreHighlight()
		if (this.onExploreModeChange) this.onExploreModeChange(newMode)
	}

	// ========== 种子控制行 ==========

	_createSeedRow() {
		const seedRow = document.createElement('div')
		seedRow.className = 'neuron-menu-row'
		seedRow.style.gap = '6px'

		// 锁定按钮
		this.lockBtnEl = document.createElement('button')
		this.lockBtnEl.className = 'ctrl-btn icon-only'
		this.lockBtnEl.style.width = '24px'
		this.lockBtnEl.style.height = '24px'
		this.lockBtnEl.style.fontSize = '12px'
		this._updateLockBtn()
		this.lockBtnEl.addEventListener('click', () => this._toggleSeedLock())
		seedRow.appendChild(this.lockBtnEl)

		// 种子输入框
		this.seedInputEl = document.createElement('input')
		this.seedInputEl.type = 'text'
		this.seedInputEl.className = 'seed-input'
		this.seedInputEl.placeholder = '随机种子'
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
		this.seedInputEl.addEventListener('change', () => this._handleSeedInput())
		this.seedInputEl.addEventListener('focus', () => {
			this.seedInputEl.style.borderColor = '#0f0'
		})
		this.seedInputEl.addEventListener('blur', () => {
			this.seedInputEl.style.borderColor = 'rgba(0,255,0,0.3)'
		})
		seedRow.appendChild(this.seedInputEl)

		// 随机骰子按钮
		const diceBtn = document.createElement('button')
		diceBtn.className = 'ctrl-btn icon-only'
		diceBtn.innerHTML = '🎲'
		diceBtn.style.width = '24px'
		diceBtn.style.height = '24px'
		diceBtn.style.fontSize = '12px'
		diceBtn.title = '随机种子'
		diceBtn.addEventListener('click', () => this._randomizeSeed())
		seedRow.appendChild(diceBtn)

		console.log('[NEURON_UI]', '创建种子控制行')
		return seedRow
	}

	_updateLockBtn() {
		if (!this.lockBtnEl) return
		this.lockBtnEl.innerHTML = this.isSeedLocked ? '🔒' : '🔓'
		this.lockBtnEl.title = this.isSeedLocked ? '种子已锁定' : '种子未锁定（每局随机）'
		this.lockBtnEl.style.opacity = this.isSeedLocked ? '1' : '0.5'
	}

	_toggleSeedLock() {
		this.isSeedLocked = !this.isSeedLocked
		this._updateLockBtn()
		console.log('[NEURON_UI]', `种子锁定切换 | ${this.isSeedLocked ? '锁定' : '解锁'}`)
		if (this.onSeedLockChange) this.onSeedLockChange(this.isSeedLocked)
	}

	_handleSeedInput() {
		const value = this.seedInputEl.value.trim()
		const seed = value ? parseInt(value, 10) : null
		if (isNaN(seed)) {
			console.warn('[NEURON_UI]', `无效种子输入 | "${value}"`)
			return
		}
		this.currentSeed = seed
		console.log('[NEURON_UI]', `手动设置种子 | ${seed}`)
		if (this.onSeedChange) this.onSeedChange(seed)
	}

	_randomizeSeed() {
		const newSeed = Date.now()
		this.currentSeed = newSeed
		if (this.seedInputEl) {
			this.seedInputEl.value = newSeed
		}
		console.log('[NEURON_UI]', `随机生成种子 | ${newSeed}`)
		if (this.onSeedChange) this.onSeedChange(newSeed)
	}

	/**
	 * 外部更新种子显示（如游戏生成新地形后）
	 */
	updateSeedDisplay(seed) {
		if (!this.isSeedLocked && this.seedInputEl) {
			this.seedInputEl.value = seed || ''
			this.currentSeed = seed
		}
	}

	// ========== 元素权重控制 ==========

	_createWeightControls() {
		const container = document.createElement('div')
		container.className = 'weight-controls'
		container.style.cssText = `
			padding: 6px;
			background: rgba(0,0,0,0.2);
			border-radius: 4px;
		`

		// 标题
		const title = document.createElement('div')
		title.textContent = '地形元素权重'
		title.style.cssText = `
			font-size: 10px;
			color: rgba(255,255,255,0.6);
			margin-bottom: 8px;
			text-align: center;
		`
		container.appendChild(title)

		// 三元素滑块
		this.weightSliders = {}
		this.weightToggles = {}

		const elements = [
			{ key: 'ground', label: '🟩平地', color: '#27ae60', defaultWeight: 50 },
			{ key: 'singlePit', label: '⬛单坑', color: '#e74c3c', defaultWeight: 30 },
			{ key: 'doublePit', label: '⬛⬛双坑', color: '#c0392b', defaultWeight: 20 }
		]

		elements.forEach(el => {
			container.appendChild(this._createWeightRow(el))
		})

		console.log('[NEURON_UI]', '创建权重控制面板')
		return container
	}

	_createWeightRow({ key, label, color, defaultWeight }) {
		const row = document.createElement('div')
		row.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 6px;
			font-size: 11px;
		`

		// 开关复选框
		const toggle = document.createElement('input')
		toggle.type = 'checkbox'
		toggle.checked = true
		toggle.style.cssText = `
			width: 14px;
			height: 14px;
			accent-color: #0f0;
			cursor: pointer;
		`
		toggle.addEventListener('change', () => {
			this._handleWeightToggle(key, toggle.checked)
		})
		this.weightToggles[key] = toggle

		// 标签
		const labelEl = document.createElement('span')
		labelEl.textContent = label
		labelEl.style.cssText = `
			width: 55px;
			color: ${color};
		`

		// 滑块
		const slider = document.createElement('input')
		slider.type = 'range'
		slider.min = '0'
		slider.max = '100'
		slider.value = defaultWeight
		slider.style.cssText = `
			flex: 1;
			height: 4px;
			accent-color: ${color};
			cursor: pointer;
		`
		slider.addEventListener('input', () => {
			this._handleWeightChange(key, parseInt(slider.value))
		})
		this.weightSliders[key] = slider

		// 数值显示
		const valueDisplay = document.createElement('span')
		valueDisplay.textContent = defaultWeight
		valueDisplay.style.cssText = `
			width: 24px;
			text-align: right;
			color: ${color};
			font-family: monospace;
		`
		slider.addEventListener('input', () => {
			valueDisplay.textContent = slider.value
		})

		row.appendChild(toggle)
		row.appendChild(labelEl)
		row.appendChild(slider)
		row.appendChild(valueDisplay)

		return row
	}

	_handleWeightChange(key, value) {
		console.log('[NEURON_UI]', `权重调整 | ${key}=${value}`)
		if (this.onWeightChange) {
			this.onWeightChange(key, value)
		}
	}

	_handleWeightToggle(key, enabled) {
		console.log('[NEURON_UI]', `元素开关 | ${key}=${enabled ? '开启' : '关闭'}`)
		if (this.weightSliders[key]) {
			this.weightSliders[key].disabled = !enabled
			this.weightSliders[key].style.opacity = enabled ? '1' : '0.3'
		}
		if (this.onElementToggle) {
			this.onElementToggle(key, enabled)
		}
	}

	/**
	 * 获取当前权重配置
	 */
	getWeightConfig() {
		const weights = {}
		const enabled = {}
		
		for (const key of ['ground', 'singlePit', 'doublePit']) {
			weights[key] = this.weightSliders[key] 
				? parseInt(this.weightSliders[key].value) 
				: 50
			enabled[key] = this.weightToggles[key] 
				? this.weightToggles[key].checked 
				: true
		}
		
		return { weights, enabled }
	}

	// ========== 通用按钮创建 ==========

	_createButton({ item, isActive, className, datasetKey, onClick }) {
		const el = document.createElement('div')
		el.dataset[datasetKey] = item.id
		el.textContent = item.label
		el.className = `${className} ${isActive ? 'active' : 'inactive'}`
		el.addEventListener('click', onClick)
		this._attachHover(el, () => el.dataset[datasetKey] === this._getCurrentValue(datasetKey))
		return el
	}

	_getCurrentValue(datasetKey) {
		switch (datasetKey) {
			case 'mode': return this.currentMode
			case 'speed': return this.currentSpeed
			case 'explore': return this.currentExploreMode
			default: return ''
		}
	}

	_attachHover(el, isActiveCheck) {
		el.addEventListener('mouseenter', () => {
			if (!isActiveCheck()) el.style.background = 'rgba(255,255,255,0.1)'
		})
		el.addEventListener('mouseleave', () => {
			if (!isActiveCheck()) el.style.background = 'rgba(255,255,255,0.05)'
		})
	}

	_toggleMenu(btn, menu) {
		const isOpen = menu.style.display === 'none'
		menu.style.display = isOpen ? 'block' : 'none'
		btn.classList.toggle('active', isOpen)
	}

	// ========== 渲染 ==========

	render(network, inputs = null, action = null, isPreview = false, isResize = false, weightChanges = null) {
		console.log('[NEURON_UI]', `render | isPreview=${isPreview} isResize=${isResize} weightChanges=${weightChanges ? '有' : '无'}`)
		if (this.currentView && this.currentView.render) {
			this.currentView.render(network, inputs, action, isPreview, isResize, weightChanges)
		}
	}

	// ========== 高亮更新 ==========

	updateModeHighlight() {
		this._updateHighlight(this.modeItems, 'mode')
	}

	updateSpeedHighlight() {
		this._updateHighlight(this.speedItems, 'speed')
	}

	updateExploreHighlight() {
		this._updateHighlight(this.exploreItems, 'explore')
	}

	/**
	 * 统一高亮更新方法
	 * @param {HTMLElement[]} items - 按钮元素数组
	 * @param {string} datasetKey - dataset 属性名（mode / speed / explore）
	 */
	_updateHighlight(items, datasetKey) {
		const currentValue = this._getCurrentValue(datasetKey)
		items.forEach(el => {
			const isActive = el.dataset[datasetKey] === currentValue
			this._applyButtonStyle(el, isActive, datasetKey)
		})
		console.log('[NEURON_UI]', `高亮更新 | 类型=${datasetKey} 当前值=${currentValue}`)
	}

	_applyButtonStyle(el, isActive, type) {
		const baseClass = `neuron-${type}-btn`
		el.className = `${baseClass} ${isActive ? 'active' : 'inactive'}`
		
		const style = isActive ? STYLE.active : STYLE.inactive
		el.style.color = style.color
		el.style.background = style.background
		el.style.border = style.border
	}
}

export default NeuronAreaManager
