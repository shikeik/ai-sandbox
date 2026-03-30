/**
 * 游戏渲染器
 * 负责将游戏状态渲染到 DOM，处理补间动画
 */

import { CONFIG, TERRAIN } from '@game/JumpGame.js'

/**
 * 补间动画类
 * 支持打断和连续补间
 */
class Tween {
  constructor({ fromX, fromY, toX, toY, duration, isJump, onUpdate, onComplete }) {
    this.fromX = fromX
    this.fromY = fromY
    this.toX = toX
    this.toY = toY
    this.duration = duration
    this.isJump = isJump
    this.onUpdate = onUpdate
    this.onComplete = onComplete
    
    this.startTime = performance.now()
    this.animationId = null
    this.isRunning = false
  }
  
  start() {
    this.isRunning = true
    this.startTime = performance.now()
    this._tick()
    return this
  }
  
  stop() {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    return this
  }
  
  _tick() {
    if (!this.isRunning) return
    
    const elapsed = performance.now() - this.startTime
    const progress = Math.min(elapsed / this.duration, 1)
    
    // 缓动函数：easeInOutQuad
    const t = progress < 0.5 
      ? 2 * progress * progress 
      : -1 + (4 - 2 * progress) * progress
    
    // 计算当前位置
    let currentX = this.fromX + (this.toX - this.fromX) * t
    let currentY
    
    if (this.isJump) {
      // 抛物线跳跃：从 fromY 起跳，最后落到 toY（地面）
      // 基础高度从 fromY 过渡到 toY
      const baseY = this.fromY + (this.toY - this.fromY) * progress
      // 抛物线高度（正弦波）
      const jumpHeight = Math.sin(progress * Math.PI) * CONFIG.toPx(CONFIG.JUMP_HEIGHT)
      currentY = baseY + jumpHeight
    } else {
      // 平地移动
      currentY = this.fromY + (this.toY - this.fromY) * t
    }
    
    // 通知更新
    if (this.onUpdate) {
      this.onUpdate(currentX, currentY)
    }
    
    if (progress < 1) {
      this.animationId = requestAnimationFrame(() => this._tick())
    } else {
      this.isRunning = false
      if (this.onComplete) {
        this.onComplete()
      }
    }
  }
}

export class GameRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    this.worldEl = null
    this.playerEl = null
    this.currentTween = null
    
    // 视觉位置（用于补间起点）
    this.visual = { x: 0, y: CONFIG.toPx(CONFIG.GROUND_HEIGHT) }
    
    // 信息面板元素
    this.posDisplay = document.getElementById('pos-display')
    this.genDisplay = document.getElementById('gen-display')
    this.statusText = document.getElementById('status-text')
    
    // 游戏实例引用（用于通知动画完成）
    this.game = null
  }
  
  setGame(game) {
    this.game = game
  }

  /**
   * 初始化世界渲染
   */
  initWorld(terrain) {
    this.container.innerHTML = ''
    
    this.worldEl = document.createElement('div')
    this.worldEl.className = 'world-content'
    
    this._renderGridLines()
    
    terrain.forEach(t => {
      if (t.type === TERRAIN.GROUND) {
        this._createGround(t.start, t.end - t.start)
      } else {
        this._createPit(t.start)
      }
    })
    
    this._createGoal()
    this._createPlayer()
    
    this.container.appendChild(this.worldEl)
    
    // 添加云朵（背景装饰）
    this._createClouds()
    
    // 停止任何进行中的补间
    if (this.currentTween) {
      this.currentTween.stop()
      this.currentTween = null
    }
  }
  
  /**
   * 创建云朵装饰
   */
  _createClouds() {
    const cloudPositions = [
      { class: 'cloud cloud-1', delay: '0s' },
      { class: 'cloud cloud-2', delay: '-8s' },
      { class: 'cloud cloud-3', delay: '-15s' }
    ]
    
    cloudPositions.forEach((cloud, index) => {
      const el = document.createElement('div')
      el.className = cloud.class
      el.style.left = `${-100 - index * 50}px`
      this.container.appendChild(el)
    })
  }
  
  /**
   * 开始动作补间动画
   * 
   * 【速通核心机制】
   * 立即停止当前补间（打断），从当前视觉位置开始新补间。
   * 这使得玩家可以在动画期间输入新指令，新动作立即生效，
   * 逻辑与视觉分离，实现连续操作不等待的速通体验。
   * 
   * @param {Object} from - 起始位置 {x, y}
   * @param {Object} to - 目标位置 {x, y}
   * @param {boolean} isJump - 是否是跳跃
   * @param {number} duration - 动画时长
   */
  startActionTween(from, to, isJump, duration) {
    // 停止当前补间（打断）
    if (this.currentTween) {
      this.currentTween.stop()
    }
    
    // 使用当前视觉位置作为起点（支持连续补间）
    const startX = this.visual.x
    const startY = this.visual.y
    
    // 创建新补间
    this.currentTween = new Tween({
      fromX: startX,
      fromY: startY,
      toX: to.x,
      toY: to.y,
      duration,
      isJump,
      onUpdate: (x, y) => {
        this.visual.x = x
        this.visual.y = y
        this._updatePlayerVisual(x, y)
        // 更新狐狸动画状态 - 跳跃时根据高度判断，平地移动时显示奔跑
        this._updateFoxAnimation({ x, y, status: 'moving' }, !isJump, isJump)
        // 用视觉位置更新相机（平滑跟随）
        if (this.game) {
          this.game._updateCamera(x)
          this.updateCamera(this.game.camera)
        }
      },
      onComplete: () => {
        this.currentTween = null
        // 动画完成，狐狸恢复待机状态
        if (this.foxContainer) {
          this.foxContainer.classList.remove('state-run', 'state-jump-up', 'state-jump-down', 'state-land')
          this.foxContainer.classList.add('state-idle')
          this._foxState = 'idle'
          // 恢复待机尾巴动画
          this._startTailAnimation('idle')
        }
        // 通知游戏逻辑动画完成
        if (this.game) {
          this.game.notifyVisualComplete()
        }
      }
    }).start()
  }
  
  /**
   * 更新相机位置（由游戏逻辑驱动）
   */
  updateCamera(camera) {
    if (this.worldEl) {
      this.worldEl.style.transform = `translateX(${-camera.x}px)`
    }
  }
  
  /**
   * 同步视觉位置到逻辑位置（用于初始化、重置）
   */
  syncVisualToLogical(player) {
    this.visual.x = player.x
    this.visual.y = player.y
    this._updatePlayerVisual(player.x, player.y)
    
    if (this.posDisplay) {
      this.posDisplay.textContent = player.grid
    }
  }
  
  /**
   * 设置视觉位置（指定像素坐标）
   */
  setVisualPosition(x, y) {
    this.visual.x = x
    this.visual.y = y
    this._updatePlayerVisual(x, y)
  }
  
  /**
   * 更新世代显示
   */
  updateGeneration(gen) {
    if (this.genDisplay) {
      this.genDisplay.textContent = gen
    }
  }
  
  /**
   * 显示死亡动画
   */
  showDeath() {
    // 给狐狸容器添加死亡状态
    if (this.foxContainer) {
      this.foxContainer.classList.remove('state-idle', 'state-run', 'state-jump-up', 'state-jump-down', 'state-land')
      this.foxContainer.classList.add('state-dead')
      this._foxState = 'dead'
      // 停止尾巴动画
      this._startTailAnimation('dead')
    }
    this._showStatus('💀', 'dead')
  }
  
  /**
   * 显示胜利动画
   */
  showWin() {
    this._showStatus('🏆', 'win')
  }
  
  /**
   * 重置玩家状态（新一关）
   */
  resetPlayer() {
    // 重置狐狸状态
    if (this.foxContainer) {
      this.foxContainer.className = 'fox-container state-idle'
      this._foxState = 'idle'
      this._foxLastY = 0
      this._foxVelocity = 0
      this._foxOnGround = true
      // 重置尾巴动画
      this._startTailAnimation('idle')
    }
    this._hideStatus()
    
    // 停止补间
    if (this.currentTween) {
      this.currentTween.stop()
      this.currentTween = null
    }
  }

  // ========== 私有方法 ==========
  
  _updatePlayerVisual(x, y) {
    if (this.playerEl) {
      this.playerEl.style.left = `${x}px`
      this.playerEl.style.bottom = `${y}px`
    }
  }
  
  _renderGridLines() {
    const gridOverlay = document.createElement('div')
    gridOverlay.className = 'world-grid'
    
    for (let i = 0; i <= CONFIG.WORLD_LENGTH; i++) {
      const x = CONFIG.toPx(i)
      
      const line = document.createElement('div')
      line.className = 'grid-vline'
      line.style.left = `${x}px`
      gridOverlay.appendChild(line)
      
      if (i % 5 === 0) {
        const label = document.createElement('div')
        label.className = 'grid-label'
        label.style.left = `${x}px`
        label.textContent = i
        gridOverlay.appendChild(label)
      }
    }
    
    this.worldEl.appendChild(gridOverlay)
  }
  
  _createGround(startX, width) {
    const el = document.createElement('div')
    el.className = 'ground'
    el.style.left = `${startX}px`
    el.style.width = `${width}px`
    el.style.height = `${CONFIG.toPx(CONFIG.GROUND_HEIGHT)}px`
    this.worldEl.appendChild(el)
  }
  
  _createPit(startX) {
    const el = document.createElement('div')
    el.className = 'pit-zone'
    el.style.left = `${startX}px`
    el.style.width = `${CONFIG.GRID_SIZE}px`
    el.style.height = `${CONFIG.toPx(0.2)}px`  // 0.2 unit 深度
    this.worldEl.appendChild(el)
  }
  
  _createGoal() {
    const el = document.createElement('div')
    el.className = 'goal'
    // 终点位置（第 WORLD_LENGTH-1 格）
    el.style.left = `${CONFIG.toPx(CONFIG.WORLD_LENGTH - 1)}px`
    // 旗子底部对齐地面高度
    el.style.bottom = `${CONFIG.toPx(CONFIG.GROUND_HEIGHT)}px`
    // 旗子大小使用 GOAL_SIZE
    const goalWidth = CONFIG.toPx(CONFIG.GOAL_SIZE)  // 0.8 unit 宽
    const goalHeight = CONFIG.toPx(CONFIG.GOAL_SIZE * 1.4) // 更高一点
    el.style.width = `${goalWidth}px`
    el.style.height = `${goalHeight}px`
    
    // 旗杆使用相对尺寸
    const poleWidth = Math.max(3, Math.floor(goalWidth * 0.08))
    const poleHeight = goalHeight
    const flagWidth = Math.floor(goalWidth * 0.7)
    const flagHeight = Math.floor(goalHeight * 0.35)
    
    el.innerHTML = `
      <div class="goal-pole" style="
        position: absolute;
        left: ${Math.floor(goalWidth * 0.15)}px;
        bottom: 0;
        width: ${poleWidth}px;
        height: ${poleHeight}px;
        background: linear-gradient(90deg, #888 0%, #eee 50%, #888 100%);
        border-radius: 2px;
      "></div>
      <div class="goal-flag" style="
        position: absolute;
        left: ${Math.floor(goalWidth * 0.15) + poleWidth}px;
        top: ${Math.floor(goalHeight * 0.08)}px;
        width: ${flagWidth}px;
        height: ${flagHeight}px;
        background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
        clip-path: polygon(0 0, 100% 50%, 0 100%);
        animation: wave 2s ease-in-out infinite;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      "></div>
    `
    this.worldEl.appendChild(el)
  }
  
  _createPlayer() {
    this.playerEl = document.createElement('div')
    this.playerEl.id = 'player'
    // 玩家大小
    const playerSize = CONFIG.toPx(CONFIG.PLAYER_SIZE)
    this.playerEl.style.width = `${playerSize}px`
    this.playerEl.style.height = `${playerSize}px`
    
    // 创建狐狸结构（侧面视角，四条腿）
    this.playerEl.innerHTML = `
      <div class="fox-container state-idle" data-state="idle">
        <div class="fox-tail"></div>
        <div class="fox-leg-back-far"></div>
        <div class="fox-body"></div>
        <div class="fox-leg-back-near"></div>
        <div class="fox-leg-front-far"></div>
        <div class="fox-head">
          <div class="fox-ear-far"></div>
          <div class="fox-ear-near"></div>
          <div class="fox-eye"></div>
          <div class="fox-nose"></div>
        </div>
        <div class="fox-leg-front-near"></div>
      </div>
    `
    this.worldEl.appendChild(this.playerEl)
    
    // 获取狐狸容器用于动画控制
    this.foxContainer = this.playerEl.querySelector('.fox-container')
    this.foxTail = this.playerEl.querySelector('.fox-tail')
    
    // 初始化动画状态
    this._foxState = 'idle'
    this._foxLastY = 0
    this._foxVelocity = 0
    this._foxOnGround = true
    
    // 尾巴WAAPI动画控制（实现类似Spine的动画混合）
    this._tailAnimation = null
    // 延迟启动动画，确保DOM已渲染
    requestAnimationFrame(() => {
      this._startTailAnimation('idle')
    })
  }
  
  /**
   * 使用WAAPI启动尾巴动画（无过渡，直接切换）
   */
  _startTailAnimation(state) {
    if (!this.foxTail) return
    
    // 停止当前动画
    if (this._tailAnimation) {
      this._tailAnimation.cancel()
      this._tailAnimation = null
    }
    
    // 根据状态定义动画（直接切换，无过渡）
    let keyframes, options
    
    switch(state) {
      case 'run':
        keyframes = [
          { transform: 'rotate(-10deg)' },
          { transform: 'rotate(15deg)' },
          { transform: 'rotate(-10deg)' }
        ]
        options = { duration: 300, iterations: Infinity }
        break
      case 'jump-up':
        keyframes = [
          { transform: 'rotate(-30deg) scaleX(0.9)' }
        ]
        options = { duration: 1000, fill: 'both' }
        break
      case 'jump-down':
        keyframes = [
          { transform: 'rotate(20deg)' }
        ]
        options = { duration: 1000, fill: 'both' }
        break
      case 'land':
        keyframes = [
          { transform: 'rotate(-10deg)' }
        ]
        options = { duration: 200, fill: 'forwards' }
        break
      case 'dead':
        // 死亡时停止尾巴动画
        return
      case 'idle':
      default:
        keyframes = [
          { transform: 'rotate(-10deg)' },
          { transform: 'rotate(5deg)' },
          { transform: 'rotate(-10deg)' }
        ]
        options = { duration: 3000, iterations: Infinity }
    }
    
    // 使用WAAPI启动动画
    this._tailAnimation = this.foxTail.animate(keyframes, options)
  }
  
  /**
   * 更新狐狸动画状态（程序自动计算）
   */
  _updateFoxAnimation(player, isMoving, isJump) {
    if (!this.foxContainer) return
    
    const currentY = player.y
    const currentX = player.x
    
    // 计算垂直速度
    this._foxVelocity = currentY - this._foxLastY
    this._foxLastY = currentY
    
    // 判断是否在地面上
    const groundY = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
    const onGround = Math.abs(currentY - groundY) < 5
    
    // 计算新状态
    let newState = 'idle'
    
    if (player.action === 'dead') {
      newState = 'dead'
    } else if (!onGround) {
      // 在空中
      if (this._foxVelocity > 0.5) {
        newState = 'jump-down'  // 下降
      } else if (this._foxVelocity < -0.5) {
        newState = 'jump-up'    // 上升
      } else {
        newState = 'jump-up'    // 最高点附近，保持上升姿态
      }
    } else if (isMoving) {
      newState = 'run'  // 地面移动
    } else {
      newState = 'idle' // 待机
    }
    
    // 落地检测（从空中到地面）
    if (!this._foxOnGround && onGround && this._foxState !== 'idle') {
      newState = 'land'
      // 0.2秒后恢复待机
      setTimeout(() => {
        if (this.foxContainer) {
          this.foxContainer.classList.remove('state-land')
          this.foxContainer.classList.add('state-idle')
          // 同步更新尾巴动画为待机
          this._startTailAnimation('idle')
        }
      }, 200)
    }
    
    // 应用新状态
    if (newState !== this._foxState) {
      this.foxContainer.classList.remove(`state-${this._foxState}`)
      this.foxContainer.classList.add(`state-${newState}`)
      this._foxState = newState
      
      // 使用WAAPI更新尾巴动画（平滑混合）
      this._startTailAnimation(newState)
    }
    
    this._foxOnGround = onGround
  }
  
  _showStatus(emoji, type) {
    if (this.statusText) {
      this.statusText.textContent = emoji
      this.statusText.className = `show ${type}`
    }
  }
  
  _hideStatus() {
    if (this.statusText) {
      this.statusText.className = ''
    }
  }
}

export default GameRenderer
