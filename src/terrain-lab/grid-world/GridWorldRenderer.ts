// ========== 格子世界系统 - 渲染器 ==========
// 职责：统一的 Canvas 地形渲染（支持任意尺寸、视野、动画）

import type { ElementDef, RenderOptions, LayoutMetrics, CellPos } from "./types.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 默认配置 ==========

const DEFAULT_CELL_SIZE = 44
const DEFAULT_GAP = 6

// ========== 渲染器类 ==========

export class GridWorldRenderer {
	private elements: ElementDef[]
	private numLayers: number
	private logger: Logger

	// Canvas 状态
	private canvas: HTMLCanvasElement | null = null
	private ctx: CanvasRenderingContext2D | null = null
	private dpr: number = 1

	// 布局缓存
	private lastLayout: LayoutMetrics | null = null
	private lastCanvasWidth = 0
	private lastCanvasHeight = 0

	constructor(elements: ElementDef[], numLayers: number) {
		this.elements = elements
		this.numLayers = numLayers
		this.logger = new Logger("GRID-RENDERER")
		console.log(`渲染器初始化 | elements=${elements.length}, layers=${numLayers}`)
	}

	// ========== 布局计算 ==========

	/**
	 * 计算布局
	 */
	calculateLayout(
		canvasWidth: number,
		canvasHeight: number,
		viewportCols: number,
		cellSize: number = DEFAULT_CELL_SIZE,
		gap: number = DEFAULT_GAP
	): LayoutMetrics {
		const cellW = cellSize
		const cellH = cellSize
		const gapX = gap
		const gapY = gap
		
		const gridW = viewportCols * cellW + (viewportCols - 1) * gapX
		const gridH = this.numLayers * cellH + (this.numLayers - 1) * gapY
		
		const startX = (canvasWidth - gridW) / 2
		const startY = (canvasHeight - gridH) / 2 + 10

		return { cellW, cellH, gapX, gapY, startX, startY, gridW, gridH }
	}

	/**
	 * 自适应计算格子大小
	 */
	calculateAdaptiveLayout(
		canvasWidth: number,
		canvasHeight: number,
		viewportCols: number,
		paddingX: number = 60,
		paddingY: number = 40
	): LayoutMetrics {
		const availableW = canvasWidth - paddingX * 2
		const availableH = canvasHeight - paddingY * 2

		// 计算最大可能的格子大小
		const cellFromW = Math.floor((availableW - (viewportCols - 1) * 4) / viewportCols)
		const cellFromH = Math.floor((availableH - (this.numLayers - 1) * 4) / this.numLayers)
		
		const cellSize = Math.min(cellFromW, cellFromH, 60) // 最大60px
		const gap = 4

		return this.calculateLayout(canvasWidth, canvasHeight, viewportCols, cellSize, gap)
	}

	// ========== 核心渲染方法 ==========

	/**
	 * 渲染地形网格
	 */
	render(
		grid: number[][],
		options: RenderOptions
	): void {
		const { canvas, heroCol = 0, cameraCol = 0, hideHeroAtCol, hideSlimeAtCol } = options
		
		this.canvas = canvas
		const ctx = canvas.getContext("2d")
		if (!ctx) {
			console.error("无法获取 Canvas 2D 上下文")
			return
		}
		this.ctx = ctx

		// 设置高 DPI
		this.setupHighDPI(canvas)

		// 清空画布
		const rect = canvas.getBoundingClientRect()
		ctx.fillStyle = "#0b0c0f"
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// 计算布局
		const viewportCols = grid[0]?.length ?? 0
		const layout = this.calculateLayout(
			rect.width,
			rect.height,
			viewportCols
		)
		this.lastLayout = layout

		// 绘制层标签
		if (options.showLayerLabels !== false) {
			this.drawLayerLabels(layout)
		}

		// 绘制列标签
		if (options.showColLabels !== false) {
			this.drawColLabels(layout, cameraCol, viewportCols)
		}

		// 绘制网格和元素
		this.drawGrid(grid, layout, cameraCol, hideHeroAtCol, hideSlimeAtCol)

		// 绘制主角（如果不在动画中）
		if (hideHeroAtCol === null || hideHeroAtCol === undefined) {
			this.drawHero(layout, heroCol - cameraCol)
		}
	}

	/**
	 * 渲染动画帧
	 */
	renderAnimation(
		grid: number[][],
		options: RenderOptions,
		heroScreenCol: number,  // 狐狸在视野中的列位置（考虑相机）
		heroX: number,          // 动画中的精确 X 坐标
		heroY: number           // 动画中的精确 Y 坐标
	): void {
		const { canvas, cameraCol = 0, hideSlimeAtCol } = options
		
		this.canvas = canvas
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		this.ctx = ctx

		// 设置高 DPI
		this.setupHighDPI(canvas)

		// 清空画布
		const rect = canvas.getBoundingClientRect()
		ctx.fillStyle = "#0b0c0f"
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// 计算布局
		const viewportCols = grid[0]?.length ?? 0
		const layout = this.calculateLayout(
			rect.width,
			rect.height,
			viewportCols
		)
		this.lastLayout = layout

		// 绘制标签
		this.drawLayerLabels(layout)
		this.drawColLabels(layout, cameraCol, viewportCols)

		// 绘制网格和元素（隐藏原位置狐狸）
		this.drawGrid(grid, layout, cameraCol, null, hideSlimeAtCol)

		// 绘制动画中的狐狸
		this.drawHeroAtPosition(heroX, heroY, layout.cellW, layout.cellH)
	}

	// ========== 绘制辅助方法 ==========

	/**
	 * 设置高 DPI
	 */
	private setupHighDPI(canvas: HTMLCanvasElement): void {
		const rect = canvas.getBoundingClientRect()
		const dpr = window.devicePixelRatio || 1

		// 只在尺寸变化时重置
		if (Math.floor(rect.width * dpr) !== this.lastCanvasWidth ||
			Math.floor(rect.height * dpr) !== this.lastCanvasHeight) {
			
			canvas.width = Math.floor(rect.width * dpr)
			canvas.height = Math.floor(rect.height * dpr)
			
			const ctx = canvas.getContext("2d")
			if (ctx) {
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			}
			
			this.lastCanvasWidth = canvas.width
			this.lastCanvasHeight = canvas.height
			this.dpr = dpr
		}
	}

	/**
	 * 绘制网格和元素
	 */
	private drawGrid(
		grid: number[][],
		layout: LayoutMetrics,
		cameraCol: number,
		hideHeroAtCol: number | null | undefined,
		hideSlimeAtCol: number | null | undefined
	): void {
		if (!this.ctx) return

		const { cellW, cellH, gapX, gapY, startX, startY } = layout
		const viewportCols = grid[0]?.length ?? 0

		// 绘制网格线框
		this.ctx.strokeStyle = "#3c4043"
		this.ctx.lineWidth = 1

		for (let row = 0; row < this.numLayers; row++) {
			for (let col = 0; col < viewportCols; col++) {
				const x = startX + col * (cellW + gapX)
				const y = startY + row * (cellH + gapY)
				this.ctx.strokeRect(x, y, cellW, cellH)
			}
		}

		// 绘制元素
		for (let row = 0; row < this.numLayers; row++) {
			for (let col = 0; col < viewportCols; col++) {
				const worldCol = cameraCol + col
				const elemId = grid[row]?.[col]

				// 跳过无效元素
				if (elemId === undefined || elemId < 0) continue

				// 跳过被击杀的史莱姆
				if (row === 1 && worldCol === hideSlimeAtCol) {
					continue
				}

				// 动画时跳过原位置的狐狸
				if (row === 1 && col === (hideHeroAtCol ?? -1) && elemId === 1) {
					this.drawEmoji("⬛", startX + col * (cellW + gapX) + cellW / 2, startY + row * (cellH + gapY) + cellH / 2, Math.min(cellW, cellH) * 0.55)
					continue
				}

				const elem = this.elements[elemId]
				if (elem) {
					const x = startX + col * (cellW + gapX) + cellW / 2
					const y = startY + row * (cellH + gapY) + cellH / 2
					this.drawEmoji(elem.emoji, x, y, Math.min(cellW, cellH) * 0.55)
				}
			}
		}
	}

	/**
	 * 绘制层标签
	 */
	private drawLayerLabels(layout: LayoutMetrics): void {
		if (!this.ctx) return

		const layerNames = ["天上", "地上", "地面"]
		const { cellH, gapY, startX, startY } = layout

		this.ctx.fillStyle = "#9aa0a6"
		this.ctx.font = "10px sans-serif"
		this.ctx.textAlign = "right"

		for (let row = 0; row < this.numLayers; row++) {
			const y = startY + row * (cellH + gapY) + cellH / 2 + 3
			this.ctx.fillText(layerNames[row], startX - 8, y)
		}
	}

	/**
	 * 绘制列标签
	 */
	private drawColLabels(layout: LayoutMetrics, cameraCol: number, viewportCols: number): void {
		if (!this.ctx) return

		const { cellW, gapX, startX, startY } = layout

		this.ctx.fillStyle = "#9aa0a6"
		this.ctx.font = "10px sans-serif"
		this.ctx.textAlign = "center"

		for (let col = 0; col < viewportCols; col++) {
			const worldCol = cameraCol + col
			const x = startX + col * (cellW + gapX) + cellW / 2
			const y = startY - 8
			this.ctx.fillText(`x${worldCol}`, x, y)
		}
	}

	/**
	 * 绘制主角（静止状态）
	 */
	private drawHero(layout: LayoutMetrics, screenCol: number): void {
		if (!this.ctx) return

		const { cellW, cellH, gapX, gapY, startX, startY } = layout
		const heroRow = 1  // 狐狸在地上层

		const x = startX + screenCol * (cellW + gapX) + cellW / 2
		const y = startY + heroRow * (cellH + gapY) + cellH / 2

		this.drawEmoji("🦊", x, y, Math.min(cellW, cellH) * 0.65)
	}

	/**
	 * 在指定位置绘制主角（动画状态）
	 */
	private drawHeroAtPosition(x: number, y: number, cellW: number, cellH: number): void {
		this.drawEmoji("🦊", x, y, Math.min(cellW, cellH) * 0.65)
	}

	/**
	 * 绘制 Emoji
	 */
	private drawEmoji(emoji: string, x: number, y: number, size: number): void {
		if (!this.ctx) return

		this.ctx.font = `${Math.floor(size)}px sans-serif`
		this.ctx.textAlign = "center"
		this.ctx.textBaseline = "middle"
		this.ctx.fillText(emoji, x, y)
	}

	// ========== 交互辅助 ==========

	/**
	 * 获取指定像素位置的格子
	 */
	getCellAtPosition(
		mx: number,
		my: number,
		canvasWidth: number,
		canvasHeight: number,
		viewportCols: number
	): CellPos | null {
		const layout = this.calculateLayout(canvasWidth, canvasHeight, viewportCols)
		const { cellW, cellH, gapX, gapY, startX, startY } = layout

		const x = mx - startX
		const y = my - startY

		const col = Math.floor(x / (cellW + gapX))
		const row = Math.floor(y / (cellH + gapY))

		if (col < 0 || col >= viewportCols || row < 0 || row >= this.numLayers) {
			return null
		}

		// 检查是否在格子内部（不在 gap 上）
		const localX = x - col * (cellW + gapX)
		const localY = y - row * (cellH + gapY)
		if (localX < 0 || localX > cellW || localY < 0 || localY > cellH) {
			return null
		}

		return { row, col }
	}

	/**
	 * 获取最后一次布局
	 */
	getLastLayout(): LayoutMetrics | null {
		return this.lastLayout
	}

	/**
	 * 清空画布
	 */
	clear(canvas: HTMLCanvasElement, message?: string): void {
		const ctx = canvas.getContext("2d")
		if (!ctx) return

		const rect = canvas.getBoundingClientRect()
		ctx.fillStyle = "#0b0c0f"
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		if (message) {
			ctx.fillStyle = "#5f6368"
			ctx.font = "14px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText(message, rect.width / 2, rect.height / 2)
		}
	}
}
