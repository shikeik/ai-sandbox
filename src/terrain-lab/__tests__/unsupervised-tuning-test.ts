// ========== 参数调优：突破87%瓶颈 ==========

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG, LR } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { printTestSuite } from "./test-utils.js"

printTestSuite("参数调优：突破87%瓶颈")

const DATASET_SIZE = 6000
const TRAIN_STEPS = 5000
const BATCH_SIZE = 32

console.log("\n生成数据集...")
const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

function evaluateModel(currentNet: ReturnType<typeof createNet>, data: DatasetItem[]) {
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

// 测试不同学习率
const learningRates = [0.01, 0.05, 0.1, 0.2]

for (const lr of learningRates) {
	console.log(`\n--- 学习率: ${lr} ---`)
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
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		// 使用自定义学习率
		for (let e = 0; e < 6; e++) {
			for (let d = 0; d < 2; d++) {
				net.embed[e][d] -= lr * buffer.dEmbed[e][d]
			}
		}
		for (let i = 0; i < 16; i++) {
			for (let j = 0; j < 30; j++) {
				net.W1[i][j] -= lr * buffer.dW1[i][j]
			}
			net.b1[i] -= lr * buffer.db1[i]
		}
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 16; j++) {
				net.W2[i][j] -= lr * buffer.dW2[i][j]
			}
			net.b2[i] -= lr * buffer.db2[i]
		}
	}
	
	const result = evaluateModel(net, dataset)
	console.log(`学习率 ${lr}: 合法率 ${result.validRate.toFixed(1)}%`)
}

// 测试不同奖励值
console.log("\n--- 不同奖励值组合 ---")
const rewardConfigs = [
	{ optimal: 0.1, valid: 0.05, invalid: -0.1 },   // 更激进的奖励
	{ optimal: 0.2, valid: 0.1, invalid: -0.2 },    // 更更激进
	{ optimal: 0.05, valid: 0.02, invalid: -0.05 }, // 保守
	{ optimal: 0.5, valid: 0.1, invalid: -0.5 },    // 极端
]

for (const cfg of rewardConfigs) {
	console.log(`\n奖励: 最优${cfg.optimal}/合法${cfg.valid}/非法${cfg.invalid}`)
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
			
			let reward: number
			if (!isValid) reward = cfg.invalid
			else if (isOptimal) reward = cfg.optimal
			else reward = cfg.valid
			
			const evaluation = { action, isValid, isOptimal, reward }
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
	}
	
	const result = evaluateModel(net, dataset)
	console.log(`结果: 合法率 ${result.validRate.toFixed(1)}%`)
}

console.log("\n========== 调优完成 ==========\n")
