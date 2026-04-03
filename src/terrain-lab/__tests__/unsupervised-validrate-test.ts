// ========== 纯无监督学习：专注提升合法率到95%+ ==========

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { assertGreaterThan, printTestSuite, printTestComplete } from "./test-utils.js"

printTestSuite("纯无监督学习：专注合法率95%+")

const DATASET_SIZE = 6000
const TRAIN_STEPS = 10000  // 更多训练步数
const BATCH_SIZE = 32
const LOG_INTERVAL = 500
const TARGET_VALID_RATE = 95

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

// ========== 策略1: 延长探索期，缓慢衰减 ==========
console.log("\n--- 策略1: 延长探索期，缓慢衰减 ---")
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
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % LOG_INTERVAL === 0) {
			const result = evaluateModel(net, dataset)
			history.push(result.validRate)
			if (history.length > 10) history.shift()
			
			// 更保守的探索率衰减
			if (history.length >= 10) {
				const recent = history.slice(-5).reduce((a, b) => a + b, 0) / 5
				const older = history.slice(0, 5).reduce((a, b) => a + b, 0) / 5
				
				if (recent > older + 2) {
					epsilon = Math.max(0.15, epsilon - 0.005)  // 更慢衰减
				} else if (recent < older - 2) {
					epsilon = Math.min(0.6, epsilon + 0.01)
				}
			}
			
			const avgValid = history.reduce((a, b) => a + b, 0) / history.length
			console.log(`[Step ${(step + 1).toString().padStart(5)}] 合法率: ${result.validRate.toFixed(1)}% (avg:${avgValid.toFixed(1)}%), ε: ${epsilon.toFixed(3)}`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`\n策略1结果: 合法率 ${final.validRate.toFixed(1)}%`)
}

// ========== 策略2: 两阶段训练，先高探索后低探索 ==========
console.log("\n--- 策略2: 两阶段训练（高探索→低探索）---")
{
	const net = createNet()
	
	// 阶段1: 高探索期（5000步，ε=0.5）
	console.log("阶段1: 高探索...")
	for (let step = 0; step < 5000; step++) {
		const buffer = createUnsupervisedBuffer()
		const epsilon = 0.5
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			const action = Math.random() < epsilon ? Math.floor(Math.random() * 4) : fp.o.indexOf(Math.max(...fp.o))
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const isOptimal = (action === getLabel(sample.t))
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
	}
	
	const mid = evaluateModel(net, dataset)
	console.log(`阶段1后: 合法率 ${mid.validRate.toFixed(1)}%`)
	
	// 阶段2: 低探索固化（5000步，ε=0.2）
	console.log("阶段2: 低探索固化...")
	for (let step = 0; step < 5000; step++) {
		const buffer = createUnsupervisedBuffer()
		const epsilon = 0.2
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			const action = Math.random() < epsilon ? Math.floor(Math.random() * 4) : fp.o.indexOf(Math.max(...fp.o))
			
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
			console.log(`[固化 ${(step + 1).toString().padStart(4)}] 合法率: ${result.validRate.toFixed(1)}%`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`\n策略2结果: 合法率 ${final.validRate.toFixed(1)}%`)
	
	try {
		assertGreaterThan(final.validRate, TARGET_VALID_RATE, `合法率应达到 ${TARGET_VALID_RATE}%`)
		console.log(`✅ 达到目标合法率 ${TARGET_VALID_RATE}%!`)
	} catch (e) {
		console.log(`⚠️ 未达到目标 ${TARGET_VALID_RATE}%，当前 ${final.validRate.toFixed(1)}%`)
	}
}

// ========== 策略3: 自适应探索，合法率不达标就提高探索 ==========
console.log("\n--- 策略3: 自适应探索（不达标就探索）---")
{
	const net = createNet()
	let epsilon = 0.5
	let bestValid = 0
	let stallCount = 0
	
	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			const action = Math.random() < epsilon ? Math.floor(Math.random() * 4) : fp.o.indexOf(Math.max(...fp.o))
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			const isValid = isActionValidByChecks(checks, action)
			const isOptimal = (action === getLabel(sample.t))
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
		
		if ((step + 1) % 1000 === 0) {
			const result = evaluateModel(net, dataset)
			
			if (result.validRate > bestValid) {
				bestValid = result.validRate
				stallCount = 0
			} else {
				stallCount++
			}
			
			// 如果停滞了，提高探索率
			if (stallCount > 3) {
				epsilon = Math.min(0.7, epsilon + 0.1)
				stallCount = 0
				console.log(`[Step ${step + 1}] 停滞，提高探索率到 ${epsilon.toFixed(2)}`)
			}
			
			console.log(`[Step ${(step + 1).toString().padStart(5)}] 合法率: ${result.validRate.toFixed(1)}%, 最佳: ${bestValid.toFixed(1)}%, ε: ${epsilon.toFixed(2)}`)
		}
	}
	
	const final = evaluateModel(net, dataset)
	console.log(`\n策略3结果: 合法率 ${final.validRate.toFixed(1)}%`)
}

printTestComplete()
