/**
 * 神经元区域管理器
 * 简化版：仅保留网络结构视图
 */

import { NetworkView } from './NetworkView.js'

export class NeuronAreaManager {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.currentView = null
		this.currentMode = 'player'  // 默认玩家模式
		this.currentSpeed = 'normal' // 默认中速
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
		btn.innerHTML = '☰'
		btn.title = '菜单'
		btn.style.cssText = `
			width: 28px;
			height: 28px;
			border: none;
			border-radius: 4px;
			background: #222;
			border: 1px solid #0f0;
			color: #0f0;
			font-size: 14px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
		`

		// 创建下拉菜单
		const menu = document.createElement('div')
		menu.id = 'view-menu-dropdown'
		menu.style.cssText = `
			position: absolute;
			top: 36px;
			right: 0;
			background: #1a1a2e;
			border: 1px solid #0f0;
			border-radius: 4px;
			padding: 6px;
			width: 200px;
			z-index: 3001;
			display: none;
			box-shadow: 0 4px 12px rgba(0,0,0,0.5);
			font-size: 11px;
		`

		// 模式选择 - 1行3列
		const modeRow = document.createElement('div')
		modeRow.style.cssText = `
			display: flex;
			gap: 4px;
			margin-bottom: 6px;
		`

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
			el.style.cssText = `
				flex: 1;
				padding: 6px 4px;
				cursor: pointer;
				color: ${isActive ? '#0f0' : '#fff'};
				text-align: center;
				border-radius: 3px;
				background: ${isActive ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.05)'};
				border: ${isActive ? '1px solid #0f0' : '1px solid transparent'};
				transition: all 0.2s;
			`
			el.addEventListener('click', () => {
				this.currentMode = item.id
				this.updateModeHighlight()
				if (this.onModeChange) this.onModeChange(item.id)
				menu.style.display = 'none'
			})
			el.addEventListener('mouseenter', () => {
				if (item.id !== this.currentMode) {
					el.style.background = 'rgba(255,255,255,0.1)'
				}
			})
			el.addEventListener('mouseleave', () => {
				if (item.id !== this.currentMode) {
					el.style.background = 'rgba(255,255,255,0.05)'
				}
			})
			this.modeItems.push(el)
			modeRow.appendChild(el)
		})
		menu.appendChild(modeRow)

		// 分隔线
		const divider = document.createElement('div')
		divider.style.cssText = `
			height: 1px;
			background: rgba(0,255,0,0.3);
			margin: 4px 0 6px 0;
		`
		menu.appendChild(divider)

		// 训练速度 - 2排网格
		const speedGrid = document.createElement('div')
		speedGrid.style.cssText = `
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
		`

		const speeds = [
			{ id: 'step', label: '单步' },
			{ id: 'slow', label: '慢速' },
			{ id: 'normal', label: '中速' },
			{ id: 'fast', label: '快速' },
			{ id: 'max', label: '极速' }
		]

		speeds.forEach((item, index) => {
			const el = document.createElement('div')
			el.dataset.speed = item.id
			// 前3个占1/3，后2个占1/2
			const flexBasis = index < 3 ? 'calc(33.333% - 3px)' : 'calc(50% - 2px)'
			const isActive = item.id === this.currentSpeed
			el.style.cssText = `
				flex: 0 0 ${flexBasis};
				padding: 5px 2px;
				cursor: pointer;
				color: ${isActive ? '#0f0' : 'rgba(255,255,255,0.8)'};
				text-align: center;
				border-radius: 3px;
				background: ${isActive ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.05)'};
				border: ${isActive ? '1px solid #0f0' : '1px solid transparent'};
				font-size: 11px;
				transition: all 0.2s;
			`
			el.textContent = item.label
			el.addEventListener('click', () => {
				this.currentSpeed = item.id
				this.updateSpeedHighlight()
				if (this.onSpeedChange) this.onSpeedChange(item.id)
				menu.style.display = 'none'
			})
			el.addEventListener('mouseenter', () => {
				if (item.id !== this.currentSpeed) {
					el.style.background = 'rgba(255,255,255,0.1)'
				}
			})
			el.addEventListener('mouseleave', () => {
				if (item.id !== this.currentSpeed) {
					el.style.background = 'rgba(255,255,255,0.05)'
				}
			})
			this.speedItems.push(el)
			speedGrid.appendChild(el)
		})
		menu.appendChild(speedGrid)

		btn.addEventListener('click', () => {
			menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
		})

		// 注：菜单显隐仅通过按钮切换，不响应外部点击

		menuContainer.appendChild(btn)
		menuContainer.appendChild(menu)
	}

	render(...args) {
		if (this.currentView && this.currentView.render) {
			this.currentView.render(...args)
		}
	}

	updateModeHighlight() {
		this.modeItems.forEach(el => {
			const isActive = el.dataset.mode === this.currentMode
			el.style.color = isActive ? '#0f0' : '#fff'
			el.style.background = isActive ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.05)'
			el.style.border = isActive ? '1px solid #0f0' : '1px solid transparent'
		})
	}

	updateSpeedHighlight() {
		this.speedItems.forEach(el => {
			const isActive = el.dataset.speed === this.currentSpeed
			el.style.color = isActive ? '#0f0' : 'rgba(255,255,255,0.8)'
			el.style.background = isActive ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.05)'
			el.style.border = isActive ? '1px solid #0f0' : '1px solid transparent'
		})
	}
}

export default NeuronAreaManager
