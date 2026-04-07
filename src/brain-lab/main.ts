// ========== Brain Lab 入口 ==========

import { BrainLabUI } from "./ui/index.js"
import { setAssertLevel, setAssertStopOnFail } from "../engine/utils/assert.js"

// 启用断言（开发模式）
setAssertLevel("verbose")
setAssertStopOnFail(true)

// 启动
document.addEventListener("DOMContentLoaded", () => {
	const app = new BrainLabUI()
	// 暴露到全局，方便控制台调试
	;(window as unknown as Record<string, unknown>).brainLab = app
})
