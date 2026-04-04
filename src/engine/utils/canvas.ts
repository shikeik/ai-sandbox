// ========== Canvas 工具函数 ==========

/**
 * 设置 Canvas 高 DPI 渲染
 * 根据 devicePixelRatio 调整 canvas 实际尺寸，保证绘制内容清晰
 * @returns 包含 ctx、rect、dpr、width、height 的对象
 */
export function setupHighDPICanvas(canvas: HTMLCanvasElement): {
	ctx: CanvasRenderingContext2D
	rect: { width: number; height: number; left: number; top: number }
	dpr: number
	width: number
	height: number
} {
	const ctx = canvas.getContext("2d")!
	const rect = canvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1

	canvas.width = Math.floor(rect.width * dpr)
	canvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.clearRect(0, 0, rect.width, rect.height)

	return { ctx, rect, dpr, width: rect.width, height: rect.height }
}

/**
 * 简单的 Canvas 设置（不处理 DPR，用于不需要高清渲染的场景）
 */
export function setupCanvas(canvas: HTMLCanvasElement): {
	ctx: CanvasRenderingContext2D
	rect: { width: number; height: number; left: number; top: number }
	width: number
	height: number
} {
	const ctx = canvas.getContext("2d")!
	const rect = canvas.getBoundingClientRect()

	canvas.width = rect.width
	canvas.height = rect.height

	return { ctx, rect, width: rect.width, height: rect.height }
}
