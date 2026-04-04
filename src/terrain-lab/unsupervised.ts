// ========== 无监督学习核心逻辑（可测试封装）==========

import type { NetParams } from "./types.js"
import { NUM_ELEMENTS, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM, EMBED_DIM } from "./constants.js"
import { forward, backward } from "./neural-network.js"
import { createGradientBuffer, type GradientBuffer } from "./gradients.js"
export { createGradientBuffer, type GradientBuffer } from "./gradients.js"

// 无监督学习配置接口
export interface UnsupervisedRewardConfig {
	rewardOptimal: number
	rewardValid: number
	rewardInvalid: number
}

// 动作评估结果
export interface ActionEvaluation {
	action: number
	isValid: boolean
	isOptimal: boolean
	reward: number
}

// 新增：带最优动作引导的梯度累积
export interface GuidedEvaluation extends ActionEvaluation {
	optimalAction: number  // 已知的最优动作（用于引导）
}

// 最优动作引导的梯度累积（平衡版）
// 核心改进：保持合法性学习的同时，让embedding层也能学到最优特征
export function accumulateGradientsGuided(
	buffer: GradientBuffer,
	net: NetParams,
	indices: number[],
	evaluation: GuidedEvaluation,
	batchSize: number
): void {
	const { reward, action: selectedAction, optimalAction, isValid } = evaluation
	const gradScale = 0.3 / batchSize

	if (!isValid) {
		// 不合法：惩罚选中动作，向最优动作引导
		_addGradient(buffer, net, indices, selectedAction, -gradScale)
		_addGradient(buffer, net, indices, optimalAction, gradScale)
		return
	}

	// 合法动作的处理：平衡"维持合法性"和"学习最优"
	if (selectedAction === optimalAction) {
		// 选中最优：大幅强化（和监督学习强度相同）
		_addGradient(buffer, net, indices, optimalAction, gradScale * 2.0)
	} else {
		// 选中次优：两个目标都更新
		// 1. 以较小权重强化选中动作（维持合法性知识）
		_addGradient(buffer, net, indices, selectedAction, gradScale * 0.4)
		// 2. 以较大权重向最优动作引导（embedding学习关键）
		_addGradient(buffer, net, indices, optimalAction, gradScale * 1.2)
	}
}

// 累积梯度到缓冲区（核心逻辑，可测试）
export function accumulateGradients(
	buffer: GradientBuffer,
	net: NetParams,
	indices: number[],
	evaluation: ActionEvaluation,
	batchSize: number
): void {
	const { reward, action: targetAction } = evaluation
	const gradScale = Math.abs(reward) * 0.3 / batchSize

	if (reward > 0) {
		// 正向强化
		_addGradient(buffer, net, indices, targetAction, gradScale)
	} else {
		// 负向惩罚：减少 targetAction，同时增加其他动作
		// 关键：惩罚总量 = 奖励总量，保持概率质量守恒
		const otherActionCount = OUTPUT_DIM - 1
		const redistributeScale = gradScale / otherActionCount  // 平均分摊，不额外缩放
		
		for (let otherAction = 0; otherAction < OUTPUT_DIM; otherAction++) {
			if (otherAction === targetAction) {
				// 惩罚坏动作
				_addGradient(buffer, net, indices, targetAction, -gradScale)
			} else {
				// 奖励其他动作（平均分摊拿走的概率）
				_addGradient(buffer, net, indices, otherAction, redistributeScale)
			}
		}
	}
}

// 内部辅助：添加单次梯度
function _addGradient(
	buffer: GradientBuffer,
	net: NetParams,
	indices: number[],
	action: number,
	scale: number
): void {
	const fp = forward(net, indices)
	const grad = backward(net, fp, action)

	// 使用 EMBED_DIM 常量替代硬编码的 2
	for (let e = 0; e < NUM_ELEMENTS; e++) {
		for (let d = 0; d < EMBED_DIM; d++) {
			buffer.dEmbed[e][d] += grad.dEmbed[e][d] * scale
		}
	}
	for (let i = 0; i < HIDDEN_DIM; i++) {
		for (let j = 0; j < INPUT_DIM; j++) {
			buffer.dW1[i][j] += grad.dW1[i][j] * scale
		}
		buffer.db1[i] += grad.db1[i] * scale
	}
	for (let i = 0; i < OUTPUT_DIM; i++) {
		for (let j = 0; j < HIDDEN_DIM; j++) {
			buffer.dW2[i][j] += grad.dW2[i][j] * scale
		}
		buffer.db2[i] += grad.db2[i] * scale
	}
}

// 计算奖励（纯函数，可测试）
export function calculateReward(
	action: number,
	isValid: boolean,
	isOptimal: boolean,
	config: UnsupervisedRewardConfig
): ActionEvaluation {
	if (!isValid) {
		return { action, isValid, isOptimal, reward: config.rewardInvalid }
	}
	if (isOptimal) {
		return { action, isValid, isOptimal, reward: config.rewardOptimal }
	}
	return { action, isValid, isOptimal, reward: config.rewardValid }
}
