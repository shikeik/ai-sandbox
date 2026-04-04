// ========== 指标数据存储 ==========
// 职责：管理训练指标数据，提供数据查询和订阅功能

import type { TrainingMetrics, TimeRange } from "./types.js"

/** 数据变更监听器 */
type DataListener = (metrics: TrainingMetrics[]) => void

/** 指标数据存储 */
export class MetricsStore {
	private data: TrainingMetrics[] = []
	private listeners: DataListener[] = []
	private maxSize: number

	/**
	 * 创建数据存储
	 * @param maxSize 最大存储数据点数
	 */
	constructor(maxSize = 10000) {
		this.maxSize = maxSize
	}

	/**
	 * 添加数据点
	 * @param metrics 训练指标
	 */
	add(metrics: TrainingMetrics): void {
		this.data.push(metrics)

		// 限制存储大小
		if (this.data.length > this.maxSize) {
			this.data.shift()
		}

		this.notifyListeners()
	}

	/**
	 * 批量添加数据
	 * @param metricsArray 指标数组
	 */
	addBatch(metricsArray: TrainingMetrics[]): void {
		this.data.push(...metricsArray)

		// 限制存储大小
		if (this.data.length > this.maxSize) {
			this.data = this.data.slice(-this.maxSize)
		}

		this.notifyListeners()
	}

	/**
	 * 获取所有数据
	 */
	getAll(): TrainingMetrics[] {
		return [...this.data]
	}

	/**
	 * 获取最近N条数据
	 * @param count 数据条数
	 */
	getRecent(count: number): TrainingMetrics[] {
		return this.data.slice(-count)
	}

	/**
	 * 获取按时间范围过滤的数据
	 * @param range 时间范围（轮数）
	 */
	getByRange(range: TimeRange): TrainingMetrics[] {
		// 获取每N轮的数据点
		const step = range
		const result: TrainingMetrics[] = []

		for (let i = 0; i < this.data.length; i += step) {
			result.push(this.data[i])
		}

		return result
	}

	/**
	 * 获取最新数据点
	 */
	getLatest(): TrainingMetrics | null {
		if (this.data.length === 0) return null
		return this.data[this.data.length - 1]
	}

	/**
	 * 清空数据
	 */
	clear(): void {
		this.data = []
		this.notifyListeners()
	}

	/**
	 * 订阅数据变更
	 * @param listener 监听器
	 * @returns 取消订阅函数
	 */
	subscribe(listener: DataListener): () => void {
		this.listeners.push(listener)
		return () => {
			const index = this.listeners.indexOf(listener)
			if (index !== -1) {
				this.listeners.splice(index, 1)
			}
		}
	}

	/**
	 * 通知所有监听器
	 */
	private notifyListeners(): void {
		const data = this.getAll()
		for (const listener of this.listeners) {
			try {
				listener(data)
			} catch {
				// 忽略监听器错误
			}
		}
	}

	/**
	 * 生成模拟数据（用于测试）
	 * @param count 数据点数
	 * @param startStep 起始步数
	 */
	generateMockData(count: number, startStep = 0): void {
		const mockData: TrainingMetrics[] = []
		let loss = 1.5
		let accuracy = 20
		let validRate = 30
		let epsilon = 0.4

		for (let i = 0; i < count; i++) {
			const step = startStep + i * 10

			// 模拟训练收敛
			loss *= 0.995
			loss += (Math.random() - 0.5) * 0.05
			loss = Math.max(0.1, loss)

			accuracy += (Math.random() - 0.3) * 2
			accuracy = Math.min(95, Math.max(20, accuracy))

			validRate += (Math.random() - 0.3) * 3
			validRate = Math.min(90, Math.max(30, validRate))

			epsilon = Math.max(0.1, epsilon - 0.001)

			mockData.push({
				step,
				loss,
				accuracy,
				validRate,
				epsilon,
			})
		}

		this.addBatch(mockData)
	}
}
