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
		console.log("INPUT", "输入事件绑定完成")
	}

	unbind(): void {
		document.removeEventListener("keydown", this.handleKeyDown)
		window.removeEventListener("resize", this.handleResize)
		console.log("INPUT", "输入事件解绑完成")
	}

	handleKeyDown(e: KeyboardEvent): void {
		if (e.repeat) return

		if (this.aiController.isAIMode && this.aiController.isStepMode && e.key === " ") {
			e.preventDefault()
			console.log("INPUT", "空格键触发单步执行")
			this.aiController.step()
			return
		}

		if (this.aiController.isAIMode) return
		if (this.game.gameStatus !== GAME_STATUS.RUNNING) return

		if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
			e.preventDefault()
			console.log("INPUT", "键盘右移")
			this.game.execute(ACTION.RIGHT)
		}
		if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
			e.preventDefault()
			console.log("INPUT", "键盘跳跃")
			this.game.execute(ACTION.JUMP)
		}
		if (e.key === "ArrowDown" || e.key === "s" || e.key === "S" || e.key === "e" || e.key === "E") {
			e.preventDefault()
			console.log("INPUT", "键盘远跳")
			this.game.execute(ACTION.LONG_JUMP)
		}
	}

	handleResize(): void {
		this.EPS.updateViewport()
		const isLandscape = window.innerWidth > window.innerHeight
		const realWidth = isLandscape ? window.innerHeight : window.innerWidth

		console.log("INPUT", `窗口大小调整 | 宽度=${realWidth}px 横屏=${isLandscape}`)
		this.game.setViewportSize(realWidth)
	}
}

export default InputManager
