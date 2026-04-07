/**
 * UI 管理器
 * 负责所有 UI 更新、DOM 操作和控制面板渲染
 */

import { ACTION, GAME_STATUS, JumpGame, ActionType } from "@game/JumpGame.js"
import { formatTimeMs } from "@utils/timeUtils.js"
import { AIController } from "@ai/AIController.js"
import { PlayerBestStore } from "@ai/PlayerBestStore.js"
import { NeuronAreaManager } from "@views/NeuronAreaManager.js"
import { NeuralNetwork } from "@ai/NeuralNetwork.js"

interface UIManagerOptions {
	game: JumpGame
	aiController: AIController
	playerBestStore: PlayerBestStore
	viewManager: NeuronAreaManager
	network: NeuralNetwork
}

export class UIManager {
	private game: JumpGame
	aiController: AIController
	private playerBestStore: PlayerBestStore
	private viewManager: NeuronAreaManager
	private network: NeuralNetwork
	private _lastGrid: number = -1

	constructor({ game, aiController, playerBestStore, viewManager, network }: UIManagerOptions) {
		this.game = game
		this.aiController = aiController
		this.playerBestStore = playerBestStore
		this.viewManager = viewManager
		this.network = network
	}

	// ========== 控制面板渲染 ==========

	bindPlayerBtn(btn: HTMLElement | null, action: ActionType): void {
		if (!btn) {
			return
		}
		const actionNames: Record<string, string> = { 
			[ACTION.RIGHT]: "移动", 
			[ACTION.JUMP]: "跳跃", 
			[ACTION.LONG_JUMP]: "远跳" 
		}
		
		const addActive = () => btn.classList.add("btn-pressed")
		const removeActive = () => btn.classList.remove("btn-pressed")
		
		btn.addEventListener("touchstart", addActive, { passive: true })
		btn.addEventListener("touchend", removeActive, { passive: true })
		btn.addEventListener("touchcancel", removeActive, { passive: true })
		btn.addEventListener("mousedown", addActive)
		btn.addEventListener("mouseup", removeActive)
		btn.addEventListener("mouseleave", removeActive)
		
		const handler = (e: Event) => {
			e.preventDefault()
			if (this.game.gameStatus === GAME_STATUS.RUNNING) {
				const result = this.game.execute(action)
			} else {
			}
		}
		btn.addEventListener("touchstart", handler, { passive: false })
		btn.addEventListener("mousedown", handler)
	}

	renderPlayerControls(controlArea: HTMLElement): void {
		controlArea.innerHTML = `
			<button class="btn" id="btn-right" ontouchstart="">
				▶
				<span class="btn-label">移动 (x+1)</span>
			</button>
			<button class="btn" id="btn-jump" ontouchstart="">
				⬆
				<span class="btn-label">跳跃 (x+2)</span>
			</button>
			<button class="btn" id="btn-long-jump" ontouchstart="">
				⤴
				<span class="btn-label">远跳 (x+3)</span>
			</button>
		`
		const btnRight = document.getElementById("btn-right")
		const btnJump = document.getElementById("btn-jump")
		const btnLongJump = document.getElementById("btn-long-jump")
		this.bindPlayerBtn(btnRight, ACTION.RIGHT)
		this.bindPlayerBtn(btnJump, ACTION.JUMP)
		this.bindPlayerBtn(btnLongJump, ACTION.LONG_JUMP)
	}

	renderStepControls(controlArea: HTMLElement): void {
		const pending = this.aiController.pendingAIDecision
		const actionNames = ["移动", "跳跃", "远跳"]
		const actionLabel = pending
			? (actionNames[pending.action] || "行动")
			: ""
		const btnText = (pending ? `行动-${actionLabel}` : "决策") + "(Space)"

		controlArea.innerHTML = `
			<button class="btn" id="btn-step" style="background: var(--color-btn-right); box-shadow: 0 8px 0 var(--color-btn-right-shadow); color: white;">
				⏭️
				<span class="btn-label">${btnText}</span>
			</button>
		`
		const btnStep = document.getElementById("btn-step")
		if (btnStep) {
			btnStep.addEventListener("click", () => this.aiController.step())
		}
	}

	renderAutoHint(controlArea: HTMLElement): void {
		controlArea.innerHTML = `
			<div style="color: #888; font-size: 14px; width: 100%; text-align: center;">🤖 AI自动运行中...</div>
		`
	}

	updateControlsUI(): void {
		const controlArea = document.getElementById("control-area")
		if (!controlArea) return

		if (!this.aiController.isAIMode) {
			this.renderPlayerControls(controlArea)
		} else if (this.aiController.isStepMode) {
			this.renderStepControls(controlArea)
		} else {
			this.renderAutoHint(controlArea)
		}
	}

	// ========== 遮罩控制 ==========

	showStartOverlay(): void {
		const overlay = document.getElementById("start-overlay")
		if (overlay) overlay.classList.remove("hidden")
		if (this.game.gameStatus !== GAME_STATUS.READY) {
			this.game.init()
		}
	}

	hideStartOverlay(): void {
		const overlay = document.getElementById("start-overlay")
		if (overlay) overlay.classList.add("hidden")
	}

	bindStartButton(onStart: () => void): void {
		const startBtn = document.getElementById("start-btn")
		if (startBtn) {
			startBtn.addEventListener("click", onStart)
		}
	}

	// ========== 游戏信息更新 ==========

	updateGameInfo(): void {
		const gameInfo = document.getElementById("game-info")
		if (!gameInfo) return

		const player = this.game.getState().player
		const currentTime = formatTimeMs(this.game.getElapsedTime())
		const bestTime = this.playerBestStore.getFormatted()

		gameInfo.innerHTML = `POS: <span id="pos-display">${player.grid}</span> | GEN: <span id="gen-display">${this.game.getState().generation}</span>${this.aiController.isAIMode ? "" : ` | TIME: ${currentTime} | BEST: ${bestTime}`}`

		if (player.grid !== this._lastGrid) {
			this._lastGrid = player.grid
		}
	}

	// ========== AI 视图渲染 ==========

	renderCurrentAIView(
		inputs: number[] | null = null, 
		action: number | null = null, 
		isPreview: boolean = false, 
		weightChanges: number[][][] | null = null
	): void {
		if (this.network) {
			this.viewManager.render(this.network, inputs, action, isPreview, false, weightChanges)
		}
	}
}

export default UIManager
