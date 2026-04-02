/**
 * AI 控制器
 * 封装所有 AI 决策、训练循环、速度控制与结果记录逻辑
 */

import { ACTION, GAME_STATUS, PLAYER_ACTION } from '@game/JumpGame.js'

export const AI_CONFIG = {
	STEP_REWARD: 0.02,
	DEATH_REWARD: -1,
	WIN_REWARD: 1,
	SPEEDS: {
		STEP: 'step',
		SLOW: 1000,
		NORMAL: 200,
		FAST: 50,
		MAX: 0
	},
	DEFAULT_SPEED: 'step',
	DEFAULT_MODE: 'player',
	ANIMATION: {
		MAX_DURATION: 16,   // 极速模式：约1帧完成动画
		FAST_DURATION: 50   // 快速模式动画时长(ms)
	},
	TIMER_INTERVAL: 100   // 游戏信息刷新间隔(ms)
}

export class AIController {
	constructor({ game, network, onRenderView }) {
		this.game = game
		this.network = network
		this.onRenderView = onRenderView

		this.isAIMode = false
		this.isAITrainMode = false
		this.isStepMode = AI_CONFIG.DEFAULT_SPEED === 'step'
		this.aiSpeed = this.isStepMode ? AI_CONFIG.SPEEDS.NORMAL : AI_CONFIG.SPEEDS[AI_CONFIG.DEFAULT_SPEED.toUpperCase()]
		this.aiInterval = null
		this.fastLoopId = null
		this.pendingAIDecision = null
		this.performanceHistory = []
		this.windowSize = 5
	}

	setMode(mode) {
		switch (mode) {
			case 'player':
				this.isAIMode = false
				this.isAITrainMode = false
				this.stop()
				console.log('[UI]', '切换到玩家模式')
				break
			case 'ai':
				this.isAIMode = true
				this.isAITrainMode = false
				this.start()
				console.log('[AI]', '切换到AI模式')
				break
			case 'train':
				this.isAIMode = true
				this.isAITrainMode = true
				this.start()
				console.log('[AI]', '切换到AI训练模式（自动循环并更新权重）')
				break
		}
	}

	setSpeed(speedId) {
		if (speedId === AI_CONFIG.SPEEDS.STEP) {
			this.isStepMode = true
			this.aiSpeed = AI_CONFIG.SPEEDS.NORMAL
			this.pendingAIDecision = null
			console.log('[AI]', '切换到单步模式')
		} else {
			this.isStepMode = false
			this.aiSpeed = speedId
			const speedName = speedId === AI_CONFIG.SPEEDS.SLOW ? '慢速' :
				speedId === AI_CONFIG.SPEEDS.NORMAL ? '中速' :
					speedId === AI_CONFIG.SPEEDS.FAST ? '快速' : '极速'
			console.log('[AI]', `切换到${speedName}`)
		}

		if (this.isAIMode && (this.aiInterval || this.fastLoopId || this.isStepMode)) {
			this._startInterval()
		}
	}

	start() {
		if (!this.isAIMode) return
		if (this.game.gameStatus === GAME_STATUS.READY) {
			this.game.startGame()
		}
		this._startInterval()
	}

	stop() {
		this._stopInterval()
	}

	step() {
		if (!this.isAIMode || !this.isStepMode) return
		if (this.pendingAIDecision) {
			this._executePendingDecision()
		} else {
			this._makeDecisionPreview()
		}
	}

	recordResult(finalStatus) {
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

			if (this.network.autoAdjustEpsilon) {
				if (steps > currentAvg) {
					this.network.epsilon = Math.max(0.1, this.network.epsilon - 0.05)
				} else if (steps < currentAvg) {
					this.network.epsilon = Math.min(0.4, this.network.epsilon + 0.05)
				} else {
					this.network.epsilon = Math.max(0.1, this.network.epsilon - 0.01)
				}
			}

			console.log('[AI]', `窗口平均:${currentAvg.toFixed(1)} | 本局:${steps} | 新好奇心(ε):${this.network.epsilon.toFixed(2)}`)
		}
	}

	_convertToInputs(terrainAhead) {
		return [
			terrainAhead[0] === 'pit' ? 1 : 0,
			terrainAhead[1] === 'pit' ? 1 : 0,
			terrainAhead[2] === 'pit' ? 1 : 0
		]
	}

	_canMakeDecision() {
		return this.game.gameStatus === GAME_STATUS.RUNNING &&
			this.game.getState().player.action === PLAYER_ACTION.IDLE
	}

	_startInterval() {
		this._stopInterval()
		if (this.isStepMode) return
		if (this.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
			this._runFastLoop()
		} else {
			this.aiInterval = setInterval(() => {
				if (this._canMakeDecision()) this._makeDecision()
			}, this.aiSpeed)
		}
	}

	_stopInterval() {
		if (this.aiInterval) {
			clearInterval(this.aiInterval)
			this.aiInterval = null
		}
		if (this.fastLoopId) {
			cancelAnimationFrame(this.fastLoopId)
			this.fastLoopId = null
		}
	}

	_runFastLoop() {
		if (!this.isAIMode || this.isStepMode || this.aiSpeed !== AI_CONFIG.SPEEDS.MAX) return
		if (this._canMakeDecision()) {
			this._makeDecision()
		}
		this.fastLoopId = requestAnimationFrame(() => this._runFastLoop())
	}

	_makeDecisionPreview() {
		if (!this.isAIMode || !this.network) return

		const state = this.game.getStateForAI()
		const inputs = this._convertToInputs(state.terrainAhead)

		const action = this.network.decide(inputs)
		const actionType = action === 1 ? ACTION.JUMP : ACTION.RIGHT
		const scores = this.network.lastScores ? [...this.network.lastScores] : [0, 0]

		this.pendingAIDecision = { action, actionType, inputs, scores }

		const scoreLog = `移动:${scores[0].toFixed(2)} 跳跃:${scores[1].toFixed(2)}`
		const chosen = action === 1 ? '跳跃' : '移动'
		console.log('[AI]', `决策完成 | ${scoreLog} | 选中=[${chosen}] | 探索=${this.network.isExploring ? '是' : '否'}`)

		if (this.onRenderView) {
			this.onRenderView(inputs, action, true)
		}
	}

	_executePendingDecision() {
		if (!this.pendingAIDecision) return

		const { actionType, inputs, action } = this.pendingAIDecision

		const result = this.game.execute(actionType)
		if (result) {
			console.log('[AI]', `执行动作 | 动作=${actionType === ACTION.JUMP ? '跳跃' : '移动'}`)
		}

		this.pendingAIDecision = null
		if (this.onRenderView) {
			this.onRenderView(inputs, action, false, this.network ? this.network.lastWeightChanges : null)
		}
	}

	_makeDecision() {
		if (!this.isAIMode || !this.network) return
		if (!this._canMakeDecision()) return

		const state = this.game.getStateForAI()
		const inputs = this._convertToInputs(state.terrainAhead)

		const action = this.network.decide(inputs)
		const actionType = action === 1 ? ACTION.JUMP : ACTION.RIGHT

		this.game.execute(actionType)
	}
}

export default AIController
