// ========== 指标仪表盘常量 ==========

import type { MetricCardConfig } from "./types.js"

/** 指标卡片配置 - 集中管理，避免魔法数字 */
export const METRIC_CARDS: MetricCardConfig[] = [
	{
		id: "loss",
		title: "损失 (Loss)",
		color: "#f9ab00",
		format: "fixed4",
		lowerIsBetter: true,
	},
	{
		id: "accuracy",
		title: "准确率 (Accuracy)",
		color: "#34a853",
		format: "percent",
		lowerIsBetter: false,
	},
	{
		id: "validRate",
		title: "合法率 (Valid Rate)",
		color: "#8ab4f8",
		format: "percent",
		lowerIsBetter: false,
	},
	{
		id: "epsilon",
		title: "探索率 (Epsilon)",
		color: "#ea4335",
		format: "decimal",
		lowerIsBetter: false,
	},
]

/** 动作类型及其颜色 */
export const ACTIONS = [
	{ name: "走", color: "#8ab4f8" },
	{ name: "跳", color: "#f9ab00" },
	{ name: "远跳", color: "#34a853" },
	{ name: "走A", color: "#ea4335" },
]

/** 图表颜色配置 */
export const CHART_COLORS = {
	grid: "#3c4043",
	text: "#9aa0a6",
	background: "#16181d",
	axis: "#5f6368",
} as const

/** 图表内边距 */
export const CHART_PADDING = {
	left: 48,
	right: 16,
	top: 20,
	bottom: 32,
}

/** 时间范围选项 */
export const TIME_RANGES: { value: 1 | 10 | 100; label: string }[] = [
	{ value: 1, label: "1轮" },
	{ value: 10, label: "10轮" },
	{ value: 100, label: "100轮" },
]

/** 指标卡片默认更新间隔（毫秒） */
export const UPDATE_INTERVAL = 1000

/** 模拟数据生成步长 */
export const SIMULATION_STEP_SIZE = 10
