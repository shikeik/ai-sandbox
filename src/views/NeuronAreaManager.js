/**
 * 神经元区域管理器
 * 简化版：仅保留网络结构视图
 */

import { NetworkView } from './NetworkView.js'

export class NeuronAreaManager {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.currentView = null
		// 从全局配置读取默认值
		this.currentMode = window.AI_CONFIG?.DEFAULT_MODE || 'player'
		this.currentSpeed = window.AI_CONFIG?.DEFAULT_SPEED || 'step'
		this.modeItems = []          // 模式按钮引用
		this.speedItems = []         // 速度按钮引用
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

	createControlButton() {
		const menuContainer = document.getElementById('neuron-menu-container')
		if (!menuContainer) return

		// 创建下拉菜单按钮
		const btn = document.createElement('button')
		btn.id = 'view-menu-btn'
		btn.className = 'ctrl-btn icon-only'
		btn.innerHTML = '☰'
		btn.title = '菜单'

		// 创建下拉菜单
		const menu = document.createElement('div')
		menu.id = 'view-menu-dropdown'
		menu.className = 'neuron-menu-dropdown'

		// 通用 hover 处理
		const attachHover = (el, isActiveCheck) => {
			el.addEventListener('mouseenter', () => {
				if (!isActiveCheck()) el.style.background = 'rgba(255,255,255,0.1)'
			})
			el.addEventListener('mouseleave', () => {
				if (!isActiveCheck()) el.style.background = 'rgba(255,255,255,0.05)'
			})
		}

		// 模式选择 - 1行3列
		const modeRow = document.createElement('div')
		modeRow.className = 'neuron-menu-row'

		const modes = [
			{ id: 'player', label: '👤玩家' },
			{ id: 'ai', label: '🤖AI' },
			{ id: 'train', label: '📊训练' }
		]

		modes.forEach(item => {
			const el = document.createElement('div')
			el.dataset.mode = item.id
			el.textContent = item.label
			const isActive = item.id === this.currentMode
			el.className = `neuron-mode-btn ${isActive ? 'active' : 'inactive'}`
			el.addEventListener('click', () => {
				this.currentMode = item.id
				this.updateModeHighlight()
				if (this.onModeChange) this.onModeChange(item.id)
			})
			attachHover(el, () => item.id === this.currentMode)
			this.modeItems.push(el)
			modeRow.appendChild(el)
		})
		menu.appendChild(modeRow)

		// 分隔线
		const divider = document.createElement('div')
		divider.className = 'neuron-menu-divider'
		menu.appendChild(divider)

		// 训练速度 - 2排网格
		const speedGrid = document.createElement('div')
		speedGrid.className = 'neuron-menu-grid'

		const speeds = [
			{ id: 'step', label: '单步' },
			{ id: 'slow', label: '慢速' },
			{ id: 'normal', label: '中速' },
			{ id: 'fast', label: '快速' },
			{ id: 'max', label: '极速' }
		]

		speeds.forEach((item) => {
			const el = document.createElement('div')
			el.dataset.speed = item.id
			const isActive = item.id === this.currentSpeed
			el.className = `neuron-speed-btn ${isActive ? 'active' : 'inactive'}`
			el.textContent = item.label
			el.addEventListener('click', () => {
				this.currentSpeed = item.id
				this.updateSpeedHighlight()
				if (this.onSpeedChange) this.onSpeedChange(item.id)
				// 注：菜单不关闭，仅通过按钮切换
			})
			attachHover(el, () => item.id === this.currentSpeed)
			this.speedItems.push(el)
			speedGrid.appendChild(el)
		})
		menu.appendChild(speedGrid)

		btn.addEventListener('click', () => {
			const isOpen = menu.style.display === 'none'
			menu.style.display = isOpen ? 'block' : 'none'
			btn.classList.toggle('active', isOpen)
		})

		menuContainer.appendChild(btn)
		menuContainer.appendChild(menu)
	}

	render(network, inputs = null, action = null, isPreview = false, weightChanges = null) {
		if (this.currentView && this.currentView.render) {
			this.currentView.render(network, inputs, action, isPreview, false, weightChanges)
		}
	}

	/**
	 * 统一高亮更新方法
	 * @param {HTMLElement[]} items - 按钮元素数组
	 * @param {string} currentValue - 当前选中的值
	 * @param {string} datasetKey - dataset 属性名（mode / speed）
	 * @param {string} inactiveColor - 非激活状态的文字颜色
	 */
	_updateHighlight(items, currentValue, datasetKey, inactiveColor = '#fff') {
		items.forEach(el => {
			const isActive = el.dataset[datasetKey] === currentValue
			el.style.color = isActive ? '#0f0' : inactiveColor
			el.style.background = isActive ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.05)'
			el.style.border = isActive ? '1px solid #0f0' : '1px solid transparent'
		})
	}

	updateModeHighlight() {
		this._updateHighlight(this.modeItems, this.currentMode, 'mode', '#fff')
	}

	updateSpeedHighlight() {
		this._updateHighlight(this.speedItems, this.currentSpeed, 'speed', 'rgba(255,255,255,0.8)')
	}
}

export default NeuronAreaManager
