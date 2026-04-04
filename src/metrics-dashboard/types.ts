// ========== 指标仪表盘类型定义 ==========

/** 指标数据点 */
export interface MetricPoint {
	step: number
	value: number
}

/** 指标趋势方向 */
export type TrendDirection = "up" | "down" | "flat"

/** 指标卡片配置 */
export interface MetricCardConfig {
	id: string
	title: string
	color: string
	format: "percent" | "decimal" | "fixed4"
	lowerIsBetter: boolean
}

/** 对比模式下的指标数据 */
export interface ComparisonMetricData {
	/** Model A 当前值 */
	modelAValue: number
	/** Model B 当前值 */
	modelBValue: number
	/** Model A 历史数据 */
	modelAHistory: { step: number; value: number }[]
	/** Model B 历史数据 */
	modelBHistory: { step: number; value: number }[]
}

/** 训练指标数据 */
export interface TrainingMetrics {
	step: number
	loss: number
	accuracy: number
	validRate: number
	epsilon: number
}

/** 动作分布数据 */
export interface ActionDistribution {
	action: string
	count: number
	color: string
}

/** 时间范围选项 */
export type TimeRange = 1 | 10 | 100

/** 图表尺寸 */
export interface ChartRect {
	width: number
	height: number
	left: number
	top: number
}

/** 折线图数据系列 */
export interface LineSeries {
	name: string
	data: MetricPoint[]
	color: string
	lineWidth?: number
}
