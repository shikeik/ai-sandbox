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

// ========== 模式设置 ==========
let isAIMode = false  // 默认玩家模式
let aiInterval = null

// ========== DOM 元素 ==========
const gameArea = document.getElementById('game-area')
const btnRight = document.getElementById('btn-right')
const btnJump = document.getElementById('btn-jump')

// ========== 初始化 ==========
function init() {
  // 创建游戏实例
  game = new JumpGame()
  
  // 创建渲染器
  renderer = new GameRenderer('game-world')
  renderer.setGame(game)
  
  // 创建神经网络（3输入 → 2输出）
  network = new NeuralNetwork({
    layerSizes: [3, 2],
    learningRate: 0.2,
    weightClip: 5
  })
  
  // 创建历史存储
  historyStore = new HistoryStore()
  
  // 创建玩家最佳记录存储
  playerBestStore = new PlayerBestStore()
  
  // 创建视图管理器
  viewManager = new NeuronAreaManager('neuron-area')
  
  // 设置模式切换回调
  viewManager.onModeChange = (mode) => {
    switch(mode) {
      case 'player':
        isAIMode = false
        stopAI()
        console.log('👤 切换到玩家模式')
        break
      case 'ai':
        isAIMode = true
        startAI()
        console.log('🤖 切换到AI模式')
        break
      case 'train':
        isAIMode = true
        startAI()
        console.log('📊 切换到AI训练模式（自动循环）')
        break
    }
  }
  
  // 设置视口大小
  game.setViewportSize(gameArea.clientWidth)
  
  // 创建转场管理器
  transitionManager = new TransitionManager('game-area')
  
  // 绑定游戏事件回调
  bindGameEvents()
  
  // 初始化游戏世界
  game.init()
  renderer.initWorld(game.getState().terrain)
  
  // 初始渲染
  const state = game.getState()
  renderer.syncVisualToLogical(state.player)
  renderer.updateCamera(state.camera)
  renderer.updateGeneration(state.generation)
  
  // 绑定输入控制
  bindControls()
  
  // 窗口大小变化
  window.addEventListener('resize', handleResize)
  
  // 启动AI（如果开启）
  if (isAIMode) {
    startAI()
  }
  
  // 初始渲染网络图
  renderNetworkView()
  
  // 初始化游戏信息显示（POS、GEN、TIME、BEST）
  updateGameInfo()
  
  // 绑定开始按钮
  bindStartButton()
  
  // 首次加载显示开始遮罩
  showStartOverlay()
  
  console.log('🎮 AI 训练沙盘已初始化，等待开始...')
  console.log('🤖 AI模式:', isAIMode ? '开启' : '关闭')
}

// ========== 开始游戏遮罩控制 ==========
function showStartOverlay() {
  const overlay = document.getElementById('start-overlay')
  if (overlay) {
    overlay.classList.remove('hidden')
  }
  
  // 确保游戏处于 READY 状态
  if (game.gameStatus !== GAME_STATUS.READY) {
    game.init()  // 重新初始化以重置状态
  }
}

function hideStartOverlay() {
  const overlay = document.getElementById('start-overlay')
  if (overlay) {
    overlay.classList.add('hidden')
  }
}

function onGameStart() {
  // 调用游戏开始方法
  game.startGame()
  
  // 隐藏遮罩
  hideStartOverlay()
  
  // 启动计时器更新（玩家模式）
  if (!isAIMode) {
    startTimerUpdate()
  }
  
  // 如果在 AI 模式，启动 AI
  if (isAIMode) {
    startAI()
  }
  
  console.log('🎮 游戏开始！')
}

function bindStartButton() {
  const startBtn = document.getElementById('start-btn')
  if (startBtn) {
    startBtn.addEventListener('click', onGameStart)
  }
}

// ========== 事件绑定 ==========
function bindGameEvents() {
  // 状态变化时更新显示
  game.onStateChange = (player, camera) => {
    const posDisplay = document.getElementById('pos-display')
    if (posDisplay) {
      posDisplay.textContent = player.grid
    }
    
    // AI模式下，如果就绪则决策
    const canDecide = game.gameStatus === GAME_STATUS.RUNNING && 
                      player.action === PLAYER_ACTION.IDLE
    if (isAIMode && canDecide && !aiInterval) {
      makeAIDecision()
    }
  }
  
  // 动作开始
  game.onActionStart = (action, from, to, isJump) => {
    const duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION
    renderer.startActionTween(from, to, isJump, duration)
    
    // 记录AI决策用于训练
    if (isAIMode && network) {
      const actionIdx = isJump ? 1 : 0
      // 小奖励（存活）
      network.train(0.02, actionIdx)
      renderNetworkView()
    }
  }
  
  // 世代变化（新一关）
  game.onGenerationChange = (gen) => {
    renderer.initWorld(game.getState().terrain)
    const state = game.getState()
    renderer.syncVisualToLogical(state.player)
    renderer.updateCamera(state.camera)
    renderer.updateGeneration(gen)
    renderer.resetPlayer()
    
    // 注意：不再在这里显示遮罩或启动计时器，转场结束后由 onTransitionEnd 处理
    
    renderNetworkView()
    renderHistoryView()
    updateGameInfo()
  }
  
  // 绑定转场事件
  game.onTransitionStart = (onMidPoint, onComplete) => {
    transitionManager.playRespawnTransition(onMidPoint, onComplete)
  }
  
  game.onTransitionEnd = () => {
    // 转场结束后的处理
    if (!isAIMode) {
      // 玩家模式：重生后直接开始新一局（不显示遮罩）
      game.startGame()      // 启动计时器，解锁输入
      startTimerUpdate()    // 启动 UI 更新
    } else {
      // AI 模式：自动开始
      game.startGame()
      startAI()
    }
  }
  
  // 死亡
  game.onDeath = () => {
    renderer.showDeath()
    recordResult('dead')
    
    // 玩家模式下停止计时
    if (!isAIMode) {
      stopTimerUpdate()
    }
    
    if (isAIMode) {
      // 惩罚错误决策
      const state = game.getStateForAI()
      const inputs = [
        state.terrainAhead[0] === 'pit' ? 1 : 0,
        state.terrainAhead[1] === 'pit' ? 1 : 0,
        state.terrainAhead[2] === 'pit' ? 1 : 0
      ]
      network.decide(inputs) // 重新决策获取记录
      network.train(-1, network.lastAction)
      renderNetworkView()
    }
  }
  
  // 胜利
  game.onWin = () => {
    renderer.showWin()
    recordResult('win')
    
    if (isAIMode) {
      // 大奖励
      network.train(1, network.lastAction)
      renderNetworkView()
    } else {
      // 玩家模式：停止计时并更新最佳记录
      stopTimerUpdate()
      const elapsed = game.getElapsedTime()
      const isNewRecord = playerBestStore.tryUpdate(elapsed)
      if (isNewRecord) {
        console.log('🎉 新纪录！', playerBestStore.getFormatted())
      }
      // 更新显示 BEST（非 RUNNING 状态自动显示 BEST）
      updateGameInfo()
    }
  }
}

// ========== AI 控制 ==========
function startAI() {
  if (!isAIMode) return
  
  // AI循环由游戏状态回调触发
  console.log('🤖 AI已启动')
}

function stopAI() {
  if (aiInterval) {
    clearInterval(aiInterval)
    aiInterval = null
  }
}

function makeAIDecision() {
  if (!isAIMode || !network) return
  
  const state = game.getStateForAI()
  
  // 转换输入
  const inputs = [
    state.terrainAhead[0] === 'pit' ? 1 : 0,
    state.terrainAhead[1] === 'pit' ? 1 : 0,
    state.terrainAhead[2] === 'pit' ? 1 : 0
  ]
  
  // AI决策
  const action = network.decide(inputs)
  
  // 执行动作
  if (action === 1) {
    game.execute(ACTION.JUMP)
  } else {
    game.execute(ACTION.RIGHT)
  }
  
  // 更新视图
  renderNetworkView(inputs, action)
}

// ========== 记录结果 ==========
function recordResult(finalStatus) {
  const player = game.getState().player
  
  historyStore.add({
    generation: game.getState().generation,
    steps: player.grid,
    finalStatus: finalStatus,
    weights: network.getWeightsSnapshot()
  })
}

// ========== 视图渲染 ==========
function renderNetworkView(inputs = null, action = null) {
  if (viewManager.activeViewName === 'network' && network) {
    viewManager.render(network, inputs, action)
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
  }, 100) // 每100ms更新一次
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

/**
 * 绑定游戏控制（按钮和键盘）
 * 
 * 【速通核心机制】
 * 只检查游戏生命周期状态（RUNNING），不检查人物动作状态。
 * 允许在动画期间输入，execute() 会立即执行逻辑并打断当前动画。
 * 这是速通玩法的基础：操作频率决定角色移动速度。
 */
function bindControls() {
  // 按钮点击
  btnRight.addEventListener('click', () => {
    if (isAIMode) return
    if (game.gameStatus !== GAME_STATUS.RUNNING) return
    game.execute(ACTION.RIGHT)
  })
  btnJump.addEventListener('click', () => {
    if (isAIMode) return
    if (game.gameStatus !== GAME_STATUS.RUNNING) return
    game.execute(ACTION.JUMP)
  })
  
  // 键盘控制
  document.addEventListener('keydown', handleKeyDown)
}

/**
 * 键盘事件处理
 * 
 * 【速通核心机制】
 * 只检查游戏是否处于 RUNNING 状态，不检查人物是否在动画中。
 * 玩家可在任意时刻按键，execute() 立即响应并打断当前动画，
 * 实现"操作多快，游戏多快"的无缝连续操作体验。
 */
function handleKeyDown(e) {
  if (e.repeat) return
  if (isAIMode) return  // AI模式下禁用键盘
  
  // 检查游戏状态（速通机制：不检查人物动作状态，允许动画期间输入）
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
  
  // 重新渲染当前视图
  renderNetworkView()
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
  toggleAI: () => { isAIMode = !isAIMode; isAIMode ? startAI() : stopAI(); return isAIMode }
}
