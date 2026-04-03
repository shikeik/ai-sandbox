// ========== 稳定版引导学习测试 ==========
// 改进：增大 batch size，减小学习率，提高稳定性

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateGradientsGuided, type GuidedEvaluation } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import { printTestSuite } from "./test-utils.js"

printTestSuite("稳定版引导学习（大batch+小学习率）")

const dataset = generateTerrainData(6000, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

const net = createNet()

// 增大 batch size，减小学习率
const BATCH_SIZE = 128  // 从 32 增加到 128
const STEPS = 2000
const LOG_INTERVAL = 200

console.log(`\n配置: batch=${BATCH_SIZE}, steps=${STEPS}`)
console.log("--- 开始训练 ---")

let epsilon = 0.5

for (let step = 0; step < STEPS; step++) {
	const buffer = createGradientBuffer()
	let validCount = 0
	let optimalCount = 0
	
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
		
		if (isValid) validCount++
		if (isOptimal) optimalCount++
		
		let reward: number
		if (!isValid) reward = UNSUPERVISED_CONFIG.rewardInvalid
		else if (isOptimal) reward = UNSUPERVISED_CONFIG.rewardOptimal
		else reward = UNSUPERVISED_CONFIG.rewardValid
		
		const evaluation: GuidedEvaluation = {
			action,
			isValid,
			isOptimal,
			reward,
			optimalAction: optimal,
		}
		accumulateGradientsGuided(buffer, net, sample.indices, evaluation, BATCH_SIZE)
	}
	
	updateNetwork(net, buffer, 1)
	
	if ((step + 1) % LOG_INTERVAL === 0) {
		// 评估
		let evalValid = 0
		let evalOptimal = 0
		for (const sample of dataset.slice(0, 500)) {
			const fp = forward(net, sample.indices)
			const pred = fp.o.indexOf(Math.max(...fp.o))
			
			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			if (isActionValidByChecks(checks, pred)) evalValid++
			if (pred === sample.y) evalOptimal++
		}
		const validRate = (evalValid / 500) * 100
		const accuracy = (evalOptimal / 500) * 100
		
		console.log(`[Step ${(step + 1).toString().padStart(4)}] 合法率: ${validRate.toFixed(1)}% 准确率: ${accuracy.toFixed(1)}% ε: ${epsilon.toFixed(2)}`)
		
		// 缓慢衰减探索率
		if (validRate > 85) {
			epsilon = Math.max(0.1, epsilon * 0.95)
		}
	}
}

// 最终评估
console.log("\n--- 最终评估 ---")
let finalValid = 0
let finalOptimal = 0
for (const sample of dataset) {
	const fp = forward(net, sample.indices)
	const pred = fp.o.indexOf(Math.max(...fp.o))
	
	const heroCol = findHeroCol(sample.t)
	const checks = getActionChecks(sample.t, heroCol)
	if (isActionValidByChecks(checks, pred)) finalValid++
	if (pred === sample.y) finalOptimal++
}

const finalValidRate = (finalValid / dataset.length) * 100
const finalAccuracy = (finalOptimal / dataset.length) * 100

console.log(`合法率: ${finalValidRate.toFixed(1)}%`)
console.log(`准确率: ${finalAccuracy.toFixed(1)}%`)

if (finalValidRate >= 95) {
	console.log("✅ 达到目标 95%+")
} else if (finalValidRate >= 90) {
	console.log("⚠️ 接近目标 90%+")
} else {
	console.log("❌ 未达目标")
}
