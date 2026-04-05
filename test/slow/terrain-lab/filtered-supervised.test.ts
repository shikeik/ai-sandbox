import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { createNet, forward, updateNetwork } from "../../../src/terrain-lab/neural-network.js"
import { createGradientBuffer, accumulateGradients, type ActionEvaluation } from "../../../src/terrain-lab/unsupervised.js"
import { createGradientBuffer as createSuperBuffer, accumulateSupervisedGrad } from "../../../src/terrain-lab/supervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG } from "../../../src/terrain-lab/constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../../../src/terrain-lab/terrain.js"

const dataset = generateTerrainData(6000, DEFAULT_TERRAIN_CONFIG)

describe("过滤式监督学习", () => {
	it("应达到较高合法率", () => {
		const net = createNet()
		const BATCH_SIZE = 32
		const STEPS = 5000
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
					accumulateSupervisedGrad(superBuffer, net, sample.indices, optimal, BATCH_SIZE)
					hasSuperUpdate = true
				} else if (!isValid) {
					const evaluation: ActionEvaluation = {
						action,
						isValid: false,
						isOptimal: false,
						reward: UNSUPERVISED_CONFIG.rewardInvalid,
					}
					accumulateGradients(unsuperBuffer, net, sample.indices, evaluation, BATCH_SIZE)
					hasUnsuperUpdate = true
				}
			}

			if (hasSuperUpdate) updateNetwork(net, superBuffer, 1)
			if (hasUnsuperUpdate) updateNetwork(net, unsuperBuffer, 1)

			if ((step + 1) % 500 === 0) {
				let evalValid = 0
				for (const sample of dataset.slice(0, 500)) {
					const fp = forward(net, sample.indices)
					const pred = fp.o.indexOf(Math.max(...fp.o))
					const heroCol = findHeroCol(sample.t)
					const checks = getActionChecks(sample.t, heroCol)
					if (isActionValidByChecks(checks, pred)) evalValid++
				}
				const validRate = (evalValid / 500) * 100
				if (validRate > 80) epsilon = Math.max(0.1, epsilon * 0.95)
			}
		}

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

		assert.ok(finalValidRate > 80, `合法率应 > 80%，实际 ${finalValidRate.toFixed(1)}%`)
		assert.ok(finalAccuracy > 50, `准确率应 > 50%，实际 ${finalAccuracy.toFixed(1)}%`)
	})
})
