/**
 * AI 控制器
 * 封装所有 AI 决策、训练循环、速度控制与结果记录逻辑
 */

import { ACTION, GAME_STATUS, PLAYER_ACTION, JumpGame, ActionType } from "@game/JumpGame.js"
import { NeuralNetwork } from "./NeuralNetwork.js"

export type SpeedType = "step" | number

export interface AIConfigOptions {
	STEP_REWARD: number
	DEATH_REWARD: number
	WIN_REWARD: number
	SPEEDS: {
		STEP: "step"
		SLOW: number
		NORMAL: number
		FAST: number
		MAX: number
	}
	DEFAULT_SPEED: string
	DEFAULT_MODE: string
	ANIMATION: {
		MAX_DURATION: number
		FAST_DURATION: number
	}
	TIMER_INTERVAL: number
}

export const AI_CONFIG: AIConfigOptions = {
	STEP_REWARD: 0.02,
	DEATH_REWARD: -1,
	WIN_REWARD: 1,
	SPEEDS: {
		STEP: "step",
		SLOW: 1000,
		NORMAL: 200,
		FAST: 50,
		MAX: 0
	},
	DEFAULT_SPEED: "step",
	DEFAULT_MODE: "player",
	ANIMATION: {
		MAX_DURATION: 16,
		FAST_DURATION: 50
	},
	TIMER_INTERVAL: 100
}

export interface AIControllerOptions {
	game: JumpGame
	network: NeuralNetwork
	onRenderView: (inputs: number[], action: number | null, isPreview: boolean, weightChanges: number[][][] | null) => void
}

export interface PendingDecision {
	action: number
	actionType: ActionType
	inputs: number[]
	scores: number[]
}

export class AIController {
	game: JumpGame
	network: NeuralNetwork
	onRenderView: (inputs: number[], action: number | null, isPreview: boolean, weightChanges: number[][][] | null) => void
	isAIMode: boolean = false
	isAITrainMode: boolean = false
	isStepMode: boolean
	aiSpeed: SpeedType
	aiInterval: ReturnType<typeof setInterval> | null = null
	fastLoopId: number | null = null
	pendingAIDecision: PendingDecision | null = null
	performanceHistory: number[] = []
	windowSize: number = 5

	constructor({ game, network, onRenderView }: AIControllerOptions) {
		this.game = game
		this.network = network
		this.onRenderView = onRenderView

		this.isStepMode = AI_CONFIG.DEFAULT_SPEED === "step"
		this.aiSpeed = this.isStepMode ? AI_CONFIG.SPEEDS.NORMAL : AI_CONFIG.SPEEDS[AI_CONFIG.DEFAULT_SPEED.toUpperCase() as keyof typeof AI_CONFIG.SPEEDS]
	}

	setMode(mode: "player" | "ai" | "train"): void {
		switch (mode) {
			case "player":
				this.isAIMode = false
				this.isAITrainMode = false
				this.stop()
				break
			case "ai":
				this.isAIMode = true
				this.isAITrainMode = false
				this.start()
				break
			case "train":
				this.isAIMode = true
				this.isAITrainMode = true
				this.start()
				break
		}
	}

	setSpeed(speedId: SpeedType): void {
		if (speedId === AI_CONFIG.SPEEDS.STEP) {
			this.isStepMode = true
			this.aiSpeed = AI_CONFIG.SPEEDS.NORMAL
			this.pendingAIDecision = null
		} else {
			this.isStepMode = false
			this.aiSpeed = speedId
			const speedName = speedId === AI_CONFIG.SPEEDS.SLOW ? "慢速" :
				speedId === AI_CONFIG.SPEEDS.NORMAL ? "中速" :
					speedId === AI_CONFIG.SPEEDS.FAST ? "快速" : "极速"
		}

		if (this.isAIMode && (this.aiInterval || this.fastLoopId || this.isStepMode)) {
			this._startInterval()
		}
	}

	start(): void {
		if (!this.isAIMode) return
		if (this.game.gameStatus === GAME_STATUS.READY) {
			this.game.startGame()
		}
		this._startInterval()
	}

	stop(): void {
		this._stopInterval()
	}

	step(): void {
		if (!this.isAIMode || !this.isStepMode) return
		if (this.pendingAIDecision) {
			this._executePendingDecision()
		} else {
			this._makeDecisionPreview()
		}
	}

	recordResult(_finalStatus: "death" | "win"): void {
		const player = this.game.getState().player
		const steps = player.grid

		if (this.isAITrainMode && this.network) {
			if (this.performanceHistory.length >= this.windowSize) {
				this.performanceHistory.shift()
			}
			const currentAvg = this.performanceHistory.length > 0
				? this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length
				: steps
			this.performanceHistory.push(steps)

			if (this.network.exploreMode === "dynamic") {
				if (steps > currentAvg) {
					this.network.epsilon = Math.max(0.1, this.network.epsilon - 0.05)
				} else if (steps < currentAvg) {
					this.network.epsilon = Math.min(0.4, this.network.epsilon + 0.05)
				} else {
					this.network.epsilon = Math.max(0.1, this.network.epsilon - 0.01)
				}
			}

			const epsilon = this.network.getEpsilon()
		}
	}

	private _convertToInputs(terrainAhead: string[]): number[] {
		return [
			terrainAhead[0] === "pit" ? 1 : 0,
			terrainAhead[1] === "pit" ? 1 : 0,
			terrainAhead[2] === "pit" ? 1 : 0,
			terrainAhead[3] === "pit" ? 1 : 0
		]
	}

	private _canMakeDecision(): boolean {
		return this.game.gameStatus === GAME_STATUS.RUNNING &&
			this.game.getState().player.action === PLAYER_ACTION.IDLE
	}

	private _startInterval(): void {
		this._stopInterval()
		if (this.isStepMode) {
			return
		}
		if (this.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
			this._runFastLoop()
		} else {
			this.aiInterval = setInterval(() => {
				if (this._canMakeDecision()) this._makeDecision()
			}, this.aiSpeed as number)
		}
	}

	private _stopInterval(): void {
		if (this.aiInterval) {
			clearInterval(this.aiInterval)
			this.aiInterval = null
		}
		if (this.fastLoopId) {
			cancelAnimationFrame(this.fastLoopId)
			this.fastLoopId = null
		}
	}

	private _runFastLoop(): void {
		if (!this.isAIMode || this.isStepMode || this.aiSpeed !== AI_CONFIG.SPEEDS.MAX) {
			return
		}
		if (this._canMakeDecision()) {
			this._makeDecision()
		}
		this.fastLoopId = requestAnimationFrame(() => this._runFastLoop())
	}

	private _makeDecisionPreview(): void {
		if (!this.isAIMode || !this.network) return

		const state = this.game.getStateForAI()
		const inputs = this._convertToInputs(state.terrainAhead)

		const action = this.network.decide(inputs)
		const actionType = this._actionIndexToType(action)
		const scores = this.network.lastScores ? [...this.network.lastScores] : [0, 0, 0]

		this.pendingAIDecision = { action, actionType, inputs, scores }

		this._logDecision(action, scores)

		const { previewReward, willDie } = this._predictResult(action, state.terrainAhead)
		this._logPrediction(action, willDie)
		
		const { changes } = this.network.previewTrain(previewReward, action, inputs)

		if (this.onRenderView) {
			this.onRenderView(inputs, action, true, changes)
		}
	}

	private _predictResult(action: number, terrainAhead: string[]): { previewReward: number, willDie: boolean } {
		const actionJumpGrids = [0, 1, 2]
		const landingGrid = actionJumpGrids[action]
		
		const willDie = terrainAhead[landingGrid] === "pit"
		const previewReward = willDie ? AI_CONFIG.DEATH_REWARD : AI_CONFIG.STEP_REWARD
		
		return { previewReward, willDie }
	}

	private _logDecision(_action: number, _scores: number[]): void {
		// 决策日志已禁用
	}

	private _logPrediction(_action: number, willDie: boolean): void {
		// 预测结果日志（当前静默处理）
		if (willDie) {
			// 预测到会死亡
		} else {
			// 预测存活
		}
	}

	private _executePendingDecision(): void {
		if (!this.pendingAIDecision) return

		const { actionType, inputs, action } = this.pendingAIDecision

		const result = this.game.execute(actionType)
		if (result) {
			const actionNames = ["移动", "跳跃", "远跳"]
		}

		this.pendingAIDecision = null
		if (this.onRenderView) {
			this.onRenderView(inputs, action, false, null)
		}
	}

	private _makeDecision(): void {
		if (!this.isAIMode || !this.network) return
		if (!this._canMakeDecision()) return

		const state = this.game.getStateForAI()
		const inputs = this._convertToInputs(state.terrainAhead)

		const action = this.network.decide(inputs)
		const actionType = this._actionIndexToType(action)

		this.game.execute(actionType)
	}

	private _actionIndexToType(action: number): ActionType {
		switch (action) {
			case 0: return ACTION.RIGHT
			case 1: return ACTION.JUMP
			case 2: return ACTION.LONG_JUMP
			default: return ACTION.RIGHT
		}
	}
}

export default AIController
