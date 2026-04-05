// ========== AI 训练入口类（重构版）==========
// 职责：管理监督学习/无监督学习 Tab 的所有功能
// 使用 GridWorldSystem 统一处理渲染、编辑、动画

import type { ForwardResult, ActionType, DatasetItem } from "./types.js"
import type { AppState } from "./state.js"
import {
	NUM_COLS, NUM_LAYERS, NUM_ELEMENTS, HIDDEN_DIM, OUTPUT_DIM, EMBED_DIM,
	INPUT_DIM, ACTIONS, ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN,
	CURRICULUM_STAGES, ELEMENTS,
	UNSUPERVISED_CONFIG, TRAIN_CONFIG, DATASET_SIZE
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import { forward, createNet } from "./neural-network.js"
import {
	terrainToIndices, findHeroCol, getActionChecks, getLabel,
	isActionValidByChecks, generateTerrainData, generateRandomTerrain
} from "./terrain.js"
import { UIManager } from "./ui-manager.js"
import { TrainingEngine } from "./training-engine.js"
import { SnapshotManager } from "./snapshot-manager.js"
import { CurriculumController } from "./curriculum-controller.js"
import { TerrainValidator } from "./terrain-validator.js"
import { Predictor } from "./predictor.js"
import { ObsessionManager } from "./obsession-manager.js"
import { stopAnimation, setTerrainCell } from "./state.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 引入格子世界系统 ==========

import {
	GridWorld,
	DEFAULT_ELEMENTS,
	createGridWorld,
} from "./grid-world/index.js"

export class TrainingEntry {
	// ========== 依赖 ==========
	private state: AppState
	private uiManager: UIManager
	private snapshotManager: SnapshotManager
	private curriculumController: CurriculumController
	private terrainValidator: TerrainValidator
	private obsessionManager: ObsessionManager
	private predictor: Predictor
	private logger: Logger

	// ========== 格子世界系统 ==========
	private gridWorld: GridWorld

	// ========== DOM 元素 ==========
	private editorCanvas: HTMLCanvasElement
	private mlpCanvas: HTMLCanvasElement
	private embeddingCanvas: HTMLCanvasElement
	private obsessionCanvas: HTMLCanvasElement

	// ========== 回调 ==========
	private onRequestPredict: () => void

	// ========== 动画帧 ID ==========
	private animFrameId: number | null = null

	// ========== 验收快照（仅用于刷新视图恢复）==========
	private actionSnapshot: number[][] | null = null

	constructor(
		state: AppState,
		onRequestPredict: () => void
	) {
		this.state = state
		this.onRequestPredict = onRequestPredict
		this.logger = new Logger("TRAINING-ENTRY")

		console.log("TRAINING-ENTRY", "初始化开始")

		// 初始化管理器
		this.uiManager = new UIManager(state)
		this.snapshotManager = new SnapshotManager(state, this.uiManager)
		this.curriculumController = new CurriculumController(state, this.uiManager, this.snapshotManager)
		this.terrainValidator = new TerrainValidator(state, this.uiManager)
		this.obsessionManager = new ObsessionManager(state, this.uiManager, this.snapshotManager)

		// 初始化格子世界
		this.gridWorld = createGridWorld({
			width: NUM_COLS,
			height: NUM_LAYERS,
			elements: DEFAULT_ELEMENTS,
		})
		this.gridWorld.enableEditor()
		console.log("格子世界初始化完成")

		// 同步地形数据
		this.syncTerrainToGridWorld()

		// 获取 DOM 元素
		this.editorCanvas = document.getElementById("editor-canvas") as HTMLCanvasElement
		this.mlpCanvas = document.getElementById("mlp-canvas") as HTMLCanvasElement
		this.embeddingCanvas = document.getElementById("embedding-canvas") as HTMLCanvasElement
		this.obsessionCanvas = document.getElementById("obsession-canvas") as HTMLCanvasElement

		// 设置编辑器回调
		const editor = this.gridWorld.getEditor()
		if (editor) {
			editor.onCellPainted = (row, col, elementId) => {
				console.log("TRAINING-ENTRY", `编辑器绘制回调 | row=${row}, col=${col}, element=${elementId}`)
				setTerrainCell(this.state, row, col, elementId)
				// 关键：把修改同步到 GridWorld 再绘制
				this.syncTerrainToGridWorld()
				this.drawEditor()
				this.uiManager.updateTerrainStatus("wait", "地形已更新，点击「合法性检查」或「预测当前地形」查看结果")
			}
			editor.onInvalidPlacement = (message) => {
				this.uiManager.updateTerrainStatus("bad", message)
			}
		}

		// 初始化 Predictor
		this.predictor = new Predictor(
			state,
			this.uiManager,
			(fp) => this.drawMLP(fp),
			() => this.drawEmbedding(),
			(action) => this.playAnimation(action as ActionType)
		)

		console.log("TRAINING-ENTRY", "初始化完成")
	}

	// ========== 同步地形数据 ==========

	private syncTerrainToGridWorld(): void {
		console.log("TRAINING-ENTRY", `同步地形到 GridWorld | terrain=${JSON.stringify(this.state.terrain).substring(0, 100)}...`)
		this.gridWorld.setGrid(this.state.terrain)
		// 注意：setGrid 内部已自动同步 heroCol
		console.log("TRAINING-ENTRY", "地形同步完成")
	}

	private syncGridWorldToTerrain(): void {
		console.log("TRAINING-ENTRY", "从 GridWorld 同步地形到 state")
		this.state.terrain = this.gridWorld.getGrid()
	}

	// ========== 初始化 ==========

	init(): void {
		console.log("TRAINING-ENTRY", "init() 开始")

		// 动态更新 HTML 标题
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

		console.log("TRAINING-ENTRY", "init() 完成")
	}

	private setupResizeObserver(): void {
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const target = entry.target as HTMLCanvasElement
				if (target === this.editorCanvas) {
					console.log("TRAINING-ENTRY", "编辑器画布 Resize")
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
		console.log("TRAINING-ENTRY", "生成数据开始")
		this.state.dataset = generateTerrainData(DATASET_SIZE, this.state.terrainConfig)
		this.uiManager.updateMetrics({})
		this.uiManager.updateDataCount(this.state.dataset.length)
		this.uiManager.setTrainButtonDisabled(this.state.dataset.length === 0)
		this.uiManager.updateExam(`已生成 ${this.state.dataset.length} 条合法训练数据`, "wait")
		
		// 默认随机选一个观察样本
		if (this.state.dataset.length > 0 && !this.state.observedSample) {
			this.setObservedRandom()
		}
		console.log("TRAINING-ENTRY", `生成数据完成 | count=${this.state.dataset.length}`)
	}

	// ========== 训练 ==========

	async trainBatch(): Promise<void> {
		console.log("TRAINING-ENTRY", "训练批次开始")
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

		console.log("TRAINING-ENTRY", "训练完成，更新UI")
		this.uiManager.updateSnapshotSlider()
		this.evaluateAll()
		this.predict()
		this.drawObsessionCurve()
		btn.disabled = false

		// 通知外部可能需要更新
		this.onRequestPredict()
		console.log("TRAINING-ENTRY", "训练批次结束")
	}

	private evaluateAll(): void {
		const engine = new TrainingEngine(this.state, async () => {})
		const { accuracy, validRate, loss } = engine.evaluateDataset()
		this.uiManager.updateFinalMetrics(this.state.trainSteps, accuracy, validRate, loss)
	}

	// ========== 预测与验证 ==========

	predict(): void {
		// 先刷新视图（如有验收残留则恢复）
		this.resetView()
		// 保存当前地形快照（用于验收后恢复）
		this.actionSnapshot = this.state.terrain.map(row => [...row])
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
		console.log("TRAINING-ENTRY", `应用快照 | index=${index}`)
		this.snapshotManager.applySnapshot(index, () => {
			this.predict()
			this.drawObsessionCurve()
		})
		// 同步地形
		this.syncTerrainToGridWorld()
		this.drawEditor()
	}

	// ========== 地形操作 ==========

	private handleCanvasClick(e: MouseEvent): void {
		console.log("TRAINING-ENTRY", `画布点击 | clientX=${e.clientX}, clientY=${e.clientY}`)
		
		const rect = this.editorCanvas.getBoundingClientRect()
		const mx = e.clientX - rect.left
		const my = e.clientY - rect.top

		const cell = this.gridWorld.getCellAtPosition(mx, my, rect.width, rect.height)
		
		if (cell) {
			console.log("TRAINING-ENTRY", `点击格子 | row=${cell.row}, col=${cell.col}`)
			const editor = this.gridWorld.getEditor()
			if (editor) {
				editor.setBrush(this.state.selectedBrush)
				const painted = editor.paintAt(cell.row, cell.col)
				console.log("TRAINING-ENTRY", `绘制结果 | painted=${painted}`)
				if (painted) {
					// 绘制已完成，只需停止动画和刷新
					this.stopAnimation()
					// 注意：绘制已在 onCellPainted 回调中完成
				}
			}
		} else {
			console.log("TRAINING-ENTRY", "点击位置不在有效格子上")
		}
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
		console.log("TRAINING-ENTRY", `paintCell | r=${r}, c=${c}`)
		const editor = this.gridWorld.getEditor()
		if (!editor) {
			console.error("编辑器未初始化")
			return
		}

		// 检查层限制
		editor.setLayerAllowedElements(r, this.getAllowedElementsForLayer(r))
		
		const painted = editor.paintAt(r, c, this.state.selectedBrush)
		if (painted) {
			this.syncGridWorldToTerrain()
			this.stopAnimation()
			this.drawEditor()
			this.uiManager.updateTerrainStatus("wait", "地形已更新，点击「合法性检查」或「预测当前地形」查看结果")
		}
	}

	randomTerrain(): void {
		console.log("TRAINING-ENTRY", "随机地形开始")
		const newTerrain = generateRandomTerrain(this.state.terrainConfig)
		this.state.terrain = newTerrain
		this.syncTerrainToGridWorld()
		
		this.stopAnimation()
		this.drawEditor()
		this.uiManager.updateTerrainStatus("wait", "已随机生成新地形，点击「预测当前地形」查看 AI 判断")
		this.drawMLP(null)
		this.drawEmbedding()
		this.uiManager.resetProbs()
		console.log("TRAINING-ENTRY", "随机地形完成")
	}

	resetView(): void {
		console.log("TRAINING-ENTRY", "重置视图")
		// 如有验收快照，恢复地形并清空
		if (this.actionSnapshot) {
			this.state.terrain = this.actionSnapshot.map(row => [...row])
			this.actionSnapshot = null
			console.log("TRAINING-ENTRY", "已恢复地形并清空快照")
		}
		this.syncTerrainToGridWorld()
		this.stopAnimation()
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
		console.log("TRAINING-ENTRY", "配置变更")
		this.state.terrainConfig = this.uiManager.getConfigFromUI()
		
		// 更新编辑器的层限制
		const editor = this.gridWorld.getEditor()
		if (editor) {
			for (let layer = 0; layer < NUM_LAYERS; layer++) {
				editor.setLayerAllowedElements(layer, this.getAllowedElementsForLayer(layer))
			}
		}
		
		this.renderTerrainConfig()
		this.renderBrushes()
		this.uiManager.updateTerrainStatus("wait", "地形配置已更新")
	}

	// ========== 课程学习 ==========

	async runCurriculum(): Promise<void> {
		console.log("开始课程学习")
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
		console.log("TRAINING-ENTRY", "课程学习结束")
	}

	nextCurriculumStage(): void {
		console.log("切换课程阶段")
		this.curriculumController.nextStage(() => {
			this.renderTerrainConfig()
			this.renderBrushes()
		})
	}

	toggleLearningMode(): void {
		this.state.learningMode = this.state.learningMode === "supervised" ? "unsupervised" : "supervised"
		console.log("TRAINING-ENTRY", `学习模式切换 | mode=${this.state.learningMode}`)
		this.uiManager.updateModeUI(this.state.learningMode)
		this.uiManager.updateExam(`已切换到「${this.state.learningMode === "supervised" ? "监督学习" : "无监督学习"}」模式`, "wait")
	}

	// ========== 网络操作 ==========

	resetNet(): void {
		console.log("TRAINING-ENTRY", "重置网络")
		
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
		this.syncTerrainToGridWorld()
		this.stopAnimation()

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
		
		console.log("网络重置完成")
	}

	// ========== UI 渲染 ==========

	private renderBrushes(): void {
		this.uiManager.renderBrushes(this.state.selectedBrush, (id) => {
			this.state.selectedBrush = id
			const editor = this.gridWorld.getEditor()
			if (editor) {
				editor.setBrush(id)
			}
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
				// 更新编辑器的层限制
				const editor = this.gridWorld.getEditor()
				if (editor) {
					for (let layer = 0; layer < NUM_LAYERS; layer++) {
						editor.setLayerAllowedElements(layer, this.getAllowedElementsForLayer(layer))
					}
				}
				this.renderTerrainConfig()
				this.renderBrushes()
				this.uiManager.updateTerrainStatus("wait", `已切换到「${CURRICULUM_STAGES[idx].name}」，随机地形和生成数据将使用该配置`)
			},
			() => this.onConfigChange()
		)
	}

	// ========== 绘制函数 ==========

	drawEditor(): void {
		this.gridWorld.render({
			canvas: this.editorCanvas,
			showLayerLabels: true,
			showColLabels: true,
		})
	}

	drawMLP(fp: ForwardResult | null): void {
		// MLP 绘制保持原样（在 renderer.ts 中实现，需要导入）
		import("./renderer.js").then(({ drawMLP }) => {
			drawMLP(this.mlpCanvas, this.state, fp)
		})
	}

	drawEmbedding(): void {
		// Embedding 绘制保持原样
		import("./renderer.js").then(({ drawEmbedding }) => {
			drawEmbedding(this.embeddingCanvas, this.state)
		})
	}

	drawObsessionCurve(): void {
		// 执念曲线绘制保持原样
		import("./renderer.js").then(({ drawObsessionCurve }) => {
			drawObsessionCurve(this.obsessionCanvas, this.state)
		})
	}

	// ========== 动画 ==========

	private playAnimation(action: ActionType): Promise<void> {
		console.log("TRAINING-ENTRY", `播放动画 | action=${action}`)
		
		this.stopAnimation()

		return new Promise((resolve) => {
			const onFrame = (progress: number, slimeKilled: boolean) => {
				this.gridWorld.renderAnimation(
					{ canvas: this.editorCanvas },
					action,
					progress,
					slimeKilled
				)
			}

			this.gridWorld.playAction(action, { onFrame }).then((result) => {
				console.log("TRAINING-ENTRY", `动画完成 | result=${JSON.stringify(result)}`)
				// 不同步回 state.terrain，保持 state.terrain 干净
				// GridWorld 保持动画结束状态（狐狸在终点，金币被吃掉）
				this.drawEditor()
				resolve()
			})
		})
	}

	private stopAnimation(): void {
		if (this.animFrameId !== null) {
			cancelAnimationFrame(this.animFrameId)
			this.animFrameId = null
		}
		stopAnimation(this.state)
	}

	// ========== 公共方法 ==========

	getState(): AppState {
		return this.state
	}

	updatePredictor(): void {
		this.predictor.predict()
	}
}
