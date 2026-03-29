/**
 * 游戏入口文件
 * 连接游戏逻辑、渲染和输入控制
 */

import { JumpGame, ACTION, CONFIG } from '@game/JumpGame.js'
import { GameRenderer } from '@render/GameRenderer.js'
import './style.css'
import './style-fox.css'

// ========== 全局实例 ==========
let game = null
let renderer = null

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
  renderer.setGame(game)  // 让渲染器可以通知游戏动画完成
  
  // 设置视口大小（动态计算格子像素）
  game.setViewportSize(gameArea.clientWidth)
  
  // 绑定游戏事件回调
  bindGameEvents()
  
  // 初始化游戏世界（此时 CONFIG.GRID_SIZE 已确定）
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
  
  console.log('🎮 AI 训练沙盘已初始化')
  console.log('📋 操作说明：→ 右移 | ↑ 跳跃')
  console.log('✨ 新功能：连续输入，动画可打断')
}

// ========== 事件绑定 ==========
function bindGameEvents() {
  // 状态变化时更新格子显示（相机由补间驱动）
  game.onStateChange = (player, camera) => {
    // 更新格子显示
    const posDisplay = document.getElementById('pos-display')
    if (posDisplay) {
      posDisplay.textContent = player.grid
    }
  }
  
  // 动作开始 - 启动补间动画
  game.onActionStart = (action, from, to, isJump) => {
    const duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION
    renderer.startActionTween(from, to, isJump, duration)
  }
  
  // 世代变化（新一关）
  game.onGenerationChange = (gen) => {
    renderer.initWorld(game.getState().terrain)
    const state = game.getState()
    renderer.syncVisualToLogical(state.player)
    renderer.updateCamera(state.camera)
    renderer.updateGeneration(gen)
    renderer.resetPlayer()
  }
  
  // 死亡
  game.onDeath = () => {
    renderer.showDeath()
  }
  
  // 胜利
  game.onWin = () => {
    renderer.showWin()
  }
}

// ========== 输入控制 ==========
function bindControls() {
  // 按钮点击
  btnRight.addEventListener('click', () => game.execute(ACTION.RIGHT))
  btnJump.addEventListener('click', () => game.execute(ACTION.JUMP))
  
  // 键盘控制
  document.addEventListener('keydown', handleKeyDown)
}

function handleKeyDown(e) {
  if (e.repeat) return
  
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
  
  // 用当前视觉位置重新计算相机
  const visualX = renderer.visual.x
  game._updateCamera(visualX)
  renderer.updateCamera(game.camera)
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init)

// ========== Vite 热更新 ==========
if (import.meta.hot) {
  import.meta.hot.accept()
  
  import.meta.hot.dispose(() => {
    console.log('🔄 热更新：清理游戏实例')
    if (game) {
      game.destroy()
      game = null
    }
  })
}

// ========== 调试接口 ==========
window.aiSandbox = {
  get game() { return game },
  get renderer() { return renderer },
  ACTION
}
