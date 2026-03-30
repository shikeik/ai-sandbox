/**
 * 游戏入口文件
 * 连接游戏逻辑、渲染、AI控制和视图
 */

import { JumpGame, ACTION, CONFIG, STATUS } from '@game/JumpGame.js'
import { GameRenderer } from '@render/GameRenderer.js'
import { NeuralNetwork } from '@ai/NeuralNetwork.js'
import { HistoryStore } from '@ai/HistoryStore.js'
import { PlayerBestStore } from '@ai/PlayerBestStore.js'
import { NeuronAreaManager } from '@views/NeuronAreaManager.js'
import './style.css'
import './style-fox.css'

// ========== 全局实例 ==========
let game = null
let renderer = null
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
  
  console.log('🎮 AI 训练沙盘已初始化')
  console.log('🤖 AI模式:', isAIMode ? '开启' : '关闭')
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
    if (isAIMode && player.status === STATUS.IDLE && !aiInterval) {
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
    
    // 玩家模式下启动计时
    if (!isAIMode) {
      game.startTimer()
      startTimerUpdate()
    }
    
    // 渲染更新
    renderNetworkView()
    renderHistoryView()
    updateGameInfo()
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
  const bestTime = playerBestStore.getFormatted()
  
  // 玩家模式下显示 TIME，未开始时显示 00:00
  let timeStr = '--:--'
  if (!isAIMode && game.startTime) {
    timeStr = game.formatTime(game.getElapsedTime())
  }
  
  gameInfo.innerHTML = `POS: <span id="pos-display">${player.grid}</span> | GEN: <span id="gen-display">${game.getState().generation}</span>${isAIMode ? '' : ` | TIME: ${timeStr}`} | BEST: ${bestTime}`
}

// ========== 输入控制 ==========
function bindControls() {
  // 按钮点击
  btnRight.addEventListener('click', () => {
    if (!isAIMode) game.execute(ACTION.RIGHT)
  })
  btnJump.addEventListener('click', () => {
    if (!isAIMode) game.execute(ACTION.JUMP)
  })
  
  // 键盘控制
  document.addEventListener('keydown', handleKeyDown)
}

function handleKeyDown(e) {
  if (e.repeat) return
  if (isAIMode) return  // AI模式下禁用键盘
  
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
