// ========== 数据格式化工具 ==========
// 职责：统一数据格式化逻辑，供导出和显示复用

import type { TrainingMetrics, MetricCardConfig } from "../types.js"

/**
 * 格式化数值为百分比字符串
 * @param value 0-100 的数值
 * @param decimals 小数位数，默认1
 */
export function formatPercent(value: number, decimals = 1): string {
	if (value === undefined || value === null || Number.isNaN(value)) return "-"
	return `${value.toFixed(decimals)}%`
}

/**
 * 格式化为4位小数
 */
export function formatFixed4(value: number): string {
	if (value === undefined || value === null || Number.isNaN(value)) return "-"
	return value.toFixed(4)
}

/**
 * 格式化为普通小数
 */
export function formatDecimal(value: number, decimals = 2): string {
	if (value === undefined || value === null || Number.isNaN(value)) return "-"
	return value.toFixed(decimals)
}

/**
 * 根据指标配置格式化数值
 * @param value 数值
 * @param config 指标卡片配置
 */
export function formatMetricValue(value: number, config: MetricCardConfig): string {
	switch (config.format) {
	case "percent":
		return formatPercent(value)
	case "fixed4":
		return formatFixed4(value)
	case "decimal":
		return formatDecimal(value)
	default:
		return String(value)
	}
}

/**
 * 生成CSV内容
 * @param headers 表头
 * @param rows 数据行
 */
export function generateCsvContent(headers: string[], rows: (string | number)[][]): string {
	const escapeCell = (cell: string | number): string => {
		const str = String(cell)
		if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
			return `"${str.replace(/"/g, "\"\"")}"`
		}
		return str
	}

	const headerLine = headers.map(escapeCell).join(",")
	const dataLines = rows.map(row => row.map(escapeCell).join(","))
	return [headerLine, ...dataLines].join("\n")
}

/**
 * 训练指标转CSV
 * @param metrics 训练指标数组
 */
export function metricsToCsv(metrics: TrainingMetrics[]): string {
	const headers = ["Step", "Loss", "Accuracy", "ValidRate", "Epsilon"]
	const rows = metrics.map(m => [m.step, m.loss, m.accuracy, m.validRate, m.epsilon])
	return generateCsvContent(headers, rows)
}

/**
 * 触发文件下载
 * @param content 文件内容
 * @param filename 文件名
 * @param mimeType MIME类型
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

/**
 * 下载CSV文件
 * @param content CSV内容
 * @param filename 文件名（不含扩展名）
 */
export function downloadCsv(content: string, filename: string): void {
	const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
	downloadFile(content, `${filename}-${timestamp}.csv`, "text/csv;charset=utf-8")
}

/**
 * 计算趋势方向
 * @param current 当前值
 * @param previous 前值
 */
export function calculateTrend(current: number, previous: number): "up" | "down" | "flat" {
	const diff = current - previous
	const threshold = 0.001 // 避免浮点误差
	if (diff > threshold) return "up"
	if (diff < -threshold) return "down"
	return "flat"
}

/**
 * 判断趋势是否良好
 * @param trend 趋势方向
 * @param lowerIsBetter 是否越低越好
 */
export function isTrendGood(trend: "up" | "down" | "flat", lowerIsBetter: boolean): boolean {
	if (trend === "flat") return true
	return lowerIsBetter ? trend === "down" : trend === "up"
}
