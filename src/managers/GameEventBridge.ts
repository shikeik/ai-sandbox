/**
 * 游戏事件桥接器
 * 桥接游戏核心事件与 UI/AI/渲染器的回调
 */

import { AI_CONFIG, AIController } from '@ai/AIController.js'
import { CONFIG, ACTION, JumpGame, PlayerState, CameraState, ActionType } from '@game/JumpGame.js'
import { GameRenderer } from '@render/GameRenderer.js'
import { TransitionManager } from '@render/TransitionManager.js'
import { UIManager } from './UIManager.js'
import { NeuralNetwork } from '@ai/NeuralNetwork.js'

interface Position {
	x: number
	y: number
}

interface GameEventBridgeOptions {
	game: JumpGame
	renderer: GameRenderer
	aiController: AIController
	network: NeuralNetwork
	transitionManager: TransitionManager
	uiManager: UIManager
	startTimerUpdate: () => void
	stopTimerUpdate: () => void
}

export class GameEventBridge {
	private game: JumpGame
	private renderer: GameRenderer
	private aiController: AIController
	private network: NeuralNetwork
	private transitionManager: TransitionManager
	private uiManager: UIManager
	private startTimerUpdate: () => void
	private stopTimerUpdate: () => void

	constructor({
		game,
		renderer,
		aiController,
		network,
		transitionManager,
		uiManager,
		startTimerUpdate,
		stopTimerUpdate
	}: GameEventBridgeOptions) {
		this.game = game
		this.renderer = renderer
		this.aiController = aiController
		this.network = network
		this.transitionManager = transitionManager
		this.uiManager = uiManager
		this.startTimerUpdate = startTimerUpdate
		this.stopTimerUpdate = stopTimerUpdate
	}

	bind(): void {
		console.log('[EVENT_BRIDGE]', '开始绑定游戏事件桥接...')

		this.game.onStateChange = (player: PlayerState, camera: CameraState) => {
			const posDisplay = document.getElementById('pos-display')
			if (posDisplay) posDisplay.textContent = String(player.grid)
		}

		this.game.onActionStart = (action: ActionType, from: Position, to: Position, isJump: boolean, result: string) => {
			console.log('[EVENT_BRIDGE]', `onActionStart | action=${action} isJump=${isJump} result=${result}`)
			console.log('[EVENT_BRIDGE]', `ACTION常量 | RIGHT=${ACTION.RIGHT} JUMP=${ACTION.JUMP} LONG_JUMP=${ACTION.LONG_JUMP}`)
			let duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION

			if (this.aiController.isAIMode && this.aiController.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
				duration = AI_CONFIG.ANIMATION.MAX_DURATION
			} else if (this.aiController.isAIMode && this.aiController.aiSpeed === AI_CONFIG.SPEEDS.FAST) {
				duration = AI_CONFIG.ANIMATION.FAST_DURATION
			}

			this.renderer.startActionTween(from, to, isJump, duration)

			if (this.aiController.isAITrainMode && this.network) {
				let actionIdx = 0
				if (action === ACTION.JUMP) actionIdx = 1
				else if (action === ACTION.LONG_JUMP) actionIdx = 2
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

		this.game.onGenerationChange = (gen: number) => {
			this.renderer.initWorld(this.game.getState().terrain)
			const state = this.game.getState()
			this.renderer.syncVisualToLogical(state.player)
			this.renderer.updateCamera(state.camera)
			this.renderer.updateGeneration(gen)
			this.renderer.resetPlayer()

			this.uiManager.renderCurrentAIView()
			this.uiManager.updateGameInfo()
		}

		this.game.onTransitionStart = (onMidPoint: () => void, onComplete: () => void) => {
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
			this.aiController.recordResult('death')
			if (!this.aiController.isAIMode) this.stopTimerUpdate()
		}

		this.game.onWin = () => {
			this.renderer.showWin()
			this.aiController.recordResult('win')

			if (!this.aiController.isAITrainMode && !this.aiController.isAIMode) {
				this.stopTimerUpdate()
				const elapsed = this.game.getElapsedTime()
				// Note: playerBestStore is accessed through uiManager in the original
				// We need to check if this works correctly
				console.log('[RECORD]', '游戏胜利', elapsed)
				this.uiManager.updateGameInfo()
			}
		}

		console.log('[EVENT_BRIDGE]', '游戏事件桥接完成 | 绑定6个回调')
	}
}

export default GameEventBridge
