// ========== 无监督学习核心逻辑（可测试封装）==========

import type { NetParams } from "./types.js"
import { NUM_ELEMENTS, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM } from "./constants.js"
import { forward, backward } from "./neural-network.js"

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

// 梯度容器（与 Gradients 接口兼容）
export interface GradientBuffer {
	dEmbed: number[][]
	dW1: number[][]
	db1: number[]
	dW2: number[][]
	db2: number[]
}

// 创建空梯度容器
export function createGradientBuffer(): GradientBuffer {
	return {
		dEmbed: Array(NUM_ELEMENTS).fill(null).map(() => Array(2).fill(0)),
		dW1: Array(HIDDEN_DIM).fill(null).map(() => Array(INPUT_DIM).fill(0)),
		db1: Array(HIDDEN_DIM).fill(0),
		dW2: Array(OUTPUT_DIM).fill(null).map(() => Array(HIDDEN_DIM).fill(0)),
		db2: Array(OUTPUT_DIM).fill(0),
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
		for (let otherAction = 0; otherAction < OUTPUT_DIM; otherAction++) {
			if (otherAction === targetAction) {
				// 惩罚坏动作
				_addGradient(buffer, net, indices, targetAction, -gradScale)
			} else {
				// 奖励其他动作（分摊概率）
				const redistributeScale = gradScale / (OUTPUT_DIM - 1) * 0.5
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

	for (let e = 0; e < NUM_ELEMENTS; e++) {
		for (let d = 0; d < 2; d++) {
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

// 验证梯度缓冲区是否有效（测试用）
export function isValidGradientBuffer(buffer: GradientBuffer): boolean {
	// 检查维度
	if (buffer.dEmbed.length !== NUM_ELEMENTS) return false
	if (buffer.dW1.length !== HIDDEN_DIM) return false
	if (buffer.dW2.length !== OUTPUT_DIM) return false

	// 检查是否有 NaN 或 Infinity
	const allValues = [
		...buffer.dEmbed.flat(),
		...buffer.dW1.flat(),
		...buffer.db1,
		...buffer.dW2.flat(),
		...buffer.db2,
	]
	return allValues.every(v => !isNaN(v) && isFinite(v))
}

// 计算缓冲区总梯度幅值（测试用）
export function getTotalGradientMagnitude(buffer: GradientBuffer): number {
	const allValues = [
		...buffer.dEmbed.flat(),
		...buffer.dW1.flat(),
		...buffer.db1,
		...buffer.dW2.flat(),
		...buffer.db2,
	]
	return allValues.reduce((sum, v) => sum + Math.abs(v), 0)
}
