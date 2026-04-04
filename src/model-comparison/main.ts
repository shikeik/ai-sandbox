// ========== 模型对比页面入口 ==========
// 职责：模块初始化与协调，复用 metrics-dashboard 的 store 和 engine 的 console

import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"
import { MetricsStore } from "../metrics-dashboard/metrics-store.js"
import { TimelineController } from "./timeline-controller.js"
import { ModelComparisonUIManager } from "./ui-manager.js"

// ========== 全局状态 ==========

/** 应用状态 */
interface AppState {
	modelAStore: MetricsStore
	modelBStore: MetricsStore
	timeline: TimelineController
	uiManager: ModelComparisonUIManager
	logger: Logger
}

let state: AppState | null = null

// ========== 初始化函数 ==========

/**
 * 初始化应用
 */
function init(): void {
	console.log("MODEL-COMP", "初始化模型对比页面...")

	// 创建日志系统
	const logger = new Logger("model-comparison")

	// 创建两个独立的数据存储（分别对应 Model A 和 Model B）
	const modelAStore = new MetricsStore()
	const modelBStore = new MetricsStore()

	// 创建时间轴控制器
	const timeline = new TimelineController(0)

	// 创建 UI 管理器
	const uiManager = new ModelComparisonUIManager(modelAStore, modelBStore, timeline)
	uiManager.init()

	// 初始化状态
	state = {
		modelAStore,
		modelBStore,
		timeline,
		uiManager,
		logger,
	}

	// 初始化控制台
	initConsole(logger)

	// 生成初始数据
	generateInitialData()

	console.log("MODEL-COMP", "模型对比页面初始化完成")
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

	console.log("MODEL-COMP", "生成初始数据...")

	// Model A：正常收敛速度
	state.modelAStore.generateMockData(100, 0)

	// Model B：收敛较慢（模拟不同模型性能）
	const mockDataB: { step: number; loss: number; accuracy: number; validRate: number; epsilon: number }[] = []
	let loss = 2.0
	let accuracy = 15
	let validRate = 25
	let epsilon = 0.5

	for (let i = 0; i < 100; i++) {
		const step = i * 10

		// Model B 收敛较慢，噪声更大
		loss *= 0.998
		loss += (Math.random() - 0.5) * 0.08
		loss = Math.max(0.1, loss)

		accuracy += (Math.random() - 0.4) * 1.5
		accuracy = Math.min(95, Math.max(15, accuracy))

		validRate += (Math.random() - 0.4) * 2.5
		validRate = Math.min(90, Math.max(25, validRate))

		epsilon = Math.max(0.1, epsilon - 0.0008)

		mockDataB.push({ step, loss, accuracy, validRate, epsilon })
	}

	state.modelBStore.addBatch(mockDataB)
}

/**
 * 清理资源
 */
function destroy(): void {
	if (!state) return

	state.timeline.destroy()
	state.uiManager.destroy()
	state.logger.destroy()
	state = null
}

// ========== 全局暴露 ==========

// 暴露给全局供调试使用
;(window as unknown as Record<string, unknown>).modelComparison = {
	destroy,
}

// ========== 启动 ==========

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}
