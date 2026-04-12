// ========== 因果链 AI - 主入口 ==========

import { StateManager } from "./state"
import { UIManager } from "./ui-manager"
import { GameController } from "./game-controller"
import type { ActionType } from "./types"

// 是否已尝试进入全屏（避免重复提示）
let hasAttemptedFullscreen = false

// 进入全屏
async function enterFullscreen(): Promise<void> {
	const docEl = document.documentElement as HTMLElement & {
		requestFullscreen?: () => Promise<void>
		webkitRequestFullscreen?: () => Promise<void>
		mozRequestFullScreen?: () => Promise<void>
		msRequestFullscreen?: () => Promise<void>
	}

	try {
		if (docEl.requestFullscreen) {
			await docEl.requestFullscreen()
		} else if (docEl.webkitRequestFullscreen) {
			await docEl.webkitRequestFullscreen()
		} else if (docEl.mozRequestFullScreen) {
			await docEl.mozRequestFullScreen()
		} else if (docEl.msRequestFullscreen) {
			await docEl.msRequestFullscreen()
		}
	} catch (err) {
		console.log("[CAUSAL-AI] 全屏请求失败:", err)
	}
}

// 锁定横屏
async function lockLandscape(): Promise<void> {
	const scr = globalThis.screen as typeof globalThis.screen & {
		orientation?: {
			lock?: (orientation: string) => Promise<void>
		}
	}

	try {
		if (scr.orientation?.lock) {
			await scr.orientation.lock("landscape")
		}
	} catch (err) {
		console.log("[CAUSAL-AI] 横屏锁定失败:", err)
	}
}

// 初始化全屏覆盖层
function initFullscreenOverlay(): void {
	const overlay = document.getElementById("fullscreenOverlay")
	if (!overlay || hasAttemptedFullscreen) return

	// 始终显示覆盖层
	overlay.classList.remove("hidden")

	// 点击事件
	overlay.addEventListener("click", async () => {
		hasAttemptedFullscreen = true
		await enterFullscreen()
		await lockLandscape()

		// 添加全屏样式
		document.body.classList.add("is-fullscreen")

		// 隐藏覆盖层
		overlay.classList.add("hidden")

		// 触发 resize 让 Canvas 适应
		window.dispatchEvent(new Event("resize"))
	})
}

// 初始化标签切换
function initTabs(): void {
	const tabs = document.querySelectorAll(".tab")
	const panes = document.querySelectorAll(".tab-pane")

	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			const target = tab.getAttribute("data-tab")

			// 切换标签状态
			tabs.forEach((t) => t.classList.remove("active"))
			tab.classList.add("active")

			// 切换面板显示
			panes.forEach((pane) => {
				pane.classList.remove("active")
				if (pane.id === `tab-${target}`) {
					pane.classList.add("active")
				}
			})
		})
	})
}

// 初始化函数
function init(): void {
	const canvas = document.getElementById("worldCanvas") as HTMLCanvasElement
	if (!canvas) {
		throw new Error("未找到 canvas 元素")
	}

	// 创建管理器
	const stateManager = new StateManager()
	const uiManager = new UIManager()

	// 创建游戏控制器
	const controller = new GameController(canvas, stateManager, uiManager)

	// 绑定基础动作按钮
	const actionButtons: ActionType[] = [
		"move_up",
		"move_down",
		"move_left",
		"move_right",
		"pickup"
	]

	actionButtons.forEach((action) => {
		uiManager.bindActionButton(action, () => controller.executeAction(action))
	})

	// 绑定重置按钮
	uiManager.bindActionButton("reset", () => controller.reset())

	// 绑定特殊按钮
	uiManager.bindButton("exploreBtn", () => controller.explore())
	uiManager.bindButton("generalizeBtn", () => controller.generalize())
	uiManager.bindButton("planBtn", () => controller.planAndExecute())
	uiManager.bindButton("clearExpBtn", () => controller.clearKnowledge())

	// 初始化标签切换
	initTabs()

	// 初始化全屏覆盖层（统一显示引导）
	initFullscreenOverlay()

	// 初始日志
	uiManager.addLog("👋 先探索积累经验 → 点击「泛化」→ 「后向规划」")
}

// DOM 加载完成后初始化
document.addEventListener("DOMContentLoaded", init)
