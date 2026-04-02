/**
 * UI 管理器
 * 负责所有 UI 更新、DOM 操作和控制面板渲染
 */

import { ACTION, GAME_STATUS } from '@game/JumpGame.js'
import { formatTimeMs } from '@utils/timeUtils.js'

export class UIManager {
	constructor({ game, aiController, playerBestStore, viewManager, network }) {
		this.game = game
		this.aiController = aiController
		this.playerBestStore = playerBestStore
		this.viewManager = viewManager
		this.network = network
		console.log('[UI_MANAGER]', 'UI管理器初始化完成')
	}

	// ========== 控制面板渲染 ==========

	bindPlayerBtn(btn, action) {
		if (!btn) return
		const handler = (e) => {
			e.preventDefault()
			if (this.game.gameStatus === GAME_STATUS.RUNNING) {
				this.game.execute(action)
			}
		}
		btn.addEventListener('touchstart', handler, { passive: false })
		btn.addEventListener('mousedown', handler)
	}

	renderPlayerControls(controlArea) {
		console.log('[CONTROLS]', '渲染玩家模式按钮 | 右移+跳跃')
		controlArea.innerHTML = `
			<button class="btn" id="btn-right">
				▶
				<span class="btn-label">移动 (x+1)</span>
			</button>
			<button class="btn" id="btn-jump">
				⬆
				<span class="btn-label">跳跃 (x+2)</span>
			</button>
		`
		const btnRight = document.getElementById('btn-right')
		const btnJump = document.getElementById('btn-jump')
		this.bindPlayerBtn(btnRight, ACTION.RIGHT)
		this.bindPlayerBtn(btnJump, ACTION.JUMP)
	}

	renderStepControls(controlArea) {
		console.log('[CONTROLS]', '渲染单步模式按钮 | 决策/执行')
		const pending = this.aiController.pendingAIDecision
		const actionLabel = pending
			? (pending.actionType === ACTION.JUMP ? '跳跃' : '移动')
			: ''
		const btnText = (pending ? `行动-${actionLabel}` : '决策') + '(Space)'

		controlArea.innerHTML = `
			<button class="btn" id="btn-step" style="background: var(--color-btn-right); box-shadow: 0 8px 0 var(--color-btn-right-shadow); color: white;">
				⏭️
				<span class="btn-label">${btnText}</span>
			</button>
		`
		const btnStep = document.getElementById('btn-step')
		if (btnStep) {
			btnStep.addEventListener('click', () => this.aiController.step())
		}
	}

	renderAutoHint(controlArea) {
		console.log('[CONTROLS]', '渲染自动模式提示 | AI运行中')
		controlArea.innerHTML = `
			<div style="color: #888; font-size: 14px; width: 100%; text-align: center;">🤖 AI自动运行中...</div>
		`
	}

	updateControlsUI() {
		const controlArea = document.getElementById('control-area')
		if (!controlArea) return

		if (!this.aiController.isAIMode) {
			console.log('[CONTROLS]', 'UI路由 | 玩家模式 → renderPlayerControls')
			this.renderPlayerControls(controlArea)
		} else if (this.aiController.isStepMode) {
			console.log('[CONTROLS]', 'UI路由 | 单步模式 → renderStepControls')
			this.renderStepControls(controlArea)
		} else {
			console.log('[CONTROLS]', 'UI路由 | 自动模式 → renderAutoHint')
			this.renderAutoHint(controlArea)
		}
	}

	// ========== 遮罩控制 ==========

	showStartOverlay() {
		const overlay = document.getElementById('start-overlay')
		if (overlay) overlay.classList.remove('hidden')
		if (this.game.gameStatus !== GAME_STATUS.READY) {
			this.game.init()
		}
	}

	hideStartOverlay() {
		const overlay = document.getElementById('start-overlay')
		if (overlay) overlay.classList.add('hidden')
	}

	bindStartButton(onStart) {
		const startBtn = document.getElementById('start-btn')
		if (startBtn) {
			startBtn.addEventListener('click', onStart)
			console.log('[UI_MANAGER]', '开始按钮绑定完成')
		}
	}

	// ========== 游戏信息更新 ==========

	updateGameInfo() {
		const gameInfo = document.getElementById('game-info')
		if (!gameInfo) return

		const player = this.game.getState().player
		const currentTime = formatTimeMs(this.game.getElapsedTime())
		const bestTime = this.playerBestStore.getFormatted()

		gameInfo.innerHTML = `POS: <span id="pos-display">${player.grid}</span> | GEN: <span id="gen-display">${this.game.getState().generation}</span>${this.aiController.isAIMode ? '' : ` | TIME: ${currentTime} | BEST: ${bestTime}`}`
		console.log('[UI_MANAGER]', `游戏信息更新 | 位置=${player.grid} 世代=${this.game.getState().generation}`)
	}

	// ========== AI 视图渲染 ==========

	renderCurrentAIView(inputs = null, action = null, isPreview = false, weightChanges = null) {
		if (this.network) {
			this.viewManager.render(this.network, inputs, action, isPreview, false, weightChanges)
		}
	}
}

export default UIManager
