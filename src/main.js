/**
 * 游戏入口文件
 * 连接游戏逻辑、渲染、AI控制和视图
 */

import { JumpGame, ACTION, GAME_STATUS, CONFIG } from '@game/JumpGame.js'
import { GameRenderer } from '@render/GameRenderer.js'
import { TransitionManager } from '@render/TransitionManager.js'
import { NeuralNetwork } from '@ai/NeuralNetwork.js'
import { AIController, AI_CONFIG } from '@ai/AIController.js'
import { PlayerBestStore } from '@ai/PlayerBestStore.js'
import { NeuronAreaManager } from '@views/NeuronAreaManager.js'
import { ConsolePanel } from '@views/ConsolePanel.js'
import { UIManager } from '@managers/UIManager.js'
import { InputManager } from '@managers/InputManager.js'
import { GameEventBridge } from '@managers/GameEventBridge.js'
import EPS from './eps.js'
import './style.css'
import './style-fox.css'

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
let uiManager = null
let inputManager = null
let gameEventBridge = null

// ========== DOM 元素 ==========
const gameArea = document.getElementById('game-area')

// ========== 初始化 ==========
function init() {
	// 初始化控制台面板
	consolePanel = new ConsolePanel()
	consolePanel.init()

	EPS.init()
	game = new JumpGame()
	renderer = new GameRenderer('game-world')
	renderer.setGame(game)

	// 创建神经网络
	network = new NeuralNetwork({
		layerSizes: [4, 3],
		learningRate: 0.2,
		weightClip: 5
	})
	window.network = network
	window.AI_CONFIG = AI_CONFIG

	playerBestStore = new PlayerBestStore()
	viewManager = new NeuronAreaManager('neuron-area')
	transitionManager = new TransitionManager('game-area')

	// 初始化 UI 管理器
	uiManager = new UIManager({
		game,
		aiController: { isAIMode: false }, // 临时占位，后续更新
		playerBestStore,
		viewManager,
		network
	})

	// 初始化 AI 控制器
	aiController = new AIController({
		game,
		network,
		onRenderView: (inputs, action, isPreview, weightChanges) => {
			uiManager.renderCurrentAIView(inputs, action, isPreview, weightChanges)
		}
	})

	// 更新 UI 管理器的 AI 控制器引用
	uiManager.aiController = aiController

	// 设置模式切换回调
	viewManager.onModeChange = (mode) => {
		aiController.setMode(mode)
		uiManager.updateControlsUI()
	}

	viewManager.onViewChange = (viewName) => {
		const state = game.getStateForAI()
		const inputs = [
			state.terrainAhead[0] === 'pit' ? 1 : 0,
			state.terrainAhead[1] === 'pit' ? 1 : 0,
			state.terrainAhead[2] === 'pit' ? 1 : 0,
			state.terrainAhead[3] === 'pit' ? 1 : 0
		]
		uiManager.renderCurrentAIView(inputs, network ? network.lastAction : null)
	}

	viewManager.onSpeedChange = (speedId) => {
		switch (speedId) {
			case 'step': aiController.setSpeed(AI_CONFIG.SPEEDS.STEP); break
			case 'slow': aiController.setSpeed(AI_CONFIG.SPEEDS.SLOW); break
			case 'normal': aiController.setSpeed(AI_CONFIG.SPEEDS.NORMAL); break
			case 'fast': aiController.setSpeed(AI_CONFIG.SPEEDS.FAST); break
			case 'max': aiController.setSpeed(AI_CONFIG.SPEEDS.MAX); break
		}
		uiManager.updateControlsUI()
	}

	// 设置探索模式切换回调
	viewManager.onExploreModeChange = (mode) => {
		network.exploreMode = mode
		const epsilon = network.getEpsilon ? network.getEpsilon() : 0
		console.log('[MAIN]', `探索模式切换 | 新模式=${mode} | ε=${epsilon.toFixed(2)}`)
	}

	// 初始化输入管理器
	inputManager = new InputManager({
		game,
		aiController,
		EPS,
		onRenderView: uiManager.renderCurrentAIView.bind(uiManager)
	})
	inputManager.bind()

	// 初始化游戏事件桥接器
	gameEventBridge = new GameEventBridge({
		game,
		renderer,
		aiController,
		network,
		transitionManager,
		uiManager,
		startTimerUpdate,
		stopTimerUpdate
	})
	gameEventBridge.bind()

	// 游戏初始化
	game.setViewportSize(gameArea.clientWidth)
	game.init()
	renderer.initWorld(game.getState().terrain)

	const state = game.getState()
	renderer.syncVisualToLogical(state.player)
	renderer.updateCamera(state.camera)
	renderer.updateGeneration(state.generation)

	// UI 初始化
	uiManager.updateControlsUI()
	uiManager.renderCurrentAIView()
	uiManager.updateGameInfo()
	uiManager.bindStartButton(onGameStart)
	uiManager.showStartOverlay()

	if (aiController.isAIMode) {
		aiController.start()
	}

	aiController.pendingAIDecision = null

	console.log('[GAME]', 'AI 训练沙盘已初始化，等待开始...')
	console.log('[GAME]', 'AI模式:', aiController.isAIMode ? '开启' : '关闭')
	console.log('[MAIN]', '重构后主入口初始化完成 | UIManager + InputManager + GameEventBridge 已加载')

	// 工具栏按钮
	bindToolbarButtons()
}

function onGameStart() {
	console.log('[MAIN]', '游戏开始')
	game.startGame()
	uiManager.hideStartOverlay()
	if (!aiController.isAIMode) {
		startTimerUpdate()
	} else {
		aiController.start()
	}
	console.log('[MAIN]', '游戏状态切换完成')
}

function startTimerUpdate() {
	stopTimerUpdate()
	timerInterval = setInterval(() => {
		uiManager.updateGameInfo()
	}, AI_CONFIG.TIMER_INTERVAL)
}

function stopTimerUpdate() {
	if (timerInterval) {
		clearInterval(timerInterval)
		timerInterval = null
	}
}

function bindToolbarButtons() {
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
		btnFullscreen.addEventListener('click', () => EPS.fullscreen())
	}

	if (btnConsole) {
		btnConsole.addEventListener('click', () => consolePanel.toggle())
	}

	const btnReload = document.getElementById('btn-reload')
	if (btnReload) {
		btnReload.addEventListener('click', () => {
			console.log('[MAIN]', '刷新页面')
			window.location.reload()
		})
	}
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
		if (inputManager) inputManager.unbind()
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
		uiManager.updateControlsUI()
		return aiController.isAIMode
	}
}
