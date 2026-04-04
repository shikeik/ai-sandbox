import type { ForwardResult, ActionType } from "./types.js"
import type { AppState } from "./state.js"
import {
	NUM_COLS, NUM_LAYERS, NUM_ELEMENTS, HIDDEN_DIM, OUTPUT_DIM, EMBED_DIM,
	INPUT_DIM, ACTIONS, ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN,
	CURRICULUM_STAGES, ELEMENTS,
	UNSUPERVISED_CONFIG, TRAIN_CONFIG, DATASET_SIZE
} from "./constants.js"
import { forward, updateNetwork, cloneNet } from "./neural-network.js"
import { createGradientBuffer, accumulateGradients, calculateReward } from "./unsupervised.js"
import { createGradientBuffer as createSuperBuffer, accumulateSupervisedGrad } from "./supervised.js"
import {
	terrainToIndices, findHeroCol, getActionChecks, getLabel, getActionName,
	isActionValidByChecks, generateTerrainData, generateRandomTerrain
} from "./terrain.js"
import {
	getEditorCellAt,
	drawMLP as rendererDrawMLP, drawEmbedding as rendererDrawEmbedding,
	drawObsessionCurve as rendererDrawObsessionCurve,
	stepAnimation as rendererStepAnimation,
	drawEditorWithState
} from "./renderer.js"
import { UIManager } from "./ui-manager.js"
import { TrainingEngine } from "./training-engine.js"
import { zeroMat, zeroVec } from "./utils.js"

// 课程学习内部使用的评估函数（将在批次6中进一步重构）
function evaluateDatasetForCurriculum() {
	const engine = new TrainingEngine(state, async () => {})
	return engine.evaluateDataset()
}
import { calculateAnimationPath } from "./animation.js"
import { createInitialState, resetState, setTerrainCell, stopAnimation } from "./state.js"

import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"

// ========== 全局状态 ==========
const state: AppState = createInitialState()
const uiManager = new UIManager(state)

// DOM 元素
let editorCanvas: HTMLCanvasElement
let mlpCanvas: HTMLCanvasElement
let embeddingCanvas: HTMLCanvasElement
let obsessionCanvas: HTMLCanvasElement

// 注意：UI 元素定义现在使用从 constants.ts 导入的 ELEMENTS

// ========== 训练相关 ==========

async function trainBatch() {
	console.log("MAIN", "开始训练批次")
	const btn = document.getElementById("btn-train") as HTMLButtonElement
	btn.disabled = true

	// 若快照为空，先保存初始状态
	if (state.snapshots.length === 0) {
		state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
		recordSnapshotStats(0)
		state.selectedSnapshotIndex = 0
	}

	const engine = new TrainingEngine(state, async (result) => {
		uiManager.updateMetrics({
			loss: result.loss,
			acc: result.accuracy,
			validRate: result.validRate,
			epsilon: result.epsilon,
			reward: result.reward,
			progress: result.progress
		})
		// 保存快照
		state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
		recordSnapshotStats(state.snapshots.length - 1)
		await new Promise(r => setTimeout(r, 1))
	})

	if (state.learningMode === "supervised") {
		await engine.trainSupervised()
	} else {
		await engine.trainUnsupervised()
	}

	console.log("MAIN", "训练完成，更新UI")
	uiManager.updateSnapshotSlider()
	evaluateAll()
	predict()
	drawObsessionCurve()
	btn.disabled = false
	console.log("MAIN", "训练批次结束")
}

function recordSnapshotStats(snapshotIndex: number) {
	if (snapshotIndex < 0 || snapshotIndex >= state.snapshots.length) return
	const snap = state.snapshots[snapshotIndex]

	// 执念曲线概率
	if (state.observedSample) {
		const fp = forward(snap.net, state.observedSample.indices)
		snap.observedProbs = fp.o.slice()
	}

	// 准确率与损失
	if (state.dataset.length > 0) {
		let correct = 0
		let lossSum = 0
		for (const sample of state.dataset) {
			const fp = forward(snap.net, sample.indices)
			if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) correct++
			lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
		}
		snap.acc = (correct / state.dataset.length) * 100
		snap.loss = lossSum / state.dataset.length
	}
}

function applySnapshot(index: number) {
	console.log("MAIN", `应用快照 #${index}`)
	if (index < 0 || index >= state.snapshots.length) return
	state.selectedSnapshotIndex = index
	state.net = cloneNet(state.snapshots[index].net)
	const snap = state.snapshots[index]
	uiManager.applySnapshotLabel(snap.step, snap.acc, snap.loss)
	predict()
	drawObsessionCurve()
}

// 统一评估函数（4种训练模式共用）
// limit: 限制评估样本数（0=全部）
// 更新最终评估UI
function evaluateAll() {
	const engine = new TrainingEngine(state, async () => {})
	const { accuracy, validRate, loss } = engine.evaluateDataset()
	uiManager.updateFinalMetrics(state.trainSteps, accuracy, validRate, loss)
}

// ========== 数据生成 ==========

function generateData() {
	state.dataset = generateTerrainData(DATASET_SIZE, state.terrainConfig)  // 修复：使用常量
	uiManager.updateMetrics({})
	uiManager.updateDataCount(state.dataset.length)
	uiManager.setTrainButtonDisabled(state.dataset.length === 0)
	uiManager.updateExam(`已生成 ${state.dataset.length} 条合法训练数据`, "wait")
	// 默认随机选一个观察样本
	if (state.dataset.length > 0 && !state.observedSample) {
		setObservedRandom()
	}
}

// ========== 观察样本设置 ==========

function setObservedFromTerrain() {
	const indices = terrainToIndices(state.terrain)
	const label = getLabel(state.terrain)
	if (label === -1) {
		uiManager.updateObsessionStatus("当前地形为死局，无法设为观察样本", "bad")
		return
	}
	state.observedSample = { t: state.terrain.map(row => row.slice()), indices, y: label }
	uiManager.updateObsessionStatus(`观察样本：当前地形 | 规则答案：${ACTIONS[label]}`, "ok")
	// 若有快照，重新计算所有快照对该样本的概率
	for (let i = 0; i < state.snapshots.length; i++) {
		recordSnapshotStats(i)
	}
	drawObsessionCurve()
}

function setObservedRandom() {
	if (state.dataset.length === 0) {
		uiManager.updateObsessionStatus("数据集为空，无法抽取样本", "bad")
		return
	}
	const sample = state.dataset[Math.floor(Math.random() * state.dataset.length)]
	state.observedSample = sample
	uiManager.updateObsessionStatus(`观察样本：数据集第 ${state.dataset.indexOf(sample) + 1} 条 | 规则答案：${ACTIONS[sample.y]}`, "ok")
	for (let i = 0; i < state.snapshots.length; i++) {
		recordSnapshotStats(i)
	}
	drawObsessionCurve()
}

// ========== 预测与验证 ==========

function predict() {
	const indices = terrainToIndices(state.terrain)
	const fp = forward(state.net, indices)
	state.lastForwardResult = fp
	const pred = fp.o.indexOf(Math.max(...fp.o))
	const heroCol = findHeroCol(state.terrain)
	const checks = getActionChecks(state.terrain, heroCol)
	const correct = getLabel(state.terrain)
	
	// 调试：输出预测详情（使用 getActionName 避免硬编码）
	console.log("PREDICT", "AI预测:", pred, getActionName(pred), "规则答案:", correct, getActionName(correct))
	console.log("PREDICT", "输出概率:", fp.o.map((v, i) => `${getActionName(i)}:${v.toFixed(3)}`).join(", "))
	console.log("PREDICT", "各动作合法性:", `${getActionName(0)}:${checks.canWalk.ok} ${getActionName(1)}:${checks.canJump.ok} ${getActionName(2)}:${checks.canLongJump.ok} ${getActionName(3)}:${checks.canWalkAttack.ok}`)

	const conf = (fp.o[pred] * 100).toFixed(1)

	if (correct === -1) {
		uiManager.updateTerrainStatus(
			"bad",
			`AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)<br>规则答案: <b style="color:#f9ab00">此地形无解（死局）</b>`
		)
		drawMLP(fp)
		drawEmbedding()
		uiManager.updateProbs(fp.o)
		stopAnimation(state)
		return
	}

	// 统一使用与合法性检查同一数据源的判定函数
	const isValid = isActionValidByChecks(checks, pred)
	const lines: string[] = []
	lines.push(`AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)`)
	lines.push(`规则答案: <b>${ACTIONS[correct]}</b>`)

	if (isValid) {
		if (pred === correct) {
			lines.push("<span style='color:#34a853'>✅ 最优</span>")
			uiManager.updateTerrainStatus("ok", lines.join("<br>"))
		} else {
			lines.push("<span style='color:#f9ab00'>✅ 合法（但非最优）</span>")
			uiManager.updateTerrainStatus("ok", lines.join("<br>"))
		}
	} else {
		lines.push("<span style='color:#ea4335'>❌ 非法</span>")
		uiManager.updateTerrainStatus("bad", lines.join("<br>"))
	}

	drawMLP(fp)
	drawEmbedding()
	uiManager.updateProbs(fp.o)
	playAnimation(ACTIONS[pred])
}

function validateTerrain() {
	const heroCol = findHeroCol(state.terrain)
	const checks = getActionChecks(state.terrain, heroCol)
	const walk = checks.canWalk
	const jump = checks.canJump
	const longJump = checks.canLongJump
	const wa = checks.canWalkAttack

	// 统计可行动作数
	const validActions: string[] = []
	if (walk.ok) validActions.push("走")
	if (jump.ok) validActions.push("跳")
	if (longJump.ok) validActions.push("远跳")
	if (wa.ok) validActions.push("走A")

	// 构建详细报告
	const lines: string[] = []
	lines.push(`<b>狐狸位置：x${heroCol}</b>`)
	lines.push("")

	if (validActions.length > 0) {
		lines.push(`✅ 可行动作：${validActions.join("、")}`)
	} else {
		lines.push("❌ 无可用动作（死局）")
	}

	// 显示各动作详情
	const actionDetails: string[] = []

	// 走
	if (walk.ok) {
		actionDetails.push(`✅ 走 → x${heroCol + 1}`)
	} else {
		actionDetails.push(`❌ 走：${walk.reasons[0] || "无法前行"}`)
	}

	// 跳
	if (jump.ok) {
		actionDetails.push(`✅ 跳 → x${heroCol + 2}`)
	} else {
		const jumpTarget = heroCol + 2
		if (jumpTarget >= NUM_COLS) {
			actionDetails.push("❌ 跳：超出地图边界")
		} else {
			actionDetails.push(`❌ 跳：${jump.reasons[0] || "无法跳跃"}`)
		}
	}

	// 远跳
	if (longJump.ok) {
		actionDetails.push(`✅ 远跳 → x${heroCol + 3}`)
	} else {
		const longJumpTarget = heroCol + 3
		if (longJumpTarget >= NUM_COLS) {
			actionDetails.push("❌ 远跳：超出地图边界")
		} else {
			actionDetails.push(`❌ 远跳：${longJump.reasons[0] || "无法远跳"}`)
		}
	}

	// 走A
	if (wa.ok) {
		const hasSlime = state.terrain[1][heroCol + 1] === ELEM_SLIME
		actionDetails.push(`✅ 走A → x${heroCol + 1}${hasSlime ? "（击杀史莱姆）" : ""}`)
	} else {
		const walkATarget = heroCol + 1
		if (walkATarget >= NUM_COLS) {
			actionDetails.push("❌ 走A：超出地图边界")
		} else {
			actionDetails.push(`❌ 走A：${wa.reasons[0] || "无法攻击"}`)
		}
	}

	lines.push("")
	lines.push(actionDetails.join("<br>"))

	uiManager.updateTerrainStatus(validActions.length > 0 ? "ok" : "bad", lines.join("<br>"))
}

// ========== UI 辅助 ==========

// ========== 渲染器 ==========

function renderBrushesWithCallback(): void {
	uiManager.renderBrushes(state.selectedBrush, (id) => {
		state.selectedBrush = id
		renderBrushesWithCallback()
		uiManager.updateTerrainStatus("wait", "已选择 " + ELEMENTS[id].name + "，点击上方格子绘制")
	})
}

function findCurrentStageIndex(): number {
	const cfg = state.terrainConfig
	for (let i = 0; i < CURRICULUM_STAGES.length; i++) {
		const s = CURRICULUM_STAGES[i].config
		if (
			cfg.groundOnly === s.groundOnly &&
			cfg.slime === s.slime &&
			cfg.demon === s.demon &&
			cfg.coin === s.coin
		) {
			return i
		}
	}
	return -1
}

function renderTerrainConfigWithCallback(): void {
	const currentStageIdx = findCurrentStageIndex()
	uiManager.renderTerrainConfig(
		currentStageIdx,
		(idx) => {
			state.terrainConfig = { ...CURRICULUM_STAGES[idx].config }
			renderTerrainConfigWithCallback()
			renderBrushesWithCallback()
			uiManager.updateTerrainStatus("wait", `已切换到「${CURRICULUM_STAGES[idx].name}」，随机地形和生成数据将使用该配置`)
		},
		onConfigChange
	)
}

function onConfigChange() {
	const swGroundOnly = document.getElementById("sw-ground-only") as HTMLInputElement
	const swSlime = document.getElementById("sw-slime") as HTMLInputElement
	const swDemon = document.getElementById("sw-demon") as HTMLInputElement
	const swCoin = document.getElementById("sw-coin") as HTMLInputElement

	state.terrainConfig = {
		groundOnly: swGroundOnly.checked,
		slime: swSlime.checked,
		demon: swDemon.checked,
		coin: swCoin.checked,
	}
	renderTerrainConfigWithCallback()
	renderBrushesWithCallback()
	uiManager.updateTerrainStatus("wait", "地形配置已更新")
}

function randomTerrain() {
	state.terrain = generateRandomTerrain(state.terrainConfig)
	stopAnimation(state)
	drawEditor()
	uiManager.updateTerrainStatus("wait", "已随机生成新地形，点击「预测当前地形」查看 AI 判断")
	drawMLP(null)
	drawEmbedding()
	uiManager.resetProbs()
}

function resetNet() {
	resetState(state)
	// 重置所有数据显示
	uiManager.resetNetworkUI()
	uiManager.updateExam("网络已重置", "wait")
	drawMLP(null)
	drawEmbedding()
	uiManager.resetProbs()
	uiManager.updateSnapshotSlider()
	drawObsessionCurve()
	uiManager.updateObsessionStatus("未设置观察样本", "wait")
	uiManager.updateCurriculumUI(curriculumStageIdx, curriculumRunning, state.learningMode)
	uiManager.updateModeUI(state.learningMode)
}

// ========== 学习模式切换 ==========

function toggleLearningMode() {
	state.learningMode = state.learningMode === "supervised" ? "unsupervised" : "supervised"
	uiManager.updateModeUI(state.learningMode)
	uiManager.updateExam(`已切换到「${state.learningMode === "supervised" ? "监督学习" : "无监督学习"}」模式`, "wait")
}

// ========== 课程学习 ==========

let curriculumStageIdx = 0
let curriculumRunning = false

async function runCurriculum() {
	console.log("MAIN", "开始课程学习")
	if (curriculumRunning) return
	if (curriculumStageIdx >= CURRICULUM_STAGES.length) {
		uiManager.updateExam("已完成全部课程阶段！", "ok")
		return
	}

	curriculumRunning = true
	uiManager.updateCurriculumUI(curriculumStageIdx, curriculumRunning, state.learningMode)

	// 应用当前阶段配置
	state.terrainConfig = { ...CURRICULUM_STAGES[curriculumStageIdx].config }
	renderTerrainConfigWithCallback()
	renderBrushesWithCallback()

	// 生成数据
	state.dataset = generateTerrainData(DATASET_SIZE, state.terrainConfig)  // 修复：使用常量
	document.getElementById("data-count")!.textContent = String(state.dataset.length)
	const btnTrain = document.getElementById("btn-train") as HTMLButtonElement
	btnTrain.disabled = state.dataset.length === 0

	// 清空旧快照，保留初始状态
	state.snapshots = [{ step: state.trainSteps, net: cloneNet(state.net) }]
	recordSnapshotStats(0)
	state.selectedSnapshotIndex = 0
	uiManager.updateSnapshotSlider()

	// 根据学习模式选择训练方式
	if (state.learningMode === "supervised") {
		await runCurriculumSupervised()
	} else {
		await runCurriculumUnsupervised()
	}

	curriculumRunning = false
	uiManager.updateCurriculumUI(curriculumStageIdx, curriculumRunning, state.learningMode)
	predict()
}

// 课程学习 - 监督学习模式
async function runCurriculumSupervised() {
	const targetAcc = 90
	const maxTotalSteps = 3000
	const { batchSize } = TRAIN_CONFIG  // 课程学习使用统一配置
	const stepsPerBatch = 100
	let achieved = false

	while (state.trainSteps < maxTotalSteps) {
		for (let s = 0; s < stepsPerBatch; s++) {
			const buffer = createSuperBuffer()

			for (let b = 0; b < batchSize; b++) {
				const idx = Math.floor(Math.random() * state.dataset.length)
				const sample = state.dataset[idx]
				accumulateSupervisedGrad(buffer, state.net, sample.indices, sample.y, batchSize)
			}

			updateNetwork(state.net, buffer, 1)
			state.trainSteps++
		}

		// 评估（统一使用 evaluateDataset，完整数据集）
		const { accuracy: acc, validRate, loss } = evaluateDatasetForCurriculum()
		uiManager.updateMetrics({ loss, acc, validRate, progress: Math.min(state.trainSteps / maxTotalSteps, 1) * 100 })
		console.log("SUP", `合法率:${validRate.toFixed(1)}% 准确率:${acc.toFixed(1)}% 损失:${loss.toFixed(4)}`)

		// 保存快照
		state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
		recordSnapshotStats(state.snapshots.length - 1)
		uiManager.updateSnapshotSlider()
		drawObsessionCurve()

		// 检查是否达标
		if (acc >= targetAcc) {
			achieved = true
			break
		}

		await new Promise(r => setTimeout(r, 1))
	}

	if (achieved) {
		uiManager.updateExam(
			`${CURRICULUM_STAGES[curriculumStageIdx].name} 训练完成！准确率 ≥ ${targetAcc}%，可进入下一阶段`,
			"ok"
		)
	} else {
		uiManager.updateExam(
			`${CURRICULUM_STAGES[curriculumStageIdx].name} 训练结束，未达到 ${targetAcc}% 准确率（当前：${document.getElementById("acc-display")!.textContent}）。建议重置网络再试一次。`,
			"bad"
		)
	}
}

// 课程学习 - 无监督学习模式
async function runCurriculumUnsupervised() {
	const targetValidRate = 70  // 无监督用合法率代替准确率
	const targetAcc = 50        // 添加：准确率目标
	const maxTotalSteps = 3000
	const { batchSize } = TRAIN_CONFIG  // 课程学习使用统一配置
	const stepsPerBatch = 100
	let achieved = false

	while (state.trainSteps < maxTotalSteps) {
		for (let s = 0; s < stepsPerBatch; s++) {
			const gEmbed = zeroMat(NUM_ELEMENTS, EMBED_DIM)  // 修复：使用 EMBED_DIM 常量
			const gW1 = zeroMat(HIDDEN_DIM, INPUT_DIM)
			const gb1 = zeroVec(HIDDEN_DIM)
			const gW2 = zeroMat(OUTPUT_DIM, HIDDEN_DIM)
			const gb2 = zeroVec(OUTPUT_DIM)

			for (let b = 0; b < batchSize; b++) {
				const idx = Math.floor(Math.random() * state.dataset.length)
				const sample = state.dataset[idx]
				const fp = forward(state.net, sample.indices)

				// ε-贪心选择动作（使用动态探索率）
				let action: number
				if (Math.random() < state.epsilon) {
					action = Math.floor(Math.random() * OUTPUT_DIM)
				} else {
					action = fp.o.indexOf(Math.max(...fp.o))
				}

				// 检查动作合法性
				const heroCol = findHeroCol(sample.t)
				const checks = getActionChecks(sample.t, heroCol)
				const isValid = isActionValidByChecks(checks, action)
				const optimal = getLabel(sample.t)

				// 计算奖励
				const evaluation = calculateReward(action, isValid, action === optimal, UNSUPERVISED_CONFIG)

				// 无监督学习梯度累积
				accumulateGradients({ dEmbed: gEmbed, dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, state.net, sample.indices, evaluation, batchSize)
			}

			updateNetwork(state.net, { dEmbed: gEmbed, dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, 1)
			state.trainSteps++
		}

		// 评估（统一使用 evaluateDataset，完整数据集）
		const { accuracy, validRate, loss } = evaluateDatasetForCurriculum()
		// 动态调整探索率
		const engine = new TrainingEngine(state, async () => {})
		const newEpsilon = engine.adjustEpsilon(validRate)
		console.log("UNS", `合法率:${validRate.toFixed(1)}% 准确率:${accuracy.toFixed(1)}% 损失:${loss.toFixed(4)} 探索率ε:${newEpsilon.toFixed(2)}`)
		// 统一使用 updateMetrics 显示所有指标
		uiManager.updateMetrics({ loss, acc: accuracy, validRate, epsilon: newEpsilon, progress: Math.min(state.trainSteps / maxTotalSteps, 1) * 100 })

		// 保存快照
		state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
		recordSnapshotStats(state.snapshots.length - 1)
		uiManager.updateSnapshotSlider()
		drawObsessionCurve()

		// 检查是否达标
		if (validRate >= targetValidRate) {
			achieved = true
			break
		}

		await new Promise(r => setTimeout(r, 1))
	}

	if (achieved) {
		uiManager.updateExam(
			`${CURRICULUM_STAGES[curriculumStageIdx].name} 训练完成！合法率 ≥ ${targetValidRate}%，可进入下一阶段`,
			"ok"
		)
	} else {
		uiManager.updateExam(
			`${CURRICULUM_STAGES[curriculumStageIdx].name} 训练结束，未达到 ${targetValidRate}% 合法率（当前：${document.getElementById("acc-display")!.textContent}）。建议重置网络再试一次。`,
			"bad"
		)
	}
}

function nextCurriculumStage() {
	if (curriculumStageIdx < CURRICULUM_STAGES.length - 1) {
		curriculumStageIdx++
		state.terrainConfig = { ...CURRICULUM_STAGES[curriculumStageIdx].config }
		renderTerrainConfigWithCallback()
		renderBrushesWithCallback()
		uiManager.updateCurriculumUI(curriculumStageIdx, curriculumRunning, state.learningMode)
		uiManager.updateExam(`已进入 ${CURRICULUM_STAGES[curriculumStageIdx].name}，点击「开始课程训练」生成数据并训练`, "wait")
	}
}

// ========== 编辑器绘制 ==========

function drawEditor() {
	drawEditorWithState(editorCanvas, state)
}

// ========== MLP 绘制 ==========

function drawMLP(fp: ForwardResult | null) {
	rendererDrawMLP(mlpCanvas, state, fp)
}

// ========== Embedding 绘制 ==========

function drawEmbedding() {
	rendererDrawEmbedding(embeddingCanvas, state)
}

// ========== 执念曲线绘制 ==========

function drawObsessionCurve() {
	rendererDrawObsessionCurve(obsessionCanvas, state)
}

// ========== 动画 ==========

function playAnimation(action: ActionType) {
	stopAnimation(state)
	state.animation.animAction = action
	state.animation.animStartTime = performance.now()
	state.animation.animSlimeKilled = false
	state.animation.animId = requestAnimationFrame(stepAnimation)
}

function stepAnimation(now: number) {
	if (!state.animation.animAction) return

	const t = rendererStepAnimation(editorCanvas, state, now)

	if (t < 1) {
		state.animation.animId = requestAnimationFrame(stepAnimation)
	} else {
		finishAnimation()
	}
}

function finishAnimation() {
	if (state.animation.animId !== null) {
		cancelAnimationFrame(state.animation.animId)
		state.animation.animId = null
	}
	drawEditor()
}

// ========== 初始化 ==========

function init() {
	// 创建独立的 Logger 实例
	const logger = new Logger("terrain-lab")

	editorCanvas = document.getElementById("editor-canvas") as HTMLCanvasElement
	mlpCanvas = document.getElementById("mlp-canvas") as HTMLCanvasElement
	embeddingCanvas = document.getElementById("embedding-canvas") as HTMLCanvasElement
	obsessionCanvas = document.getElementById("obsession-canvas") as HTMLCanvasElement

	// 动态更新HTML标题
	const editorTitle = document.getElementById("editor-title")
	if (editorTitle) {
		editorTitle.textContent = `编辑预览视图 (${NUM_COLS}×${NUM_LAYERS}) — 点击绘制，狐狸可在任意列`
	}
	const mlpTitle = document.getElementById("mlp-title")
	if (mlpTitle) {
		mlpTitle.textContent = `MLP 网络状态 (${INPUT_DIM} → ${HIDDEN_DIM} → ${OUTPUT_DIM})`
	}
	// 动态更新训练按钮文字（根据 TRAIN_CONFIG）
	const btnTrain = document.getElementById("btn-train") as HTMLButtonElement
	if (btnTrain) {
		btnTrain.textContent = `训练${TRAIN_CONFIG.steps}步+预测`
	}

	renderBrushesWithCallback()
	renderTerrainConfigWithCallback()
	uiManager.updateCurriculumUI(curriculumStageIdx, curriculumRunning, state.learningMode)
	drawEditor()
	drawMLP(null)
	drawEmbedding()
	drawObsessionCurve()
	uiManager.resetProbs()

	const ro = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const target = entry.target as HTMLCanvasElement
			if (target === editorCanvas) {
				drawEditor()
			} else if (target === mlpCanvas && state.lastForwardResult) {
				drawMLP(state.lastForwardResult)
			} else if (target === embeddingCanvas) {
				drawEmbedding()
			} else if (target === obsessionCanvas) {
				drawObsessionCurve()
			}
		}
	})
	ro.observe(editorCanvas)
	ro.observe(mlpCanvas)
	ro.observe(embeddingCanvas)
	ro.observe(obsessionCanvas)

	// canvas 点击绘制
	editorCanvas.addEventListener("click", e => {
		const rect = editorCanvas.getBoundingClientRect()
		const cell = getEditorCellAt(e.clientX - rect.left, e.clientY - rect.top, rect)
		if (!cell) return
		paintCell(cell.r, cell.c)
	})

	// 快照滑块
	const slider = document.getElementById("snapshot-slider") as HTMLInputElement
	slider.addEventListener("input", () => {
		applySnapshot(Number(slider.value))
	})

	// 绑定全局函数
	;(window as any).generateData = generateData
	;(window as any).trainBatch = trainBatch
	;(window as any).resetNet = resetNet
	;(window as any).predict = predict
	;(window as any).validateTerrain = validateTerrain
	;(window as any).randomTerrain = randomTerrain
	;(window as any).resetView = () => {
		stopAnimation(state)
		drawEditor()
	}
	;(window as any).setObservedFromTerrain = setObservedFromTerrain
	;(window as any).setObservedRandom = setObservedRandom
	;(window as any).onConfigChange = onConfigChange
	;(window as any).runCurriculum = runCurriculum
	;(window as any).nextCurriculumStage = nextCurriculumStage
	;(window as any).toggleLearningMode = toggleLearningMode

	// 初始化控制台
	const consolePanel = new ConsolePanel("#console-mount", logger)
	consolePanel.init()
	console.log("TERRAIN-LAB", "控制台初始化完成")

	// 暴露全局 console API
	;(window as any).toggleConsole = () => consolePanel.toggle()
	;(window as any).clearConsole = () => consolePanel.clear()
	;(window as any).downloadConsole = () => consolePanel.download()
}

function getAllowedElementsForLayer(layer: number): number[] {
	const cfg = state.terrainConfig
	const pool = [ELEM_AIR]
	if (layer === 0) {
		if (cfg.demon) pool.push(ELEM_DEMON)
		if (cfg.coin) pool.push(ELEM_COIN)
	} else if (layer === 1) {
		pool.push(ELEM_HERO)
		if (cfg.slime) pool.push(ELEM_SLIME)
		if (cfg.coin) pool.push(ELEM_COIN)
	} else if (layer === 2) {
		pool.push(ELEM_GROUND)
	}
	return pool
}

function paintCell(r: number, c: number) {
	const allowed = getAllowedElementsForLayer(r)
	if (!allowed.includes(state.selectedBrush)) {
		uiManager.updateTerrainStatus("bad", `❌ 该元素不能放在 ${["天上", "地上", "地面"][r]}层`)
		return
	}
	stopAnimation(state)
	setTerrainCell(state, r, c, state.selectedBrush)
	drawEditor()
	uiManager.updateTerrainStatus("wait", "地形已更新，点击「合法性检查」或「预测当前地形」查看结果")
}

init()
