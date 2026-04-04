// ========== 测试权重裁剪对合法率的影响 ==========

import { createNet, forward, backward } from "../neural-network.js"
import { createGradientBuffer as createUnsupervisedBuffer, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG, LR, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM, NUM_ELEMENTS, EMBED_DIM } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem, NetParams } from "../types.js"
import { printTestSuite } from "./test-utils.js"

printTestSuite("权重裁剪影响测试")

const DATASET_SIZE = 6000
const TRAIN_STEPS = 5000
const BATCH_SIZE = 32

console.log("\n生成数据集...")
const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

function evaluateModel(currentNet: NetParams, data: DatasetItem[]) {
	let validCount = 0
	for (const sample of data) {
		const fp = forward(currentNet, sample.indices)
		const predictedAction = fp.o.indexOf(Math.max(...fp.o))
		const heroCol = findHeroCol(sample.t)
		const checks = getActionChecks(sample.t, heroCol)
		if (isActionValidByChecks(checks, predictedAction)) validCount++
	}
	return { validRate: (validCount / data.length) * 100 }
}

// 自定义 updateNetwork，带可配置裁剪
function updateNetworkWithClip(net: NetParams, grads: ReturnType<typeof createUnsupervisedBuffer>, batchSize: number, clipValue: number | null) {
	for (let e = 0; e < 6; e++) {
		for (let d = 0; d < 2; d++) {
			net.embed[e][d] -= LR * grads.dEmbed[e][d] / batchSize
			if (clipValue !== null) {
				net.embed[e][d] = Math.max(-clipValue, Math.min(clipValue, net.embed[e][d]))
			}
		}
	}
	for (let i = 0; i < HIDDEN_DIM; i++) {
		for (let j = 0; j < INPUT_DIM; j++) {
			net.W1[i][j] -= LR * grads.dW1[i][j] / batchSize
			if (clipValue !== null) {
				net.W1[i][j] = Math.max(-clipValue, Math.min(clipValue, net.W1[i][j]))
			}
		}
		net.b1[i] -= LR * grads.db1[i] / batchSize
		if (clipValue !== null) {
			net.b1[i] = Math.max(-clipValue, Math.min(clipValue, net.b1[i]))
		}
	}
	for (let i = 0; i < OUTPUT_DIM; i++) {
		for (let j = 0; j < HIDDEN_DIM; j++) {
			net.W2[i][j] -= LR * grads.dW2[i][j] / batchSize
			if (clipValue !== null) {
				net.W2[i][j] = Math.max(-clipValue, Math.min(clipValue, net.W2[i][j]))
			}
		}
		net.b2[i] -= LR * grads.db2[i] / batchSize
		if (clipValue !== null) {
			net.b2[i] = Math.max(-clipValue, Math.min(clipValue, net.b2[i]))
		}
	}
}

// 累积梯度（简化版）
function accumulateGradSimple(net: NetParams, buffer: ReturnType<typeof createUnsupervisedBuffer>, indices: number[], targetAction: number, reward: number, batchSize: number) {
	const gradScale = Math.abs(reward) * 0.3 / batchSize
	const fp = forward(net, indices)
	
	if (reward > 0) {
		// 正向
		const grad = backward(net, fp, targetAction)
		for (let e = 0; e < NUM_ELEMENTS; e++) for (let d = 0; d < EMBED_DIM; d++) buffer.dEmbed[e][d] += grad.dEmbed[e][d] * gradScale
		for (let i = 0; i < HIDDEN_DIM; i++) {
			for (let j = 0; j < INPUT_DIM; j++) buffer.dW1[i][j] += grad.dW1[i][j] * gradScale
			buffer.db1[i] += grad.db1[i] * gradScale
		}
		for (let i = 0; i < OUTPUT_DIM; i++) {
			for (let j = 0; j < HIDDEN_DIM; j++) buffer.dW2[i][j] += grad.dW2[i][j] * gradScale
			buffer.db2[i] += grad.db2[i] * gradScale
		}
	} else {
		// 负向 - 概率重新分配
		const otherActionCount = 3
		const redistributeScale = gradScale / otherActionCount
		
		for (let otherAction = 0; otherAction < 4; otherAction++) {
			const grad = backward(net, fp, otherAction)
			if (otherAction === targetAction) {
				for (let e = 0; e < NUM_ELEMENTS; e++) for (let d = 0; d < EMBED_DIM; d++) buffer.dEmbed[e][d] -= grad.dEmbed[e][d] * gradScale
				for (let i = 0; i < 16; i++) {
					for (let j = 0; j < 30; j++) buffer.dW1[i][j] -= grad.dW1[i][j] * gradScale
					buffer.db1[i] -= grad.db1[i] * gradScale
				}
				for (let i = 0; i < 4; i++) {
					for (let j = 0; j < 16; j++) buffer.dW2[i][j] -= grad.dW2[i][j] * gradScale
					buffer.db2[i] -= grad.db2[i] * gradScale
				}
			} else {
				for (let e = 0; e < NUM_ELEMENTS; e++) for (let d = 0; d < EMBED_DIM; d++) buffer.dEmbed[e][d] += grad.dEmbed[e][d] * redistributeScale
				for (let i = 0; i < 16; i++) {
					for (let j = 0; j < 30; j++) buffer.dW1[i][j] += grad.dW1[i][j] * redistributeScale
					buffer.db1[i] += grad.db1[i] * redistributeScale
				}
				for (let i = 0; i < 4; i++) {
					for (let j = 0; j < 16; j++) buffer.dW2[i][j] += grad.dW2[i][j] * redistributeScale
					buffer.db2[i] += grad.db2[i] * redistributeScale
				}
			}
		}
	}
}

// 测试不同裁剪值
const clipValues = [null, 10, 5, 2, 1]  // null = 无裁剪

for (const clip of clipValues) {
	const clipLabel = clip === null ? "无裁剪" : `裁剪±${clip}`
	console.log(`\n--- ${clipLabel} ---`)
	
	const net = createNet()
	
	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			const action = Math.random() < 0.5 ? Math.floor(Math.random() * 4) : fp.o.indexOf(Math.max(...fp.o))
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const isOptimal = (action === getLabel(sample.t))
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradSimple(net, buffer, sample.indices, action, evaluation.reward, BATCH_SIZE)
		}
		
		updateNetworkWithClip(net, buffer, 1, clip)
	}
	
	const result = evaluateModel(net, dataset)
	console.log(`${clipLabel}: 合法率 ${result.validRate.toFixed(1)}%`)
}

console.log("\n========== 裁剪测试完成 ==========\n")
