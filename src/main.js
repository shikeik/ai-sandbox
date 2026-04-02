/**
 * 游戏入口文件
 * 连接游戏逻辑、渲染、AI控制和视图
 */

import { JumpGame, ACTION, CONFIG, GAME_STATUS, PLAYER_ACTION } from '@game/JumpGame.js'
import { formatTimeMs } from '@utils/timeUtils.js'
import { GameRenderer } from '@render/GameRenderer.js'
import { TransitionManager } from '@render/TransitionManager.js'
import { NeuralNetwork } from '@ai/NeuralNetwork.js'
import { AIController, AI_CONFIG } from '@ai/AIController.js'
import { PlayerBestStore } from '@ai/PlayerBestStore.js'
import { NeuronAreaManager } from '@views/NeuronAreaManager.js'
import { ConsolePanel } from '@views/ConsolePanel.js'
import './style.css'
import './style-fox.css'
import EPS from './eps.js'

// ========== 全局实例 ==========
let game = null
let renderer = null
let transitionManager = null
let network = null
let playerBestStore = null
let viewManager = null
let consolePanel = null
let timerInterval = null

let aiController = null

// 根据默认速度初始化（用于外部视图兼容）
const isStepModeByDefault = AI_CONFIG.DEFAULT_SPEED === 'step'
const aiSpeed = isStepModeByDefault ? AI_CONFIG.SPEEDS.NORMAL : AI_CONFIG.SPEEDS[AI_CONFIG.DEFAULT_SPEED.toUpperCase()]
const isStepMode = isStepModeByDefault


// ========== DOM 元素 ==========
const gameArea = document.getElementById('game-area')

// ========== 初始化 ==========
function init() {
	// 先初始化控制台面板，确保后续所有日志都能被捕获
	consolePanel = new ConsolePanel()
	consolePanel.init()

	EPS.init()
	game = new JumpGame()
	renderer = new GameRenderer('game-world')
	renderer.setGame(game)
	
	// 创建神经网络（3输入 → 2输出）
	network = new NeuralNetwork({
		layerSizes: [3, 2],
		learningRate: 0.2,
		weightClip: 5
	})
	window.network = network
	window.AI_CONFIG = AI_CONFIG  // 暴露配置给视图使用
	
	playerBestStore = new PlayerBestStore()
	viewManager = new NeuronAreaManager('neuron-area')
	transitionManager = new TransitionManager('game-area')
	
	// 初始化 AI 控制器
	aiController = new AIController({
		game,
		network,
		onRenderView: (inputs, action, isPreview, weightChanges) => {
			renderCurrentAIView(inputs, action, isPreview, weightChanges)
		}
	})
	
	// 设置模式切换回调
	viewManager.onModeChange = (mode) => {
		aiController.setMode(mode)
		updateControlsUI()
	}

	// 【修复 Bug 1】：监听视图切换，要求立即重绘画布
	viewManager.onViewChange = (viewName) => {
		const state = game.getStateForAI()
		const inputs = [
			state.terrainAhead[0] === 'pit' ? 1 : 0,
			state.terrainAhead[1] === 'pit' ? 1 : 0,
			state.terrainAhead[2] === 'pit' ? 1 : 0
		]
		renderCurrentAIView(inputs, network ? network.lastAction : null)
	}

	// 设置速度切换回调
	viewManager.onSpeedChange = (speedId) => {
		switch(speedId) {
			case 'step': aiController.setSpeed(AI_CONFIG.SPEEDS.STEP); break
			case 'slow': aiController.setSpeed(AI_CONFIG.SPEEDS.SLOW); break
			case 'normal': aiController.setSpeed(AI_CONFIG.SPEEDS.NORMAL); break
			case 'fast': aiController.setSpeed(AI_CONFIG.SPEEDS.FAST); break
			case 'max': aiController.setSpeed(AI_CONFIG.SPEEDS.MAX); break
		}
		updateControlsUI()
	}
	
	game.setViewportSize(gameArea.clientWidth)
	bindGameEvents()
	game.init()
	renderer.initWorld(game.getState().terrain)
	
	const state = game.getState()
	renderer.syncVisualToLogical(state.player)
	renderer.updateCamera(state.camera)
	renderer.updateGeneration(state.generation)
	
	// 动态构建控制面板并绑定按键
	updateControlsUI()
	document.addEventListener('keydown', handleKeyDown)
	window.addEventListener('resize', handleResize)
	
	if (aiController.isAIMode) {
		aiController.start()
	}
	
	renderCurrentAIView()
	updateGameInfo()
	bindStartButton()
	showStartOverlay()
	// 初始化时清空单步缓存
	if (aiController) aiController.pendingAIDecision = null
	
	console.log('[GAME]', 'AI 训练沙盘已初始化，等待开始...')
	console.log('[GAME]', 'AI模式:', aiController.isAIMode ? '开启' : '关闭')

	// --- 控制栏按钮 ---
	const btnToggle = document.getElementById('btn-toggle')
	const btnFullscreen = document.getElementById('btn-fullscreen')
	const btnConsole = document.getElementById('btn-console')
	if (btnToggle) {
		btnToggle.classList.toggle('active', EPS.isActive())
		btnToggle.addEventListener('click', () => {
			EPS.toggle()
			btnToggle.classList.toggle('active', EPS.isActive())
			console.log('[EPS]', 'EPS:', EPS.isActive() ? 'ON' : 'OFF')
		})
	}
	if (btnFullscreen) {
		const updateFullscreenBtn = () => {
			btnFullscreen.classList.toggle('active', !!document.fullscreenElement)
		}
		document.addEventListener('fullscreenchange', updateFullscreenBtn)
		document.addEventListener('webkitfullscreenchange', updateFullscreenBtn)
		btnFullscreen.addEventListener('click', () => {
			EPS.fullscreen()
		})
	}
	if (btnConsole) {
		btnConsole.addEventListener('click', () => {
			consolePanel.toggle()
		})
	}
	// ------------------

}

// ========== 动态 UI 控制面板 ==========

function bindPlayerBtn(btn, action) {
	if (!btn) return
	const handler = (e) => {
		e.preventDefault()
		if (game.gameStatus === GAME_STATUS.RUNNING) game.execute(action)
	}
	// 同时绑定 touchstart 和 mousedown，确保移动设备多点触控和桌面点击都能即时响应
	btn.addEventListener('touchstart', handler, { passive: false })
	btn.addEventListener('mousedown', handler)
}

/**
 * 渲染玩家模式控制按钮（右移/跳跃）
 * @param {HTMLElement} controlArea - 控制区域容器
 */
function renderPlayerControls(controlArea) {
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
	bindPlayerBtn(btnRight, ACTION.RIGHT)
	bindPlayerBtn(btnJump, ACTION.JUMP)
}

/**
 * 渲染单步模式控制按钮（决策/执行）
 * @param {HTMLElement} controlArea - 控制区域容器
 */
function renderStepControls(controlArea) {
	const pending = aiController.pendingAIDecision
	const actionLabel = pending ? (pending.actionType === ACTION.JUMP ? '跳跃' : '移动') : ''
	const btnText = (pending ? `行动-${actionLabel}` : '决策') + '(Space)'

	controlArea.innerHTML = `
		<button class="btn" id="btn-step" style="background: var(--color-btn-right); box-shadow: 0 8px 0 var(--color-btn-right-shadow); color: white;">
			⏭️
			<span class="btn-label">${btnText}</span>
		</button>
	`
	const btnStep = document.getElementById('btn-step')
	if (btnStep) btnStep.addEventListener('click', () => aiController.step())
}

/**
 * 渲染 AI 自动模式提示
 * @param {HTMLElement} controlArea - 控制区域容器
 */
function renderAutoHint(controlArea) {
	controlArea.innerHTML = `
		<div style="color: #888; font-size: 14px; width: 100%; text-align: center;">🤖 AI自动运行中...</div>
	`
}

/**
 * 更新控制面板 UI（根据当前模式路由到具体渲染函数）
 */
function updateControlsUI() {
	const controlArea = document.getElementById('control-area')
	if (!controlArea) return

	// 玩家模式：显示操作按钮
	if (!aiController.isAIMode) {
		renderPlayerControls(controlArea)
	}
	// AI 模式
	else if (aiController.isStepMode) {
		renderStepControls(controlArea)
	}
	// 自动运行模式
	else {
		renderAutoHint(controlArea)
	}
}

// ========== 开始游戏遮罩控制 ==========
function showStartOverlay() {
	const overlay = document.getElementById('start-overlay')
	if (overlay) overlay.classList.remove('hidden')
	if (game.gameStatus !== GAME_STATUS.READY) game.init()
}

function hideStartOverlay() {
	const overlay = document.getElementById('start-overlay')
	if (overlay) overlay.classList.add('hidden')
}

function onGameStart() {
	game.startGame()
	hideStartOverlay()
	if (!aiController.isAIMode) {
		startTimerUpdate()
	} else {
		aiController.start()
	}
}

function bindStartButton() {
	const startBtn = document.getElementById('start-btn')
	if (startBtn) startBtn.addEventListener('click', onGameStart)
}

// ========== 事件绑定 ==========
function bindGameEvents() {
	game.onStateChange = (player, camera) => {
		const posDisplay = document.getElementById('pos-display')
		if (posDisplay) posDisplay.textContent = player.grid
	}
	
	game.onActionStart = (action, from, to, isJump, result) => {
		let duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION
	
		// 动态调整动画速度
		if (aiController.isAIMode && aiController.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
			duration = AI_CONFIG.ANIMATION.MAX_DURATION
		} else if (aiController.isAIMode && aiController.aiSpeed === AI_CONFIG.SPEEDS.FAST) {
			duration = AI_CONFIG.ANIMATION.FAST_DURATION
		}
	
		renderer.startActionTween(from, to, isJump, duration)
	
		// AI 训练模式：根据即时结果立即训练
		if (aiController.isAITrainMode && network) {
			const actionIdx = isJump ? 1 : 0
			network.lastAction = actionIdx
		
			// 即时判定结果并训练
			if (result === 'death') {
				network.train(AI_CONFIG.DEATH_REWARD, actionIdx)
			} else if (result === 'win') {
				network.train(AI_CONFIG.WIN_REWARD, actionIdx)
			} else {
				network.train(AI_CONFIG.STEP_REWARD, actionIdx)
			}
			renderCurrentAIView(network.lastState, actionIdx, false, network.lastWeightChanges)
		}
	}
	
	game.onGenerationChange = (gen) => {
		renderer.initWorld(game.getState().terrain)
		const state = game.getState()
		renderer.syncVisualToLogical(state.player)
		renderer.updateCamera(state.camera)
		renderer.updateGeneration(gen)
		renderer.resetPlayer()
	
		renderCurrentAIView()
		updateGameInfo()
	}
	
	game.onTransitionStart = (onMidPoint, onComplete) => {
	// 极速训练模式下跳过黑屏转场，实现超高速训练
		if (aiController.isAITrainMode && aiController.aiSpeed === AI_CONFIG.SPEEDS.MAX) {
			onMidPoint()
			onComplete()
		} else {
			transitionManager.playRespawnTransition(onMidPoint, onComplete)
		}
	}
	
	game.onTransitionEnd = () => {
		if (!aiController.isAIMode) {
			game.startGame()
			startTimerUpdate()
		} else {
		// AI 模式：自动开始新一局
			game.startGame()
			aiController.start()
		}
	}
	
	game.onDeath = () => {
		renderer.showDeath()
		aiController.recordResult('dead')
		if (!aiController.isAIMode) stopTimerUpdate()
		// 注：训练已在 onActionStart 中根据即时结果完成
	}
	
	game.onWin = () => {
		renderer.showWin()
		aiController.recordResult('win')
		// 注：训练已在 onActionStart 中根据即时结果完成
	
		if (!aiController.isAITrainMode && !aiController.isAIMode) {
			stopTimerUpdate()
			const elapsed = game.getElapsedTime()
			if (playerBestStore.tryUpdate(elapsed)) {
				console.log('[RECORD]', '新纪录！', playerBestStore.getFormatted())
			}
			updateGameInfo()
		}
	}
}

// ========== 视图渲染 ==========
function renderCurrentAIView(inputs = null, action = null, isPreview = false, weightChanges = null) {
	if (network) {
		viewManager.render(network, inputs, action, isPreview, weightChanges)
	}
}

// ========== 计时功能 ==========
function startTimerUpdate() {
	stopTimerUpdate()
	timerInterval = setInterval(() => {
		updateGameInfo()
	}, AI_CONFIG.TIMER_INTERVAL)
}

function stopTimerUpdate() {
	if (timerInterval) {
		clearInterval(timerInterval)
		timerInterval = null
	}
}

function updateGameInfo() {
	const gameInfo = document.getElementById('game-info')
	if (!gameInfo) return
	
	const player = game.getState().player
	const currentTime = formatTimeMs(game.getElapsedTime())
	const bestTime = playerBestStore.getFormatted()
	
	gameInfo.innerHTML = `POS: <span id="pos-display">${player.grid}</span> | GEN: <span id="gen-display">${game.getState().generation}</span>${aiController.isAIMode ? '' : ` | TIME: ${currentTime} | BEST: ${bestTime}`}`
}

// ========== 输入控制 ==========

function handleKeyDown(e) {
	if (e.repeat) return
	
	// AI单步模式：空格键执行下一步（决策/执行两阶段）
	if (aiController.isAIMode && aiController.isStepMode && e.key === ' ') {
		e.preventDefault()
		aiController.step()
		return
	}
	
	if (aiController.isAIMode) return
	if (game.gameStatus !== GAME_STATUS.RUNNING) return
	
	if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
		e.preventDefault()
		game.execute(ACTION.RIGHT)
	}
	if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
		e.preventDefault()
		game.execute(ACTION.JUMP)
	}
}

// ========== 窗口适配 ==========
function handleResize() {
	EPS.updateViewport()
	// 如果是横屏且触发了 CSS 旋转，我们需要取相反的尺寸
	const isLandscape = window.innerWidth > window.innerHeight
	const realWidth = isLandscape ? window.innerHeight : window.innerWidth
	
	game.setViewportSize(realWidth)
	const visualX = renderer.visual.x
	game._updateCamera(visualX)
	renderer.updateCamera(game.camera)
	renderCurrentAIView()
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init)

// ========== Vite 热更新 ==========
if (import.meta.hot) {
	import.meta.hot.accept()
	import.meta.hot.dispose(() => {
		console.log('[HMR]', '热更新：清理实例')
		if (aiController) aiController.stop()
		stopTimerUpdate()
		if (transitionManager) {
			transitionManager.destroy()
			transitionManager = null
		}
		if (game) {
			game.destroy?.()
			game = null
		}
	})
}


// ========== 调试接口 ==========
window.aiSandbox = {
	get game() { return game },
	get renderer() { return renderer },
	get network() { return network },
	get viewManager() { return viewManager },
	ACTION,
	toggleAI: () => { 
		aiController.isAIMode = !aiController.isAIMode
		aiController.isAITrainMode = aiController.isAIMode
		if (aiController.isAIMode) {
			aiController.start()
		} else {
			aiController.stop()
		}
		updateControlsUI()
		return aiController.isAIMode 
	}
}
