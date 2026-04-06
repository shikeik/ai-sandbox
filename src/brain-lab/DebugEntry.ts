// ========== 调试入口：通过 HTTP API 暴露 ==========
// 可以在浏览器 console 中测试

import { brainLabAPI } from "./BrainLabAPI.js"

// 暴露全局对象，方便浏览器 console 调试
;(window as any).brainLabAPI = brainLabAPI

// 提供 fetch 接口
const originalFetch = window.fetch
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === "string" ? input : input.toString()
	
	// 拦截 brain-lab API 请求
	if (url.includes("/api/brain-lab/")) {
		const req = new Request(url, init)
		return brainLabAPI.handleRequest(req)
	}
	
	return originalFetch(input, init)
}

console.log("[BrainLab Debug] API 已加载，可用命令:")
console.log("  await brainLabAPI.handleRequest(new Request('/api/brain-lab/state'))")
console.log("  await brainLabAPI.handleRequest(new Request('/api/brain-lab/step'))")
console.log("  await brainLabAPI.handleRequest(new Request('/api/brain-lab/reset'))")
