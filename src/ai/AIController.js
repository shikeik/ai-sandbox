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
		console.log('[AI]', `启动 | 模式=${this.isAITrainMode ? '训练' : '观察'} | 速度=${this.aiSpeed}ms | 单步=${this.isStepMode}`)
		if (this.game.gameStatus === GAME_STATUS.READY) {
			this.game.startGame()
		}
		this._startInterval()
	}

	stop() {
		console.log('[AI]', '停止')
		this._stopInterval()
	}

	step() {
		if (!this.isAIMode || !this.isStepMode) return
		if (this.pendingAIDecision) {
			console.log('[AI]', '单步: 执行缓存决策')
			this._executePendingDecision()
		} else {
			console.log('[AI]', '单步: 生成新决策')
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

			/**
			 * 动态探索率调整（仅在 dynamic 模式下生效）
			 * 原理：表现好就多利用经验，表现差就多探索随机策略
			 * - 步数 > 窗口平均（表现好）→ 降低探索率，相信已有经验
			 * - 步数 < 窗口平均（表现差）→ 提高探索率，尝试新策略
			 */
			if (this.network.exploreMode === 'dynamic') {
				if (steps > currentAvg) {
					this.network.epsilon = Math.max(0.1, this.network.epsilon - 0.05)
				} else if (steps < currentAvg) {
					this.network.epsilon = Math.min(0.4, this.network.epsilon + 0.05)
				} else {
					this.network.epsilon = Math.max(0.1, this.network.epsilon - 0.01)
				}
			}

			const epsilon = this.network.getEpsilon()
			console.log('[AI]', `窗口平均:${currentAvg.toFixed(1)} | 本局:${steps} | 探索率(ε):${epsilon.toFixed(2)} | 模式:${this.network.exploreMode}`)
		}
	}

	_convertToInputs(terrainAhead) {
		return [
			terrainAhead[0] === 'pit' ? 1 : 0,
			terrainAhead[1] === 'pit' ? 1 : 0,
			terrainAhead[2] === 'pit' ? 1 : 0,
			terrainAhead[3] === 'pit' ? 1 : 0
		]
	}

	_canMakeDecision() {
		return this.game.gameStatus === GAME_STATUS.RUNNING &&
			this.game.getState().player.action === PLAYER_ACTION.IDLE
	}

	_startInterval() {
		this._stopInterval()
		if (this.isStepMode) {
			console.log('[AI]', '区间: 单步模式，不启动自动循环')
			return
		}
		if (this.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
			console.log('[AI]', '区间: 启动极速循环 (requestAnimationFrame)')
			this._runFastLoop()
		} else {
			console.log('[AI]', `区间: 启动定时器 ${this.aiSpeed}ms`)
			this.aiInterval = setInterval(() => {
				if (this._canMakeDecision()) this._makeDecision()
			}, this.aiSpeed)
		}
	}

	_stopInterval() {
		if (this.aiInterval) {
			console.log('[AI]', '区间: 清除定时器')
			clearInterval(this.aiInterval)
			this.aiInterval = null
		}
		if (this.fastLoopId) {
			console.log('[AI]', '区间: 取消极速循环')
			cancelAnimationFrame(this.fastLoopId)
			this.fastLoopId = null
		}
	}

	_runFastLoop() {
		if (!this.isAIMode || this.isStepMode || this.aiSpeed !== AI_CONFIG.SPEEDS.MAX) {
			console.log('[AI]', '极速循环: 条件不满足，退出')
			return
		}
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
		const actionType = this._actionIndexToType(action)
		const scores = this.network.lastScores ? [...this.network.lastScores] : [0, 0, 0]

		this.pendingAIDecision = { action, actionType, inputs, scores }

		const actionNames = ['移动', '跳跃', '远跳']
		const scoreLog = `移动:${scores[0].toFixed(2)} 跳跃:${scores[1].toFixed(2)} 远跳:${scores[2].toFixed(2)}`
		const chosen = actionNames[action] || '未知'
		console.log('[AI]', `决策完成 | ${scoreLog} | 选中=[${chosen}] | 探索=${this.network.isExploring ? '是' : '否'}`)

		// 预览权重变化（决策时显示高亮）
		// 预测执行结果：检查是否会死亡
		let previewReward = AI_CONFIG.STEP_REWARD
		const terrainAhead = state.terrainAhead
		let willDie = false
		
		if (action === 0 && terrainAhead[0] === 'pit') {
			willDie = true  // 移动，前一格是坑
		} else if (action === 1 && terrainAhead[1] === 'pit') {
			willDie = true  // 跳跃，前两格是坑
		} else if (action === 2 && terrainAhead[2] === 'pit') {
			willDie = true  // 远跳，前三格是坑
		}
		
		if (willDie) {
			previewReward = AI_CONFIG.DEATH_REWARD  // -1，预览显示粉红（减分）
			console.log('[AI]', `决策预览预测 | 动作=${action} 预测结果=死亡 使用DEATH_REWARD`)
		} else {
			console.log('[AI]', `决策预览预测 | 动作=${action} 预测结果=存活 使用STEP_REWARD`)
		}
		
		const { changes } = this.network.previewTrain(previewReward, action, inputs)
		console.log('[AI]', `决策预览 | reward=${previewReward} changes=${changes ? '有' : '无'} 变化量总数=${changes ? changes[0].flat().length : 0}`)

		if (this.onRenderView) {
			console.log('[AI]', `调用 onRenderView | isPreview=true changes=${changes ? '有' : '无'}`)
			this.onRenderView(inputs, action, true, changes)
		}
	}

	_executePendingDecision() {
		if (!this.pendingAIDecision) return

		const { actionType, inputs, action } = this.pendingAIDecision

		const result = this.game.execute(actionType)
		if (result) {
			const actionNames = ['移动', '跳跃', '远跳']
			console.log('[AI]', `执行动作 | 动作=${actionNames[action] || actionType}`)
		}

		this.pendingAIDecision = null
		// 执行后不显示高亮（传 null），实际权重更新在 onActionStart 中处理
		if (this.onRenderView) {
			this.onRenderView(inputs, action, false, null)
		}
	}

	_makeDecision() {
		if (!this.isAIMode || !this.network) return
		if (!this._canMakeDecision()) return

		const state = this.game.getStateForAI()
		const inputs = this._convertToInputs(state.terrainAhead)

		const action = this.network.decide(inputs)
		const actionType = this._actionIndexToType(action)

		console.log('[AI]', `自动执行 | 动作=${actionType} | 输入=[${inputs.join(',')}]`)
		this.game.execute(actionType)
	}

	_actionIndexToType(action) {
		switch (action) {
			case 0: return ACTION.RIGHT
			case 1: return ACTION.JUMP
			case 2: return ACTION.LONG_JUMP
			default: return ACTION.RIGHT
		}
	}
}

export default AIController
