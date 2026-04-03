// ========== 收敛性测试（与 terrain-lab 实际参数完全一致）==========
// 运行方式: npx tsx src/terrain-lab/__tests__/convergence-test.ts

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateSupervisedGrad } from "../supervised.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { assertGreaterThan, printTestSuite, printTestComplete } from "./test-utils.js"

printTestSuite("收敛性测试（与 terrain-lab 完全一致）")

// 与 terrain-lab 实际参数完全一致
const DATASET_SIZE = 6000
const TRAIN_STEPS = 3000
const BATCH_SIZE = 32
const LOG_INTERVAL = 100 // terrain-lab 每100步batch评估一次

console.log("\n生成数据集...")
const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集大小: ${dataset.length} 条`)

if (dataset.length === 0) {
	throw new Error("数据集生成失败")
}

// 统一评估函数（与 terrain-lab 一致）
function evaluateModel(currentNet: typeof net, data: DatasetItem[]) {
	let correct = 0      // 与最优标签一致
	let validCount = 0   // 动作合法
	let lossSum = 0
	
	for (const sample of data) {
		const fp = forward(currentNet, sample.indices)
		const predictedAction = fp.o.indexOf(Math.max(...fp.o))
		
		// 准确率：与最优标签对比
		if (predictedAction === sample.y) correct++
		
		// 合法率：使用 terrain-lab 实际合法性检查
		const heroCol = findHeroCol(sample.t)
		const checks = getActionChecks(sample.t, heroCol)
		if (isActionValidByChecks(checks, predictedAction)) validCount++
		
		// 损失（交叉熵）
		lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
	}
	
	return {
		accuracy: (correct / data.length) * 100,
		validRate: (validCount / data.length) * 100,
		avgLoss: lossSum / data.length,
	}
}

// ========== 监督学习收敛测试 ==========
console.log("\n========== 监督学习收敛测试 ==========")
{
	const net = createNet()
	let bestAcc = 0

	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createGradientBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			accumulateSupervisedGrad(buffer, net, sample.indices, sample.y, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)

		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			const improved = result.accuracy > bestAcc
			bestAcc = Math.max(bestAcc, result.accuracy)
			console.log(`[Step ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%, 损失: ${result.avgLoss.toFixed(4)} ${improved ? '↑' : ''}`)
		}
	}

	const final = evaluateModel(net, dataset)
	console.log(`\n最终结果: 准确率 ${final.accuracy.toFixed(1)}%, 合法率: ${final.validRate.toFixed(1)}%, 损失: ${final.avgLoss.toFixed(4)}`)
	assertGreaterThan(final.accuracy, 70, `监督学习准确率应 > 70%`)
}

// ========== 无监督学习收敛测试 ==========
console.log("\n========== 无监督学习收敛测试 ==========")
{
	const net = createNet()
	const history: number[] = []
	let epsilon = 0.5
	let bestValid = 0

	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			
			// ε-贪心
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
			
			// 动态探索率（与 terrain-lab 一致）
			history.push(result.validRate)
			if (history.length > UNSUPERVISED_CONFIG.epsilonWindowSize) history.shift()
			
			if (history.length >= UNSUPERVISED_CONFIG.epsilonWindowSize) {
				const avg = history.slice(0, -1).reduce((a, b) => a + b, 0) / (history.length - 1)
				if (result.validRate > avg + UNSUPERVISED_CONFIG.epsilonImproveThreshold) {
					epsilon = Math.max(UNSUPERVISED_CONFIG.epsilonMin, epsilon - UNSUPERVISED_CONFIG.epsilonDecayStep)
				} else if (result.validRate < avg - UNSUPERVISED_CONFIG.epsilonImproveThreshold) {
					epsilon = Math.min(UNSUPERVISED_CONFIG.epsilonMax, epsilon + UNSUPERVISED_CONFIG.epsilonGrowStep)
				} else {
					epsilon = Math.max(UNSUPERVISED_CONFIG.epsilonMin, epsilon - UNSUPERVISED_CONFIG.epsilonDecayIdle)
				}
			}
			
			const improved = result.validRate > bestValid
			bestValid = Math.max(bestValid, result.validRate)
			
			// 与 terrain-lab 日志格式一致
			console.log(`[UNS] 合法率:${result.validRate.toFixed(1)}% 探索率ε:${epsilon.toFixed(2)} 历史窗口:[${history.map(v => v.toFixed(0)).join(",")}]`)
			console.log(`       → 准确率:${result.accuracy.toFixed(1)}% 损失:${result.avgLoss.toFixed(4)} ${improved ? '↑' : ''}`)
		}
	}

	const final = evaluateModel(net, dataset)
	console.log(`\n最终结果: 准确率 ${final.accuracy.toFixed(1)}%, 合法率: ${final.validRate.toFixed(1)}%, 损失: ${final.avgLoss.toFixed(4)}`)
	
	console.log("\n分析:")
	console.log(`- 合法率: ${final.validRate.toFixed(1)}% (网络学会不做非法动作)`)
	console.log(`- 准确率: ${final.accuracy.toFixed(1)}% (与最优动作对比)`)
	console.log(`- 差距: ${(final.validRate - final.accuracy).toFixed(1)}% (合法但非最优的动作)`)
}

printTestComplete()
