// ========== Brain Lab 入口 ==========

import { BrainLabUI } from "./ui/index.js"
import { setAssertLevel, setAssertStopOnFail } from "../engine/utils/assert.js"

// 启用断言（开发模式）
setAssertLevel("verbose")
setAssertStopOnFail(true)

// 启动
document.addEventListener("DOMContentLoaded", () => {
	new BrainLabUI()
})
