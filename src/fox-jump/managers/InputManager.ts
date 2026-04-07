/**
 * 输入管理器
 * 负责键盘输入和窗口大小调整事件处理
 */

import { ACTION, GAME_STATUS, JumpGame } from "@game/JumpGame.js"
import { AIController } from "@ai/AIController.js"

interface InputManagerOptions {
	game: JumpGame
	aiController: AIController
	EPS: { updateViewport: () => void }
	onRenderView: (inputs: number[], action: number | null) => void
}

export class InputManager {
	private game: JumpGame
	private aiController: AIController
	private EPS: { updateViewport: () => void }
	onRenderView: (inputs: number[], action: number | null) => void

	constructor({ game, aiController, EPS, onRenderView }: InputManagerOptions) {
		this.game = game
		this.aiController = aiController
		this.EPS = EPS
		this.onRenderView = onRenderView

		this.handleKeyDown = this.handleKeyDown.bind(this)
		this.handleResize = this.handleResize.bind(this)
	}

	bind(): void {
		document.addEventListener("keydown", this.handleKeyDown)
		window.addEventListener("resize", this.handleResize)
	}

	unbind(): void {
		document.removeEventListener("keydown", this.handleKeyDown)
		window.removeEventListener("resize", this.handleResize)
	}

	handleKeyDown(e: KeyboardEvent): void {
		if (e.repeat) return

		if (this.aiController.isAIMode && this.aiController.isStepMode && e.key === " ") {
			e.preventDefault()
			this.aiController.step()
			return
		}

		if (this.aiController.isAIMode) return
		if (this.game.gameStatus !== GAME_STATUS.RUNNING) return

		if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
			e.preventDefault()
			this.game.execute(ACTION.RIGHT)
		}
		if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
			e.preventDefault()
			this.game.execute(ACTION.JUMP)
		}
		if (e.key === "ArrowDown" || e.key === "s" || e.key === "S" || e.key === "e" || e.key === "E") {
			e.preventDefault()
			this.game.execute(ACTION.LONG_JUMP)
		}
	}

	handleResize(): void {
		this.EPS.updateViewport()
		const isLandscape = window.innerWidth > window.innerHeight
		const realWidth = isLandscape ? window.innerHeight : window.innerWidth

		this.game.setViewportSize(realWidth)
	}
}

export default InputManager
