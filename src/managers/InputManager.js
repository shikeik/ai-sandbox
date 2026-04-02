/**
 * 输入管理器
 * 负责键盘输入和窗口大小调整事件处理
 */

import { ACTION, GAME_STATUS } from '@game/JumpGame.js'

export class InputManager {
	constructor({ game, aiController, EPS, onRenderView }) {
		this.game = game
		this.aiController = aiController
		this.EPS = EPS
		this.onRenderView = onRenderView

		this.handleKeyDown = this.handleKeyDown.bind(this)
		this.handleResize = this.handleResize.bind(this)
	}

	bind() {
		document.addEventListener('keydown', this.handleKeyDown)
		window.addEventListener('resize', this.handleResize)
		console.log('[INPUT]', '输入事件绑定完成')
	}

	unbind() {
		document.removeEventListener('keydown', this.handleKeyDown)
		window.removeEventListener('resize', this.handleResize)
		console.log('[INPUT]', '输入事件解绑完成')
	}

	handleKeyDown(e) {
		if (e.repeat) return

		// AI单步模式：空格键执行下一步
		if (this.aiController.isAIMode && this.aiController.isStepMode && e.key === ' ') {
			e.preventDefault()
			this.aiController.step()
			return
		}

		if (this.aiController.isAIMode) return
		if (this.game.gameStatus !== GAME_STATUS.RUNNING) return

		if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
			e.preventDefault()
			this.game.execute(ACTION.RIGHT)
		}
		if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
			e.preventDefault()
			this.game.execute(ACTION.JUMP)
		}
	}

	handleResize() {
		this.EPS.updateViewport()
		const isLandscape = window.innerWidth > window.innerHeight
		const realWidth = isLandscape ? window.innerHeight : window.innerWidth

		if (!this.game) {
			console.log('[RESIZE]', 'game 实例不存在，跳过窗口适配')
			return
		}

		this.game.setViewportSize(realWidth)
		// 注：renderer 更新由调用方处理
	}
}

export default InputManager
