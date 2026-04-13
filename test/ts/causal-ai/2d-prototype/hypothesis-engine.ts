// ========== 假设引擎（从0到1）==========
// AI 不知道动作和哪个邻居有关，也不知道 true/false 的含义
// 它通过生成假设 → 实验验证 → 排除矛盾 来学习

import type { Action, Observation } from "./minimal-world"

export interface Hypothesis {
	id: string
	action: Action
	// 条件：哪个邻居的什么值
	condition: {
		neighbor: string   // "上" | "下" | "左" | "右"
		value: boolean
	}
	// 预测结果
	predictedResult: boolean
	// 支持此假设的实验次数
	supportCount: number
	// 是否被证伪
	falsified: boolean
}

export interface Experiment {
	action: Action
	before: Observation
	result: { success: boolean }
}

const NEIGHBORS = ["上", "下", "左", "右"] as const

export class HypothesisEngine {
	// 所有假设，按动作分组
	private hypotheses: Map<Action, Hypothesis[]> = new Map()
	private experiments: Experiment[] = []

	constructor() {
		this.initHypotheses()
	}

	private initHypotheses(): void {
		const actions: Action[] = ["上", "下", "左", "右"]
		for (const action of actions) {
			const list: Hypothesis[] = []
			for (const neighbor of NEIGHBORS) {
				for (const value of [true, false]) {
					for (const predicted of [true, false]) {
						list.push({
							id: `${action}_${neighbor}_${value}_${predicted}`,
							action,
							condition: { neighbor, value },
							predictedResult: predicted,
							supportCount: 0,
							falsified: false
						})
					}
				}
			}
			this.hypotheses.set(action, list)
		}
	}

	/**
	 * 记录一次实验并更新假设
	 */
	addExperiment(exp: Experiment): void {
		this.experiments.push(exp)
		const list = this.hypotheses.get(exp.action) || []

		for (const h of list) {
			// 检查此假设是否适用于当前观测（动作执行前）
			const actualNeighborValue = exp.before.neighbors[h.condition.neighbor]

			if (actualNeighborValue === h.condition.value) {
				// 假设条件匹配当前观测
				if (exp.result.success === h.predictedResult) {
					// 预测正确，支持度+1
					h.supportCount++
				} else {
					// 预测错误，证伪！
					h.falsified = true
				}
			}
		}
	}

	/**
	 * 获取某个动作的存活假设（未被证伪的）
	 */
	getSurvivingHypotheses(action: Action): Hypothesis[] {
		const list = this.hypotheses.get(action) || []
		return list.filter(h => !h.falsified)
	}

	/**
	 * 获取某个动作的最强假设（支持度最高且未被证伪的）
	 */
	getBestHypotheses(action: Action): Hypothesis[] {
		const survivors = this.getSurvivingHypotheses(action)
		if (survivors.length === 0) return []

		const maxSupport = Math.max(...survivors.map(h => h.supportCount))
		return survivors.filter(h => h.supportCount === maxSupport && maxSupport > 0)
	}

	/**
	 * 获取所有实验记录
	 */
	getExperiments(): Experiment[] {
		return [...this.experiments]
	}

	/**
	 * 打印当前假设状态（调试用）
	 */
	printState(action: Action): void {
		const survivors = this.getSurvivingHypotheses(action)
		console.log(`\n[${action}] 存活假设: ${survivors.length} / 16`)
		for (const h of survivors) {
			console.log(`  ${h.condition.neighbor}=${h.condition.value} → ${h.predictedResult} (支持:${h.supportCount})`)
		}
	}
}
