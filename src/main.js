/**
 * 游戏入口文件
 * 连接游戏逻辑、渲染、AI控制和视图
 */

import { JumpGame, ACTION, CONFIG, GAME_STATUS, PLAYER_ACTION } from '@game/JumpGame.js'
import { formatTimeMs } from '@utils/timeUtils.js'
import { GameRenderer } from '@render/GameRenderer.js'
import { TransitionManager } from '@render/TransitionManager.js'
import { NeuralNetwork } from '@ai/NeuralNetwork.js'
import { HistoryStore } from '@ai/HistoryStore.js'
import { PlayerBestStore } from '@ai/PlayerBestStore.js'
import { NeuronAreaManager } from '@views/NeuronAreaManager.js'
import './style.css'
import './style-fox.css'

// ========== 全局实例 ==========
let game = null
let renderer = null
let transitionManager = null
let network = null
let historyStore = null
let playerBestStore = null
let viewManager = null
let timerInterval = null

let performanceHistory = []; // 滑动窗口队列
const WINDOW_SIZE = 5;      // 窗口大小

// ========== 模式设置 ==========
let isAIMode = false      // 是否为 AI 控制模式
let isAITrainMode = false // 是否为 AI 训练模式（仅训练模式下会更新权重和自动循环）
let aiInterval = null
let fastLoopId = null     // 极速模式专用

// ========== AI 配置常量 ==========
const AI_CONFIG = {
	STEP_REWARD: 0.02,      // 每步存活奖励
	DEATH_REWARD: -1,       // 死亡惩罚
	WIN_REWARD: 1,          // 胜利奖励
	SPEEDS: {
	STEP: 'step',         // 单步模式
	SLOW: 1000,           // 慢速：1秒/步
	NORMAL: 200,          // 中速：200ms/步
	FAST: 50,             // 快速：50ms/步
	MAX: 0                // 极速：无延迟
	}
}

let aiSpeed = AI_CONFIG.SPEEDS.NORMAL  // 默认中速
let isStepMode = false                 // 单步模式标志

/**
 * 转换游戏状态为神经网络输入
 * @param {Object} terrainAhead - 前方地形数组
 * @returns {number[]} 神经网络输入 [0,1,0]
 */
function convertToInputs(terrainAhead) {
	return [
	terrainAhead[0] === 'pit' ? 1 : 0,
	terrainAhead[1] === 'pit' ? 1 : 0,
	terrainAhead[2] === 'pit' ? 1 : 0
	]
}

// ========== DOM 元素 ==========
const gameArea = document.getElementById('game-area')

// ========== 初始化 ==========
function init() {
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
	
	historyStore = new HistoryStore()
	playerBestStore = new PlayerBestStore()
	viewManager = new NeuronAreaManager('neuron-area')
	transitionManager = new TransitionManager('game-area')
	
	// 设置模式切换回调
	viewManager.onModeChange = (mode) => {
	switch(mode) {
		case 'player':
		isAIMode = false
		isAITrainMode = false
		stopAI()
		updateControlsUI()
		console.log('👤 切换到玩家模式')
		break
		case 'ai':
		isAIMode = true
		isAITrainMode = false
		updateControlsUI()
		startAI()
		console.log('🤖 切换到AI模式')
		break
		case 'train':
		isAIMode = true
		isAITrainMode = true
		updateControlsUI()
		startAI()
		console.log('📊 切换到AI训练模式（自动循环并更新权重）')
		break
	}
	}

	// 【修复 Bug 1】：监听视图切换，要求立即重绘画布
	viewManager.onViewChange = (viewName) => {
	if (viewName === 'history') {
		renderHistoryView()
	} else {
		const state = game.getStateForAI()
		const inputs = convertToInputs(state.terrainAhead)
		renderCurrentAIView(inputs, network ? network.lastAction : null)
	}
	}

	// 设置速度切换回调
	viewManager.onSpeedChange = (speedId) => {
	switch(speedId) {
		case 'step': setAISpeed(AI_CONFIG.SPEEDS.STEP); break;
		case 'slow': setAISpeed(AI_CONFIG.SPEEDS.SLOW); break;
		case 'normal': setAISpeed(AI_CONFIG.SPEEDS.NORMAL); break;
		case 'fast': setAISpeed(AI_CONFIG.SPEEDS.FAST); break;
		case 'max': setAISpeed(AI_CONFIG.SPEEDS.MAX); break;
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
	
	if (isAIMode) {
	startAI()
	}
	
	renderCurrentAIView()
	updateGameInfo()
	bindStartButton()
	showStartOverlay()
	
	console.log('🎮 AI 训练沙盘已初始化，等待开始...')
	console.log('🤖 AI模式:', isAIMode ? '开启' : '关闭')
	
	// --- 全屏引导逻辑 ---
	const isFullscreenRequested = new URLSearchParams(window.location.search).get('fullscreen') === 'true';
	const fsOverlay = document.getElementById('fs-guide-overlay');

	if (isFullscreenRequested && fsOverlay) {
	// 1. 显示遮罩
	fsOverlay.classList.remove('hidden');

	// 2. 绑定点击事件
	fsOverlay.addEventListener('click', () => {
		const docElm = document.documentElement;
		
		// 执行全屏请求
		if (docElm.requestFullscreen) {
		docElm.requestFullscreen();
		} else if (docElm.webkitRequestFullscreen) {
		docElm.webkitRequestFullscreen();
		} else if (docElm.msRequestFullscreen) {
		docElm.msRequestFullscreen();
		}

		// 3. 隐藏并销毁这个引导层
		fsOverlay.classList.add('hidden');
		setTimeout(() => fsOverlay.remove(), 500); // 彻底从 DOM 中移除
	});
	}
}

// ========== 动态 UI 控制面板 ==========
function updateControlsUI() {
	const controlArea = document.getElementById('control-area')
	if (!controlArea) return

	// 玩家模式：显示操作按钮
	if (!isAIMode) {
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
	if (btnRight) {
		btnRight.addEventListener('click', () => {
		if (game.gameStatus === GAME_STATUS.RUNNING) game.execute(ACTION.RIGHT)
		})
	}
	if (btnJump) {
		btnJump.addEventListener('click', () => {
		if (game.gameStatus === GAME_STATUS.RUNNING) game.execute(ACTION.JUMP)
		})
	}
	} 
	// AI 模式
	else {
	if (isStepMode) {
		// 单步模式：显示下一步按钮
		controlArea.innerHTML = `
		<button class="btn" id="btn-step" style="background: var(--color-btn-right); box-shadow: 0 8px 0 var(--color-btn-right-shadow); color: white;">
			⏭️
			<span class="btn-label">下一步 (Space)</span>
		</button>
		`
		const btnStep = document.getElementById('btn-step')
		if (btnStep) btnStep.addEventListener('click', stepAI)
	} else {
		// 自动运行模式：隐藏按钮，显示提示文本
		controlArea.innerHTML = `
		<div style="color: #888; font-size: 14px; width: 100%; text-align: center;">🤖 AI自动运行中...</div>
		`
	}
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
	if (!isAIMode) {
	startTimerUpdate()
	} else {
	startAI()
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
	
	game.onActionStart = (action, from, to, isJump) => {
	let duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION
	
	// 动态调整动画速度
	if (isAIMode && aiSpeed === AI_CONFIG.SPEEDS.MAX) {
		duration = 16 // 极速：1帧完成
	} else if (isAIMode && aiSpeed === AI_CONFIG.SPEEDS.FAST) {
		duration = 50
	}
	
	renderer.startActionTween(from, to, isJump, duration)
	
	// 仅在 AI 训练模式下记录并训练
	if (isAITrainMode && network) {
		const actionIdx = isJump ? 1 : 0
		network.train(AI_CONFIG.STEP_REWARD, actionIdx)
		renderCurrentAIView()
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
	renderHistoryView()
	updateGameInfo()
	}
	
	game.onTransitionStart = (onMidPoint, onComplete) => {
	// 极速训练模式下跳过黑屏转场，实现超高速训练
	if (isAITrainMode && aiSpeed === AI_CONFIG.SPEEDS.MAX) {
		onMidPoint()
		onComplete()
	} else {
		transitionManager.playRespawnTransition(onMidPoint, onComplete)
	}
	}
	
	game.onTransitionEnd = () => {
	if (!isAIMode) {
		game.startGame()
		startTimerUpdate()
	} else {
		// AI 模式：自动开始新一局
		game.startGame()
		startAIInterval()
	}
	}
	
	game.onDeath = () => {
	renderer.showDeath()
	recordResult('dead')
	if (!isAIMode) stopTimerUpdate()
	
	if (isAITrainMode) {
		// 惩罚直接导致死亡的上一次动作
		network.train(AI_CONFIG.DEATH_REWARD, network.lastAction)
		renderCurrentAIView()
	}
	}
	
	game.onWin = () => {
	renderer.showWin()
	recordResult('win')
	
	if (isAITrainMode) {
		network.train(AI_CONFIG.WIN_REWARD, network.lastAction)
		renderCurrentAIView()
	} else if (!isAIMode) {
		stopTimerUpdate()
		const elapsed = game.getElapsedTime()
		if (playerBestStore.tryUpdate(elapsed)) {
		console.log('🎉 新纪录！', playerBestStore.getFormatted())
		}
		updateGameInfo()
	}
	}
}

// ========== AI 控制 ==========

function setAISpeed(speed) {
	if (speed === AI_CONFIG.SPEEDS.STEP) {
	isStepMode = true
	aiSpeed = AI_CONFIG.SPEEDS.NORMAL
	console.log('🚶 切换到单步模式')
	} else {
	isStepMode = false
	aiSpeed = speed
	const speedName = speed === AI_CONFIG.SPEEDS.SLOW ? '慢速' :
						speed === AI_CONFIG.SPEEDS.NORMAL ? '中速' :
						speed === AI_CONFIG.SPEEDS.FAST ? '快速' : '极速'
	console.log(`⏱️ 切换到${speedName}`)
	}
	
	if (isAIMode && (aiInterval || fastLoopId || isStepMode)) {
	startAIInterval()
	}
}

function stepAI() {
	if (!isAIMode || !isStepMode) return
	makeAIDecision()
}

function startAI() {
	if (!isAIMode) return
	if (game.gameStatus === GAME_STATUS.READY) {
	game.startGame()
	}
	startAIInterval()
}

function startAIInterval() {
	stopAIInterval()
	
	if (isStepMode) return // 单步模式等待手动触发
	
	if (aiSpeed === AI_CONFIG.SPEEDS.MAX) {
	runAIFastLoop()
	} else {
	aiInterval = setInterval(() => {
		if (canMakeDecision()) makeAIDecision()
	}, aiSpeed)
	}
}

function stopAIInterval() {
	if (aiInterval) {
	clearInterval(aiInterval)
	aiInterval = null
	}
	if (fastLoopId) {
	cancelAnimationFrame(fastLoopId)
	fastLoopId = null
	}
}

function stopAI() {
	stopAIInterval()
}

function runAIFastLoop() {
	if (!isAIMode || isStepMode || aiSpeed !== AI_CONFIG.SPEEDS.MAX) return
	
	if (canMakeDecision()) {
	makeAIDecision()
	}
	fastLoopId = requestAnimationFrame(() => runAIFastLoop())
}

function canMakeDecision() {
	return game.gameStatus === GAME_STATUS.RUNNING && 
		 game.getState().player.action === PLAYER_ACTION.IDLE
}

function makeAIDecision() {
	if (!isAIMode || !network) return
	
	const state = game.getStateForAI()
	const inputs = convertToInputs(state.terrainAhead)
	
	const action = network.decide(inputs)
	const actionType = action === 1 ? ACTION.JUMP : ACTION.RIGHT
	
	game.execute(actionType)
	renderCurrentAIView(inputs, action)
}

// ========== 记录结果 ==========
function recordResult(finalStatus) {
	const player = game.getState().player
	const steps = player.grid
	
	// 记录到历史存储
	historyStore.add({
	generation: game.getState().generation,
	steps: steps,
	finalStatus: finalStatus,
	weights: network.getWeightsSnapshot()
	})

	// --- 动态 ε 调节精密逻辑 ---
	if (isAITrainMode && network) {
	// 计算 5 局滚动平均分
	if (performanceHistory.length >= WINDOW_SIZE) performanceHistory.shift();
	const currentAvg = performanceHistory.length > 0 
		? performanceHistory.reduce((a, b) => a + b, 0) / performanceHistory.length 
		: steps;
	performanceHistory.push(steps);
	
	// 2. 【核心修改】：只有当自动调节开关打开时，才执行数值变动
	if (network.autoAdjustEpsilon) {
		// 精确调节数值
		if (steps > currentAvg) {
		// 进步了：减少探索量 (Step 0.05)
		network.epsilon = Math.max(0.1, network.epsilon - 0.05);
		} else if (steps < currentAvg) {
		// 退步了：增加探索量 (Step 0.05)
		network.epsilon = Math.min(0.4, network.epsilon + 0.05);
		} else {
		// 持平：微调收敛 (Step 0.01)
		network.epsilon = Math.max(0.1, network.epsilon - 0.01);
		}
	}
	
	console.log(`📊 窗口平均:${currentAvg.toFixed(1)} | 本局:${steps} | 新好奇心(ε):${network.epsilon.toFixed(2)}`);
	}
}

// ========== 视图渲染 ==========
function renderCurrentAIView(inputs = null, action = null) {
	if ((viewManager.activeViewName === 'network' || viewManager.activeViewName === 'matrix') && network) {
	// 确保这里传了 network 实例，否则 UI 看不到好奇心数值
	viewManager.render(network, inputs, action); 
	}
}

function renderHistoryView() {
	if (viewManager.activeViewName === 'history') {
	viewManager.render(historyStore.getAll())
	}
}

// ========== 计时功能 ==========
function startTimerUpdate() {
	stopTimerUpdate()
	timerInterval = setInterval(() => {
	updateGameInfo()
	}, 100)
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
	
	gameInfo.innerHTML = `POS: <span id="pos-display">${player.grid}</span> | GEN: <span id="gen-display">${game.getState().generation}</span>${isAIMode ? '' : ` | TIME: ${currentTime} | BEST: ${bestTime}`}`
}

// ========== 输入控制 ==========

function handleKeyDown(e) {
	if (e.repeat) return
	
	// AI单步模式：空格键执行下一步
	if (isAIMode && isStepMode && e.key === ' ') {
	e.preventDefault()
	stepAI()
	return
	}
	
	if (isAIMode) return
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
	game.setViewportSize(gameArea.clientWidth)
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
	console.log('🔄 热更新：清理实例')
	stopAI()
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
	get history() { return historyStore },
	get viewManager() { return viewManager },
	ACTION,
	toggleAI: () => { 
	isAIMode = !isAIMode
	isAITrainMode = isAIMode
	isAIMode ? startAI() : stopAI()
	updateControlsUI()
	return isAIMode 
	}
}
