// ========== Brain Lab 主入口 - Tab切换版 ==========

import { DOMRenderer } from "./DOMRenderer.js"
import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"

const API_BASE = '/api/brain-lab'

class BrainLabUI {
	private renderer!: DOMRenderer
	private isRunning: boolean = false
	private autoPlayInterval: number | null = null
	private logger!: Logger
	private consolePanel!: ConsolePanel
	private currentState: any = null
	private currentTab: 'ai' | 'manual' = 'ai'

	constructor() {
		console.log("[BrainLabUI] 初始化开始...")
		
		try {
			// 初始化日志系统
			this.logger = new Logger("[BRAIN-LAB]")
			this.consolePanel = new ConsolePanel("#console-panel", this.logger)
			this.consolePanel.init()
			this.consolePanel.open()
			
			console.log("[BRAIN-LAB] [MAIN] 初始化Brain Lab UI...")
			
			// 检查容器
			const worldContainer = document.getElementById("world-container")
			const brainContainer = document.getElementById("brain-container")
			
			if (!worldContainer) {
				throw new Error("找不到 world-container 元素")
			}
			if (!brainContainer) {
				throw new Error("找不到 brain-container 元素")
			}
			
			console.log("[BRAIN-LAB] [MAIN] 容器检查通过")
			
			this.renderer = new DOMRenderer("world-container", "brain-container")
			this.bindTabControls()
			this.bindAIControls()
			this.bindManualControls()
			
			// 初始渲染
			this.refreshState()
			
			console.log("[BRAIN-LAB] [MAIN] Brain Lab UI初始化完成")
			
			// 暴露调试API
			;(window as any).brainLabDebug = {
				step: () => this.step(),
				reset: () => this.reset(),
				state: () => this.refreshState(),
				move: (action: string) => this.manualMove(action),
				logs: () => fetch(`${API_BASE}/logs`, {method: 'POST'}).then(r => r.json()),
				clearLogs: () => fetch(`${API_BASE}/clear-logs`, {method: 'POST'})
			}
			
		} catch (err: any) {
			console.error("[BrainLabUI] 初始化失败:", err)
			const container = document.getElementById("world-container")
			if (container) {
				container.innerHTML = `<div style="color:red;padding:20px;">初始化错误: ${err.message}</div>`
			}
		}
	}

	// ========== Tab切换 ==========
	private bindTabControls(): void {
		const tabBtns = document.querySelectorAll('.tab-btn')
		tabBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				const tab = btn.getAttribute('data-tab') as 'ai' | 'manual'
				this.switchTab(tab)
			})
		})
	}

	private switchTab(tab: 'ai' | 'manual'): void {
		this.currentTab = tab
		console.log(`[BRAIN-LAB] [UI] 切换到${tab === 'ai' ? 'AI' : '手动'}模式`)

		// 更新Tab按钮状态
		document.querySelectorAll('.tab-btn').forEach(btn => {
			btn.classList.toggle('active', btn.getAttribute('data-tab') === tab)
		})

		// 更新内容显示
		document.querySelectorAll('.tab-content').forEach(content => {
			content.classList.toggle('active', content.id === `tab-${tab}`)
		})

		// 如果切换到AI模式，自动刷新一次状态
		if (tab === 'ai') {
			this.refreshState()
		}
	}

	// ========== AI控制 ==========
	private bindAIControls(): void {
		document.getElementById("btn-step")?.addEventListener("click", () => this.step())
		document.getElementById("btn-auto")?.addEventListener("click", () => this.toggleAuto())
		document.getElementById("btn-reset")?.addEventListener("click", () => this.reset())

		document.getElementById("depth-slider")?.addEventListener("input", (e) => {
			const depth = parseInt((e.target as HTMLInputElement).value)
			this.setDepth(depth)
		})
	}

	// ========== 手动控制 ==========
	private bindManualControls(): void {
		// 方向键
		document.getElementById("btn-left")?.addEventListener("click", () => this.manualMove("LEFT"))
		document.getElementById("btn-right")?.addEventListener("click", () => this.manualMove("RIGHT"))
		document.getElementById("btn-up")?.addEventListener("click", () => this.manualMove("JUMP"))
		document.getElementById("btn-wait")?.addEventListener("click", () => this.manualMove("WAIT"))
		document.getElementById("btn-jump-left")?.addEventListener("click", () => this.manualMove("JUMP_LEFT"))
		document.getElementById("btn-jump-right")?.addEventListener("click", () => this.manualMove("JUMP_RIGHT"))

		// 重置按钮
		document.getElementById("btn-manual-reset")?.addEventListener("click", () => this.manualReset())

		// 键盘控制
		document.addEventListener("keydown", (e) => {
			if (this.currentTab !== 'manual') return
			
			switch (e.key) {
				case 'ArrowLeft':
				case 'a':
				case 'A':
					e.preventDefault()
					this.manualMove("LEFT")
					break
				case 'ArrowRight':
				case 'd':
				case 'D':
					e.preventDefault()
					this.manualMove("RIGHT")
					break
				case 'ArrowUp':
				case 'w':
				case 'W':
				case ' ':
					e.preventDefault()
					this.manualMove("JUMP")
					break
				case 'ArrowDown':
				case 's':
				case 'S':
					e.preventDefault()
					this.manualMove("WAIT")
					break
				case 'q':
				case 'Q':
					e.preventDefault()
					this.manualMove("JUMP_LEFT")
					break
				case 'e':
				case 'E':
					e.preventDefault()
					this.manualMove("JUMP_RIGHT")
					break
			}
		})
	}

	// ========== 手动移动 ==========
	async manualMove(action: string): Promise<void> {
		if (this.isRunning) return
		this.isRunning = true
		console.log(`[BRAIN-LAB] [MANUAL] 手动移动: ${action}`)

		try {
			const res = await fetch(`${API_BASE}/move`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			})
			const data = await res.json()

			if (data.error) {
				console.error(`[BRAIN-LAB] [MANUAL] 错误: ${data.error}`)
				this.showMessage(`❌ ${data.error}`)
				this.isRunning = false
				return
			}

			console.log(`[BRAIN-LAB] [MANUAL] 移动成功: (${data.from?.x},${data.from?.y}) -> (${data.to?.x},${data.to?.y})`)
			console.log(`[BRAIN-LAB] [MANUAL] 动画事件: ${data.animations?.length || 0}个`)

			// 播放动画
			if (data.animations && data.animations.length > 0) {
				await this.renderer.playAnimations(data.animations)
			}

			// 刷新状态
			await this.refreshState()

			// 更新手动模式的位置显示
			this.updateManualPosition(data.to)

			// 检查是否到达终点
			if (data.result?.reachedGoal) {
				console.log("[BRAIN-LAB] [MANUAL] 🎉 到达终点！")
				this.showMessage("🎉 恭喜到达终点！")
			}

			// 检查是否触发按钮
			if (data.result?.triggeredButton) {
				console.log("[BRAIN-LAB] [MANUAL] ⚡ 触发按钮！")
				this.showMessage("⚡ 按钮已触发！")
			}

		} catch (err: any) {
			console.error("[BRAIN-LAB] [MANUAL] 移动失败:", err.message)
		}

		this.isRunning = false
	}

	// ========== 手动重置 ==========
	async manualReset(): Promise<void> {
		console.log("[BRAIN-LAB] [MANUAL] 手动重置游戏...")
		try {
			await fetch(`${API_BASE}/reset`, { method: 'POST' })
			await this.refreshState()
			this.updateManualPosition({ x: 1, y: 1 })
			this.showMessage("🔄 游戏已重置")
		} catch (err: any) {
			console.error("[BRAIN-LAB] [MANUAL] 重置失败:", err.message)
		}
	}

	// ========== 更新手动模式位置显示 ==========
	private updateManualPosition(pos: { x: number, y: number }): void {
		const posEl = document.getElementById("manual-position")
		if (posEl) {
			posEl.textContent = `(${pos.x}, ${pos.y})`
		}
	}

	// ========== 状态刷新 ==========
	async refreshState(): Promise<void> {
		try {
			console.log("[BRAIN-LAB] [API] 获取状态...")
			const res = await fetch(`${API_BASE}/state`)
			
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`)
			}
			
			const data = await res.json()
			this.currentState = data
			
			console.log(`[BRAIN-LAB] [API] 获取状态成功: hero=(${data.hero?.x},${data.hero?.y})`)
			
			// 检查数据
			if (!data.gridRaw && !data.grid) {
				throw new Error("API返回数据缺少gridRaw/grid字段")
			}
			
			this.renderer.renderWorldFromAPI(data)
			
			// 更新手动模式的位置显示
			if (data.hero) {
				this.updateManualPosition(data.hero)
			}
			
			console.log("[BRAIN-LAB] [RENDER] 世界渲染完成")
			
		} catch (err: any) {
			console.error("[BRAIN-LAB] [API] 获取状态失败:", err.message)
		}
	}

	// ========== AI步骤 ==========
	async step(): Promise<void> {
		if (this.isRunning) return
		this.isRunning = true
		console.log("[BRAIN-LAB] [GAME] 执行AI步骤...")

		try {
			const res = await fetch(`${API_BASE}/step`, { method: 'POST' })
			const data = await res.json()
			
			console.log(`[BRAIN-LAB] [BRAIN] 决策: ${data.decision?.action}`)
			console.log(`[BRAIN-LAB] [GAME] 动画事件: ${data.animations?.length || 0}个`)

			// 渲染大脑思考
			this.renderer.renderImaginationFromAPI(data)

			// 播放动画
			if (data.animations && data.animations.length > 0) {
				await this.renderer.playAnimations(data.animations)
			}

			// 动画完成后刷新状态
			await this.refreshState()

			if (data.result?.reachedGoal) {
				console.log("[BRAIN-LAB] [GAME] 🎉 到达终点！")
				this.stopAuto()
			}
		} catch (err: any) {
			console.error("[BRAIN-LAB] [API] 步骤失败:", err.message)
		}

		this.isRunning = false
	}

	// ========== 自动运行 ==========
	toggleAuto(): void {
		if (this.autoPlayInterval) {
			this.stopAuto()
		} else {
			console.log("[BRAIN-LAB] [GAME] 开始自动运行")
			document.getElementById("btn-auto")!.textContent = "⏸️ 暂停"
			this.autoPlayInterval = window.setInterval(() => this.step(), 2000)
		}
	}

	stopAuto(): void {
		if (this.autoPlayInterval) {
			clearInterval(this.autoPlayInterval)
			this.autoPlayInterval = null
			document.getElementById("btn-auto")!.textContent = "▶️ 自动"
		}
	}

	// ========== 重置游戏 ==========
	async reset(): Promise<void> {
		this.stopAuto()
		console.log("[BRAIN-LAB] [GAME] 重置游戏...")
		try {
			await fetch(`${API_BASE}/reset`, { method: 'POST' })
			await this.refreshState()
			this.renderer.clearBrainPanel()
		} catch (err: any) {
			console.error("[BRAIN-LAB] [API] 重置失败:", err.message)
		}
	}

	// ========== 设置深度 ==========
	async setDepth(depth: number): Promise<void> {
		try {
			await fetch(`${API_BASE}/set-depth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ depth })
			})
			document.getElementById("depth-value")!.textContent = depth.toString()
			console.log(`[BRAIN-LAB] [CONFIG] 想象深度: ${depth}`)
		} catch (err: any) {
			console.error("[BRAIN-LAB] [API] 设置深度失败:", err.message)
		}
	}

	// ========== 显示消息 ==========
	private showMessage(msg: string): void {
		const el = document.getElementById('message')!
		el.textContent = msg
		el.classList.add('show')
		setTimeout(() => el.classList.remove('show'), 2000)
	}
}

// 启动
document.addEventListener("DOMContentLoaded", () => {
	console.log("[BrainLabUI] DOM加载完成")
	new BrainLabUI()
})
