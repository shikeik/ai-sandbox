// ========== Brain Lab UI 控制器 ==========

import { DOMRenderer } from "../render/index.js"
import { Logger } from "../../engine/utils/Logger.js"
import { ConsolePanel } from "../../engine/console/ConsolePanel.js"

const API_BASE = "/api/brain-lab"

export type TabType = "ai" | "manual"

/**
 * Brain Lab UI 控制器
 * 
 * 职责：
 * - Tab 切换管理
 * - AI 控制（单步、自动、重置）
 * - 手动控制（键盘、按钮）
 * - 状态刷新与渲染
 */
export class BrainLabUI {
	private renderer!: DOMRenderer
	private isRunning: boolean = false
	private autoPlayInterval: number | null = null
	private logger!: Logger
	private consolePanel!: ConsolePanel
	private currentState: any = null
	private currentTab: TabType = "ai"

	constructor() {
		try {
			// 初始化日志系统
			this.logger = new Logger("[BRAIN-LAB]")
			this.consolePanel = new ConsolePanel("#console-panel", this.logger)
			this.consolePanel.init()
			this.consolePanel.open()

			// 检查容器
			const worldContainer = document.getElementById("world-container")
			const brainContainer = document.getElementById("brain-container")

			if (!worldContainer) {
				throw new Error("找不到 world-container 元素")
			}
			if (!brainContainer) {
				throw new Error("找不到 brain-container 元素")
			}

			this.renderer = new DOMRenderer("world-container", "brain-container")
			this.bindTabControls()
			this.bindAIControls()
			this.bindManualControls()

			// 初始渲染
			this.refreshState()

			// 暴露调试API
			this.exposeDebugAPI()

		} catch (err: any) {
			const container = document.getElementById("world-container")
			if (container) {
				container.innerHTML = `<div style="color:red;padding:20px;">初始化错误: ${err.message}</div>`
			}
		}
	}

	/**
	 * 暴露调试 API
	 */
	private exposeDebugAPI(): void {
		;(window as any).brainLabDebug = {
			step: () => this.step(),
			reset: () => this.reset(),
			state: () => this.refreshState(),
			move: (action: string) => this.manualMove(action),
			logs: () => fetch(`${API_BASE}/logs`, { method: "POST" }).then(r => r.json()),
			clearLogs: () => fetch(`${API_BASE}/clear-logs`, { method: "POST" })
		}
	}

	// ========== Tab 切换 ==========

	private bindTabControls(): void {
		const tabBtns = document.querySelectorAll(".tab-btn")
		tabBtns.forEach(btn => {
			btn.addEventListener("click", () => {
				const tab = btn.getAttribute("data-tab") as TabType
				this.switchTab(tab)
			})
		})
	}

	private switchTab(tab: TabType): void {
		this.currentTab = tab

		// 更新 Tab 按钮状态
		document.querySelectorAll(".tab-btn").forEach(btn => {
			btn.classList.toggle("active", btn.getAttribute("data-tab") === tab)
		})

		// 更新内容显示
		document.querySelectorAll(".tab-content").forEach(content => {
			content.classList.toggle("active", content.id === `tab-${tab}`)
		})

		// 如果切换到 AI 模式，自动刷新一次状态
		if (tab === "ai") {
			this.refreshState()
		}
	}

	// ========== AI 控制 ==========

	private bindAIControls(): void {
		document.getElementById("btn-step")?.addEventListener("click", () => this.step())
		document.getElementById("btn-auto")?.addEventListener("click", () => this.toggleAuto())
		document.getElementById("btn-reset")?.addEventListener("click", () => this.reset())

		document.getElementById("depth-slider")?.addEventListener("input", (e) => {
			const depth = parseInt((e.target as HTMLInputElement).value)
			this.setDepth(depth)
		})
	}

	/**
	 * AI 单步执行
	 */
	async step(): Promise<void> {
		if (this.isRunning) return
		this.isRunning = true

		try {
			const res = await fetch(`${API_BASE}/step`, { method: "POST" })
			const data = await res.json()

			// 渲染大脑思考
			this.renderer.renderImaginationFromAPI(data)

			// 播放动画
			if (data.animations && data.animations.length > 0) {
				await this.renderer.playAnimations(data.animations)
			}

			// 检查死亡
			if (data.result?.dead) {
				await this.handleDeath()
				return
			}

			// 动画完成后刷新状态
			await this.refreshState()

			if (data.result?.reachedGoal) {
				this.stopAuto()
			}
		} catch {
			// 静默处理错误
		}

		this.isRunning = false
	}

	/**
	 * 切换自动运行
	 */
	private toggleAuto(): void {
		if (this.autoPlayInterval) {
			this.stopAuto()
		} else {
			document.getElementById("btn-auto")!.textContent = "⏸️ 暂停"
			this.autoPlayInterval = window.setInterval(() => this.step(), 2000)
		}
	}

	/**
	 * 停止自动运行
	 */
	stopAuto(): void {
		if (this.autoPlayInterval) {
			clearInterval(this.autoPlayInterval)
			this.autoPlayInterval = null
			document.getElementById("btn-auto")!.textContent = "▶️ 自动"
		}
	}

	/**
	 * 重置游戏
	 */
	async reset(): Promise<void> {
		this.stopAuto()
		try {
			await fetch(`${API_BASE}/reset`, { method: "POST" })
			await this.refreshState()
			this.renderer.clearBrainPanel()
		} catch {
			// 静默处理错误
		}
	}

	/**
	 * 设置想象深度
	 */
	async setDepth(depth: number): Promise<void> {
		try {
			await fetch(`${API_BASE}/set-depth`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ depth })
			})
			document.getElementById("depth-value")!.textContent = depth.toString()
		} catch {
			// 静默处理错误
		}
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
		document.addEventListener("keydown", (e) => this.handleKeyDown(e))
	}

	/**
	 * 处理键盘事件
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		if (this.currentTab !== "manual") return

		const keyMap: Record<string, string> = {
			"ArrowLeft": "LEFT",
			"a": "LEFT",
			"A": "LEFT",
			"ArrowRight": "RIGHT",
			"d": "RIGHT",
			"D": "RIGHT",
			"ArrowUp": "JUMP",
			"w": "JUMP",
			"W": "JUMP",
			" ": "JUMP",
			"ArrowDown": "WAIT",
			"s": "WAIT",
			"S": "WAIT",
			"q": "JUMP_LEFT",
			"Q": "JUMP_LEFT",
			"e": "JUMP_RIGHT",
			"E": "JUMP_RIGHT",
		}

		const action = keyMap[e.key]
		if (action) {
			e.preventDefault()
			this.manualMove(action)
		}
	}

	/**
	 * 手动移动
	 */
	async manualMove(action: string): Promise<void> {
		if (this.isRunning) return
		this.isRunning = true

		try {
			const res = await fetch(`${API_BASE}/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action })
			})
			const data = await res.json()

			if (data.error) {
				this.showMessage(`❌ ${data.error}`)
				this.isRunning = false
				return
			}

			// 播放动画
			if (data.animations && data.animations.length > 0) {
				await this.renderer.playAnimations(data.animations)
			}

			// 刷新状态
			await this.refreshState()

			// 更新手动模式的位置显示
			this.updateManualPosition(data.to)

			// 检查结果
			if (data.result?.dead) {
				// 死亡：显示效果后自动重置
				await this.handleDeath()
				return
			}
			if (data.result?.reachedGoal) {
				this.showMessage("🎉 恭喜到达终点！")
			}

		} catch {
			// 静默处理错误
		}

		this.isRunning = false
	}

	/**
	 * 手动重置
	 */
	async manualReset(): Promise<void> {
		try {
			await fetch(`${API_BASE}/reset`, { method: "POST" })
			await this.refreshState()
			this.updateManualPosition({ x: 1, y: 1 })
			this.showMessage("🔄 游戏已重置")
		} catch {
			// 静默处理错误
		}
	}

	/**
	 * 处理死亡
	 */
	private async handleDeath(): Promise<void> {
		// 显示死亡效果
		this.showMessage("💀 坠入虚空！")

		// 等待消息显示
		await new Promise(resolve => setTimeout(resolve, 800))

		// 渐暗效果
		const worldContainer = document.getElementById("world-container")
		if (worldContainer) {
			worldContainer.style.transition = "opacity 0.3s ease"
			worldContainer.style.opacity = "0"
		}

		// 等待渐暗完成
		await new Promise(resolve => setTimeout(resolve, 300))

		// 重置游戏
		await fetch(`${API_BASE}/reset`, { method: "POST" })
		await this.refreshState()
		this.updateManualPosition({ x: 1, y: 1 })

		// 渐亮效果
		if (worldContainer) {
			worldContainer.style.opacity = "1"
		}

		// 等待渐亮完成
		await new Promise(resolve => setTimeout(resolve, 300))

		// 清除过渡效果
		if (worldContainer) {
			worldContainer.style.transition = ""
		}

		this.isRunning = false
	}

	/**
	 * 更新手动模式位置显示
	 */
	private updateManualPosition(pos: { x: number; y: number }): void {
		const posEl = document.getElementById("manual-position")
		if (posEl) {
			posEl.textContent = `(${pos.x}, ${pos.y})`
		}
	}

	// ========== 状态管理 ==========

	/**
	 * 刷新状态
	 */
	async refreshState(): Promise<void> {
		try {
			const res = await fetch(`${API_BASE}/state`)

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`)
			}

			const data = await res.json()
			this.currentState = data

			if (!data.gridRaw && !data.grid) {
				throw new Error("API返回数据缺少gridRaw/grid字段")
			}

			this.renderer.renderWorldFromAPI(data)

			if (data.hero) {
				this.updateManualPosition(data.hero)
			}

		} catch {
			// 静默处理错误
		}
	}

	/**
	 * 显示消息
	 */
	private showMessage(msg: string): void {
		const el = document.getElementById("message")!
		el.textContent = msg
		el.classList.add("show")
		setTimeout(() => el.classList.remove("show"), 2000)
	}
}
