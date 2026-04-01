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
			padding: 8px 0;
			min-width: 150px;
			z-index: 3001;
			display: none;
			box-shadow: 0 4px 12px rgba(0,0,0,0.5);
		`

		const addHoverEffect = (el) => {
			el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.1)')
			el.addEventListener('mouseleave', () => el.style.background = 'transparent')
		}

		const addDivider = () => {
			const divider = document.createElement('div')
			divider.style.cssText = `
				height: 1px;
				background: rgba(255,255,255,0.2);
				margin: 4px 0;
			`
			menu.appendChild(divider)
		}

		// 模式选择
		const modes = [
			{ id: 'player', label: '👤 玩家游玩' },
			{ id: 'ai', label: '🤖 AI控制' },
			{ id: 'train', label: '📊 AI训练' }
		]

		modes.forEach(item => {
			const el = document.createElement('div')
			el.className = 'menu-item'
			el.textContent = item.label
			el.style.cssText = `
				padding: 8px 16px;
				cursor: pointer;
				color: #fff;
				font-size: 13px;
			`
			el.addEventListener('click', () => {
				if (this.onModeChange) this.onModeChange(item.id)
				menu.style.display = 'none'
			})
			addHoverEffect(el)
			menu.appendChild(el)
		})

		addDivider()

		// 训练速度（仅训练模式时可用）
		const speedTitle = document.createElement('div')
		speedTitle.textContent = '⏱️ 训练速度'
		speedTitle.style.cssText = 'padding: 4px 16px; color: rgba(255,255,255,0.5); font-size: 11px;'
		menu.appendChild(speedTitle)

		const speeds = [
			{ id: 'step', label: '🚶 单步' },
			{ id: 'slow', label: '🐢 慢速' },
			{ id: 'normal', label: '🚶 中速' },
			{ id: 'fast', label: '🏃 快速' },
			{ id: 'max', label: '⚡ 极速' }
		]

		speeds.forEach(item => {
			const el = document.createElement('div')
			el.className = 'menu-item'
			el.textContent = item.label
			el.style.cssText = `
				padding: 8px 16px 8px 24px;
				cursor: pointer;
				color: #fff;
				font-size: 12px;
			`
			el.addEventListener('click', () => {
				if (this.onSpeedChange) this.onSpeedChange(item.id)
				menu.style.display = 'none'
			})
			addHoverEffect(el)
			menu.appendChild(el)
		})

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
