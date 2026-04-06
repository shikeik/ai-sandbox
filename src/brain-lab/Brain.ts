// ========== 大脑：想象 + 规划 + 决策 ==========

import { WorldState, ActionType, Imagination, BrainDecision, ELEM } from "./types.js"
import { WorldModel } from "./WorldModel.js"

export class Brain {
	private worldModel: WorldModel
	private imagineDepth: number = 3  // 想象深度

	constructor(width: number, height: number) {
		this.worldModel = new WorldModel(width, height)
	}

	// 大脑决策：想象所有可能，选择最好的
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

	// 想象：递归推演未来
	private imagine(state: WorldState, action: ActionType, depth: number): Imagination {
		// 第一步预测
		let predictedState = this.worldModel.predict(state, action)
		let totalReward = this.worldModel.evaluate(predictedState)
		let steps = 1

		// 继续想象（简单的贪心延续）
		if (depth > 1 && predictedState.hero.y < state.grid.length) {
			// 想象后续几步：假设继续往右走
			let futureState = predictedState
			for (let i = 0; i < depth - 1; i++) {
				futureState = this.worldModel.predict(futureState, "RIGHT")
				totalReward += this.worldModel.evaluate(futureState) * Math.pow(0.9, i + 1)
				steps++
			}
		}

		return {
			action,
			predictedState,
			predictedReward: totalReward,
			steps,
		}
	}

	// 生成人类可读的决策理由
	private generateReasoning(best: Imagination, all: Imagination[]): string {
		const actionNames: Record<ActionType, string> = {
			LEFT: "左移",
			RIGHT: "右移",
			JUMP: "跳跃",
			WAIT: "等待",
		}

		let reason = `选择「${actionNames[best.action]}」，因为：`;

		// 分析原因
		if (best.predictedState.hero.x > all.find(i => i.action === "WAIT")?.predictedState.hero.x!) {
			reason += "可以向前推进；"
		}

		if (best.predictedState.enemies.length < all[0].predictedState.enemies.length) {
			reason += "可能触发机关清除敌人；"
		}

		if (best.predictedReward > 100) {
			reason += "预计获得高奖励。"
		}

		// 对比其他选项
		const others = all.filter(i => i.action !== best.action && i.predictedReward < 0)
		if (others.length > 0) {
			reason += `（其他选项如${others.map(o => actionNames[o.action]).join("、")}预测结果不佳）`
		}

		return reason
	}

	// 设置想象深度
	setImagineDepth(depth: number) {
		this.imagineDepth = depth
	}
}
