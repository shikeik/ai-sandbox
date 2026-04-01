/**
 * 神经元区域管理器
 * 简化版：仅保留网络结构视图
 */

import { NetworkView } from './NetworkView.js'

export class NeuronAreaManager {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.currentView = null
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
			width: 220px;
			z-index: 3001;
			display: none;
			box-shadow: 0 4px 12px rgba(0,0,0,0.5);
			font-size: 11px;
		`

		const addHoverEffect = (el) => {
			el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.1)')
			el.addEventListener('mouseleave', () => el.style.background = 'transparent')
		}

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
			el.className = 'menu-item'
			el.textContent = item.label
			el.style.cssText = `
				flex: 1;
				padding: 6px 4px;
				cursor: pointer;
				color: #fff;
				text-align: center;
				border-radius: 3px;
				background: rgba(255,255,255,0.05);
			`
			el.addEventListener('click', () => {
				if (this.onModeChange) this.onModeChange(item.id)
				menu.style.display = 'none'
			})
			addHoverEffect(el)
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
			el.className = 'menu-item'
			el.textContent = item.label
			// 前3个占1/3，后2个占1/2
			const flexBasis = index < 3 ? 'calc(33.333% - 3px)' : 'calc(50% - 2px)'
			el.style.cssText = `
				flex: 0 0 ${flexBasis};
				padding: 5px 2px;
				cursor: pointer;
				color: rgba(255,255,255,0.8);
				text-align: center;
				border-radius: 3px;
				background: rgba(255,255,255,0.05);
				font-size: 11px;
			`
			el.addEventListener('click', () => {
				if (this.onSpeedChange) this.onSpeedChange(item.id)
				menu.style.display = 'none'
			})
			addHoverEffect(el)
			speedGrid.appendChild(el)
		})
		menu.appendChild(speedGrid)

		btn.addEventListener('click', () => {
			menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
		})

		// 点击外部关闭菜单
		document.addEventListener('click', (e) => {
			if (!btn.contains(e.target) && !menu.contains(e.target)) {
				menu.style.display = 'none'
			}
		})

		menuContainer.appendChild(btn)
		menuContainer.appendChild(menu)
	}

	render(...args) {
		if (this.currentView && this.currentView.render) {
			this.currentView.render(...args)
		}
	}
}

export default NeuronAreaManager
