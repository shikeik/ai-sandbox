/**
 * 神经元区域管理器
 * 负责视图切换和菜单控制
 */

import { NetworkView } from './NetworkView.js'
import { HistoryView } from './HistoryView.js'
import { MatrixView } from './MatrixView.js'

export class NeuronAreaManager {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.currentView = null
		this.views = new Map()
		this.activeViewName = 'network'
	
		this.init()
	}
	
	init() {
		this.createMenuButton()
		this.createMenuDropdown()
	
		this.registerView('network', NetworkView)
		this.registerView('matrix', MatrixView)
		this.registerView('history', HistoryView)
	
		this.switchView('network')
		this.setupSwipeGesture()
	}
	
	setupSwipeGesture() {
		let touchStartX = 0
		let touchStartTime = 0
	
		this.container.addEventListener('touchstart', (e) => {
			if (e.touches.length === 2) {
				touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2
				touchStartTime = Date.now()
			}
		}, { passive: true })
	
		this.container.addEventListener('touchend', (e) => {
			if (e.changedTouches.length === 2) {
				const touchEndX = (e.changedTouches[0].clientX + e.changedTouches[1].clientX) / 2
				const deltaX = touchEndX - touchStartX
				const deltaTime = Date.now() - touchStartTime
		
				if (Math.abs(deltaX) > 50 && deltaTime < 500) {
					const views = Array.from(this.views.keys())
					const currentIndex = views.indexOf(this.activeViewName)
			
					if (deltaX > 0 && currentIndex > 0) {
						this.switchView(views[currentIndex - 1])
					} else if (deltaX < 0 && currentIndex < views.length - 1) {
						this.switchView(views[currentIndex + 1])
					}
				}
			}
		}, { passive: true })
	}
	
	createMenuButton() {
		// 菜单按钮创建到顶部控制栏
		const menuContainer = document.getElementById('neuron-menu-container')
		if (!menuContainer) return
		
		const btn = document.createElement('button')
		btn.id = 'view-menu-btn'
		btn.innerHTML = '🧠'
		btn.title = '神经元视图菜单'
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
	
		btn.addEventListener('click', () => this.toggleMenu())
		menuContainer.appendChild(btn)
		this.menuBtn = btn
	}
	
	createMenuDropdown() {
		// 下拉菜单创建到顶部控制栏
		const menuContainer = document.getElementById('neuron-menu-container')
		if (!menuContainer) return
		
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
	
		const addDivider = () => {
			const divider = document.createElement('div')
			divider.style.cssText = `
		height: 1px;
		background: rgba(255,255,255,0.2);
		margin: 4px 0;
		`
			menu.appendChild(divider)
		}

		const addHoverEffect = (el) => {
			el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.1)')
			el.addEventListener('mouseleave', () => el.style.background = 'transparent')
		}
	
		const modes =[
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
			})
			addHoverEffect(el)
			menu.appendChild(el)
		})
	
		addDivider()

		const speedTitle = document.createElement('div')
		speedTitle.textContent = '⏱️ 训练速度'
		speedTitle.style.cssText = 'padding: 4px 16px; color: rgba(255,255,255,0.5); font-size: 11px;'
		menu.appendChild(speedTitle)

		const speeds =[
			{ id: 'step', label: '🚶 单步 (等待确认)' },
			{ id: 'slow', label: '🐢 慢速 (1秒/步)' },
			{ id: 'normal', label: '🚶 中速 (200ms/步)' },
			{ id: 'fast', label: '🏃 快速 (50ms/步)' },
			{ id: 'max', label: '⚡ 极速 (无延迟)' }
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
			})
			addHoverEffect(el)
			menu.appendChild(el)
		})
	
		addDivider()
	
		const items =[
			{ id: 'network', label: '🧠 网络结构' },
			{ id: 'matrix', label: '🔢 权重矩阵' },
			{ id: 'history', label: '📈 训练历史' }
		]
	
		items.forEach(item => {
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
				this.switchView(item.id)
			})
			addHoverEffect(el)
			menu.appendChild(el)
		})
	
		menuContainer.appendChild(menu)
		this.menuDropdown = menu
	
		addDivider()

		// --- 新增：探索率手动控制区 ---
		const epsTitle = document.createElement('div')
		epsTitle.textContent = '🧠 好奇心控制'
		epsTitle.style.cssText = 'padding: 4px 16px; color: rgba(255,255,255,0.5); font-size: 11px;'
		menu.appendChild(epsTitle)

		// 开关：自动调节
		const toggleAuto = document.createElement('div')
		toggleAuto.className = 'menu-item'
		toggleAuto.textContent = '🔄 自动调节开关'
		toggleAuto.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #fff; font-size: 13px;'
		toggleAuto.addEventListener('click', () => {
			if (window.network) {
				window.network.autoAdjustEpsilon = !window.network.autoAdjustEpsilon
				alert(`自动调节已${window.network.autoAdjustEpsilon ? '开启' : '关闭'}`)
			}
		})
		addHoverEffect(toggleAuto)
		menu.appendChild(toggleAuto)

		// 一键设置：50% 探索率
		const set50 = document.createElement('div')
		set50.className = 'menu-item'
		set50.textContent = '🎲 设为 50% (梦游模式)'
		set50.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #f39c12; font-size: 13px;'
		set50.addEventListener('click', () => {
			if (window.network) {
				window.network.autoAdjustEpsilon = false // 自动设为手动锁定
				window.network.epsilon = 0.5
				alert('已锁定探索率为 50%')
			}
		})
		addHoverEffect(set50)
		menu.appendChild(set50)
	}
	
	toggleMenu() {
		if (this.menuDropdown.style.display === 'none') {
			this.showMenu()
		} else {
			this.hideMenu()
		}
	}
	
	showMenu() {
		this.menuDropdown.style.display = 'block'
	}
	
	hideMenu() {
		this.menuDropdown.style.display = 'none'
	}
	
	registerView(name, ViewClass) {
		this.views.set(name, ViewClass)
	}
	
	switchView(name) {
		if (!this.views.has(name)) return
	
		if (this.currentView) {
			this.currentView.destroy()
		}
	
		const canvas = this.container.querySelector('canvas')
		if (canvas) canvas.remove()
	
		const ViewClass = this.views.get(name)
		this.currentView = new ViewClass('neuron-area')
		this.activeViewName = name
	
		this.updateMenuButton()

		// 【修复 Bug 1】：抛出事件让 main.js 进行立刻绘制
		if (this.onViewChange) {
			this.onViewChange(name)
		}
	}
	
	updateMenuButton() {
		this.menuBtn.innerHTML = '☰'
	}
	
	getCurrentView() {
		return this.currentView
	}
	
	render(...args) {
		if (this.currentView && this.currentView.render) {
			this.currentView.render(...args)
		}
	}
}

export default NeuronAreaManager