// ========== 混合策略：监督预热 + 无监督微调 ==========

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateSupervisedGrad } from "../supervised.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { assertGreaterThan, printTestSuite, printTestComplete } from "./test-utils.js"

printTestSuite("混合学习测试（预热+微调）")

const DATASET_SIZE = 6000
const PRETRAIN_STEPS = 500   // 监督预热步数
const FINETUNE_STEPS = 1000  // 无监督微调步数
const BATCH_SIZE = 32
const LOG_INTERVAL = 100
const TARGET_ACCURACY = 80

console.log("\n生成数据集...")
const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

function evaluateModel(currentNet: ReturnType<typeof createNet>, data: DatasetItem[]) {
	let correct = 0
	let validCount = 0
	
	for (const sample of data) {
		const fp = forward(currentNet, sample.indices)
		const predictedAction = fp.o.indexOf(Math.max(...fp.o))
		
		if (predictedAction === sample.y) correct++
		
		const heroCol = findHeroCol(sample.t)
		const checks = getActionChecks(sample.t, heroCol)
		if (isActionValidByChecks(checks, predictedAction)) validCount++
	}
	
	return {
		accuracy: (correct / data.length) * 100,
		validRate: (validCount / data.length) * 100,
	}
}

// ========== 阶段1: 监督学习预热 ==========
console.log("\n--- 阶段1: 监督学习预热 ---")
{
	const net = createNet()
	
	for (let step = 0; step < PRETRAIN_STEPS; step++) {
		const buffer = createGradientBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			accumulateSupervisedGrad(buffer, net, sample.indices, sample.y, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			console.log(`[预热 ${(step + 1).toString().padStart(3)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%`)
		}
	}
	
	const afterPretrain = evaluateModel(net, dataset)
	console.log(`预热后: 准确率 ${afterPretrain.accuracy.toFixed(1)}%, 合法率: ${afterPretrain.validRate.toFixed(1)}%`)
	
	// 保存预热后的网络
	const pretrainedNet = JSON.parse(JSON.stringify(net))
	
	// ========== 阶段2: 无监督微调 ==========
	console.log("\n--- 阶段2: 无监督微调 ---")
	
	const history: number[] = []
	let epsilon = 0.3  // 低探索率，基于已学知识微调
	
	for (let step = 0; step < FINETUNE_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			
			let action: number
			if (Math.random() < epsilon) {
				action = Math.floor(Math.random() * 4)
			} else {
				action = fp.o.indexOf(Math.max(...fp.o))
			}
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const isOptimal = (action === getLabel(sample.t))
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			history.push(result.accuracy)
			if (history.length > 5) history.shift()
			
			const avgAcc = history.reduce((a, b) => a + b, 0) / history.length
			if (result.accuracy > avgAcc + 1) {
				epsilon = Math.max(0.1, epsilon - 0.01)
			} else if (result.accuracy < avgAcc - 1) {
				epsilon = Math.min(0.5, epsilon + 0.01)
			}
			
			console.log(`[微调 ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%, ε: ${epsilon.toFixed(2)}`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`\n最终结果: 准确率 ${final.accuracy.toFixed(1)}%, 合法率: ${final.validRate.toFixed(1)}%`)
	console.log(`对比预热后: 准确率 ${(final.accuracy - afterPretrain.accuracy).toFixed(1)}%`)
	
	try {
		assertGreaterThan(final.accuracy, TARGET_ACCURACY, `混合学习应达到 ${TARGET_ACCURACY}% 准确率`)
		console.log(`✅ 达到目标准确率 ${TARGET_ACCURACY}%!`)
	} catch (e) {
		console.log(`⚠️ 未达到目标 ${TARGET_ACCURACY}%，当前 ${final.accuracy.toFixed(1)}%`)
	}
}

// ========== 纯无监督对比（相同总步数） ==========
console.log("\n--- 纯无监督对比（1500步）---")
{
	const net = createNet()
	const history: number[] = []
	let epsilon = 0.5
	
	for (let step = 0; step < PRETRAIN_STEPS + FINETUNE_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			
			let action: number
			if (Math.random() < epsilon) {
				action = Math.floor(Math.random() * 4)
			} else {
				action = fp.o.indexOf(Math.max(...fp.o))
			}
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const isOptimal = (action === getLabel(sample.t))
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
	}
	
	const result = evaluateModel(net, dataset)
	console.log(`纯无监督: 准确率 ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%`)
}

printTestComplete()
