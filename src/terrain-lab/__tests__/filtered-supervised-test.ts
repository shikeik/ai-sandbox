// ========== 过滤式监督学习测试 ==========
// 策略：只有 AI 选中最优动作时，才用监督学习更新
// 这样 AI 只从"最优示范"中学习，避免次优动作的噪声

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateGradients, type ActionEvaluation } from "../unsupervised.js"
import { createGradientBuffer as createSuperBuffer, accumulateSupervisedGrad } from "../supervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import { printTestSuite } from "./test-utils.js"

printTestSuite("过滤式监督学习")

const dataset = generateTerrainData(6000, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

const net = createNet()

const BATCH_SIZE = 32
const STEPS = 5000
const LOG_INTERVAL = 500

console.log(`\n配置: batch=${BATCH_SIZE}, steps=${STEPS}`)
console.log("策略: 只有选中最优动作时才更新（监督学习），否则跳过\n")

let epsilon = 0.5

for (let step = 0; step < STEPS; step++) {
	const superBuffer = createSuperBuffer()
	const unsuperBuffer = createGradientBuffer()
	let hasSuperUpdate = false
	let hasUnsuperUpdate = false
	
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
		
		if (isOptimal) {
			// 选中最优动作 → 监督学习更新
			accumulateSupervisedGrad(superBuffer, net, sample.indices, optimal, BATCH_SIZE)
			hasSuperUpdate = true
		} else if (!isValid) {
			// 选中不合法动作 → 无监督惩罚
			const evaluation: ActionEvaluation = {
				action,
				isValid: false,
				isOptimal: false,
				reward: UNSUPERVISED_CONFIG.rewardInvalid,
			}
			accumulateGradients(unsuperBuffer, net, sample.indices, evaluation, BATCH_SIZE)
			hasUnsuperUpdate = true
		}
		// 选中次优但合法 → 跳过（不产生更新）
	}
	
	// 应用更新
	if (hasSuperUpdate) {
		updateNetwork(net, superBuffer, 1)
	}
	if (hasUnsuperUpdate) {
		updateNetwork(net, unsuperBuffer, 1)
	}
	
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
		if (validRate > 80) {
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
