// ========== 课程控制器 ==========
// 职责：课程学习状态机 + 阶段控制

import type { AppState } from "./state.js"
import type { UIManager } from "./ui-manager.js"
import type { SnapshotManager } from "./snapshot-manager.js"
import { TrainingEngine } from "./training-engine.js"
import { CURRICULUM_STAGES, TRAIN_CONFIG, DATASET_SIZE, UNSUPERVISED_CONFIG } from "./constants.js"
import { generateTerrainData, findHeroCol, getActionChecks, isActionValidByChecks, getLabel } from "./terrain.js"
import { accumulateGradients, calculateReward } from "./unsupervised.js"
import { accumulateSupervisedGrad } from "./supervised.js"
import { createGradientBuffer } from "./gradients.js"
import { forward, updateNetwork } from "./neural-network.js"
import { zeroMat, zeroVec } from "./utils.js"
import { NUM_ELEMENTS, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM, EMBED_DIM } from "./constants.js"

export class CurriculumController {
	private state: AppState
	private uiManager: UIManager
	private snapshotManager: SnapshotManager
	private stageIdx = 0
	private isRunning = false

	constructor(state: AppState, uiManager: UIManager, snapshotManager: SnapshotManager) {
		this.state = state
		this.uiManager = uiManager
		this.snapshotManager = snapshotManager
	}

	getStageIdx(): number {
		return this.stageIdx
	}

	isCurriculumRunning(): boolean {
		return this.isRunning
	}

	/**
	 * 开始当前阶段的课程学习
	 */
	async runCurriculum(
		generateDataCallback: () => void,
		onComplete: () => void
	): Promise<void> {
		if (this.isRunning) return
		if (this.stageIdx >= CURRICULUM_STAGES.length) {
			this.uiManager.updateExam("已完成全部课程阶段！", "ok")
			return
		}

		this.isRunning = true
		this.uiManager.updateCurriculumUI(this.stageIdx, this.isRunning, this.state.learningMode)

		// 应用当前阶段配置
		this.state.terrainConfig = { ...CURRICULUM_STAGES[this.stageIdx].config }

		// 生成数据
		generateDataCallback()

		// 清空旧快照，保留初始状态
		this.snapshotManager.resetSnapshots()
		this.uiManager.updateSnapshotSlider()

		// 根据学习模式选择训练方式
		if (this.state.learningMode === "supervised") {
			await this.runCurriculumSupervised()
		} else {
			await this.runCurriculumUnsupervised()
		}

		this.isRunning = false
		this.uiManager.updateCurriculumUI(this.stageIdx, this.isRunning, this.state.learningMode)
		onComplete()
	}

	/**
	 * 监督学习模式 - 课程训练
	 */
	private async runCurriculumSupervised(): Promise<void> {
		const targetAcc = 90
		const maxTotalSteps = 3000
		const { batchSize } = TRAIN_CONFIG
		const stepsPerBatch = 100
		let achieved = false

		while (this.state.trainSteps < maxTotalSteps) {
			for (let s = 0; s < stepsPerBatch; s++) {
				const buffer = createGradientBuffer()

				for (let b = 0; b < batchSize; b++) {
					const idx = Math.floor(Math.random() * this.state.dataset.length)
					const sample = this.state.dataset[idx]
					accumulateSupervisedGrad(buffer, this.state.net, sample.indices, sample.y, batchSize)
				}

				updateNetwork(this.state.net, buffer, 1)
				this.state.trainSteps++
			}

			// 评估
			const engine = new TrainingEngine(this.state, async () => {})
			const { accuracy: acc, validRate, loss } = engine.evaluateDataset()
			this.uiManager.updateMetrics({ loss, acc, validRate, progress: Math.min(this.state.trainSteps / maxTotalSteps, 1) * 100 })

			// 保存快照
			this.snapshotManager.addSnapshot()
			this.uiManager.updateSnapshotSlider()

			// 检查是否达标
			if (acc >= targetAcc) {
				achieved = true
				break
			}

			await new Promise(r => setTimeout(r, 1))
		}

		if (achieved) {
			this.uiManager.updateExam(
				`${CURRICULUM_STAGES[this.stageIdx].name} 训练完成！准确率 ≥ ${targetAcc}%，可进入下一阶段`,
				"ok"
			)
		} else {
			const accDisplay = document.getElementById("acc-display")!.textContent
			this.uiManager.updateExam(
				`${CURRICULUM_STAGES[this.stageIdx].name} 训练结束，未达到 ${targetAcc}% 准确率（当前：${accDisplay}）。建议重置网络再试一次。`,
				"bad"
			)
		}
	}

	/**
	 * 无监督学习模式 - 课程训练
	 */
	private async runCurriculumUnsupervised(): Promise<void> {
		const targetValidRate = 70
		const targetAcc = 50
		const maxTotalSteps = 3000
		const { batchSize } = TRAIN_CONFIG
		const stepsPerBatch = 100
		let achieved = false

		while (this.state.trainSteps < maxTotalSteps) {
			for (let s = 0; s < stepsPerBatch; s++) {
				const gEmbed = zeroMat(NUM_ELEMENTS, EMBED_DIM)
				const gW1 = zeroMat(HIDDEN_DIM, INPUT_DIM)
				const gb1 = zeroVec(HIDDEN_DIM)
				const gW2 = zeroMat(OUTPUT_DIM, HIDDEN_DIM)
				const gb2 = zeroVec(OUTPUT_DIM)

				for (let b = 0; b < batchSize; b++) {
					const idx = Math.floor(Math.random() * this.state.dataset.length)
					const sample = this.state.dataset[idx]
					const fp = forward(this.state.net, sample.indices)

					let action: number
					if (Math.random() < this.state.epsilon) {
						action = Math.floor(Math.random() * OUTPUT_DIM)
					} else {
						action = fp.o.indexOf(Math.max(...fp.o))
					}

					const heroCol = findHeroCol(sample.t)
					const checks = getActionChecks(sample.t, heroCol)
					const isValid = isActionValidByChecks(checks, action)
					const optimal = getLabel(sample.t)

					const evaluation = calculateReward(action, isValid, action === optimal, UNSUPERVISED_CONFIG)
					accumulateGradients({ dEmbed: gEmbed, dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, this.state.net, sample.indices, evaluation, batchSize)
				}

				updateNetwork(this.state.net, { dEmbed: gEmbed, dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, 1)
				this.state.trainSteps++
			}

			// 评估
			const engine = new TrainingEngine(this.state, async () => {})
			const { accuracy, validRate, loss } = engine.evaluateDataset()
			const newEpsilon = engine.adjustEpsilon(validRate)
			this.uiManager.updateMetrics({ loss, acc: accuracy, validRate, epsilon: newEpsilon, progress: Math.min(this.state.trainSteps / maxTotalSteps, 1) * 100 })

			// 保存快照
			this.snapshotManager.addSnapshot()
			this.uiManager.updateSnapshotSlider()

			// 检查是否达标
			if (validRate >= targetValidRate) {
				achieved = true
				break
			}

			await new Promise(r => setTimeout(r, 1))
		}

		if (achieved) {
			this.uiManager.updateExam(
				`${CURRICULUM_STAGES[this.stageIdx].name} 训练完成！合法率 ≥ ${targetValidRate}%，可进入下一阶段`,
				"ok"
			)
		} else {
			const accDisplay = document.getElementById("acc-display")!.textContent
			this.uiManager.updateExam(
				`${CURRICULUM_STAGES[this.stageIdx].name} 训练结束，未达到 ${targetValidRate}% 合法率（当前：${accDisplay}）。建议重置网络再试一次。`,
				"bad"
			)
		}
	}

	/**
	 * 进入下一阶段
	 */
	nextStage(onStageChange: () => void): void {
		if (this.stageIdx < CURRICULUM_STAGES.length - 1) {
			this.stageIdx++
			this.state.terrainConfig = { ...CURRICULUM_STAGES[this.stageIdx].config }
			onStageChange()
			this.uiManager.updateCurriculumUI(this.stageIdx, this.isRunning, this.state.learningMode)
			this.uiManager.updateExam(`已进入 ${CURRICULUM_STAGES[this.stageIdx].name}，点击「开始课程训练」生成数据并训练`, "wait")
		}
	}

	/**
	 * 重置课程进度
	 */
	reset(): void {
		this.stageIdx = 0
		this.isRunning = false
		this.state.terrainConfig = { ...CURRICULUM_STAGES[0].config }
	}
}
