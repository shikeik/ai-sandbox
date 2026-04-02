/**
 * 游戏事件桥接器
 * 桥接游戏核心事件与 UI/AI/渲染器的回调
 */

import { AI_CONFIG } from '@ai/AIController.js'
import { CONFIG } from '@game/JumpGame.js'

export class GameEventBridge {
	constructor({
		game,
		renderer,
		aiController,
		network,
		transitionManager,
		uiManager,
		startTimerUpdate,
		stopTimerUpdate
	}) {
		this.game = game
		this.renderer = renderer
		this.aiController = aiController
		this.network = network
		this.transitionManager = transitionManager
		this.uiManager = uiManager
		this.startTimerUpdate = startTimerUpdate
		this.stopTimerUpdate = stopTimerUpdate
	}

	bind() {
		console.log('[EVENT_BRIDGE]', '开始绑定游戏事件桥接...')

		this.game.onStateChange = (player, camera) => {
			const posDisplay = document.getElementById('pos-display')
			if (posDisplay) posDisplay.textContent = player.grid
		}

		this.game.onActionStart = (action, from, to, isJump, result) => {
			let duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION

			// 动态调整动画速度
			if (this.aiController.isAIMode && this.aiController.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
				duration = AI_CONFIG.ANIMATION.MAX_DURATION
			} else if (this.aiController.isAIMode && this.aiController.aiSpeed === AI_CONFIG.SPEEDS.FAST) {
				duration = AI_CONFIG.ANIMATION.FAST_DURATION
			}

			this.renderer.startActionTween(from, to, isJump, duration)

			// AI 训练模式：根据即时结果立即训练
			if (this.aiController.isAITrainMode && this.network) {
				const actionIdx = isJump ? 1 : 0
				this.network.lastAction = actionIdx

				if (result === 'death') {
					this.network.train(AI_CONFIG.DEATH_REWARD, actionIdx)
				} else if (result === 'win') {
					this.network.train(AI_CONFIG.WIN_REWARD, actionIdx)
				} else {
					this.network.train(AI_CONFIG.STEP_REWARD, actionIdx)
				}
				this.uiManager.renderCurrentAIView(
					this.network.lastState,
					actionIdx,
					false,
					this.network.lastWeightChanges
				)
			}
		}

		this.game.onGenerationChange = (gen) => {
			this.renderer.initWorld(this.game.getState().terrain)
			const state = this.game.getState()
			this.renderer.syncVisualToLogical(state.player)
			this.renderer.updateCamera(state.camera)
			this.renderer.updateGeneration(gen)
			this.renderer.resetPlayer()

			this.uiManager.renderCurrentAIView()
			this.uiManager.updateGameInfo()
		}

		this.game.onTransitionStart = (onMidPoint, onComplete) => {
			// 极速训练模式下跳过黑屏转场
			if (this.aiController.isAITrainMode && this.aiController.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
				onMidPoint()
				onComplete()
			} else {
				this.transitionManager.playRespawnTransition(onMidPoint, onComplete)
			}
		}

		this.game.onTransitionEnd = () => {
			if (!this.aiController.isAIMode) {
				this.game.startGame()
				this.startTimerUpdate()
			} else {
				this.game.startGame()
				this.aiController.start()
			}
		}

		this.game.onDeath = () => {
			this.renderer.showDeath()
			this.aiController.recordResult('dead')
			if (!this.aiController.isAIMode) this.stopTimerUpdate()
		}

		this.game.onWin = () => {
			this.renderer.showWin()
			this.aiController.recordResult('win')

			if (!this.aiController.isAITrainMode && !this.aiController.isAIMode) {
				this.stopTimerUpdate()
				const elapsed = this.game.getElapsedTime()
				if (this.uiManager.playerBestStore.tryUpdate(elapsed)) {
					console.log('[RECORD]', '新纪录！', this.uiManager.playerBestStore.getFormatted())
				}
				this.uiManager.updateGameInfo()
			}
		}

		console.log('[EVENT_BRIDGE]', '游戏事件桥接完成 | 绑定6个回调')
	}
}

export default GameEventBridge
