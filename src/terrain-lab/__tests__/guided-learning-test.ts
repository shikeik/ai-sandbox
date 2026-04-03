// ========== 最优动作引导的无监督学习测试 ==========
// 核心改进：即使AI选了次优动作，也向最优动作方向引导

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateGradientsGuided, type GuidedEvaluation } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { printTestSuite } from "./test-utils.js"

printTestSuite("最优动作引导的无监督学习")

const DATASET_SIZE = 6000
const TRAIN_STEPS = 5000
const BATCH_SIZE = 32
const LOG_INTERVAL = 500

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

// ========== 测试：最优动作引导 ==========
console.log("\n--- 最优动作引导策略 ---")
{
	const net = createNet()
	let epsilon = 0.5
	
	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createGradientBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			const optimal = getLabel(sample.t)
			
			let action: number
			if (Math.random() < epsilon) {
				action = Math.floor(Math.random() * 4)
			} else {
				action = fp.o.indexOf(Math.max(...fp.o))
			}
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const isOptimal = (action === optimal)
			
			// 计算奖励
			let reward: number
			if (!isValid) {
				reward = UNSUPERVISED_CONFIG.rewardInvalid
			} else if (isOptimal) {
				reward = UNSUPERVISED_CONFIG.rewardOptimal
			} else {
				reward = UNSUPERVISED_CONFIG.rewardValid
			}
			
			// 关键：使用引导式梯度累积
			const evaluation: GuidedEvaluation = {
				action,
				isValid,
				isOptimal,
				reward,
				optimalAction: optimal,  // ← 传入最优动作
			}
			accumulateGradientsGuided(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			console.log(`[Step ${(step + 1).toString().padStart(5)}] 合法率: ${result.validRate.toFixed(1)}% 准确率: ${result.accuracy.toFixed(1)}% ε: ${epsilon.toFixed(2)}`)
			
			// 动态调整探索率
			if (result.validRate > 90) {
				epsilon = Math.max(0.1, epsilon * 0.95)
			}
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`\n最终结果: 合法率 ${final.validRate.toFixed(1)}% 准确率: ${final.accuracy.toFixed(1)}%`)
	
	if (final.validRate >= 95) {
		console.log("✅ 达到目标 95%+")
	} else if (final.validRate >= 90) {
		console.log("⚠️ 接近目标，当前 90%+")
	} else {
		console.log("❌ 未达目标，仍需改进")
	}
}

console.log("\n========== 测试完成 ==========")
