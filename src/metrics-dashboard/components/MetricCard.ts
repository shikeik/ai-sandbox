// ========== 通用指标卡片组件 ==========
// 职责：封装指标卡片渲染逻辑，供4个指标复用
// 遵循 DRY 原则：不重复写4个几乎一样的组件

import type { MetricCardConfig, TrendDirection } from "../types.js"
import { formatMetricValue, isTrendGood } from "../utils/data-formatter.js"
import { drawMiniChart } from "../charts/line-chart.js"

/** 指标数据 */
export interface MetricData {
	/** 当前值 */
	current: number
	/** 历史数据点（用于迷你图） */
	history: { step: number; value: number }[]
	/** 趋势方向 */
	trend: TrendDirection
}

/** 指标卡片组件 */
export class MetricCard {
	private container: HTMLElement
	private config: MetricCardConfig
	private valueEl: HTMLElement
	private trendEl: HTMLElement
	private canvas: HTMLCanvasElement

	/**
	 * 创建指标卡片
	 * @param parent 父容器
	 * @param config 卡片配置
	 */
	constructor(parent: HTMLElement, config: MetricCardConfig) {
		this.config = config
		this.container = this.createCard()
		parent.appendChild(this.container)

		// 缓存关键元素引用
		this.valueEl = this.container.querySelector(".metric-value") as HTMLElement
		this.trendEl = this.container.querySelector(".metric-trend") as HTMLElement
		this.canvas = this.container.querySelector(".metric-chart") as HTMLCanvasElement
	}

	/**
	 * 创建卡片DOM结构
	 */
	private createCard(): HTMLElement {
		const card = document.createElement("div")
		card.className = "metric-card"
		card.dataset.metricId = this.config.id

		card.innerHTML = `
			<div class="metric-header">
				<span class="metric-title">${this.config.title}</span>
				<span class="metric-trend" title="趋势"></span>
			</div>
			<div class="metric-value" style="color: ${this.config.color}">-</div>
			<canvas class="metric-chart"></canvas>
		`

		return card
	}

	/**
	 * 更新指标显示
	 * @param data 指标数据
	 */
	update(data: MetricData): void {
		// 更新数值
		this.valueEl.textContent = formatMetricValue(data.current, this.config)

		// 更新趋势图标
		this.updateTrendIcon(data.trend)

		// 更新迷你图
		if (data.history.length > 1) {
			drawMiniChart(this.canvas, data.history, this.config.color)
		}
	}

	/**
	 * 更新趋势图标
	 * @param trend 趋势方向
	 */
	private updateTrendIcon(trend: TrendDirection): void {
		const isGood = isTrendGood(trend, this.config.lowerIsBetter)
		const icon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→"

		this.trendEl.textContent = icon
		this.trendEl.className = `metric-trend ${trend} ${isGood ? "good" : "bad"}`
	}

	/**
	 * 获取卡片元素
	 */
	getElement(): HTMLElement {
		return this.container
	}

	/**
	 * 销毁卡片
	 */
	destroy(): void {
		this.container.remove()
	}
}

/**
 * 批量创建指标卡片
 * @param container 父容器
 * @param configs 卡片配置数组
 */
export function createMetricCards(
	container: HTMLElement,
	configs: MetricCardConfig[]
): Map<string, MetricCard> {
	const cards = new Map<string, MetricCard>()

	for (const config of configs) {
		const card = new MetricCard(container, config)
		cards.set(config.id, card)
	}

	return cards
}
