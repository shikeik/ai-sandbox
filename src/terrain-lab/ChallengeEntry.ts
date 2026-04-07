// ========== 连续挑战入口类（重构版）==========
// 职责：管理连续挑战 Tab 的所有功能
// 使用 GridWorldSystem 统一处理渲染和动画

import type { AppState } from "./state.js"
import type { ActionType } from "./types.js"
import type { ChallengeState, ChallengeResult, ChallengeSpeed, ChallengeMode } from "./challenge-controller.js"
import { ChallengeController, ChallengeUIManager } from "./challenge-controller.js"
import { CURRICULUM_STAGES, NUM_LAYERS } from "./constants.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 引入格子世界系统 ==========

import {
	GridWorld,
	DEFAULT_ELEMENTS,
	createGridWorld,
} from "./grid-world/index.js"

export class ChallengeEntry {
	// ========== 依赖 ==========
	private state: AppState
	private challengeController: ChallengeController | null = null
	private challengeUIManager: ChallengeUIManager | null = null
	private logger: Logger

	// ========== 格子世界系统 ==========
	private gridWorld: GridWorld

	// ========== 回调 ==========
	private onRequestPredict: () => void

	constructor(
		state: AppState,
		onRequestPredict: () => void
	) {
		this.state = state
		this.onRequestPredict = onRequestPredict
		this.logger = new Logger("CHALLENGE-ENTRY")


		// 初始化格子世界（32列，5列视野）
		this.gridWorld = createGridWorld({
			width: 32,
			height: NUM_LAYERS,
			elements: DEFAULT_ELEMENTS,
			viewportWidth: 5,
		})
	}

	// ========== 初始化 ==========

	init(): void {

		this.challengeUIManager = new ChallengeUIManager(this.state, this.gridWorld)

		// 获取挑战画布
		const challengeCanvas = document.getElementById("challenge-canvas") as HTMLCanvasElement

		// 创建挑战控制器
		this.challengeController = new ChallengeController(
			this.state,
			(challengeState: ChallengeState) => this.handleStateUpdate(challengeState),
			(result: ChallengeResult) => this.handleStepComplete(result),
			(won: boolean, finalCol: number) => this.handleGameOver(won, finalCol),
			(action: ActionType, speed: ChallengeSpeed) => this.playChallengeAnimation(action, speed),
			challengeCanvas
		)

		// 初始化挑战 UI
		this.challengeUIManager.init(() => {
			// 尺寸变化时重绘
			const terrain = this.challengeController?.getCurrentTerrain() ?? null
			const heroCol = this.challengeController?.getHeroCol() ?? 0
			this.challengeUIManager?.drawTerrain(terrain, heroCol)
			this.challengeUIManager?.drawMLP(terrain)
		})

		// 设置初始地形配置
		this.setupTerrainConfig()

		// 设置速度选择
		this.setupSpeedSelect()

		// 初始渲染
		this.resetUI()

		// 绑定全局函数
		this.bindGlobalFunctions()

	}

	private setupTerrainConfig(): void {
		const stageSelect = document.getElementById("challenge-stage-select") as HTMLSelectElement
		if (stageSelect && this.challengeController) {
			const stageIdx = Number(stageSelect.value)
			this.challengeController.setTerrainConfig(CURRICULUM_STAGES[stageIdx].config)

			stageSelect.addEventListener("change", () => {
				const idx = Number(stageSelect.value)
				this.challengeController?.setTerrainConfig(CURRICULUM_STAGES[idx].config)
			})
		}
	}

	private setupSpeedSelect(): void {
		const speedSelect = document.getElementById("challenge-speed") as HTMLSelectElement
		if (speedSelect && this.challengeController) {
			speedSelect.addEventListener("change", () => {
				const speed = Number(speedSelect.value) as ChallengeSpeed
				this.challengeController?.setSpeed(speed)
			})
		}
	}

	private bindGlobalFunctions(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(window as any).startChallenge = () => this.startChallenge()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(window as any).pauseChallenge = () => this.pauseChallenge()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(window as any).stepChallenge = () => this.stepChallenge()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(window as any).resetChallenge = () => this.resetChallenge()
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		;(window as any).setChallengeMode = (mode: ChallengeMode) => this.setChallengeMode(mode)
	}

	private resetUI(): void {
		if (this.challengeController && this.challengeUIManager) {
			this.challengeUIManager.updateStats(this.challengeController.getState())
			this.challengeUIManager.updateControls(false, false)
			this.challengeUIManager.updateResult(null)
			this.challengeUIManager.updateHistory([])
			this.challengeUIManager.resetProbs()
			this.challengeUIManager.drawTerrain(null)
			this.challengeUIManager.drawMLP(null)
		}
	}

	// ========== 回调处理 ==========

	private handleStateUpdate(challengeState: ChallengeState): void {
		
		this.challengeUIManager?.updateStats(challengeState)
		this.challengeUIManager?.updateControls(
			challengeState.isRunning,
			challengeState.isPaused,
			challengeState.isStepMode
		)
		this.challengeUIManager?.updateHistory(challengeState.history)
		this.challengeUIManager?.updateMode(challengeState.mode)

		// 更新地形显示（使用视野窗口）
		const terrain = this.challengeController?.getCurrentTerrain()
		if (terrain) {
			// 同步到 GridWorld 并更新相机
			this.gridWorld.setGrid(this.challengeController!.getFullMap()!)
			this.gridWorld.setHeroCol(challengeState.heroCol)
			this.gridWorld.followHero(true)
			
			this.challengeUIManager?.drawTerrain(terrain, challengeState.heroCol)
			this.challengeUIManager?.drawMLP(terrain)
		}
	}

	private handleStepComplete(result: ChallengeResult): void {
		this.challengeUIManager?.updateResult(result)
		this.challengeUIManager?.updateProbs(result.probabilities)
	}

	private handleGameOver(won: boolean, finalCol: number): void {
		this.challengeUIManager?.showGameOver(won, finalCol)
		this.challengeUIManager?.updateControls(false, false)
	}

	// ========== 动画播放 ==========

	private async playChallengeAnimation(action: ActionType, speed: ChallengeSpeed): Promise<void> {

		const challengeCanvas = document.getElementById("challenge-canvas") as HTMLCanvasElement
		if (!challengeCanvas) {
			return Promise.resolve()
		}

		// 使用 GridWorld 播放动画
		const heroCol = this.challengeController?.getHeroCol() ?? 0
		this.gridWorld.setHeroCol(heroCol)

		// 动画回调
		const onFrame = (progress: number, slimeKilled: boolean) => {
			this.gridWorld.renderAnimation(
				{ canvas: challengeCanvas },
				action,
				progress,
				slimeKilled
			)
		}

		// 播放动画
		await this.gridWorld.playAction(action, { speed, onFrame })
		
	}

	// ========== 公共控制方法 ==========

	startChallenge(): void {
		if (!this.challengeController) return

		if (this.challengeController.getIsPaused()) {
			this.challengeController.resume()
		} else {
			this.challengeController.start()
		}
	}

	pauseChallenge(): void {
		this.challengeController?.pause()
	}

	stepChallenge(): void {
		this.challengeController?.step()
	}

	resetChallenge(): void {
		this.challengeController?.reset()
		this.challengeUIManager?.updateResult(null)
		this.challengeUIManager?.updateHistory([])
		this.challengeUIManager?.resetProbs()
		this.challengeUIManager?.drawTerrain(null)
		this.challengeUIManager?.drawMLP(null)
	}

	setChallengeMode(mode: ChallengeMode): void {
		this.challengeController?.setMode(mode)
	}

	// ========== Tab 切换时调用 ==========

	onTabActivate(): void {
		// 切换到挑战 Tab，初始化挑战画布
		if (this.challengeUIManager && this.challengeController) {
			const terrain = this.challengeController.getCurrentTerrain()
			const heroCol = this.challengeController.getHeroCol()
			this.challengeUIManager.drawTerrain(terrain, heroCol)
			this.challengeUIManager.drawMLP(terrain)
		}
	}
}
