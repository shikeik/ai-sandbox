// ========== Brain Lab 入口 ==========

import { BrainLabUI } from "./ui/index.js"
import { setAssertLevel, setAssertStopOnFail, setAssertLogHandler } from "../engine/utils/assert.js"
import { Logger } from "../engine/utils/Logger.js"

// 启用断言（开发模式）
setAssertLevel("verbose")
setAssertStopOnFail(true)

// 启动
document.addEventListener("DOMContentLoaded", () => {
	const app = new BrainLabUI()
	// 设置断言日志处理器，输出到 console-panel
	setAssertLogHandler((tag, message, context) => {
		Logger.get("[ASSERT]").log(`${tag}: ${message}`, context)
	})
	// 暴露到全局，方便控制台调试
	;(window as unknown as Record<string, unknown>).brainLab = app
})
