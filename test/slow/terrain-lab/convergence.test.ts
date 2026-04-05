// ========== 收敛性测试（与 terrain-lab 实际参数完全一致）==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { createNet, forward, updateNetwork } from "@/terrain-lab/neural-network.js"
import { createGradientBuffer, accumulateSupervisedGrad } from "@/terrain-lab/supervised.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "@/terrain-lab/unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "@/terrain-lab/constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "@/terrain-lab/terrain.js"
import type { DatasetItem, NetParams } from "@/terrain-lab/types.js"

const DATASET_SIZE = 6000
const TRAIN_STEPS = 3000
const BATCH_SIZE = 32
const LOG_INTERVAL = 100

function evaluateModel(currentNet: NetParams, data: DatasetItem[]) {
	let correct = 0
	let validCount = 0
	let lossSum = 0

	for (const sample of data) {
		const fp = forward(currentNet, sample.indices)
		const predictedAction = fp.o.indexOf(Math.max(...fp.o))

		if (predictedAction === sample.y) correct++

		const heroCol = findHeroCol(sample.t)
		const checks = getActionChecks(sample.t, heroCol)
		if (isActionValidByChecks(checks, predictedAction)) validCount++

		lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
	}

	return {
		accuracy: (correct / data.length) * 100,
		validRate: (validCount / data.length) * 100,
		avgLoss: lossSum / data.length,
	}
}

describe("收敛性测试", () => {
	const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
	assert.ok(dataset.length > 0, "数据集生成失败")

	it("监督学习应收敛到 70% 以上准确率", () => {
		const net = createNet()

		for (let step = 0; step < TRAIN_STEPS; step++) {
			const buffer = createGradientBuffer()

			for (let b = 0; b < BATCH_SIZE; b++) {
				const sample = dataset[Math.floor(Math.random() * dataset.length)]
				accumulateSupervisedGrad(buffer, net, sample.indices, sample.y, BATCH_SIZE)
			}

			updateNetwork(net, buffer, 1)
		}

		const final = evaluateModel(net, dataset)
		assert.ok(final.accuracy > 70, `监督学习准确率应 > 70%，实际 ${final.accuracy.toFixed(1)}%`)
	})

	it("无监督学习应收敛到较高合法率", () => {
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
			}
		}

		const final = evaluateModel(net, dataset)
		assert.ok(final.validRate > 60, `无监督学习合法率应 > 60%，实际 ${final.validRate.toFixed(1)}%`)
	})
})
