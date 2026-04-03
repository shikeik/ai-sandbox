// ========== 追踪 Embedding 层更新测试 ==========

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateGradientsGuided, type GuidedEvaluation } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import { printTestSuite } from "./test-utils.js"

printTestSuite("追踪 Embedding 层更新")

const dataset = generateTerrainData(1000, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

const net = createNet()

// 记录初始 embedding
const initialEmbed = net.embed.map(row => [...row])

console.log("\n--- 训练 100 步，观察 embedding 变化 ---")

for (let step = 0; step < 100; step++) {
	const buffer = createGradientBuffer()
	
	for (let b = 0; b < 32; b++) {
		const sample = dataset[Math.floor(Math.random() * dataset.length)]
		const fp = forward(net, sample.indices)
		const optimal = getLabel(sample.t)
		
		// ε-贪心
		const epsilon = 0.3
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
		accumulateGradientsGuided(buffer, net, sample.indices, evaluation, 32)
	}
	
	updateNetwork(net, buffer, 1)
}

// 计算 embedding 变化
let totalChange = 0
let maxChange = 0
let changeCount = 0

for (let e = 0; e < net.embed.length; e++) {
	for (let d = 0; d < net.embed[e].length; d++) {
		const change = Math.abs(net.embed[e][d] - initialEmbed[e][d])
		totalChange += change
		maxChange = Math.max(maxChange, change)
		if (change > 0.0001) changeCount++
	}
}

const avgChange = totalChange / (net.embed.length * net.embed[0].length)

console.log("\nEmbedding 变化统计:")
console.log(`  平均变化: ${avgChange.toFixed(6)}`)
console.log(`  最大变化: ${maxChange.toFixed(6)}`)
console.log(`  变化元素: ${changeCount}/${net.embed.length * net.embed[0].length}`)

if (avgChange < 0.001) {
	console.log("❌ Embedding 几乎没动！")
} else if (avgChange < 0.01) {
	console.log("⚠️ Embedding 变化较小")
} else {
	console.log("✅ Embedding 有明显变化")
}

// 对比：监督学习 100 步的变化
console.log("\n--- 对比：监督学习 100 步 ---")
const net2 = createNet()
const initialEmbed2 = net2.embed.map(row => [...row])

import { createGradientBuffer as createSuperBuffer, accumulateSupervisedGrad } from "../supervised.js"

for (let step = 0; step < 100; step++) {
	const buffer = createSuperBuffer()
	
	for (let b = 0; b < 32; b++) {
		const sample = dataset[Math.floor(Math.random() * dataset.length)]
		accumulateSupervisedGrad(buffer, net2, sample.indices, sample.y, 32)
	}
	
	updateNetwork(net2, buffer, 1)
}

let totalChange2 = 0
let maxChange2 = 0
let changeCount2 = 0

for (let e = 0; e < net2.embed.length; e++) {
	for (let d = 0; d < net2.embed[e].length; d++) {
		const change = Math.abs(net2.embed[e][d] - initialEmbed2[e][d])
		totalChange2 += change
		maxChange2 = Math.max(maxChange2, change)
		if (change > 0.0001) changeCount2++
	}
}

const avgChange2 = totalChange2 / (net2.embed.length * net2.embed[0].length)

console.log("\n监督学习 Embedding 变化:")
console.log(`  平均变化: ${avgChange2.toFixed(6)}`)
console.log(`  最大变化: ${maxChange2.toFixed(6)}`)
console.log(`  变化元素: ${changeCount2}/${net2.embed.length * net2.embed[0].length}`)

if (avgChange2 < 0.001) {
	console.log("❌ Embedding 几乎没动！")
} else if (avgChange2 < 0.01) {
	console.log("⚠️ Embedding 变化较小")
} else {
	console.log("✅ Embedding 有明显变化")
}

console.log(`\n对比: 无监督/监督 变化比例 = ${(avgChange / avgChange2).toFixed(2)}x`)
