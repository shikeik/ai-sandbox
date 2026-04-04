// ========== 通用折线图绘制工具 ==========
// 职责：封装折线图绘制逻辑，供迷你图和主图表复用
// 遵循 DRY 原则：不重复实现绘制代码

import type { LineSeries, ChartRect } from "../types.js"

/** 绘制上下文配置 */
export interface DrawContext {
	ctx: CanvasRenderingContext2D
	rect: ChartRect
}

/** 坐标映射配置 */
interface ScaleConfig {
	minX: number
	maxX: number
	minY: number
	maxY: number
	padding: { left: number; right: number; top: number; bottom: number }
}

/**
 * 计算数据范围
 * @param seriesArray 数据系列数组
 */
function calculateDataRange(seriesArray: LineSeries[]): { min: number; max: number } {
	let min = Infinity
	let max = -Infinity

	for (const series of seriesArray) {
		for (const point of series.data) {
			min = Math.min(min, point.value)
			max = Math.max(max, point.value)
		}
	}

	// 添加一些边距
	const range = max - min
	if (range === 0) {
		return { min: min - 1, max: max + 1 }
	}

	return { min: min - range * 0.1, max: max + range * 0.1 }
}

/**
 * 创建坐标映射函数
 * @param config 缩放配置
 * @param width 画布宽度
 * @param height 画布高度
 */
function createScales(config: ScaleConfig, width: number, height: number) {
	const chartH = height - config.padding.top - config.padding.bottom

	const chartW = width - config.padding.left - config.padding.right
	const xRange = config.maxX - config.minX
	const yRange = config.maxY - config.minY

	return {
		x: (x: number): number => {
			if (xRange === 0) return config.padding.left + chartW / 2
			return config.padding.left + ((x - config.minX) / xRange) * chartW
		},
		y: (y: number): number => {
			if (yRange === 0) return config.padding.top + chartH / 2
			return config.padding.top + chartH - ((y - config.minY) / yRange) * chartH
		},
	}
}

/**
 * 绘制坐标轴
 * @param ctx 绘制上下文
 * @param scales 坐标映射函数
 * @param config 缩放配置
 * @param width 画布宽度
 * @param height 画布高度
 * @param options 可选配置
 */
function drawAxes(
	ctx: CanvasRenderingContext2D,
	scales: ReturnType<typeof createScales>,
	config: ScaleConfig,
	width: number,
	height: number,
	options: {
		showGrid?: boolean
		gridColor?: string
		axisColor?: string
		textColor?: string
	} = {}
): void {
	const {
		showGrid = true,
		gridColor = "#3c4043",
		axisColor = "#5f6368",
		textColor = "#9aa0a6",
	} = options

	const _chartW = width - config.padding.left - config.padding.right
	const chartH = height - config.padding.top - config.padding.bottom

	// 绘制网格
	if (showGrid) {
		ctx.strokeStyle = gridColor
		ctx.lineWidth = 0.5
		ctx.setLineDash([2, 2])

		// 横向网格线
		for (let i = 0; i <= 4; i++) {
			const y = config.padding.top + (chartH / 4) * i
			ctx.beginPath()
			ctx.moveTo(config.padding.left, y)
			ctx.lineTo(width - config.padding.right, y)
			ctx.stroke()
		}

		ctx.setLineDash([])
	}

	// 绘制坐标轴
	ctx.strokeStyle = axisColor
	ctx.lineWidth = 1
	ctx.beginPath()
	ctx.moveTo(config.padding.left, config.padding.top)
	ctx.lineTo(config.padding.left, height - config.padding.bottom)
	ctx.lineTo(width - config.padding.right, height - config.padding.bottom)
	ctx.stroke()

	// 绘制Y轴刻度
	ctx.fillStyle = textColor
	ctx.font = "10px sans-serif"
	ctx.textAlign = "right"
	ctx.textBaseline = "middle"

	for (let i = 0; i <= 4; i++) {
		const value = config.minY + (config.maxY - config.minY) * (1 - i / 4)
		const y = config.padding.top + (chartH / 4) * i
		ctx.fillText(value.toFixed(1), config.padding.left - 6, y)
	}
}

/**
 * 绘制单条折线
 * @param ctx 绘制上下文
 * @param scales 坐标映射函数
 * @param series 数据系列
 */
function drawLine(
	ctx: CanvasRenderingContext2D,
	scales: ReturnType<typeof createScales>,
	series: LineSeries
): void {
	if (series.data.length === 0) return

	ctx.strokeStyle = series.color
	ctx.lineWidth = series.lineWidth ?? 2
	ctx.lineJoin = "round"
	ctx.lineCap = "round"

	ctx.beginPath()
	let hasPoint = false

	for (const point of series.data) {
		const x = scales.x(point.step)
		const y = scales.y(point.value)

		if (!hasPoint) {
			ctx.moveTo(x, y)
			hasPoint = true
		} else {
			ctx.lineTo(x, y)
		}
	}

	ctx.stroke()
}

/**
 * 绘制数据点
 * @param ctx 绘制上下文
 * @param scales 坐标映射函数
 * @param series 数据系列
 * @param radius 点半径
 */
function drawPoints(
	ctx: CanvasRenderingContext2D,
	scales: ReturnType<typeof createScales>,
	series: LineSeries,
	radius = 3
): void {
	ctx.fillStyle = series.color

	for (const point of series.data) {
		const x = scales.x(point.step)
		const y = scales.y(point.value)

		ctx.beginPath()
		ctx.arc(x, y, radius, 0, Math.PI * 2)
		ctx.fill()
	}
}

/** 折线图绘制选项 */
export interface LineChartOptions {
	/** 是否显示坐标轴 */
	showAxes?: boolean
	/** 是否显示网格 */
	showGrid?: boolean
	/** 是否显示数据点 */
	showPoints?: boolean
	/** 坐标轴颜色 */
	axisColor?: string
	/** 网格颜色 */
	gridColor?: string
	/** 文字颜色 */
	textColor?: string
	/** 内边距 */
	padding?: { left: number; right: number; top: number; bottom: number }
}

/**
 * 绘制折线图（通用函数，供迷你图和主图表复用）
 * @param ctx 绘制上下文
 * @param width 画布宽度
 * @param height 画布高度
 * @param seriesArray 数据系列数组
 * @param options 绘制选项
 */
export function drawLineChart(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	seriesArray: LineSeries[],
	options: LineChartOptions = {}
): void {
	if (seriesArray.length === 0 || seriesArray.every(s => s.data.length === 0)) {
		return
	}

	const {
		showAxes = true,
		showGrid = true,
		showPoints = false,
		axisColor = "#5f6368",
		gridColor = "#3c4043",
		textColor = "#9aa0a6",
		padding = { left: 48, right: 16, top: 20, bottom: 32 },
	} = options

	// 计算数据范围
	const yRange = calculateDataRange(seriesArray)

	// 计算X范围
	let minX = Infinity
	let maxX = -Infinity
	for (const series of seriesArray) {
		for (const point of series.data) {
			minX = Math.min(minX, point.step)
			maxX = Math.max(maxX, point.step)
		}
	}

	const config: ScaleConfig = {
		minX,
		maxX,
		minY: yRange.min,
		maxY: yRange.max,
		padding,
	}

	const scales = createScales(config, width, height)

	// 绘制坐标轴
	if (showAxes) {
		drawAxes(ctx, scales, config, width, height, {
			showGrid,
			gridColor,
			axisColor,
			textColor,
		})
	}

	// 绘制折线
	for (const series of seriesArray) {
		drawLine(ctx, scales, series)
	}

	// 绘制数据点
	if (showPoints) {
		for (const series of seriesArray) {
			drawPoints(ctx, scales, series)
		}
	}
}

/**
 * 绘制迷你折线图（简化版，用于指标卡片）
 * @param canvas 画布元素
 * @param data 数据点数组
 * @param color 线条颜色
 */
export function drawMiniChart(
	canvas: HTMLCanvasElement,
	data: { step: number; value: number }[],
	color: string
): void {
	if (data.length < 2) return

	const ctx = canvas.getContext("2d")!
	const dpr = window.devicePixelRatio || 1
	const rect = canvas.getBoundingClientRect()

	// 设置高DPI
	canvas.width = Math.floor(rect.width * dpr)
	canvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.clearRect(0, 0, rect.width, rect.height)

	// 简化的绘制配置
	const padding = { left: 4, right: 4, top: 4, bottom: 4 }
	const width = rect.width
	const height = rect.height

	// 计算范围
	let minY = Infinity
	let maxY = -Infinity
	for (const point of data) {
		minY = Math.min(minY, point.value)
		maxY = Math.max(maxY, point.value)
	}

	// 添加边距
	const range = maxY - minY
	minY -= range * 0.1
	maxY += range * 0.1

	const chartW = width - padding.left - padding.right
	const chartH = height - padding.top - padding.bottom

	// 绘制区域填充
	const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom)
	gradient.addColorStop(0, color + "40") // 25% 透明度
	gradient.addColorStop(1, color + "00") // 0% 透明度

	ctx.fillStyle = gradient
	ctx.beginPath()

	for (let i = 0; i < data.length; i++) {
		const x = padding.left + (i / (data.length - 1)) * chartW
		const y = padding.top + chartH - ((data[i].value - minY) / (maxY - minY)) * chartH

		if (i === 0) {
			ctx.moveTo(x, y)
		} else {
			ctx.lineTo(x, y)
		}
	}

	ctx.lineTo(width - padding.right, height - padding.bottom)
	ctx.lineTo(padding.left, height - padding.bottom)
	ctx.closePath()
	ctx.fill()

	// 绘制线条
	ctx.strokeStyle = color
	ctx.lineWidth = 2
	ctx.beginPath()

	for (let i = 0; i < data.length; i++) {
		const x = padding.left + (i / (data.length - 1)) * chartW
		const y = padding.top + chartH - ((data[i].value - minY) / (maxY - minY)) * chartH

		if (i === 0) {
			ctx.moveTo(x, y)
		} else {
			ctx.lineTo(x, y)
		}
	}

	ctx.stroke()
}

/**
 * 绘制饼图
 * @param canvas 画布元素
 * @param data 数据项数组
 * @param centerX 中心X坐标
 * @param centerY 中心Y坐标
 * @param radius 半径
 */
export function drawPieChart(
	canvas: HTMLCanvasElement,
	data: { label: string; value: number; color: string }[],
	centerX: number,
	centerY: number,
	radius: number
): void {
	if (data.length === 0) return

	const ctx = canvas.getContext("2d")!
	const total = data.reduce((sum, item) => sum + item.value, 0)

	if (total === 0) return

	let currentAngle = -Math.PI / 2 // 从顶部开始

	for (const item of data) {
		const sliceAngle = (item.value / total) * Math.PI * 2

		// 绘制扇形
		ctx.fillStyle = item.color
		ctx.beginPath()
		ctx.moveTo(centerX, centerY)
		ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
		ctx.closePath()
		ctx.fill()

		// 绘制边框
		ctx.strokeStyle = "#16181d"
		ctx.lineWidth = 2
		ctx.stroke()

		currentAngle += sliceAngle
	}
}
