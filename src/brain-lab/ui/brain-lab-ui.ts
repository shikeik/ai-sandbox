// ========== Brain Lab UI 控制器 ==========

import { DOMRenderer } from "../render/index.js"
import { Logger } from "../../engine/utils/Logger.js"
import { ConsolePanel } from "../../engine/console/ConsolePanel.js"
import { DEFAULT_LEVEL_MAP, ADVANCED_LEVEL_MAP } from "../config.js"
import type { APIStateResponse, APIMoveResponse } from "../types/api.js"
import { UIManager } from "./ui-manager.js"
import { TransitionManager } from "./transition-manager.js"

const API_BASE = "/api/brain-lab"

type LevelName = "default" | "advanced"

/**
 * Brain Lab UI 控制器
 * 
 * 职责：
 * - 手动控制（键盘、按钮）
 * - 状态刷新与渲染
 */
export class BrainLabUI {
	private renderer!: DOMRenderer
	private uiManager!: UIManager
	private transitionManager!: TransitionManager
	private isRunning: boolean = false
	private logger!: Logger
	private consolePanel!: ConsolePanel
	private currentState: APIStateResponse | null = null
	private currentLevel: LevelName = "default"

	constructor() {
		try {
			// 初始化日志系统
			this.logger = new Logger("BRAIN-LAB")
			this.consolePanel = new ConsolePanel("#console-panel", this.logger)
			this.consolePanel.init()
			this.consolePanel.open()

			// 初始化 UI 管理器和转场管理器
			this.uiManager = new UIManager()
			this.transitionManager = new TransitionManager(this.uiManager)

			// 检查容器
			const worldContainer = this.uiManager.getElement("world-container")
			if (!worldContainer) {
				throw new Error("找不到 world-container 元素")
			}

			this.renderer = new DOMRenderer("world-container", "brain-container")
			this.bindControls()

			// 初始渲染
			this.refreshState()

			// 暴露调试API
			this.exposeDebugAPI()

		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			this.uiManager?.showErrorInWorld(`初始化错误: ${message}`)
		}
	}

	/**
	 * 暴露调试 API
	 */
	private exposeDebugAPI(): void {
		;(window as unknown as Record<string, unknown>).brainLabDebug = {
			reset: () => this.reset(),
			state: () => this.refreshState(),
			move: (action: string) => this.manualMove(action),
		}
	}

	// ========== 控制绑定 ==========

	private bindControls(): void {
		// 方向键
		document.getElementById("btn-left")?.addEventListener("click", () => this.manualMove("LEFT"))
		document.getElementById("btn-right")?.addEventListener("click", () => this.manualMove("RIGHT"))
		document.getElementById("btn-jump-left")?.addEventListener("click", () => this.manualMove("JUMP_LEFT"))
		document.getElementById("btn-jump-right")?.addEventListener("click", () => this.manualMove("JUMP_RIGHT"))
		document.getElementById("btn-jump-left-far")?.addEventListener("click", () => this.manualMove("JUMP_LEFT_FAR"))
		document.getElementById("btn-jump-right-far")?.addEventListener("click", () => this.manualMove("JUMP_RIGHT_FAR"))

		// 重置按钮
		document.getElementById("btn-reset")?.addEventListener("click", () => this.reset())

		// 关卡切换按钮
		document.getElementById("btn-switch-level")?.addEventListener("click", () => this.switchLevel())

		// 键盘控制
		document.addEventListener("keydown", (e) => this.handleKeyDown(e))
	}

	/**
	 * 处理键盘事件
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		const keyMap: Record<string, string> = {
			"ArrowLeft": "LEFT",
			"a": "LEFT",
			"A": "LEFT",
			"ArrowRight": "RIGHT",
			"d": "RIGHT",
			"D": "RIGHT",
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

			if ("error" in data && data.error) {
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

		} catch {
			// 静默处理错误
		}

		this.isRunning = false
	}

	/**
	 * 重置游戏
	 */
	async reset(): Promise<void> {
		try {
			await fetch(`${API_BASE}/reset`, { method: "POST" })
			
			// 清除旧视图，强制重新渲染
			const worldContainer = document.getElementById("world-container")
			if (worldContainer) {
				worldContainer.innerHTML = ""
			}
			
			await this.refreshState()
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
			this.showToast(`🗺️ 已切换到：${levelData.name}`)
		} catch {
			// 静默处理错误
			this.showToast("❌ 切换关卡失败")
		}
	}

	/**
	 * 处理死亡
	 */
	private async handleDeath(): Promise<void> {
		await this.transitionManager.playTransition("death", async () => {
			await fetch(`${API_BASE}/reset`, { method: "POST" })
			await this.refreshState()
			this.updateManualPosition({ x: 1, y: 1 })
		})
		this.isRunning = false
	}

	/**
	 * 处理胜利
	 */
	private async handleVictory(): Promise<void> {
		await this.transitionManager.playTransition("victory", async () => {
			await fetch(`${API_BASE}/reset`, { method: "POST" })
			await this.refreshState()
			this.updateManualPosition({ x: 1, y: 1 })
		})
		this.isRunning = false
	}

	/**
	 * 更新手动模式位置显示（游戏视图内的 HUD）
	 */
	private updateManualPosition(pos: { x: number; y: number }): void {
		this.uiManager.updatePositionHUD(pos)
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

			const data = await res.json() as APIStateResponse
			this.currentState = data

			if (!data.gridRaw && !("grid" in data)) {
				throw new Error("API返回数据缺少gridRaw/grid字段")
			}

			this.renderer.renderWorldFromAPI(data)

		} catch {
			// 静默处理错误
		}
	}

	/**
	 * 显示 Toast 提示
	 */
	private showToast(msg: string): void {
		this.uiManager.showToast(msg)
	}
}
