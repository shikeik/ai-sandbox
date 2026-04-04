// ========== 模型对比 UI 管理器 ==========
// 职责：管理模型对比页面的所有 DOM 更新
// 复用：MetricCard、LoadingButton、line-chart、data-formatter

import type { MetricsStore } from "../metrics-dashboard/metrics-store.js"
import type { TimelineController, TimelineState } from "./timeline-controller.js"
import type { MetricCardConfig } from "../metrics-dashboard/types.js"
import { MetricCard } from "../metrics-dashboard/components/MetricCard.js"
import { LoadingButton } from "../metrics-dashboard/components/LoadingButton.js"
import { drawDualAxisChart } from "../metrics-dashboard/charts/line-chart.js"
import { generateComparisonReport, metricsToCsv, downloadCsv, downloadJson } from "../metrics-dashboard/utils/data-formatter.js"

/** 对比指标卡片扩展配置 */
interface ComparisonCardConfig extends MetricCardConfig {
	/** 是否为主要指标（显示在顶部） */
	isPrimary?: boolean
}

/** UI 管理器 */
export class ModelComparisonUIManager {
	private modelAStore: MetricsStore
	private modelBStore: MetricsStore
	private timeline: TimelineController
	private metricCards: Map<string, MetricCard> = new Map()
	private buttons: LoadingButton[] = []

	// DOM 元素缓存
	private mainChartCanvas!: HTMLCanvasElement
	private timelineControls!: HTMLElement
	private stepDisplay!: HTMLElement

	// 当前时间轴状态
	private currentTimelineState: TimelineState | null = null

	/**
	 * 创建 UI 管理器
	 * @param modelAStore Model A 数据存储
	 * @param modelBStore Model B 数据存储
	 * @param timeline 时间轴控制器
	 */
	constructor(
		modelAStore: MetricsStore,
		modelBStore: MetricsStore,
		timeline: TimelineController
	) {
		this.modelAStore = modelAStore
		this.modelBStore = modelBStore
		this.timeline = timeline
	}

	/**
	 * 初始化 UI
	 */
	init(): void {
		this.initMetricCards()
		this.initTimelineControls()
		this.initMainChart()
		this.initExportControls()
		this.bindEvents()
	}

	/**
	 * 初始化指标卡片（5个对比卡片）
	 */
	private initMetricCards(): void {
		const container = document.getElementById("metrics-grid")
		if (!container) return

		const cardConfigs: ComparisonCardConfig[] = [
			{
				id: "loss",
				title: "损失对比 (Loss)",
				color: "#f9ab00",
				format: "fixed4",
				lowerIsBetter: true,
				isPrimary: true,
			},
			{
				id: "accuracy",
				title: "准确率对比 (Accuracy)",
				color: "#34a853",
				format: "percent",
				lowerIsBetter: false,
				isPrimary: true,
			},
			{
				id: "validRate",
				title: "合法率对比 (Valid Rate)",
				color: "#8ab4f8",
				format: "percent",
				lowerIsBetter: false,
				isPrimary: true,
			},
			{
				id: "epsilon",
				title: "探索率对比 (Epsilon)",
				color: "#ea4335",
				format: "decimal",
				lowerIsBetter: false,
				isPrimary: false,
			},
			{
				id: "score",
				title: "综合评分对比 (Score)",
				color: "#c58af9",
				format: "decimal",
				lowerIsBetter: false,
				isPrimary: false,
			},
		]

		for (const config of cardConfigs) {
			const card = new MetricCard(container, config)
			this.metricCards.set(config.id, card)
		}
	}

	/**
	 * 初始化时间轴控制面板
	 */
	private initTimelineControls(): void {
		this.timelineControls = document.getElementById("timeline-controls") as HTMLElement
		this.stepDisplay = document.getElementById("step-display") as HTMLElement

		if (!this.timelineControls) return

		// 首帧按钮
		new LoadingButton(this.timelineControls, {
			text: "◀◀",
			className: "btn-timeline",
			onClick: () => this.timeline.goToFirst(),
		})

		// 上一帧按钮
		new LoadingButton(this.timelineControls, {
			text: "◀",
			className: "btn-timeline",
			onClick: () => this.timeline.goToPrevious(),
		})

		// 播放/暂停按钮（需要动态更新文本，单独保存引用）
		const playBtn = new LoadingButton(this.timelineControls, {
			text: "▶",
			className: "btn-timeline btn-play",
			onClick: () => this.timeline.togglePlay(),
		})
		this.buttons.push(playBtn)

		// 下一帧按钮
		new LoadingButton(this.timelineControls, {
			text: "▶",
			className: "btn-timeline",
			onClick: () => this.timeline.goToNext(),
		})

		// 末帧按钮
		new LoadingButton(this.timelineControls, {
			text: "▶▶",
			className: "btn-timeline",
			onClick: () => this.timeline.goToLast(),
		})

		// 复位按钮
		new LoadingButton(this.timelineControls, {
			text: "复位",
			className: "btn-timeline btn-reset",
			onClick: () => this.timeline.reset(),
		})
	}

	/**
	 * 初始化主图表区域
	 */
	private initMainChart(): void {
		this.mainChartCanvas = document.getElementById("main-chart") as HTMLCanvasElement
	}

	/**
	 * 初始化导出控制面板
	 */
	private initExportControls(): void {
		const container = document.getElementById("export-controls")
		if (!container) return

		// 导出对比报告按钮
		new LoadingButton(container, {
			text: "📄 导出对比报告",
			className: "btn-control",
			onClick: () => this.handleExportReport(),
		})

		// 切换 Model A 数据源按钮
		new LoadingButton(container, {
			text: "🔄 切换 Model A",
			className: "btn-control",
			onClick: () => this.handleSwitchModelA(),
		})

		// 切换 Model B 数据源按钮
		new LoadingButton(container, {
			text: "🔄 切换 Model B",
			className: "btn-control",
			onClick: () => this.handleSwitchModelB(),
		})
	}

	/**
	 * 绑定事件
	 */
	private bindEvents(): void {
		// 监听时间轴变更
		this.timeline.subscribe((state) => {
			this.currentTimelineState = state
			this.updateTimelineDisplay(state)
			this.updateDisplay()
		})

		// 监听数据变更
		this.modelAStore.subscribe(() => this.onDataUpdate())
		this.modelBStore.subscribe(() => this.onDataUpdate())

		// 窗口大小变化时重绘图表
		window.addEventListener("resize", () => {
			this.drawMainChart()
		})
	}

	/**
	 * 数据更新时处理
	 */
	private onDataUpdate(): void {
		const modelAData = this.modelAStore.getAll()
		const modelBData = this.modelBStore.getAll()
		const maxSteps = Math.max(modelAData.length, modelBData.length)

		// 更新时间轴总步数
		this.timeline.setTotalSteps(maxSteps)

		// 更新显示
		this.updateDisplay()
	}

	/**
	 * 更新时间轴显示
	 */
	private updateTimelineDisplay(state: TimelineState): void {
		// 更新步数显示
		if (this.stepDisplay) {
			const currentStep = state.currentIndex + 1
			this.stepDisplay.textContent = `${currentStep}/${state.totalSteps}`
		}

		// 更新播放按钮图标
		const playBtn = this.buttons[0]
		if (playBtn) {
			playBtn.setText(state.isPlaying ? "⏸" : "▶")
		}
	}

	/**
	 * 更新显示（指标卡片 + 图表）
	 */
	updateDisplay(): void {
		const modelAData = this.modelAStore.getAll()
		const modelBData = this.modelBStore.getAll()

		if (modelAData.length === 0 && modelBData.length === 0) return

		const currentIndex = this.currentTimelineState?.currentIndex ?? 0

		// 获取当前索引对应的数据
		const modelACurrent = modelAData[Math.min(currentIndex, modelAData.length - 1)]
		const modelBCurrent = modelBData[Math.min(currentIndex, modelBData.length - 1)]

		// 更新各指标卡片（使用对比模式）
		this.updateComparisonCard("loss", modelACurrent?.loss ?? 0, modelBCurrent?.loss ?? 0, modelAData, modelBData)
		this.updateComparisonCard("accuracy", modelACurrent?.accuracy ?? 0, modelBCurrent?.accuracy ?? 0, modelAData, modelBData)
		this.updateComparisonCard("validRate", modelACurrent?.validRate ?? 0, modelBCurrent?.validRate ?? 0, modelAData, modelBData)
		this.updateComparisonCard("epsilon", modelACurrent?.epsilon ?? 0, modelBCurrent?.epsilon ?? 0, modelAData, modelBData)

		// 计算并更新综合评分
		const scoreA = this.calculateScore(modelACurrent)
		const scoreB = this.calculateScore(modelBCurrent)
		const scoreAHistory = modelAData.map(d => ({ step: d.step, value: this.calculateScore(d) }))
		const scoreBHistory = modelBData.map(d => ({ step: d.step, value: this.calculateScore(d) }))
		this.metricCards.get("score")?.updateComparison(
			{
				modelA: scoreA,
				modelB: scoreB,
				modelAHistory: scoreAHistory,
				modelBHistory: scoreBHistory,
			},
			"Model A",
			"Model B"
		)

		// 绘制主图表
		this.drawMainChart()
	}

	/**
	 * 更新单个对比卡片
	 */
	private updateComparisonCard(
		cardId: string,
		modelAValue: number,
		modelBValue: number,
		modelAData: { step: number; loss: number; accuracy: number; validRate: number; epsilon: number }[],
		modelBData: { step: number; loss: number; accuracy: number; validRate: number; epsilon: number }[]
	): void {
		const card = this.metricCards.get(cardId)
		if (!card) return

		const getHistory = (data: typeof modelAData, key: keyof typeof modelAData[0]) =>
			data.map(d => ({ step: d.step, value: d[key] as number }))

		card.updateComparison(
			{
				modelA: modelAValue,
				modelB: modelBValue,
				modelAHistory: getHistory(modelAData, cardId as keyof typeof modelAData[0]),
				modelBHistory: getHistory(modelBData, cardId as keyof typeof modelBData[0]),
			},
			"Model A",
			"Model B"
		)
	}

	/**
	 * 计算综合评分
	 * 准确率权重40%，合法率权重30%，损失权重30%（反转）
	 */
	private calculateScore(metrics: { accuracy: number; validRate: number; loss: number } | undefined): number {
		if (!metrics) return 0
		const normalizedLoss = Math.max(0, 1 - metrics.loss)
		return metrics.accuracy * 0.4 + metrics.validRate * 0.3 + normalizedLoss * 30
	}

	/**
	 * 绘制主对比图表（双Y轴）
	 */
	private drawMainChart(): void {
		if (!this.mainChartCanvas) return

		const ctx = this.mainChartCanvas.getContext("2d")
		if (!ctx) return

		const dpr = window.devicePixelRatio || 1
		const rect = this.mainChartCanvas.getBoundingClientRect()

		// 设置高 DPI
		this.mainChartCanvas.width = Math.floor(rect.width * dpr)
		this.mainChartCanvas.height = Math.floor(rect.height * dpr)
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.clearRect(0, 0, rect.width, rect.height)

		const modelAData = this.modelAStore.getAll()
		const modelBData = this.modelBStore.getAll()

		if (modelAData.length === 0 && modelBData.length === 0) return

		// 准备数据系列
		const series = [
			{
				name: "Model A 损失",
				data: modelAData.map(d => ({ step: d.step, value: d.loss })),
				color: "#f9ab00",
				lineWidth: 2,
			},
			{
				name: "Model B 损失",
				data: modelBData.map(d => ({ step: d.step, value: d.loss })),
				color: "#f9ab0080", // 半透明
				lineWidth: 2,
			},
			{
				name: "Model A 准确率",
				data: modelAData.map(d => ({ step: d.step, value: d.accuracy })),
				color: "#34a853",
				lineWidth: 2,
			},
			{
				name: "Model B 准确率",
				data: modelBData.map(d => ({ step: d.step, value: d.accuracy })),
				color: "#34a85380", // 半透明
				lineWidth: 2,
			},
		]

		// 使用双Y轴绘制
		drawDualAxisChart(ctx, rect.width, rect.height, series, {
			leftAxisSeries: [0, 1], // 损失使用左Y轴
			rightAxisSeries: [2, 3], // 准确率使用右Y轴
			showGrid: true,
		})

		// 绘制图例
		this.drawChartLegend(ctx, rect.width, rect.height)
	}

	/**
	 * 绘制图表图例
	 */
	private drawChartLegend(ctx: CanvasRenderingContext2D, width: number, height: number): void {
		const legendItems = [
			{ label: "A 损失", color: "#f9ab00" },
			{ label: "B 损失", color: "#f9ab0080" },
			{ label: "A 准确率", color: "#34a853" },
			{ label: "B 准确率", color: "#34a85380" },
		]

		const itemWidth = 80
		const startX = (width - legendItems.length * itemWidth) / 2
		const y = height - 10

		ctx.font = "11px sans-serif"
		ctx.textBaseline = "middle"

		legendItems.forEach((item, index) => {
			const x = startX + index * itemWidth

			// 颜色线
			ctx.strokeStyle = item.color
			ctx.lineWidth = 2
			ctx.beginPath()
			ctx.moveTo(x, y)
			ctx.lineTo(x + 20, y)
			ctx.stroke()

			// 文字
			ctx.fillStyle = "#e8eaed"
			ctx.textAlign = "left"
			ctx.fillText(item.label, x + 24, y)
		})
	}

	/**
	 * 处理导出对比报告
	 */
	private async handleExportReport(): Promise<void> {
		const modelAData = this.modelAStore.getAll()
		const modelBData = this.modelBStore.getAll()

		if (modelAData.length === 0 || modelBData.length === 0) {
			window.alert("没有数据可导出")
			return
		}

		// 生成对比报告（JSON）
		const report = generateComparisonReport(modelAData, modelBData, "Model A", "Model B")
		const jsonContent = JSON.stringify(report, null, 2)
		downloadJson(jsonContent, "model-comparison-report")

		// 同时导出 Model A CSV
		const csvA = metricsToCsv(modelAData)
		downloadCsv(csvA, "model-a-metrics")

		// 同时导出 Model B CSV
		const csvB = metricsToCsv(modelBData)
		downloadCsv(csvB, "model-b-metrics")

		console.log("MODEL-COMP", "对比报告已导出")
	}

	/**
	 * 切换 Model A 数据源
	 */
	private async handleSwitchModelA(): Promise<void> {
		// 生成新的模拟数据
		this.modelAStore.clear()
		this.modelAStore.generateMockData(100, 0)
		console.log("MODEL-COMP", "Model A 数据已更新")
	}

	/**
	 * 切换 Model B 数据源
	 */
	private async handleSwitchModelB(): Promise<void> {
		// 生成不同的模拟数据（收敛速度较慢）
		this.modelBStore.clear()
		const mockData: { step: number; loss: number; accuracy: number; validRate: number; epsilon: number }[] = []
		let loss = 2.0
		let accuracy = 15
		let validRate = 25
		let epsilon = 0.5

		for (let i = 0; i < 100; i++) {
			const step = i * 10

			// Model B 收敛较慢
			loss *= 0.998
			loss += (Math.random() - 0.5) * 0.08
			loss = Math.max(0.1, loss)

			accuracy += (Math.random() - 0.4) * 1.5
			accuracy = Math.min(95, Math.max(15, accuracy))

			validRate += (Math.random() - 0.4) * 2.5
			validRate = Math.min(90, Math.max(25, validRate))

			epsilon = Math.max(0.1, epsilon - 0.0008)

			mockData.push({ step, loss, accuracy, validRate, epsilon })
		}

		this.modelBStore.addBatch(mockData)
		console.log("MODEL-COMP", "Model B 数据已更新")
	}

	/**
	 * 销毁资源
	 */
	destroy(): void {
		for (const card of this.metricCards.values()) {
			card.destroy()
		}
		this.metricCards.clear()

		for (const btn of this.buttons) {
			btn.destroy()
		}
		this.buttons = []
	}
}
