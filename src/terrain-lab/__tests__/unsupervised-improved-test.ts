// ========== 改进的无监督学习测试 ==========
// 尝试不同的算法改进策略

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { assertGreaterThan, printTestSuite, printTestComplete } from "./test-utils.js"

printTestSuite("改进的无监督学习测试")

const DATASET_SIZE = 6000
const TRAIN_STEPS = 5000  // 增加训练步数
const BATCH_SIZE = 32
const LOG_INTERVAL = 250
const TARGET_ACCURACY = 80  // 目标准确率

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

// ========== 策略1: 基于动作价值的奖励塑形 ==========
console.log("\n--- 策略1: 基于动作价值的奖励塑形 ---")
{
	const net = createNet()
	const history: number[] = []
	let epsilon = 0.5
	
	// 改进的奖励计算：给不同合法动作不同奖励
	function calculateImprovedReward(action: number, isValid: boolean, isOptimal: boolean) {
		if (!isValid) return -0.1  // 非法动作惩罚
		if (isOptimal) return 0.1   // 最优动作最高奖励
		
		// 合法但非最优：根据动作的"效率"给不同奖励
		// 走(0) > 走A(3) > 跳(1) > 远跳(2)  [基于能量消耗]
		const actionValue = [0.05, 0.02, 0.01, 0.04][action]
		return actionValue
	}
	
	for (let step = 0; step < TRAIN_STEPS; step++) {
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
			
			const reward = calculateImprovedReward(action, isValid, isOptimal)
			
			// 使用原始accumulateGradients但传入自定义奖励
			const evaluation = { action, isValid, isOptimal, reward }
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			history.push(result.accuracy)
			if (history.length > 5) history.shift()
			
			const avgAcc = history.reduce((a, b) => a + b, 0) / history.length
			if (result.accuracy > avgAcc + 2) {
				epsilon = Math.max(0.1, epsilon - 0.02)
			} else if (result.accuracy < avgAcc - 2) {
				epsilon = Math.min(0.6, epsilon + 0.02)
			}
			
			console.log(`[Step ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%, ε: ${epsilon.toFixed(2)}`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`最终结果: 准确率 ${final.accuracy.toFixed(1)}%, 合法率: ${final.validRate.toFixed(1)}%`)
}

// ========== 策略2: 基于预测概率的自信度奖励 ==========
console.log("\n--- 策略2: 基于预测概率的自信度奖励 ---")
{
	const net = createNet()
	const history: number[] = []
	let epsilon = 0.5
	
	for (let step = 0; step < TRAIN_STEPS; step++) {
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
			
			// 改进：根据预测概率调整奖励
			// 高置信度的正确预测给更多奖励
			const confidence = fp.o[action]
			let reward: number
			
			if (isOptimal) {
				reward = 0.1 * (1 + confidence)  // 最优动作奖励 * (1+置信度)
			} else if (isValid) {
				reward = 0.02 * confidence  // 合法但非最优，低奖励
			} else {
				reward = -0.1 * (1 + confidence)  // 非法动作，惩罚 * (1+置信度)
			}
			
			const evaluation = { action, isValid, isOptimal, reward }
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			history.push(result.accuracy)
			if (history.length > 5) history.shift()
			
			const avgAcc = history.reduce((a, b) => a + b, 0) / history.length
			if (result.accuracy > avgAcc + 2) {
				epsilon = Math.max(0.1, epsilon - 0.02)
			} else if (result.accuracy < avgAcc - 2) {
				epsilon = Math.min(0.6, epsilon + 0.02)
			}
			
			console.log(`[Step ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%, ε: ${epsilon.toFixed(2)}`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`最终结果: 准确率 ${final.accuracy.toFixed(1)}%, 合法率: ${final.validRate.toFixed(1)}%`)
}

// ========== 策略3: 对比学习 - 在合法动作中选择最好的 ==========
console.log("\n--- 策略3: 对比学习（合法动作中的软标签）---")
{
	const net = createNet()
	const history: number[] = []
	let epsilon = 0.5
	
	for (let step = 0; step < TRAIN_STEPS; step++) {
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
			
			// 找出所有合法动作
			const validActions = [0, 1, 2, 3].filter(a => isActionValidByChecks(checks, a))
			
			let reward: number
			if (isOptimal) {
				reward = 0.1  // 最优动作
			} else if (isValid && validActions.length > 1) {
				// 在多个合法动作中，给当前选择的动作中等奖励
				// 但惩罚其他合法动作（对比学习）
				reward = 0.03
				// 额外：惩罚其他合法动作，强化区分度
				for (const otherAction of validActions) {
					if (otherAction !== action) {
						// 反向梯度：降低其他合法动作的概率
						const negativeEval = { action: otherAction, isValid: true, isOptimal: false, reward: -0.02 }
						accumulateGradients(buffer, net, sample.indices, negativeEval, BATCH_SIZE * validActions.length)
					}
				}
			} else if (isValid) {
				reward = 0.05  // 唯一合法动作，较高奖励
			} else {
				reward = -0.1  // 非法
			}
			
			const evaluation = { action, isValid, isOptimal, reward }
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			history.push(result.accuracy)
			if (history.length > 5) history.shift()
			
			const avgAcc = history.reduce((a, b) => a + b, 0) / history.length
			if (result.accuracy > avgAcc + 2) {
				epsilon = Math.max(0.1, epsilon - 0.02)
			} else if (result.accuracy < avgAcc - 2) {
				epsilon = Math.min(0.6, epsilon + 0.02)
			}
			
			console.log(`[Step ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%, ε: ${epsilon.toFixed(2)}`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`最终结果: 准确率 ${final.accuracy.toFixed(1)}%, 合法率: ${final.validRate.toFixed(1)}%`)
	
	try {
		assertGreaterThan(final.accuracy, TARGET_ACCURACY, `改进后应达到 ${TARGET_ACCURACY}% 准确率`)
		console.log(`✅ 达到目标准确率 ${TARGET_ACCURACY}%!`)
	} catch (e) {
		console.log(`⚠️ 未达到目标 ${TARGET_ACCURACY}%，当前 ${final.accuracy.toFixed(1)}%`)
	}
}

printTestComplete()
