// ========== 权重裁剪对合法率的影响测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { createNet, forward, backward } from "../../../src/terrain-lab/neural-network.js"
import { createGradientBuffer as createUnsupervisedBuffer, calculateReward } from "../../../src/terrain-lab/unsupervised.js"
import { UNSUPERVISED_CONFIG, DEFAULT_TERRAIN_CONFIG, LR, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM, NUM_ELEMENTS, EMBED_DIM } from "../../../src/terrain-lab/constants.js"
import { generateTerrainData, getLabel, findHeroCol, getActionChecks, isActionValidByChecks } from "../../../src/terrain-lab/terrain.js"
import type { DatasetItem, NetParams } from "../../../src/terrain-lab/types.js"

const DATASET_SIZE = 6000
const TRAIN_STEPS = 5000
const BATCH_SIZE = 32

function evaluateModel(currentNet: NetParams, data: DatasetItem[]) {
	let validCount = 0
	for (const sample of data) {
		const fp = forward(currentNet, sample.indices)
		const predictedAction = fp.o.indexOf(Math.max(...fp.o))
		const heroCol = findHeroCol(sample.t)
		const checks = getActionChecks(sample.t, heroCol)
		if (isActionValidByChecks(checks, predictedAction)) validCount++
	}
	return { validRate: (validCount / data.length) * 100 }
}

function updateNetworkWithClip(net: NetParams, grads: ReturnType<typeof createUnsupervisedBuffer>, batchSize: number, clipValue: number | null) {
	for (let e = 0; e < NUM_ELEMENTS; e++) {
		for (let d = 0; d < EMBED_DIM; d++) {
			net.embed[e][d] -= LR * grads.dEmbed[e][d] / batchSize
			if (clipValue !== null) {
				net.embed[e][d] = Math.max(-clipValue, Math.min(clipValue, net.embed[e][d]))
			}
		}
	}
	for (let i = 0; i < HIDDEN_DIM; i++) {
		for (let j = 0; j < INPUT_DIM; j++) {
			net.W1[i][j] -= LR * grads.dW1[i][j] / batchSize
			if (clipValue !== null) {
				net.W1[i][j] = Math.max(-clipValue, Math.min(clipValue, net.W1[i][j]))
			}
		}
		net.b1[i] -= LR * grads.db1[i] / batchSize
		if (clipValue !== null) {
			net.b1[i] = Math.max(-clipValue, Math.min(clipValue, net.b1[i]))
		}
	}
	for (let i = 0; i < OUTPUT_DIM; i++) {
		for (let j = 0; j < HIDDEN_DIM; j++) {
			net.W2[i][j] -= LR * grads.dW2[i][j] / batchSize
			if (clipValue !== null) {
				net.W2[i][j] = Math.max(-clipValue, Math.min(clipValue, net.W2[i][j]))
			}
		}
		net.b2[i] -= LR * grads.db2[i] / batchSize
		if (clipValue !== null) {
			net.b2[i] = Math.max(-clipValue, Math.min(clipValue, net.b2[i]))
		}
	}
}

function accumulateGradSimple(net: NetParams, buffer: ReturnType<typeof createUnsupervisedBuffer>, indices: number[], targetAction: number, reward: number, batchSize: number) {
	const gradScale = Math.abs(reward) * 0.3 / batchSize
	const fp = forward(net, indices)

	if (reward > 0) {
		const grad = backward(net, fp, targetAction)
		for (let e = 0; e < NUM_ELEMENTS; e++) for (let d = 0; d < EMBED_DIM; d++) buffer.dEmbed[e][d] += grad.dEmbed[e][d] * gradScale
		for (let i = 0; i < HIDDEN_DIM; i++) {
			for (let j = 0; j < INPUT_DIM; j++) buffer.dW1[i][j] += grad.dW1[i][j] * gradScale
			buffer.db1[i] += grad.db1[i] * gradScale
		}
		for (let i = 0; i < OUTPUT_DIM; i++) {
			for (let j = 0; j < HIDDEN_DIM; j++) buffer.dW2[i][j] += grad.dW2[i][j] * gradScale
			buffer.db2[i] += grad.db2[i] * gradScale
		}
	} else {
		const otherActionCount = OUTPUT_DIM - 1
		const redistributeScale = gradScale / otherActionCount

		for (let otherAction = 0; otherAction < OUTPUT_DIM; otherAction++) {
			const grad = backward(net, fp, otherAction)
			if (otherAction === targetAction) {
				for (let e = 0; e < NUM_ELEMENTS; e++) for (let d = 0; d < EMBED_DIM; d++) buffer.dEmbed[e][d] -= grad.dEmbed[e][d] * gradScale
				for (let i = 0; i < HIDDEN_DIM; i++) {
					for (let j = 0; j < INPUT_DIM; j++) buffer.dW1[i][j] -= grad.dW1[i][j] * gradScale
					buffer.db1[i] -= grad.db1[i] * gradScale
				}
				for (let i = 0; i < OUTPUT_DIM; i++) {
					for (let j = 0; j < HIDDEN_DIM; j++) buffer.dW2[i][j] -= grad.dW2[i][j] * gradScale
					buffer.db2[i] -= grad.db2[i] * gradScale
				}
			} else {
				for (let e = 0; e < NUM_ELEMENTS; e++) for (let d = 0; d < EMBED_DIM; d++) buffer.dEmbed[e][d] += grad.dEmbed[e][d] * redistributeScale
				for (let i = 0; i < HIDDEN_DIM; i++) {
					for (let j = 0; j < INPUT_DIM; j++) buffer.dW1[i][j] += grad.dW1[i][j] * redistributeScale
					buffer.db1[i] += grad.db1[i] * redistributeScale
				}
				for (let i = 0; i < OUTPUT_DIM; i++) {
					for (let j = 0; j < HIDDEN_DIM; j++) buffer.dW2[i][j] += grad.dW2[i][j] * redistributeScale
					buffer.db2[i] += grad.db2[i] * redistributeScale
				}
			}
		}
	}
}

describe("权重裁剪影响测试", () => {
	const dataset = generateTerrainData(DATASET_SIZE, DEFAULT_TERRAIN_CONFIG)
	const clipValues: (number | null)[] = [null, 10, 5, 2, 1]

	for (const clip of clipValues) {
		const label = clip === null ? "无裁剪" : `裁剪±${clip}`
		it(`${label} 时无监督学习应达到基本合法率`, () => {
			const net = createNet()

			for (let step = 0; step < TRAIN_STEPS; step++) {
				const buffer = createUnsupervisedBuffer()

				for (let b = 0; b < BATCH_SIZE; b++) {
					const sample = dataset[Math.floor(Math.random() * dataset.length)]
					const fp = forward(net, sample.indices)
					const action = Math.random() < 0.5 ? Math.floor(Math.random() * 4) : fp.o.indexOf(Math.max(...fp.o))

					const heroCol = findHeroCol(sample.t)
					const checks = getActionChecks(sample.t, heroCol)
					const isValid = isActionValidByChecks(checks, action)
					const isOptimal = (action === getLabel(sample.t))

					const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
					accumulateGradSimple(net, buffer, sample.indices, action, evaluation.reward, BATCH_SIZE)
				}

				updateNetworkWithClip(net, buffer, 1, clip)
			}

			const result = evaluateModel(net, dataset)
			assert.ok(result.validRate > 40, `${label} 合法率应 > 40%，实际 ${result.validRate.toFixed(1)}%`)
		})
	}
})
