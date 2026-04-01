/**
 * 游戏入口文件
 * 连接游戏逻辑、渲染、AI控制和视图
 */

import { JumpGame, ACTION, CONFIG, GAME_STATUS, PLAYER_ACTION } from '@game/JumpGame.js'
import { formatTimeMs } from '@utils/timeUtils.js'
import { GameRenderer } from '@render/GameRenderer.js'
import { TransitionManager } from '@render/TransitionManager.js'
import { NeuralNetwork } from '@ai/NeuralNetwork.js'
import { PlayerBestStore } from '@ai/PlayerBestStore.js'
import { NeuronAreaManager } from '@views/NeuronAreaManager.js'
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
let timerInterval = null

const performanceHistory = [] // 滑动窗口队列
const WINDOW_SIZE = 5      // 窗口大小

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
	},
	DEFAULT_SPEED: 'step',    // 默认训练速度
	DEFAULT_MODE: 'player'    // 默认游戏模式
}

// 根据默认速度初始化
const isStepModeByDefault = AI_CONFIG.DEFAULT_SPEED === 'step'
let aiSpeed = isStepModeByDefault ? AI_CONFIG.SPEEDS.NORMAL : AI_CONFIG.SPEEDS[AI_CONFIG.DEFAULT_SPEED.toUpperCase()]
let isStepMode = isStepModeByDefault

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
	// 先初始化控制台面板，确保后续所有日志都能被捕获
	initConsolePanel()

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
	
	// 设置模式切换回调
	viewManager.onModeChange = (mode) => {
		switch(mode) {
			case 'player':
				isAIMode = false
				isAITrainMode = false
				stopAI()
				updateControlsUI()
				console.log('[UI]', '切换到玩家模式')
				break
			case 'ai':
				isAIMode = true
				isAITrainMode = false
				updateControlsUI()
				startAI()
				console.log('[AI]', '切换到AI模式')
				break
			case 'train':
				isAIMode = true
				isAITrainMode = true
				updateControlsUI()
				startAI()
				console.log('[AI]', '切换到AI训练模式（自动循环并更新权重）')
				break
		}
	}

	// 【修复 Bug 1】：监听视图切换，要求立即重绘画布
	viewManager.onViewChange = (viewName) => {
		const state = game.getStateForAI()
		const inputs = convertToInputs(state.terrainAhead)
		renderCurrentAIView(inputs, network ? network.lastAction : null)
	}

	// 设置速度切换回调
	viewManager.onSpeedChange = (speedId) => {
		switch(speedId) {
			case 'step': setAISpeed(AI_CONFIG.SPEEDS.STEP); break
			case 'slow': setAISpeed(AI_CONFIG.SPEEDS.SLOW); break
			case 'normal': setAISpeed(AI_CONFIG.SPEEDS.NORMAL); break
			case 'fast': setAISpeed(AI_CONFIG.SPEEDS.FAST); break
			case 'max': setAISpeed(AI_CONFIG.SPEEDS.MAX); break
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
	
	console.log('[GAME]', 'AI 训练沙盘已初始化，等待开始...')
	console.log('[GAME]', 'AI模式:', isAIMode ? '开启' : '关闭')

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
			toggleConsolePanel()
		})
	}
	// ------------------

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
	
	game.onActionStart = (action, from, to, isJump, result) => {
		let duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION
	
		// 动态调整动画速度
		if (isAIMode && aiSpeed === AI_CONFIG.SPEEDS.MAX) {
			duration = 16 // 极速：1帧完成
		} else if (isAIMode && aiSpeed === AI_CONFIG.SPEEDS.FAST) {
			duration = 50
		}
	
		renderer.startActionTween(from, to, isJump, duration)
	
		// AI 训练模式：根据即时结果立即训练
		if (isAITrainMode && network) {
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
		// 注：训练已在 onActionStart 中根据即时结果完成
	}
	
	game.onWin = () => {
		renderer.showWin()
		recordResult('win')
		// 注：训练已在 onActionStart 中根据即时结果完成
	
		if (!isAITrainMode && !isAIMode) {
			stopTimerUpdate()
			const elapsed = game.getElapsedTime()
			if (playerBestStore.tryUpdate(elapsed)) {
				console.log('[RECORD]', '新纪录！', playerBestStore.getFormatted())
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
		console.log('[AI]', '切换到单步模式')
	} else {
		isStepMode = false
		aiSpeed = speed
		const speedName = speed === AI_CONFIG.SPEEDS.SLOW ? '慢速' :
			speed === AI_CONFIG.SPEEDS.NORMAL ? '中速' :
				speed === AI_CONFIG.SPEEDS.FAST ? '快速' : '极速'
		console.log('[AI]', `切换到${speedName}`)
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
	

	// --- 动态 ε 调节精密逻辑 ---
	if (isAITrainMode && network) {
	// 计算 5 局滚动平均分
		if (performanceHistory.length >= WINDOW_SIZE) performanceHistory.shift()
		const currentAvg = performanceHistory.length > 0 
			? performanceHistory.reduce((a, b) => a + b, 0) / performanceHistory.length 
			: steps
		performanceHistory.push(steps)
	
		// 2. 【核心修改】：只有当自动调节开关打开时，才执行数值变动
		if (network.autoAdjustEpsilon) {
		// 精确调节数值
			if (steps > currentAvg) {
				// 进步了：减少探索量 (Step 0.05)
				network.epsilon = Math.max(0.1, network.epsilon - 0.05)
			} else if (steps < currentAvg) {
				// 退步了：增加探索量 (Step 0.05)
				network.epsilon = Math.min(0.4, network.epsilon + 0.05)
			} else {
				// 持平：微调收敛 (Step 0.01)
				network.epsilon = Math.max(0.1, network.epsilon - 0.01)
			}
		}
	
		console.log('[AI]', `窗口平均:${currentAvg.toFixed(1)} | 本局:${steps} | 新好奇心(ε):${network.epsilon.toFixed(2)}`)
	}
}

// ========== 视图渲染 ==========
function renderCurrentAIView(inputs = null, action = null) {
	if (network) {
		viewManager.render(network, inputs, action)
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

// ========== 控制台面板 ==========
let isConsoleOpen = false

function toggleConsolePanel() {
	isConsoleOpen = !isConsoleOpen
	const panel = document.getElementById('console-panel')
	const btn = document.getElementById('btn-console')
	if (panel) panel.classList.toggle('open', isConsoleOpen)
	if (btn) btn.classList.toggle('active', isConsoleOpen)
}

function initConsolePanel() {
	const logsContainer = document.getElementById('console-logs')
	if (!logsContainer) return

	const originalLog = console.log
	const originalWarn = console.warn
	const originalError = console.error
	const originalInfo = console.info

	const tagRegistry = new Set()
	const tagVisible = new Map()

	function formatArg(a) {
		if (a instanceof Error) {
			return a.stack || a.message || String(a)
		}
		if (typeof a === 'object') {
			try { return JSON.stringify(a) } catch { return String(a) }
		}
		return String(a)
	}

	function extractTag(args) {
		if (args.length > 0 && typeof args[0] === 'string') {
			const match = args[0].match(/^\[([^\]]+)\]$/)
			if (match) {
				const tag = match[1]
				return { tag, rest: args.slice(1) }
			}
		}
		return { tag: 'app', rest: args }
	}

	function registerTag(tag) {
		if (!tagRegistry.has(tag)) {
			tagRegistry.add(tag)
			tagVisible.set(tag, true)
			renderFilterMenu()
		}
	}

	function applyTagFilters() {
		const lines = logsContainer.querySelectorAll('.console-line')
		lines.forEach(line => {
			const tag = line.dataset.tag || 'app'
			line.style.display = tagVisible.get(tag) ? '' : 'none'
		})
	}

	function renderFilterMenu() {
		const list = document.getElementById('console-filter-list')
		if (!list) return
		list.innerHTML = ''
		const tags = Array.from(tagRegistry).sort((a, b) => a.localeCompare(b))
		tags.forEach(tag => {
			const row = document.createElement('label')
			row.className = 'console-filter-item'
			const checked = tagVisible.get(tag) ? 'checked' : ''
			row.innerHTML = `
				<input type="checkbox" ${checked}>
				<span class="console-filter-tag">${tag}</span>
			`
			row.querySelector('input').addEventListener('change', (e) => {
				tagVisible.set(tag, e.target.checked)
				applyTagFilters()
			})
			list.appendChild(row)
		})
	}

	function appendLine(level, args) {
		const { tag, rest } = extractTag(args)
		registerTag(tag)

		const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
		const entry = document.createElement('div')
		entry.className = `console-line ${level}`
		entry.dataset.tag = tag
		entry.style.display = tagVisible.get(tag) ? '' : 'none'

		const textParts = rest.map(formatArg)
		const header = document.createElement('div')
		header.textContent = `[${time}] [${tag}] ${textParts.join(' ')}`
		entry.appendChild(header)

		rest.forEach(a => {
			if (a instanceof Error && a.stack) {
				const stackDiv = document.createElement('div')
				stackDiv.className = 'console-stack'
				const stackLines = a.stack.split('\n').slice(1)
				stackDiv.textContent = stackLines.join('\n')
				entry.appendChild(stackDiv)
			}
		})

		logsContainer.appendChild(entry)
		logsContainer.scrollTop = logsContainer.scrollHeight
	}

	function makeTaggedLogger(orig, level) {
		return function (...args) {
			orig.apply(console, args)
			appendLine(level, args)
		}
	}

	console.log = makeTaggedLogger(originalLog, 'log')
	console.warn = makeTaggedLogger(originalWarn, 'warn')
	console.error = makeTaggedLogger(originalError, 'error')
	console.info = makeTaggedLogger(originalInfo, 'info')

	window.gameLog = {
		log: (tag, ...args) => console.log(`[${tag}]`, ...args),
		warn: (tag, ...args) => console.warn(`[${tag}]`, ...args),
		error: (tag, ...args) => console.error(`[${tag}]`, ...args),
		info: (tag, ...args) => console.info(`[${tag}]`, ...args)
	}

	// 绑定工具栏按钮
	const btnClear = document.getElementById('btn-clear-console')
	const btnDownload = document.getElementById('btn-download-console')
	const btnFilter = document.getElementById('btn-filter-console')
	const filterMenu = document.getElementById('console-filter-menu')

	if (btnClear) {
		btnClear.addEventListener('click', () => {
			logsContainer.innerHTML = ''
			tagRegistry.clear()
			tagVisible.clear()
			renderFilterMenu()
		})
	}

	if (btnDownload) {
		btnDownload.addEventListener('click', () => {
			const lines = Array.from(logsContainer.children).map(el => el.textContent)
			const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `console-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		})
	}

	if (btnFilter && filterMenu) {
		btnFilter.addEventListener('click', (e) => {
			e.stopPropagation()
			const isOpen = filterMenu.classList.toggle('open')
			btnFilter.classList.toggle('active', isOpen)
		})

		document.addEventListener('click', (e) => {
			if (!filterMenu.contains(e.target) && e.target !== btnFilter) {
				filterMenu.classList.remove('open')
				btnFilter.classList.remove('active')
			}
		})

		const btnAll = document.getElementById('btn-filter-all')
		const btnNone = document.getElementById('btn-filter-none')

		if (btnAll) {
			btnAll.addEventListener('click', () => {
				tagRegistry.forEach(tag => tagVisible.set(tag, true))
				renderFilterMenu()
				applyTagFilters()
			})
		}
		if (btnNone) {
			btnNone.addEventListener('click', () => {
				tagRegistry.forEach(tag => tagVisible.set(tag, false))
				renderFilterMenu()
				applyTagFilters()
			})
		}
	}
}

// ========== 调试接口 ==========
window.aiSandbox = {
	get game() { return game },
	get renderer() { return renderer },
	get network() { return network },
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
