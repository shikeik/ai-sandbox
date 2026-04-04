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
import { SnapshotManager } from "./snapshot-manager.js"
import { CurriculumController } from "./curriculum-controller.js"
import { TerrainValidator } from "./terrain-validator.js"
import { Predictor } from "./predictor.js"
import { ObsessionManager } from "./obsession-manager.js"
import { zeroMat, zeroVec } from "./utils.js"

// 课程学习内部使用的评估函数（将在批次6中进一步重构）
import { calculateAnimationPath } from "./animation.js"
import { createInitialState, resetState, setTerrainCell, stopAnimation } from "./state.js"

import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"

// ========== 全局状态 ==========
const state: AppState = createInitialState()
const uiManager = new UIManager(state)
const snapshotManager = new SnapshotManager(state, uiManager)
const curriculumController = new CurriculumController(state, uiManager, snapshotManager)
const terrainValidator = new TerrainValidator(state, uiManager)
const obsessionManager = new ObsessionManager(state, uiManager, snapshotManager)

// Predictor 需要等 drawMLP/drawEmbedding/playAnimation 定义后再创建
let predictor: Predictor

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
	snapshotManager.initSnapshot()

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
		snapshotManager.addSnapshot()
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

function applySnapshot(index: number) {
	snapshotManager.applySnapshot(index, () => {
		predict()
		drawObsessionCurve()
	})
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
	obsessionManager.setFromTerrain(() => drawObsessionCurve())
}

function setObservedRandom() {
	obsessionManager.setRandom(() => drawObsessionCurve())
}

// ========== 预测与验证 ==========

function predict() {
	predictor.predict()
}

function validateTerrain() {
	terrainValidator.validate()
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
	state.terrainConfig = uiManager.getConfigFromUI()
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
	uiManager.updateCurriculumUI(curriculumController.getStageIdx(), curriculumController.isCurriculumRunning(), state.learningMode)
	uiManager.updateModeUI(state.learningMode)
}

// ========== 学习模式切换 ==========

function toggleLearningMode() {
	state.learningMode = state.learningMode === "supervised" ? "unsupervised" : "supervised"
	uiManager.updateModeUI(state.learningMode)
	uiManager.updateExam(`已切换到「${state.learningMode === "supervised" ? "监督学习" : "无监督学习"}」模式`, "wait")
}

async function runCurriculum() {
	await curriculumController.runCurriculum(
		() => {
			// 生成数据回调
			state.dataset = generateTerrainData(DATASET_SIZE, state.terrainConfig)
			uiManager.updateDataCount(state.dataset.length)
			uiManager.setTrainButtonDisabled(state.dataset.length === 0)
		},
		() => {
			// 完成回调
			predict()
		}
	)
}

function nextCurriculumStage() {
	curriculumController.nextStage(() => {
		renderTerrainConfigWithCallback()
		renderBrushesWithCallback()
	})
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
	uiManager.updateCurriculumUI(curriculumController.getStageIdx(), curriculumController.isCurriculumRunning(), state.learningMode)
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

	// 初始化 Predictor（需要在 drawMLP/drawEmbedding/playAnimation 定义之后）
	predictor = new Predictor(state, uiManager, drawMLP, drawEmbedding, (action) => playAnimation(action as ActionType))

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
