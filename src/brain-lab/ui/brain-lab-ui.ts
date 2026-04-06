// ========== Brain Lab UI 控制器 ==========

import { DOMRenderer } from "../render/index.js"
import { Logger } from "../../engine/utils/Logger.js"
import { ConsolePanel } from "../../engine/console/ConsolePanel.js"
import { DEFAULT_LEVEL_MAP, ADVANCED_LEVEL_MAP } from "../config.js"
import type { APIStateResponse, APIStepResponse, APIMoveResponse } from "../types/api.js"

const API_BASE = "/api/brain-lab"

type LevelName = "default" | "advanced"

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
	private currentState: APIStateResponse | null = null
	private currentTab: TabType = "ai"
	private currentLevel: LevelName = "default"
	private toastTimeout: number | null = null

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

		} catch (err: unknown) {
			const container = document.getElementById("world-container")
			if (container) {
				const message = err instanceof Error ? err.message : String(err)
				container.innerHTML = `<div style="color:red;padding:20px;">初始化错误: ${message}</div>`
			}
		}
	}

	/**
	 * 暴露调试 API
	 */
	private exposeDebugAPI(): void {
		;(window as unknown as Record<string, unknown>).brainLabDebug = {
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
			const data = await res.json() as APIMoveResponse

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

			// 检查胜利（在刷新状态前处理，保持玩家在终点位置）
			if (data.result?.reachedGoal) {
				this.stopAuto()
				await this.handleVictory()
				return
			}

			// 动画完成后刷新状态
			await this.refreshState()
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
		document.getElementById("btn-jump-left-far")?.addEventListener("click", () => this.manualMove("JUMP_LEFT_FAR"))
		document.getElementById("btn-jump-right-far")?.addEventListener("click", () => this.manualMove("JUMP_RIGHT_FAR"))

		// 重置按钮
		document.getElementById("btn-manual-reset")?.addEventListener("click", () => this.manualReset())

		// 关卡切换按钮
		document.getElementById("btn-switch-level")?.addEventListener("click", () => this.switchLevel())

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
			"z": "JUMP_LEFT_FAR",
			"Z": "JUMP_LEFT_FAR",
			"c": "JUMP_RIGHT_FAR",
			"C": "JUMP_RIGHT_FAR",
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
			const data = await res.json() as APIMoveResponse

			if (data.error) {
				this.showToast(`❌ ${data.error}`)
				this.isRunning = false
				return
			}

			// 播放动画
			if (data.animations && data.animations.length > 0) {
				await this.renderer.playAnimations(data.animations)
			}

			// 检查死亡（死亡时不刷新状态，保持玩家在虚空位置）
			if (data.result?.dead) {
				await this.handleDeath()
				return
			}

			// 检查胜利（在刷新状态前处理，保持玩家在终点位置）
			if (data.result?.reachedGoal) {
				await this.handleVictory()
				return
			}

			// 刷新状态
			await this.refreshState()

			// 更新手动模式的位置显示
			this.updateManualPosition(data.to)

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
			this.showToast("🔄 游戏已重置")
		} catch {
			// 静默处理错误
		}
	}

	/**
	 * 切换关卡
	 */
	async switchLevel(): Promise<void> {
		try {
			// 切换关卡
			this.currentLevel = this.currentLevel === "default" ? "advanced" : "default"
			const levelData = this.currentLevel === "default" ? DEFAULT_LEVEL_MAP : ADVANCED_LEVEL_MAP

			// 调用 API 切换关卡
			await fetch(`${API_BASE}/set-level`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ level: this.currentLevel }),
			})

			// 清除旧的视图，强制重新渲染
			const worldContainer = document.getElementById("world-container")
			if (worldContainer) {
				worldContainer.innerHTML = ""
			}

			// 重新初始化渲染器（因为世界尺寸可能改变）
			this.renderer = new DOMRenderer("world-container", "brain-container")

			// 刷新状态并强制渲染新地图
			await this.refreshState()
			this.updateManualPosition({ x: 1, y: 1 })
			this.showToast(`🗺️ 已切换到：${levelData.name}`)
		} catch {
			// 静默处理错误
			this.showToast("❌ 切换关卡失败")
		}
	}

	/**
	 * 处理死亡 - 同时显示骷髅头和渐暗，渐亮时间拉长
	 * 渐暗: 400ms, 停顿: 100ms, 渐亮: 800ms
	 */
	private async handleDeath(): Promise<void> {
		const worldContainer = document.getElementById("world-container")
		if (!worldContainer) return

		// 确保 world-container 有定位（用于绝对定位子元素）
		const originalPosition = worldContainer.style.position
		if (!originalPosition || originalPosition === "static") {
			worldContainer.style.position = "relative"
		}

		// 创建或获取骷髅头元素
		let skullEl = document.getElementById("brain-lab-skull") as HTMLElement
		if (!skullEl) {
			skullEl = document.createElement("div")
			skullEl.id = "brain-lab-skull"
			skullEl.textContent = "💀"
			skullEl.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				font-size: 48px;
				font-weight: bold;
				text-shadow: 0 0 30px #e74c3c;
				opacity: 0;
				pointer-events: none;
				z-index: 2000;
				transition: opacity 0.4s ease-in-out;
			`
			worldContainer.appendChild(skullEl)
		}

		// 创建转场遮罩（如果不存在）
		let overlay = document.querySelector(".brain-lab-overlay") as HTMLElement
		if (!overlay) {
			overlay = document.createElement("div")
			overlay.className = "brain-lab-overlay"
			overlay.style.cssText = `
				position: absolute;
				inset: 0;
				background: #000;
				opacity: 0;
				pointer-events: none;
				z-index: 1600;
				transition: opacity 0.4s ease-in-out;
				border-radius: 12px;
			`
			worldContainer.appendChild(overlay)
		}

		// 强制重绘确保 transition 生效
		void overlay.offsetHeight

		// 同时显示骷髅头和开始渐暗
		skullEl.style.opacity = "1"
		overlay.style.opacity = "1"

		// 等待渐暗完成（1200ms）
		await this._delay(600)

		// 渐暗完成后：隐藏骷髅头 + 重置游戏
		skullEl.style.opacity = "0"
		await fetch(`${API_BASE}/reset`, { method: "POST" })
		await this.refreshState()
		this.updateManualPosition({ x: 1, y: 1 })

		// 停顿（100ms）
		await this._delay(200)

		// 渐亮（拉长到800ms）
		overlay.style.transition = "opacity 0.6s ease-in-out"
		overlay.style.opacity = "0"
		await this._delay(600)

		// 恢复原始定位
		worldContainer.style.position = originalPosition

		this.isRunning = false
	}

	/**
	 * 处理胜利 - 类似死亡转场，但显示奖杯
	 */
	private async handleVictory(): Promise<void> {
		const worldContainer = document.getElementById("world-container")
		if (!worldContainer) return

		const originalPosition = worldContainer.style.position
		if (!originalPosition || originalPosition === "static") {
			worldContainer.style.position = "relative"
		}

		// 移除可能残留的旧奖杯（确保干净状态）
		const oldTrophy = document.getElementById("brain-lab-trophy")
		if (oldTrophy) oldTrophy.remove()

		// 创建新奖杯元素
		const trophyEl = document.createElement("div")
		trophyEl.id = "brain-lab-trophy"
		trophyEl.textContent = "🏆"
		trophyEl.style.cssText = `
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 56px;
			font-weight: bold;
			text-shadow: 0 0 30px #f1c40f;
			opacity: 0;
			pointer-events: none;
			z-index: 2000;
			transition: opacity 0.4s ease-in-out;
		`
		worldContainer.appendChild(trophyEl)

		// 创建或复用遮罩
		let overlay = document.querySelector(".brain-lab-overlay") as HTMLElement
		if (!overlay) {
			overlay = document.createElement("div")
			overlay.className = "brain-lab-overlay"
			overlay.style.cssText = `
				position: absolute;
				inset: 0;
				background: #000;
				opacity: 0;
				pointer-events: none;
				z-index: 1600;
				transition: opacity 0.4s ease-in-out;
				border-radius: 12px;
			`
			worldContainer.appendChild(overlay)
		}

		void overlay.offsetHeight

		// 同时显示奖杯和开始渐暗（双倍时间：1.2s）
		trophyEl.style.opacity = "1"
		overlay.style.transition = "opacity 1.2s ease-in-out"
		overlay.style.opacity = "1"

		await this._delay(1200)

		// 渐暗完成后：隐藏奖杯
		trophyEl.style.opacity = "0"

		// 等渐隐动画完成后移除奖杯，再重置游戏
		await this._delay(400)
		trophyEl.remove()

		await fetch(`${API_BASE}/reset`, { method: "POST" })
		await this.refreshState()
		this.updateManualPosition({ x: 1, y: 1 })

		await this._delay(200)

		// 渐亮（快速：400ms）
		overlay.style.transition = "opacity 0.5s ease-in-out"
		overlay.style.opacity = "0"
		await this._delay(500)

		worldContainer.style.position = originalPosition
		this.isRunning = false
	}

	/**
	 * 延迟辅助函数
	 */
	private _delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	/**
	 * 更新手动模式位置显示（游戏视图内的 HUD）
	 */
	private updateManualPosition(pos: { x: number; y: number }): void {
		const hud = document.querySelector(".position-hud")
		if (hud) {
			hud.textContent = `(${pos.x}, ${pos.y})`
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

			const data = await res.json() as APIMoveResponse
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
	 * 显示 Toast 提示
	 * 新 Toast 会直接顶掉旧 Toast，重新计时
	 */
	private showToast(msg: string): void {
		const el = document.getElementById("message")!

		// 清除旧的 timeout，防止快速消失
		if (this.toastTimeout) {
			clearTimeout(this.toastTimeout)
		}

		// 更新内容并显示
		el.textContent = msg
		el.classList.add("show")

		// 设置新的 timeout（1.5秒后消失）
		this.toastTimeout = window.setTimeout(() => {
			el.classList.remove("show")
			this.toastTimeout = null
		}, 1500)
	}
}
