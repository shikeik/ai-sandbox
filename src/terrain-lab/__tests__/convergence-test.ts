// ========== 收敛性测试（使用 terrain-lab 实际逻辑）==========
// 运行方式: npx tsx src/terrain-lab/__tests__/convergence-test.ts

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateSupervisedGrad, evaluateModel } from "../supervised.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { assertGreaterThan, printTestSuite, printTestComplete } from "./test-utils.js"

printTestSuite("收敛性测试（使用 terrain-lab 实际数据）")

const DATASET_SIZE = 500
const TRAIN_STEPS = 1000
const BATCH_SIZE = 32
const LOG_INTERVAL = 100
const CONVERGENCE_THRESHOLD = 70

// 使用 terrain-lab 实际生成数据
console.log("\n生成数据集...")
const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集大小: ${dataset.length} 条`)

if (dataset.length === 0) {
	throw new Error("数据集生成失败，无法继续测试")
}

// ========== 监督学习收敛测试 ==========
console.log("\n========== 监督学习收敛测试 ==========")
{
	const net = createNet()
	const initialResult = evaluateModel(net, dataset)
	console.log(`[Step 0] 准确率: ${initialResult.accuracy.toFixed(1)}%, 损失: ${initialResult.avgLoss.toFixed(4)}`)

	let bestAcc = initialResult.accuracy
	let bestLoss = initialResult.avgLoss

	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createGradientBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			accumulateSupervisedGrad(buffer, net, sample.indices, sample.y, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)

		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			const improved = result.accuracy > bestAcc || (result.accuracy === bestAcc && result.avgLoss < bestLoss)
			const mark = improved ? "↑" : "→"
			console.log(`[Step ${step + 1}] 准确率: ${result.accuracy.toFixed(1)}%, 损失: ${result.avgLoss.toFixed(4)} ${mark}`)
			bestAcc = Math.max(bestAcc, result.accuracy)
			bestLoss = Math.min(bestLoss, result.avgLoss)
		}
	}

	const finalResult = evaluateModel(net, dataset)
	console.log(`\n最终结果: 准确率 ${finalResult.accuracy.toFixed(1)}%, 损失: ${finalResult.avgLoss.toFixed(4)}`)
	
	assertGreaterThan(finalResult.accuracy, CONVERGENCE_THRESHOLD, 
		`监督学习应收敛到 ${CONVERGENCE_THRESHOLD}% 以上准确率`)
}

// ========== 无监督学习收敛测试 ==========
console.log("\n========== 无监督学习收敛测试 ==========")
{
	const net = createNet()
	
	// 使用 terrain-lab 实际的合法性检查
	function evaluateUnsupervised(currentNet: typeof net, data: DatasetItem[]) {
		let validCount = 0
		for (const sample of data) {
			const fp = forward(currentNet, sample.indices)
			const predictedAction = fp.o.indexOf(Math.max(...fp.o))
			
			// 使用 terrain-lab 实际的合法性检查
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, predictedAction)
			
			if (isValid) validCount++
		}
		return {
			validRate: (validCount / data.length) * 100,
			avgMaxProb: data.reduce((sum, s) => {
				const fp = forward(currentNet, s.indices)
				return sum + Math.max(...fp.o)
			}, 0) / data.length,
		}
	}

	const initialResult = evaluateUnsupervised(net, dataset)
	console.log(`[Step 0] 合法率: ${initialResult.validRate.toFixed(1)}%, 平均最大概率: ${initialResult.avgMaxProb.toFixed(4)}`)

	// 动态探索率状态
	const history: number[] = []
	let epsilon = 0.5

	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			
			// ε-贪心选择动作
			let action: number
			if (Math.random() < epsilon) {
				action = Math.floor(Math.random() * 4)
			} else {
				action = fp.o.indexOf(Math.max(...fp.o))
			}
			
			// 使用 terrain-lab 实际的标签和合法性检查
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const optimalAction = getLabel(sample.t)
			const isOptimal = (action === optimalAction)
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)

		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateUnsupervised(net, dataset)
			
			// 动态调整探索率
			history.push(result.validRate)
			if (history.length > 5) history.shift()
			
			if (history.length >= 5) {
				const avg = history.slice(0, -1).reduce((a, b) => a + b, 0) / (history.length - 1)
				if (result.validRate > avg + 1) {
					epsilon = Math.max(0.1, epsilon - 0.015)
				} else if (result.validRate < avg - 1) {
					epsilon = Math.min(0.6, epsilon + 0.015)
				} else {
					epsilon = Math.max(0.1, epsilon - 0.005)
				}
			}
			
			console.log(`[Step ${step + 1}] 合法率: ${result.validRate.toFixed(1)}%, 最大概率: ${result.avgMaxProb.toFixed(4)}, ε: ${epsilon.toFixed(2)}`)
		}
	}

	const finalResult = evaluateUnsupervised(net, dataset)
	console.log(`\n最终结果: 合法率 ${finalResult.validRate.toFixed(1)}%, 平均最大概率: ${finalResult.avgMaxProb.toFixed(4)}`)

	if (finalResult.validRate < CONVERGENCE_THRESHOLD) {
		console.error("\n❌ 无监督学习未能达到收敛阈值")
		console.error(`   期望: > ${CONVERGENCE_THRESHOLD}%`)
		console.error(`   实际: ${finalResult.validRate.toFixed(1)}%`)
		console.error("\n可能原因:")
		console.error("- 探索率参数需要调优")
		console.error("- 奖励值需要调整")
		console.error("- 需要更多训练步数")
		throw new Error("无监督学习收敛测试失败")
	}
	
	console.log(`✅ 无监督学习收敛到 ${finalResult.validRate.toFixed(1)}%`)
}

printTestComplete()
