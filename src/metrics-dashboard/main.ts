// ========== 指标仪表盘入口 ==========
// 职责：模块初始化与协调，遵循 SRP 原则

import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"
import { MetricsStore } from "./metrics-store.js"
import { UIManager } from "./ui-manager.js"
import { UPDATE_INTERVAL } from "./constants.js"

// ========== 全局状态 ==========

/** 应用状态 */
interface AppState {
	store: MetricsStore
	uiManager: UIManager
	logger: Logger
	isAutoUpdate: boolean
	updateTimer: number | null
}

let state: AppState | null = null

// ========== 初始化函数 ==========

/**
 * 初始化应用
 */
function init(): void {
	console.log("METRICS", "初始化指标仪表盘...")

	// 创建日志系统
	const logger = new Logger("metrics-dashboard")

	// 创建数据存储
	const store = new MetricsStore()

	// 创建 UI 管理器
	const uiManager = new UIManager(store)
	uiManager.init()

	// 初始化状态
	state = {
		store,
		uiManager,
		logger,
		isAutoUpdate: true,
		updateTimer: null,
	}

	// 初始化控制台
	initConsole(logger)

	// 生成初始数据
	generateInitialData()

	// 启动自动更新
	startAutoUpdate()

	console.log("METRICS", "指标仪表盘初始化完成")
}

/**
 * 初始化控制台面板
 * @param logger 日志实例
 */
function initConsole(logger: Logger): void {
	const consoleMount = document.getElementById("console-mount")
	if (!consoleMount) return

	const consolePanel = new ConsolePanel(consoleMount, logger)
	consolePanel.init()

	// 绑定全局快捷键
	;(window as unknown as Record<string, unknown>).toggleConsole = () => {
		consolePanel.toggle()
	}
}

/**
 * 生成初始数据
 */
function generateInitialData(): void {
	if (!state) return

	console.log("METRICS", "生成初始数据...")
	state.store.generateMockData(50, 0)
}

/**
 * 启动自动更新
 */
function startAutoUpdate(): void {
	if (!state) return

	stopAutoUpdate() // 先停止之前的

	state.updateTimer = window.setInterval(() => {
		if (state?.isAutoUpdate) {
			generateNewDataPoint()
		}
	}, UPDATE_INTERVAL)

	console.log("METRICS", `自动更新已启动，间隔: ${UPDATE_INTERVAL}ms`)
}

/**
 * 停止自动更新
 */
function stopAutoUpdate(): void {
	if (!state?.updateTimer) return

	clearInterval(state.updateTimer)
	state.updateTimer = null
}

/**
 * 生成新的数据点
 */
function generateNewDataPoint(): void {
	if (!state) return

	const latest = state.store.getLatest()
	if (!latest) return

	const step = latest.step + 10

	// 模拟训练收敛过程
	const lossNoise = (Math.random() - 0.5) * 0.05
	const loss = Math.max(0.1, latest.loss * 0.998 + lossNoise)

	const accNoise = (Math.random() - 0.3) * 2
	const accuracy = Math.min(95, Math.max(20, latest.accuracy + accNoise * 0.5))

	const validNoise = (Math.random() - 0.3) * 3
	const validRate = Math.min(90, Math.max(30, latest.validRate + validNoise * 0.5))

	const epsilon = Math.max(0.1, latest.epsilon - 0.0005)

	state.store.add({
		step,
		loss,
		accuracy,
		validRate,
		epsilon,
	})
}

/**
 * 切换自动更新
 */
function toggleAutoUpdate(): void {
	if (!state) return

	state.isAutoUpdate = !state.isAutoUpdate
	console.log("METRICS", `自动更新: ${state.isAutoUpdate ? "开启" : "关闭"}`)
}

/**
 * 清理资源
 */
function destroy(): void {
	if (!state) return

	stopAutoUpdate()
	state.logger.destroy()
	state = null
}

// ========== 全局暴露 ==========

// 暴露给全局供调试使用
;(window as unknown as Record<string, unknown>).metricsDashboard = {
	toggleAutoUpdate,
	destroy,
}

// ========== 启动 ==========

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}
