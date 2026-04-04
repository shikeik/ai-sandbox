// ========== UI 管理器 ==========
// 职责：所有 DOM 更新收口，遵循 SRP 原则

import type { MetricsStore } from "./metrics-store.js"
import type { TimeRange } from "./types.js"
import { createMetricCards, MetricCard } from "./components/MetricCard.js"
import { LoadingButton } from "./components/LoadingButton.js"
import { METRIC_CARDS, TIME_RANGES } from "./constants.js"
import { calculateTrend } from "./utils/data-formatter.js"
import { metricsToCsv, downloadCsv } from "./utils/data-formatter.js"
import { drawLineChart, drawPieChart } from "./charts/line-chart.js"

/** UI 管理器 */
export class UIManager {
	private store: MetricsStore
	private metricCards: Map<string, MetricCard>
	private buttons: LoadingButton[] = []
	private currentRange: TimeRange = 10

	// DOM 元素缓存
	private mainChartCanvas!: HTMLCanvasElement
	private pieChartCanvas!: HTMLCanvasElement
	private rangeSelect: HTMLSelectElement | null = null

	/**
	 * 创建 UI 管理器
	 * @param store 数据存储
	 */
	constructor(store: MetricsStore) {
		this.store = store
		this.metricCards = new Map()
	}

	/**
	 * 初始化 UI
	 */
	init(): void {
		this.initMetricCards()
		this.initCharts()
		this.initControls()
		this.bindEvents()
	}

	/**
	 * 初始化指标卡片
	 */
	private initMetricCards(): void {
		const container = document.getElementById("metrics-grid")
		if (!container) return

		this.metricCards = createMetricCards(container, METRIC_CARDS)
	}

	/**
	 * 初始化图表区域
	 */
	private initCharts(): void {
		this.mainChartCanvas = document.getElementById("main-chart") as HTMLCanvasElement
		this.pieChartCanvas = document.getElementById("pie-chart") as HTMLCanvasElement
	}

	/**
	 * 初始化控制面板
	 */
	private initControls(): void {
		const container = document.getElementById("control-panel")
		if (!container) return

		// 刷新按钮
		const refreshBtn = new LoadingButton(container, {
			text: "🔄 刷新",
			className: "btn-control",
			onClick: () => this.handleRefresh(),
		})

		// 时间范围选择器
		this.rangeSelect = document.createElement("select")
		this.rangeSelect.className = "range-select"
		for (const range of TIME_RANGES) {
			const option = document.createElement("option")
			option.value = String(range.value)
			option.textContent = range.label
			if (range.value === this.currentRange) {
				option.selected = true
			}
			this.rangeSelect.appendChild(option)
		}
		container.appendChild(this.rangeSelect)

		// 导出 CSV 按钮
		const exportBtn = new LoadingButton(container, {
			text: "📥 导出 CSV",
			className: "btn-control",
			onClick: () => this.handleExport(),
		})

		this.buttons = [refreshBtn, exportBtn]
	}

	/**
	 * 绑定事件
	 */
	private bindEvents(): void {
		// 监听数据变更
		this.store.subscribe(() => this.updateDisplay())

		// 时间范围变更
		this.rangeSelect?.addEventListener("change", () => {
			if (!this.rangeSelect) return
			this.currentRange = Number(this.rangeSelect.value) as TimeRange
			this.drawMainChart()
		})

		// 窗口大小变化时重绘图表
		window.addEventListener("resize", () => {
			this.drawMainChart()
			this.drawPieChart()
		})
	}

	/**
	 * 更新显示
	 */
	updateDisplay(): void {
		this.updateMetricCards()
		this.drawMainChart()
		this.drawPieChart()
	}

	/**
	 * 更新指标卡片
	 */
	private updateMetricCards(): void {
		const data = this.store.getAll()
		if (data.length === 0) return

		const latest = data[data.length - 1]
		const prev = data.length > 1 ? data[data.length - 2] : latest

		// 准备历史数据（最近20个点用于迷你图）
		const recentData = data.slice(-20)

		// 更新各卡片
		const lossCard = this.metricCards.get("loss")
		if (lossCard) {
			lossCard.update({
				current: latest.loss,
				history: recentData.map(d => ({ step: d.step, value: d.loss })),
				trend: calculateTrend(latest.loss, prev.loss),
			})
		}

		const accCard = this.metricCards.get("accuracy")
		if (accCard) {
			accCard.update({
				current: latest.accuracy,
				history: recentData.map(d => ({ step: d.step, value: d.accuracy })),
				trend: calculateTrend(latest.accuracy, prev.accuracy),
			})
		}

		const validCard = this.metricCards.get("validRate")
		if (validCard) {
			validCard.update({
				current: latest.validRate,
				history: recentData.map(d => ({ step: d.step, value: d.validRate })),
				trend: calculateTrend(latest.validRate, prev.validRate),
			})
		}

		const epsilonCard = this.metricCards.get("epsilon")
		if (epsilonCard) {
			epsilonCard.update({
				current: latest.epsilon,
				history: recentData.map(d => ({ step: d.step, value: d.epsilon })),
				trend: calculateTrend(latest.epsilon, prev.epsilon),
			})
		}
	}

	/**
	 * 绘制主训练曲线图
	 */
	private drawMainChart(): void {
		if (!this.mainChartCanvas) return

		const ctx = this.mainChartCanvas.getContext("2d")!
		const dpr = window.devicePixelRatio || 1
		const rect = this.mainChartCanvas.getBoundingClientRect()

		// 设置高 DPI
		this.mainChartCanvas.width = Math.floor(rect.width * dpr)
		this.mainChartCanvas.height = Math.floor(rect.height * dpr)
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.clearRect(0, 0, rect.width, rect.height)

		// 获取按范围过滤的数据
		const data = this.store.getByRange(this.currentRange)
		if (data.length === 0) return

		// 准备数据系列
		const series = [
			{
				name: "Loss",
				data: data.map(d => ({ step: d.step, value: d.loss })),
				color: "#f9ab00",
				lineWidth: 2,
			},
			{
				name: "Accuracy",
				data: data.map(d => ({ step: d.step, value: d.accuracy })),
				color: "#34a853",
				lineWidth: 2,
			},
		]

		// 使用通用折线图绘制函数
		drawLineChart(ctx, rect.width, rect.height, series, {
			showAxes: true,
			showGrid: true,
			showPoints: false,
		})
	}

	/**
	 * 绘制动作分布饼图
	 */
	private drawPieChart(): void {
		if (!this.pieChartCanvas) return

		const ctx = this.pieChartCanvas.getContext("2d")!
		const dpr = window.devicePixelRatio || 1
		const rect = this.pieChartCanvas.getBoundingClientRect()

		// 设置高 DPI
		this.pieChartCanvas.width = Math.floor(rect.width * dpr)
		this.pieChartCanvas.height = Math.floor(rect.height * dpr)
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.clearRect(0, 0, rect.width, rect.height)

		// 模拟动作分布数据（实际项目中应从 store 获取）
		const actionData = [
			{ label: "走", value: 35, color: "#8ab4f8" },
			{ label: "跳", value: 25, color: "#f9ab00" },
			{ label: "远跳", value: 20, color: "#34a853" },
			{ label: "走A", value: 20, color: "#ea4335" },
		]

		// 使用通用饼图绘制函数
		const centerX = rect.width / 2
		const centerY = rect.height / 2
		const radius = Math.min(centerX, centerY) - 40

		drawPieChart(this.pieChartCanvas, actionData, centerX, centerY, radius)

		// 绘制图例
		this.drawPieLegend(ctx, actionData, rect.width, rect.height)
	}

	/**
	 * 绘制饼图图例
	 */
	private drawPieLegend(
		ctx: CanvasRenderingContext2D,
		data: { label: string; value: number; color: string }[],
		width: number,
		height: number
	): void {
		const total = data.reduce((sum, item) => sum + item.value, 0)
		const legendY = height - 20

		ctx.font = "11px sans-serif"
		ctx.textBaseline = "middle"

		let currentX = 20
		for (const item of data) {
			const percent = ((item.value / total) * 100).toFixed(0)

			// 颜色块
			ctx.fillStyle = item.color
			ctx.fillRect(currentX, legendY - 5, 10, 10)

			// 文字
			ctx.fillStyle = "#e8eaed"
			ctx.textAlign = "left"
			ctx.fillText(`${item.label} ${percent}%`, currentX + 14, legendY)

			// 计算下一个位置
			const textWidth = ctx.measureText(`${item.label} ${percent}%`).width
			currentX += 24 + textWidth + 16
		}
	}

	/**
	 * 处理刷新
	 */
	private async handleRefresh(): Promise<void> {
		// 生成新的模拟数据
		const latest = this.store.getLatest()
		const startStep = latest ? latest.step + 10 : 0
		this.store.generateMockData(10, startStep)
	}

	/**
	 * 处理导出
	 */
	private async handleExport(): Promise<void> {
		const data = this.store.getAll()
		if (data.length === 0) return

		const csv = metricsToCsv(data)
		downloadCsv(csv, "training-metrics")
	}

	/**
	 * 设置按钮加载状态
	 * @param index 按钮索引
	 * @param loading 是否加载中
	 */
	setButtonLoading(index: number, loading: boolean): void {
		if (this.buttons[index]) {
			this.buttons[index].setLoading(loading)
		}
	}
}
