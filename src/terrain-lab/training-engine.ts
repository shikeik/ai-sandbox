// ========== 训练引擎 ==========
// 职责：训练算法（监督/无监督）+ 探索率调整 + 评估
// 纯逻辑，不碰 DOM

import type { AppState } from "./state.js"
import type { ActionEvaluation } from "./unsupervised.js"
import { TRAIN_CONFIG, EVAL_SAMPLE_SIZE, OUTPUT_DIM, UNSUPERVISED_CONFIG } from "./constants.js"
import { forward, updateNetwork, cloneNet } from "./neural-network.js"
import { accumulateSupervisedGrad } from "./supervised.js"
import { accumulateGradients } from "./unsupervised.js"
import { createGradientBuffer } from "./gradients.js"
import { findHeroCol, getActionChecks, isActionValidByChecks, getLabel } from "./terrain.js"

export interface TrainingResult {
	loss: number
	accuracy: number
	validRate: number
	epsilon?: number
	reward?: number
}

export interface EvaluationResult {
	accuracy: number
	validRate: number
	loss: number
}

export class TrainingEngine {
	private state: AppState
	private onStep: (result: TrainingResult & { progress: number }) => Promise<void>

	constructor(
		state: AppState,
		onStep: (result: TrainingResult & { progress: number }) => Promise<void>
	) {
		this.state = state
		this.onStep = onStep
	}

	// ========== 监督学习 ==========
	async trainSupervised(customSteps?: number): Promise<void> {
		const { batchSize } = TRAIN_CONFIG
		const steps = customSteps ?? TRAIN_CONFIG.steps

		for (let s = 0; s < steps; s++) {
			const buffer = createGradientBuffer()

			for (let b = 0; b < batchSize; b++) {
				const idx = Math.floor(Math.random() * this.state.dataset.length)
				const sample = this.state.dataset[idx]
				accumulateSupervisedGrad(buffer, this.state.net, sample.indices, sample.y, batchSize)
			}

			updateNetwork(this.state.net, buffer, 1)
			this.state.trainSteps++

			if (s % 20 === 0 || s === steps - 1) {
				const { accuracy, validRate, loss } = this.evaluateDataset(EVAL_SAMPLE_SIZE)
				await this.onStep({
					loss,
					accuracy,
					validRate,
					progress: ((s + 1) / steps) * 100
				})
			}
		}
	}

	// ========== 无监督学习 ==========
	async trainUnsupervised(customSteps?: number): Promise<void> {
		const { batchSize } = TRAIN_CONFIG
		const steps = customSteps ?? TRAIN_CONFIG.steps

		for (let s = 0; s < steps; s++) {
			const superBuffer = createGradientBuffer()
			const unsuperBuffer = createGradientBuffer()
			let hasSuperUpdate = false
			let hasUnsuperUpdate = false
			let totalReward = 0

			for (let b = 0; b < batchSize; b++) {
				const idx = Math.floor(Math.random() * this.state.dataset.length)
				const sample = this.state.dataset[idx]
				const fp = forward(this.state.net, sample.indices)
				const predicted = fp.o.indexOf(Math.max(...fp.o))

				// ε-贪心选择动作
				let action: number
				if (Math.random() < this.state.epsilon) {
					action = Math.floor(Math.random() * OUTPUT_DIM)
				} else {
					action = predicted
				}

				const heroCol = findHeroCol(sample.t)
				const checks = getActionChecks(sample.t, heroCol)
				const isValid = isActionValidByChecks(checks, action)
				const optimal = getLabel(sample.t)
				const isOptimal = (action === optimal)

				// 计算奖励
				let reward: number
				if (isValid) {
					reward = isOptimal ? UNSUPERVISED_CONFIG.rewardOptimal : UNSUPERVISED_CONFIG.rewardValid
				} else {
					reward = UNSUPERVISED_CONFIG.rewardInvalid
				}
				totalReward += reward

				// 过滤式更新策略
				if (isOptimal) {
					accumulateSupervisedGrad(superBuffer, this.state.net, sample.indices, optimal, batchSize)
					hasSuperUpdate = true
				} else if (!isValid) {
					const evaluation: ActionEvaluation = {
						action,
						isValid: false,
						isOptimal: false,
						reward: UNSUPERVISED_CONFIG.rewardInvalid,
					}
					accumulateGradients(unsuperBuffer, this.state.net, sample.indices, evaluation, batchSize)
					hasUnsuperUpdate = true
				} else {
					// 选中次优但合法 → 轻微向最优动作引导
					accumulateSupervisedGrad(superBuffer, this.state.net, sample.indices, optimal, batchSize * 3)
					hasSuperUpdate = true
				}
			}

			if (hasSuperUpdate) {
				updateNetwork(this.state.net, superBuffer, 1)
			}
			if (hasUnsuperUpdate) {
				updateNetwork(this.state.net, unsuperBuffer, 1)
			}

			this.state.trainSteps++

			if (s % 20 === 0 || s === steps - 1) {
				const { accuracy, validRate } = this.evaluateDataset(EVAL_SAMPLE_SIZE)
				const newEpsilon = this.adjustEpsilon(validRate)
				await this.onStep({
					accuracy,
					validRate,
					loss: 0,
					epsilon: newEpsilon,
					reward: totalReward / batchSize,
					progress: ((s + 1) / steps) * 100
				})
			}
		}
	}

	// ========== 探索率调整 ==========
	adjustEpsilon(validRate: number): number {
		this.state.unsupervisedHistory.push(validRate)
		if (this.state.unsupervisedHistory.length > UNSUPERVISED_CONFIG.epsilonWindowSize) {
			this.state.unsupervisedHistory.shift()
		}

		if (this.state.unsupervisedHistory.length < UNSUPERVISED_CONFIG.epsilonWindowSize) {
			return this.state.epsilon
		}

		const currentAvg = this.state.unsupervisedHistory.slice(0, -1).reduce((a, b) => a + b, 0) / (UNSUPERVISED_CONFIG.epsilonWindowSize - 1)

		if (validRate < 95) {
			if (validRate > currentAvg + UNSUPERVISED_CONFIG.epsilonImproveThreshold) {
				this.state.epsilon = Math.max(UNSUPERVISED_CONFIG.epsilonMin, this.state.epsilon - UNSUPERVISED_CONFIG.epsilonDecayStep)
			} else if (validRate < currentAvg - UNSUPERVISED_CONFIG.epsilonImproveThreshold) {
				this.state.epsilon = Math.min(UNSUPERVISED_CONFIG.epsilonMax, this.state.epsilon + UNSUPERVISED_CONFIG.epsilonGrowStep)
			} else {
				this.state.epsilon = Math.max(UNSUPERVISED_CONFIG.epsilonMin, this.state.epsilon - UNSUPERVISED_CONFIG.epsilonDecayIdle)
			}
		} else {
			this.state.epsilon = Math.max(UNSUPERVISED_CONFIG.epsilonMin, this.state.epsilon - UNSUPERVISED_CONFIG.epsilonDecayStep * 2)
		}

		return this.state.epsilon
	}

	// ========== 数据集评估 ==========
	evaluateDataset(limit = 0): EvaluationResult {
		const dataset = this.state.dataset
		const net = this.state.net
		const samples = limit > 0 ? dataset.slice(0, limit) : dataset
		let correct = 0
		let validCount = 0
		let lossSum = 0

		for (const sample of samples) {
			const fp = forward(net, sample.indices)
			const predictedAction = fp.o.indexOf(Math.max(...fp.o))
			if (predictedAction === sample.y) correct++

			const heroCol = findHeroCol(sample.t)
			const checks = getActionChecks(sample.t, heroCol)
			if (isActionValidByChecks(checks, predictedAction)) validCount++

			lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
		}

		const total = samples.length
		return {
			accuracy: (correct / total) * 100,
			validRate: (validCount / total) * 100,
			loss: lossSum / total
		}
	}
}
