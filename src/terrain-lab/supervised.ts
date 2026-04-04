// ========== 监督学习核心逻辑（可测试封装）==========

import type { NetParams, ForwardResult } from "./types.js"
import { NUM_ELEMENTS, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM, EMBED_DIM } from "./constants.js"
import { forward, backward } from "./neural-network.js"
import { createGradientBuffer, type GradientBuffer } from "./gradients.js"
export { createGradientBuffer, type GradientBuffer } from "./gradients.js"

// 训练统计
export interface TrainingStats {
	lossSum: number
	correctCount: number
}

// 单样本监督学习梯度累积
export function accumulateSupervisedGrad(
	buffer: GradientBuffer,
	net: NetParams,
	indices: number[],
	targetLabel: number,
	batchSize: number
): { loss: number; isCorrect: boolean } {
	const fp = forward(net, indices)
	const grad = backward(net, fp, targetLabel)

	// 累积梯度（使用 EMBED_DIM 常量替代硬编码的 2）
	for (let e = 0; e < NUM_ELEMENTS; e++) {
		for (let d = 0; d < EMBED_DIM; d++) {
			buffer.dEmbed[e][d] += grad.dEmbed[e][d] / batchSize
		}
	}
	for (let i = 0; i < HIDDEN_DIM; i++) {
		for (let j = 0; j < INPUT_DIM; j++) {
			buffer.dW1[i][j] += grad.dW1[i][j] / batchSize
		}
		buffer.db1[i] += grad.db1[i] / batchSize
	}
	for (let i = 0; i < OUTPUT_DIM; i++) {
		for (let j = 0; j < HIDDEN_DIM; j++) {
			buffer.dW2[i][j] += grad.dW2[i][j] / batchSize
		}
		buffer.db2[i] += grad.db2[i] / batchSize
	}

	// 计算损失和准确率
	const loss = -Math.log(Math.max(fp.o[targetLabel], 1e-7))
	const predicted = fp.o.indexOf(Math.max(...fp.o))
	const isCorrect = predicted === targetLabel

	return { loss, isCorrect }
}

// 评估模型在数据集上的性能
export function evaluateModel(
	net: NetParams,
	dataset: { indices: number[]; y: number }[]
): { accuracy: number; avgLoss: number } {
	let correct = 0
	let lossSum = 0

	for (const sample of dataset) {
		const fp = forward(net, sample.indices)
		const predicted = fp.o.indexOf(Math.max(...fp.o))
		if (predicted === sample.y) correct++
		lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
	}

	return {
		accuracy: (correct / dataset.length) * 100,
		avgLoss: lossSum / dataset.length,
	}
}
