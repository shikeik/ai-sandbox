// ========== 混合策略v2：更多预热步数 ==========

import { createNet, forward, updateNetwork } from "../neural-network.js"
import { createGradientBuffer, accumulateSupervisedGrad } from "../supervised.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../terrain.js"
import type { DatasetItem } from "../types.js"
import { printTestSuite, printTestComplete } from "./test-utils.js"

printTestSuite("混合学习v2（更多预热）")

const DATASET_SIZE = 6000
const PRETRAIN_STEPS = 2000   // 增加预热步数
const FINETUNE_STEPS = 1000
const BATCH_SIZE = 32
const LOG_INTERVAL = 200

console.log("\n生成数据集...")
const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
console.log(`数据集: ${dataset.length} 条`)

function evaluateModel(currentNet: ReturnType<typeof createNet>, data: DatasetItem[]) {
	let correct = 0, validCount = 0
	for (const sample of data) {
		const fp = forward(currentNet, sample.indices)
		const predictedAction = fp.o.indexOf(Math.max(...fp.o))
		if (predictedAction === sample.y) correct++
		const heroCol = findHeroCol(sample.t)
		const checks = getActionChecks(sample.t, heroCol)
		if (isActionValidByChecks(checks, predictedAction)) validCount++
	}
	return { accuracy: (correct / data.length) * 100, validRate: (validCount / data.length) * 100 }
}

// 阶段1: 监督预热（2000步）
console.log("\n--- 阶段1: 监督预热（2000步）---")
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
		console.log(`[预热 ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%`)
	}
}

const afterPretrain = evaluateModel(net, dataset)
console.log(`预热后: 准确率 ${afterPretrain.accuracy.toFixed(1)}%`)

// 阶段2: 无监督微调
console.log("\n--- 阶段2: 无监督微调（1000步）---")
const history = []
let epsilon = 0.3

for (let step = 0; step < FINETUNE_STEPS; step++) {
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
	
	if ((step + 1) % LOG_INTERVAL === 0) {
		const result = evaluateModel(net, dataset)
		history.push(result.accuracy)
		if (history.length > 5) history.shift()
		console.log(`[微调 ${(step + 1).toString().padStart(4)}] 准确率: ${result.accuracy.toFixed(1)}%, 合法率: ${result.validRate.toFixed(1)}%`)
	}
}

const final = evaluateModel(net, dataset)
console.log(`\n最终结果: 准确率 ${final.accuracy.toFixed(1)}%`)
console.log(`是否达到80%: ${final.accuracy >= 80 ? '✅ 是' : '❌ 否'}`)

printTestComplete()
