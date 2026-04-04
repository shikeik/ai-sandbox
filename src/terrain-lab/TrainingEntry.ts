// ========== AI 训练入口类 ==========
// 职责：管理监督学习/无监督学习 Tab 的所有功能
// 包含：地形编辑器、MLP训练、课程学习、预测验证

import type { ForwardResult, ActionType, DatasetItem } from "./types.js"
import type { AppState, Snapshot } from "./state.js"
import {
	NUM_COLS, NUM_LAYERS, NUM_ELEMENTS, HIDDEN_DIM, OUTPUT_DIM, EMBED_DIM,
	INPUT_DIM, ACTIONS, ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN,
	CURRICULUM_STAGES, ELEMENTS,
	UNSUPERVISED_CONFIG, TRAIN_CONFIG, DATASET_SIZE
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import { forward, updateNetwork, cloneNet, createNet } from "./neural-network.js"
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
import { stopAnimation, setTerrainCell } from "./state.js"
import { createAnimationState, stopAnimation as stopAnimState, type AnimationState } from "./animation.js"

export class TrainingEntry {
	// ========== 依赖 ==========
	private state: AppState
	private uiManager: UIManager
	private snapshotManager: SnapshotManager
	private curriculumController: CurriculumController
	private terrainValidator: TerrainValidator
	private obsessionManager: ObsessionManager
	private predictor: Predictor

	// ========== DOM 元素 ==========
	private editorCanvas: HTMLCanvasElement
	private mlpCanvas: HTMLCanvasElement
	private embeddingCanvas: HTMLCanvasElement
	private obsessionCanvas: HTMLCanvasElement

	// ========== 回调 ==========
	private onRequestPredict: () => void

	constructor(
		state: AppState,
		onRequestPredict: () => void
	) {
		this.state = state
		this.onRequestPredict = onRequestPredict

		// 初始化管理器
		this.uiManager = new UIManager(state)
		this.snapshotManager = new SnapshotManager(state, this.uiManager)
		this.curriculumController = new CurriculumController(state, this.uiManager, this.snapshotManager)
		this.terrainValidator = new TerrainValidator(state, this.uiManager)
		this.obsessionManager = new ObsessionManager(state, this.uiManager, this.snapshotManager)

		// 获取 DOM 元素
		this.editorCanvas = document.getElementById("editor-canvas") as HTMLCanvasElement
		this.mlpCanvas = document.getElementById("mlp-canvas") as HTMLCanvasElement
		this.embeddingCanvas = document.getElementById("embedding-canvas") as HTMLCanvasElement
		this.obsessionCanvas = document.getElementById("obsession-canvas") as HTMLCanvasElement

		// 初始化 Predictor（需要在 drawMLP/drawEmbedding/playAnimation 定义之后）
		this.predictor = new Predictor(
			state,
			this.uiManager,
			(fp) => this.drawMLP(fp),
			() => this.drawEmbedding(),
			(action) => this.playAnimation(action as ActionType)
		)
	}

	// ========== 初始化 ==========

	init(): void {
		// 动态更新HTML标题
		const editorTitle = document.getElementById("editor-title")
		if (editorTitle) {
			editorTitle.textContent = `编辑预览视图 (${NUM_COLS}×${NUM_LAYERS}) — 点击绘制，狐狸可在任意列`
		}
		const mlpTitle = document.getElementById("mlp-title")
		if (mlpTitle) {
			mlpTitle.textContent = `MLP 网络状态 (${INPUT_DIM} → ${HIDDEN_DIM} → ${OUTPUT_DIM})`
		}
		// 动态更新训练按钮文字
		const btnTrain = document.getElementById("btn-train") as HTMLButtonElement
		if (btnTrain) {
			btnTrain.textContent = `训练${TRAIN_CONFIG.steps}步+预测`
		}

		this.renderBrushes()
		this.renderTerrainConfig()
		this.uiManager.updateCurriculumUI(
			this.curriculumController.getStageIdx(),
			this.curriculumController.isCurriculumRunning(),
			this.state.learningMode
		)
		this.drawEditor()
		this.drawMLP(null)
		this.drawEmbedding()
		this.drawObsessionCurve()
		this.uiManager.resetProbs()

		// 设置 ResizeObserver
		this.setupResizeObserver()

		// Canvas 点击绘制
		this.editorCanvas.addEventListener("click", (e) => this.handleCanvasClick(e))

		// 快照滑块
		const slider = document.getElementById("snapshot-slider") as HTMLInputElement
		slider.addEventListener("input", () => {
			this.applySnapshot(Number(slider.value))
		})

		// 绑定全局函数
		this.bindGlobalFunctions()
	}

	private setupResizeObserver(): void {
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const target = entry.target as HTMLCanvasElement
				if (target === this.editorCanvas) {
					this.drawEditor()
				} else if (target === this.mlpCanvas && this.state.lastForwardResult) {
					this.drawMLP(this.state.lastForwardResult)
				} else if (target === this.embeddingCanvas) {
					this.drawEmbedding()
				} else if (target === this.obsessionCanvas) {
					this.drawObsessionCurve()
				}
			}
		})
		ro.observe(this.editorCanvas)
		ro.observe(this.mlpCanvas)
		ro.observe(this.embeddingCanvas)
		ro.observe(this.obsessionCanvas)
	}

	private bindGlobalFunctions(): void {
		// 训练相关
		;(window as any).generateData = () => this.generateData()
		;(window as any).trainBatch = () => this.trainBatch()
		;(window as any).resetNet = () => this.resetNet()
		;(window as any).predict = () => this.predict()
		;(window as any).validateTerrain = () => this.validateTerrain()
		;(window as any).randomTerrain = () => this.randomTerrain()
		;(window as any).resetView = () => this.resetView()
		;(window as any).setObservedFromTerrain = () => this.setObservedFromTerrain()
		;(window as any).setObservedRandom = () => this.setObservedRandom()
		;(window as any).onConfigChange = () => this.onConfigChange()
		;(window as any).runCurriculum = () => this.runCurriculum()
		;(window as any).nextCurriculumStage = () => this.nextCurriculumStage()
		;(window as any).toggleLearningMode = () => this.toggleLearningMode()
	}

	// ========== 数据生成 ==========

	generateData(): void {
		this.state.dataset = generateTerrainData(DATASET_SIZE, this.state.terrainConfig)
		this.uiManager.updateMetrics({})
		this.uiManager.updateDataCount(this.state.dataset.length)
		this.uiManager.setTrainButtonDisabled(this.state.dataset.length === 0)
		this.uiManager.updateExam(`已生成 ${this.state.dataset.length} 条合法训练数据`, "wait")
		// 默认随机选一个观察样本
		if (this.state.dataset.length > 0 && !this.state.observedSample) {
			this.setObservedRandom()
		}
	}

	// ========== 训练 ==========

	async trainBatch(): Promise<void> {
		console.log("TRAINING", "开始训练批次")
		const btn = document.getElementById("btn-train") as HTMLButtonElement
		btn.disabled = true

		// 若快照为空，先保存初始状态
		this.snapshotManager.initSnapshot()

		const engine = new TrainingEngine(this.state, async (result) => {
			this.uiManager.updateMetrics({
				loss: result.loss,
				acc: result.accuracy,
				validRate: result.validRate,
				epsilon: result.epsilon,
				reward: result.reward,
				progress: result.progress
			})
			// 保存快照
			this.snapshotManager.addSnapshot()
			await new Promise(r => setTimeout(r, 1))
		})

		if (this.state.learningMode === "supervised") {
			await engine.trainSupervised()
		} else {
			await engine.trainUnsupervised()
		}

		console.log("TRAINING", "训练完成，更新UI")
		this.uiManager.updateSnapshotSlider()
		this.evaluateAll()
		this.predict()
		this.drawObsessionCurve()
		btn.disabled = false
		console.log("TRAINING", "训练批次结束")

		// 通知外部可能需要更新
		this.onRequestPredict()
	}

	private evaluateAll(): void {
		const engine = new TrainingEngine(this.state, async () => {})
		const { accuracy, validRate, loss } = engine.evaluateDataset()
		this.uiManager.updateFinalMetrics(this.state.trainSteps, accuracy, validRate, loss)
	}

	// ========== 预测与验证 ==========

	predict(): void {
		this.predictor.predict()
	}

	validateTerrain(): void {
		this.terrainValidator.validate()
	}

	// ========== 观察样本 ==========

	setObservedFromTerrain(): void {
		this.obsessionManager.setFromTerrain(() => this.drawObsessionCurve())
	}

	setObservedRandom(): void {
		this.obsessionManager.setRandom(() => this.drawObsessionCurve())
	}

	// ========== 快照 ==========

	applySnapshot(index: number): void {
		this.snapshotManager.applySnapshot(index, () => {
			this.predict()
			this.drawObsessionCurve()
		})
	}

	// ========== 地形操作 ==========

	private handleCanvasClick(e: MouseEvent): void {
		const rect = this.editorCanvas.getBoundingClientRect()
		const cell = getEditorCellAt(e.clientX - rect.left, e.clientY - rect.top, rect)
		if (!cell) return
		this.paintCell(cell.r, cell.c)
	}

	private getAllowedElementsForLayer(layer: number): number[] {
		const cfg = this.state.terrainConfig
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

	private paintCell(r: number, c: number): void {
		const allowed = this.getAllowedElementsForLayer(r)
		if (!allowed.includes(this.state.selectedBrush)) {
			this.uiManager.updateTerrainStatus("bad", `❌ 该元素不能放在 ${["天上", "地上", "地面"][r]}层`)
			return
		}
		stopAnimation(this.state)
		setTerrainCell(this.state, r, c, this.state.selectedBrush)
		this.drawEditor()
		this.uiManager.updateTerrainStatus("wait", "地形已更新，点击「合法性检查」或「预测当前地形」查看结果")
	}

	randomTerrain(): void {
		this.state.terrain = generateRandomTerrain(this.state.terrainConfig)
		stopAnimation(this.state)
		this.drawEditor()
		this.uiManager.updateTerrainStatus("wait", "已随机生成新地形，点击「预测当前地形」查看 AI 判断")
		this.drawMLP(null)
		this.drawEmbedding()
		this.uiManager.resetProbs()
	}

	resetView(): void {
		stopAnimation(this.state)
		this.drawEditor()
	}

	// ========== 配置操作 ==========

	private findCurrentStageIndex(): number {
		const cfg = this.state.terrainConfig
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

	private onConfigChange(): void {
		this.state.terrainConfig = this.uiManager.getConfigFromUI()
		this.renderTerrainConfig()
		this.renderBrushes()
		this.uiManager.updateTerrainStatus("wait", "地形配置已更新")
	}

	// ========== 课程学习 ==========

	async runCurriculum(): Promise<void> {
		await this.curriculumController.runCurriculum(
			() => {
				// 生成数据回调
				this.state.dataset = generateTerrainData(DATASET_SIZE, this.state.terrainConfig)
				this.uiManager.updateDataCount(this.state.dataset.length)
				this.uiManager.setTrainButtonDisabled(this.state.dataset.length === 0)
			},
			() => {
				// 完成回调
				this.predict()
			}
		)
	}

	nextCurriculumStage(): void {
		this.curriculumController.nextStage(() => {
			this.renderTerrainConfig()
			this.renderBrushes()
		})
	}

	toggleLearningMode(): void {
		this.state.learningMode = this.state.learningMode === "supervised" ? "unsupervised" : "supervised"
		this.uiManager.updateModeUI(this.state.learningMode)
		this.uiManager.updateExam(`已切换到「${this.state.learningMode === "supervised" ? "监督学习" : "无监督学习"}」模式`, "wait")
	}

	// ========== 网络操作 ==========

	resetNet(): void {
		// 重置网络参数
		this.state.net = createNet()
		this.state.trainSteps = 0
		this.state.snapshots = []
		this.state.selectedSnapshotIndex = -1
		this.state.observedSample = null
		this.state.dataset = []
		this.state.unsupervisedHistory = []
		this.state.epsilon = 0.5
		this.state.lastForwardResult = null

		// 重置地形
		this.state.terrain = [
			Array(NUM_COLS).fill(ELEM_AIR),
			[ELEM_HERO, ...Array(NUM_COLS - 1).fill(ELEM_AIR)],
			[ELEM_GROUND, ELEM_GROUND, ...Array(NUM_COLS - 2).fill(ELEM_AIR)],
		]
		this.state.selectedBrush = ELEM_AIR
		stopAnimation(this.state)

		// 重置所有数据显示
		this.uiManager.resetNetworkUI()
		this.uiManager.updateExam("网络已重置", "wait")
		this.drawMLP(null)
		this.drawEmbedding()
		this.uiManager.resetProbs()
		this.uiManager.updateSnapshotSlider()
		this.drawObsessionCurve()
		this.uiManager.updateObsessionStatus("未设置观察样本", "wait")
		this.uiManager.updateCurriculumUI(
			this.curriculumController.getStageIdx(),
			this.curriculumController.isCurriculumRunning(),
			this.state.learningMode
		)
		this.uiManager.updateModeUI(this.state.learningMode)
	}

	// ========== UI 渲染 ==========

	private renderBrushes(): void {
		this.uiManager.renderBrushes(this.state.selectedBrush, (id) => {
			this.state.selectedBrush = id
			this.renderBrushes()
			this.uiManager.updateTerrainStatus("wait", "已选择 " + ELEMENTS[id].name + "，点击上方格子绘制")
		})
	}

	private renderTerrainConfig(): void {
		const currentStageIdx = this.findCurrentStageIndex()
		this.uiManager.renderTerrainConfig(
			currentStageIdx,
			(idx) => {
				this.state.terrainConfig = { ...CURRICULUM_STAGES[idx].config }
				this.renderTerrainConfig()
				this.renderBrushes()
				this.uiManager.updateTerrainStatus("wait", `已切换到「${CURRICULUM_STAGES[idx].name}」，随机地形和生成数据将使用该配置`)
			},
			() => this.onConfigChange()
		)
	}

	// ========== 绘制函数 ==========

	drawEditor(): void {
		drawEditorWithState(this.editorCanvas, this.state)
	}

	drawMLP(fp: ForwardResult | null): void {
		rendererDrawMLP(this.mlpCanvas, this.state, fp)
	}

	drawEmbedding(): void {
		rendererDrawEmbedding(this.embeddingCanvas, this.state)
	}

	drawObsessionCurve(): void {
		rendererDrawObsessionCurve(this.obsessionCanvas, this.state)
	}

	// ========== 动画 ==========

	private playAnimation(action: ActionType): void {
		stopAnimation(this.state)
		this.state.animation.animAction = action
		this.state.animation.animStartTime = performance.now()
		this.state.animation.animSlimeKilled = false
		this.state.animation.animId = requestAnimationFrame((now) => this.stepAnimation(now))
	}

	private stepAnimation(now: number): void {
		if (!this.state.animation.animAction) return

		const t = rendererStepAnimation(this.editorCanvas, this.state, now)

		if (t < 1) {
			this.state.animation.animId = requestAnimationFrame((n) => this.stepAnimation(n))
		} else {
			this.finishAnimation()
		}
	}

	private finishAnimation(): void {
		if (this.state.animation.animId !== null) {
			cancelAnimationFrame(this.state.animation.animId)
			this.state.animation.animId = null
		}
		this.drawEditor()
	}

	// ========== 公共方法 ==========

	getState(): AppState {
		return this.state
	}

	updatePredictor(): void {
		this.predictor.predict()
	}
}
