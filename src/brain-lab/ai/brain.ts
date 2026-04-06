// ========== AI大脑：想象 + 规划 + 决策 ==========

import type { WorldState, ActionType, Imagination, BrainDecision } from "../types/index.js"
import { Predictor } from "../core/predictor.js"
import { AI_CONFIG, REWARDS } from "../config.js"

/**
 * AI大脑 - 决策中心
 * 
 * 职责：
 * - 想象所有可能的动作结果
 * - 评估每种可能的价值
 * - 选择最佳动作
 */
export class Brain {
	private predictor: Predictor
	private imagineDepth: number

	constructor(width: number, height: number) {
		this.predictor = new Predictor(width, height)
		this.imagineDepth = AI_CONFIG.defaultDepth
	}

	/**
	 * 决策：想象所有可能，选择最好的
	 */
	think(state: WorldState): BrainDecision {
		const actions: ActionType[] = ["LEFT", "RIGHT", "JUMP", "WAIT"]
		const imaginations: Imagination[] = []

		// 对每种动作，想象未来
		for (const action of actions) {
			const imagined = this.imagine(state, action, this.imagineDepth)
			imaginations.push(imagined)
		}

		// 选择最佳动作
		const best = imaginations.reduce((best, current) =>
			current.predictedReward > best.predictedReward ? current : best
		)

		// 生成决策理由
		const reasoning = this.generateReasoning(best, imaginations)

		return {
			selectedAction: best.action,
			imaginations,
			reasoning,
		}
	}

	/**
	 * 想象：递归推演未来
	 */
	private imagine(state: WorldState, action: ActionType, depth: number): Imagination {
		// 第一步预测
		const predictedState = this.predictor.predict(state, action)
		let totalReward = this.predictor.evaluate(predictedState)
		let steps = 1
		let killedEnemy = false

		// 检查是否击杀敌人
		if (predictedState.enemies.length < state.enemies.length) {
			killedEnemy = true
		}

		// 继续想象（简单的贪心延续）
		if (depth > 1 && predictedState.hero.y < state.grid.length) {
			// 想象后续几步：假设继续往右走
			let futureState = predictedState
			for (let i = 0; i < depth - 1; i++) {
				futureState = this.predictor.predict(futureState, "RIGHT")
				totalReward += this.predictor.evaluate(futureState) * Math.pow(AI_CONFIG.discountFactor, i + 1)
				steps++
			}
		}

		return {
			action,
			predictedState,
			predictedReward: totalReward,
			steps,
			killedEnemy,
		}
	}

	/**
	 * 生成人类可读的决策理由
	 */
	private generateReasoning(best: Imagination, all: Imagination[]): string {
		const actionNames: Record<ActionType, string> = {
			LEFT: "左移",
			RIGHT: "右移",
			JUMP: "跳跃",
			WAIT: "等待",
			JUMP_LEFT: "向左跳",
			JUMP_RIGHT: "向右跳",
			JUMP_LEFT_FAR: "左远跳",
			JUMP_RIGHT_FAR: "右远跳",
		}

		let reason = `选择「${actionNames[best.action]}」，因为：`

		// 分析原因
		if (best.predictedState.hero.x > all.find(i => i.action === "WAIT")?.predictedState.hero.x!) {
			reason += "可以向前推进；"
		}

		if (best.predictedState.enemies.length < all[0].predictedState.enemies.length) {
			reason += "可能触发机关清除敌人；"
		}

		if (best.predictedReward > REWARDS.reachGoal * 0.5) {
			reason += "预计获得高奖励。"
		}

		// 对比其他选项
		const others = all.filter(i => i.action !== best.action && i.predictedReward < 0)
		if (others.length > 0) {
			reason += `（其他选项如${others.map(o => actionNames[o.action]).join("、")}预测结果不佳）`
		}

		return reason
	}

	/**
	 * 设置想象深度
	 */
	setImagineDepth(depth: number): void {
		this.imagineDepth = depth
	}

	/**
	 * 获取当前想象深度
	 */
	getImagineDepth(): number {
		return this.imagineDepth
	}
}
