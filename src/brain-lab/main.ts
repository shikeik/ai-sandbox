// ========== Brain Lab 主入口 ==========
// UI层：通过HTTP API与游戏逻辑通信

import { DOMRenderer } from "./DOMRenderer.js"
import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"

const API_BASE = '/api/brain-lab'

class BrainLabUI {
	private renderer: DOMRenderer
	private isRunning: boolean = false
	private autoPlayInterval: number | null = null
	private logger: Logger
	private consolePanel: ConsolePanel

	constructor() {
		// 初始化日志系统
		this.logger = new Logger("[BRAIN-LAB]")
		this.consolePanel = new ConsolePanel("#console-panel", this.logger)
		this.consolePanel.init()
		
		this.logger.info("MAIN", "初始化Brain Lab UI...")
		
		this.renderer = new DOMRenderer("world-container", "brain-container")
		this.bindControls()
		this.refreshState()
		
		this.logger.info("MAIN", "Brain Lab UI初始化完成")
		this.logger.info("MAIN", "curl命令示例: curl -X POST http://localhost:4000/api/brain-lab/state")
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

	// 从API获取状态并渲染
	async refreshState(): Promise<void> {
		try {
			const res = await fetch(`${API_BASE}/state`)
			const data = await res.json()
			this.renderer.renderWorldFromAPI(data)
		} catch (err) {
			this.logger.error("API", "获取状态失败:", err)
		}
	}

	// 单步执行
	async step(): Promise<void> {
		if (this.isRunning) return
		this.isRunning = true
		this.logger.info("GAME", "执行AI步骤...")

		try {
			const res = await fetch(`${API_BASE}/step`, { method: 'POST' })
			const data = await res.json()
			
			this.logger.info("BRAIN", `AI决策: ${data.decision?.action}, 理由: ${data.decision?.reasoning}`)
			this.logger.info("GAME", `新位置: (${data.result?.newPos?.x}, ${data.result?.newPos?.y})`)

			// 渲染思考过程
			this.renderer.renderImaginationFromAPI(data)

			// 刷新世界状态
			await this.refreshState()

			if (data.result?.reachedGoal) {
				this.logger.info("GAME", "🎉 到达终点！")
				this.stopAuto()
			}
		} catch (err) {
			this.logger.error("API", "步骤失败:", err)
		}

		this.isRunning = false
	}

	// 手动移动（调试用）
	async move(action: string): Promise<void> {
		try {
			const res = await fetch(`${API_BASE}/move`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			})
			const data = await res.json()
			this.logger.info("GAME", `手动移动: ${action}, 结果:`, data.result)
			await this.refreshState()
		} catch (err) {
			this.logger.error("API", "移动失败:", err)
		}
	}

	// 自动运行
	toggleAuto(): void {
		if (this.autoPlayInterval) {
			this.stopAuto()
		} else {
			this.logger.info("GAME", "开始自动运行")
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

	// 重置
	async reset(): Promise<void> {
		this.stopAuto()
		this.logger.info("GAME", "重置游戏...")
		try {
			await fetch(`${API_BASE}/reset`, { method: 'POST' })
			await this.refreshState()
			this.renderer.clearBrainPanel()
		} catch (err) {
			this.logger.error("API", "重置失败:", err)
		}
	}

	// 设置深度
	async setDepth(depth: number): Promise<void> {
		try {
			await fetch(`${API_BASE}/set-depth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ depth })
			})
			document.getElementById("depth-value")!.textContent = depth.toString()
			this.logger.info("CONFIG", `想象深度设置为: ${depth}`)
		} catch (err) {
			this.logger.error("API", "设置深度失败:", err)
		}
	}
}

// 启动
document.addEventListener("DOMContentLoaded", () => {
	new BrainLabUI()
})
