// ========== 像素级手写板绘制组件 ==========
// 画布分辨率 = imageSize (14×14)
// 显示尺寸 = displaySize (280×280，CSS放大)

export interface DrawingCanvas {
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	isDrawing: boolean
	pixels: number[]
	imageSize: number
	displaySize: number
}

export function createDrawingCanvas(
	canvasId: string,
	imageSize: number,
	displaySize: number,
	onDrawingEnd?: () => void
): DrawingCanvas | null {
	const canvas = document.getElementById(canvasId) as HTMLCanvasElement
	if (!canvas) return null

	const ctx = canvas.getContext("2d", { willReadFrequently: true })
	if (!ctx) return null

	// 设置画布分辨率（像素级）
	canvas.width = imageSize
	canvas.height = imageSize

	// CSS 放大显示
	canvas.style.width = `${displaySize}px`
	canvas.style.height = `${displaySize}px`
	canvas.style.imageRendering = "pixelated"  // 像素化显示，不模糊

	// 初始化像素数组
	const pixels = new Array(imageSize * imageSize).fill(0)

	const drawCtx: DrawingCanvas = {
		canvas,
		ctx,
		isDrawing: false,
		pixels,
		imageSize,
		displaySize
	}

	// 初始化背景
	clearCanvas(drawCtx)

	// 绑定事件
	setupEvents(drawCtx, onDrawingEnd)

	return drawCtx
}

function setupEvents(
	drawCtx: DrawingCanvas,
	onDrawingEnd?: () => void
): void {
	const { canvas, imageSize } = drawCtx

	const getPixelPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
		const rect = canvas.getBoundingClientRect()
		const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
		const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
		
		// 直接映射到像素坐标
		const x = Math.floor((clientX - rect.left) * (imageSize / rect.width))
		const y = Math.floor((clientY - rect.top) * (imageSize / rect.height))
		
		return {
			x: Math.max(0, Math.min(imageSize - 1, x)),
			y: Math.max(0, Math.min(imageSize - 1, y))
		}
	}

	const drawPixel = (x: number, y: number) => {
		// 填充整个像素块
		drawCtx.ctx.fillStyle = "white"
		drawCtx.ctx.fillRect(x, y, 1, 1)
		// 同步更新像素数组
		drawCtx.pixels[y * imageSize + x] = 1
	}

	const startDraw = (e: MouseEvent | TouchEvent) => {
		e.preventDefault()
		drawCtx.isDrawing = true
		const pos = getPixelPos(e)
		drawPixel(pos.x, pos.y)
	}

	const moveDraw = (e: MouseEvent | TouchEvent) => {
		e.preventDefault()
		if (!drawCtx.isDrawing) return
		const pos = getPixelPos(e)
		drawPixel(pos.x, pos.y)
	}

	const endDraw = () => {
		if (drawCtx.isDrawing) {
			drawCtx.isDrawing = false
			onDrawingEnd?.()
		}
	}

	// 鼠标事件
	canvas.addEventListener("mousedown", startDraw)
	canvas.addEventListener("mousemove", moveDraw)
	canvas.addEventListener("mouseup", endDraw)
	canvas.addEventListener("mouseleave", endDraw)

	// 触摸事件
	canvas.addEventListener("touchstart", startDraw, { passive: false })
	canvas.addEventListener("touchmove", moveDraw, { passive: false })
	canvas.addEventListener("touchend", endDraw)
	canvas.addEventListener("touchcancel", endDraw)
}

export function clearCanvas(drawCtx: DrawingCanvas): void {
	const { ctx, canvas, pixels } = drawCtx
	ctx.fillStyle = "black"
	ctx.fillRect(0, 0, canvas.width, canvas.height)
	pixels.fill(0)
}

// 渲染像素预览（直接复制像素值，不重新采样）
export function renderPixelPreview(
	canvas: HTMLCanvasElement,
	pixels: number[]
): void {
	const ctx = canvas.getContext("2d")
	if (!ctx) return

	const size = Math.sqrt(pixels.length)
	const cellSize = canvas.width / size

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const value = pixels[y * size + x]
			const gray = Math.floor((1 - value) * 255)
			ctx.fillStyle = `rgb(${gray},${gray},${gray})`
			ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
		}
	}
}

// 绘制概率柱状图
export function renderProbabilities(
	canvas: HTMLCanvasElement,
	probs: number[]
): void {
	const ctx = canvas.getContext("2d")
	if (!ctx) return

	const width = canvas.width
	const height = canvas.height
	const barWidth = width / 10
	const maxBarHeight = height - 30

	// 清空
	ctx.fillStyle = "#1a1a2e"
	ctx.fillRect(0, 0, width, height)

	// 绘制柱状图
	for (let i = 0; i < 10; i++) {
		const prob = probs[i]
		const barHeight = prob * maxBarHeight
		const x = i * barWidth + 2
		const y = height - barHeight - 20

		// 柱子
		const gradient = ctx.createLinearGradient(0, y, 0, height - 20)
		gradient.addColorStop(0, "#4ade80")
		gradient.addColorStop(1, "#22c55e")
		ctx.fillStyle = gradient
		ctx.fillRect(x + 2, y, barWidth - 8, barHeight)

		// 数字标签
		ctx.fillStyle = "white"
		ctx.font = "12px monospace"
		ctx.textAlign = "center"
		ctx.fillText(String(i), x + barWidth / 2, height - 5)

		// 概率值
		if (prob > 0.1) {
			ctx.font = "10px monospace"
			ctx.fillText(prob.toFixed(2), x + barWidth / 2, y - 5)
		}
	}
}
