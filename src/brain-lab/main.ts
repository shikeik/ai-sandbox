// ========== Brain Lab 主入口 ==========

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

	constructor() {
		console.log("[BrainLabUI] 初始化开始...")
		
		try {
			// 初始化日志系统
			this.logger = new Logger("[BRAIN-LAB]")
			this.consolePanel = new ConsolePanel("#console-panel", this.logger)
			this.consolePanel.init()
			
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
			this.bindControls()
			
			// 初始渲染
			this.refreshState()
			
			console.log("[BRAIN-LAB] [MAIN] Brain Lab UI初始化完成")
			
			// 暴露调试API
			;(window as any).brainLabDebug = {
				step: () => this.step(),
				reset: () => this.reset(),
				state: () => this.refreshState(),
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

	private bindControls(): void {
		document.getElementById("btn-step")?.addEventListener("click", () => this.step())
		document.getElementById("btn-auto")?.addEventListener("click", () => this.toggleAuto())
		document.getElementById("btn-reset")?.addEventListener("click", () => this.reset())

		document.getElementById("depth-slider")?.addEventListener("input", (e) => {
			const depth = parseInt((e.target as HTMLInputElement).value)
			this.setDepth(depth)
		})
	}

	async refreshState(): Promise<void> {
		try {
			console.log("[BRAIN-LAB] [API] 获取状态...")
			const res = await fetch(`${API_BASE}/state`)
			
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`)
			}
			
			const data = await res.json()
			console.log(`[BRAIN-LAB] [API] 获取状态成功: hero=(${data.hero?.x},${data.hero?.y})`)
			
			// 检查数据
			if (!data.gridRaw && !data.grid) {
				throw new Error("API返回数据缺少gridRaw/grid字段")
			}
			
			this.renderer.renderWorldFromAPI(data)
			console.log("[BRAIN-LAB] [RENDER] 世界渲染完成")
			
		} catch (err: any) {
			console.error("[BRAIN-LAB] [API] 获取状态失败:", err.message)
			console.error("[BrainLabUI] 获取状态失败:", err)
		}
	}

	async step(): Promise<void> {
		if (this.isRunning) return
		this.isRunning = true
		console.log("[BRAIN-LAB] [GAME] 执行AI步骤...")

		try {
			const res = await fetch(`${API_BASE}/step`, { method: 'POST' })
			const data = await res.json()
			
			console.log(`[BRAIN-LAB] [BRAIN] 决策: ${data.decision?.action}`)
			console.log(`[BRAIN-LAB] [GAME] 新位置: (${data.result?.newPos?.x}, ${data.result?.newPos?.y})`)

			this.renderer.renderImaginationFromAPI(data)
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

	toggleAuto(): void {
		if (this.autoPlayInterval) {
			this.stopAuto()
		} else {
			console.log("[BRAIN-LAB] [GAME] 开始自动运行")
			document.getElementById("btn-auto")!.textContent = "⏸️ 暂停"
			this.autoPlayInterval = window.setInterval(() => this.step(), 1500)
		}
	}

	stopAuto(): void {
		if (this.autoPlayInterval) {
			clearInterval(this.autoPlayInterval)
			this.autoPlayInterval = null
			document.getElementById("btn-auto")!.textContent = "▶️ 自动"
		}
	}

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
}

// 启动
document.addEventListener("DOMContentLoaded", () => {
	console.log("[BrainLabUI] DOM加载完成")
	new BrainLabUI()
})
