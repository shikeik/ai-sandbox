/**
 * 跳跃游戏核心逻辑
 * 
 * 【游戏机制】
 * - 32格横版世界，地面有平地(可站)和坑(掉落死亡)
 * - 玩家只能：右移(x+1) 或 跳跃(x+2，抛物线)
 * - 跳跃落点坑上 → 死亡
 * - 移动中踩坑 → 死亡
 * - 到达终点(x30) → 胜利
 * 
 * 【使用方式】
 * const game = new JumpGame()
 * game.init()                    // 初始化世界
 * game.execute('right')          // 执行动作
 * game.execute('jump')
 * 
 * 【获取AI输入】
 * game.getStateForAI() -> { playerGrid, terrainAhead[], isJumping }
 */

// ========== 游戏常量 ==========
export const CONFIG = {
  WORLD_LENGTH: 32,       // 世界总格子数
  GRID_SIZE: 100,         // 每格像素宽度
  GROUND_HEIGHT: 80,      // 地面高度(像素)
  JUMP_HEIGHT: 100,       // 跳跃高度(像素)
  MOVE_DURATION: 400,     // 移动动画时长(ms)
  JUMP_DURATION: 600,     // 跳跃动画时长(ms)
  CAMERA_OFFSET_RATIO: 0.3, // 玩家在屏幕左侧30%位置
}

// 动作类型
export const ACTION = {
  RIGHT: 'right',
  JUMP: 'jump'
}

// 游戏状态
export const STATUS = {
  IDLE: 'idle',      // 待机，可接受操作
  MOVING: 'moving',  // 移动中
  DEAD: 'dead',      // 死亡
  WON: 'won'         // 胜利
}

// 地形类型
export const TERRAIN = {
  GROUND: 'ground',
  PIT: 'pit'
}

/**
 * 游戏核心类
 * 只关心：世界状态、动作执行、碰撞检测、胜负判定
 * 不关心：如何渲染、谁触发动作
 */
export class JumpGame {
  constructor() {
    // 世界地形数据
    this.terrain = []
    
    // 玩家状态
    this.player = {
      x: 0,           // 像素坐标
      y: 0,           // 像素坐标（离地高度）
      grid: 0,        // 所在格子
      status: STATUS.IDLE
    }
    
    // 相机位置（像素）
    this.camera = { x: 0 }
    
    // 世代计数（死亡/胜利后+1）
    this.generation = 1
    
    // 视口宽度（由外部设置）
    this.viewportWidth = 0
    
    // 动画相关
    this._animationId = null
    this._isProcessing = false
    
    // 事件回调
    this.onStateChange = null    // (player, camera) => void
    this.onActionStart = null    // (action) => void
    this.onActionEnd = null      // (result) => void
    this.onDeath = null          // () => void
    this.onWin = null            // () => void
    this.onGenerationChange = null // (gen) => void
  }

  // ========== 初始化 ==========
  
  /**
   * 初始化游戏世界
   * 生成地形，重置玩家位置
   */
  init() {
    this._generateTerrain()
    this._resetPlayer()
    this._notifyStateChange()
    return this
  }
  
  /**
   * 设置视口宽度（用于相机计算）
   */
  setViewportWidth(width) {
    this.viewportWidth = width
    this._updateCamera()
  }

  // ========== 核心操作 ==========
  
  /**
   * 执行动作
   * @param {string} action - 'right' | 'jump'
   * @returns {boolean} - 是否成功开始执行
   */
  execute(action) {
    // 只有待机状态才能执行动作
    if (this.player.status !== STATUS.IDLE || this._isProcessing) {
      return false
    }
    
    if (action === ACTION.RIGHT) {
      this._startMove(CONFIG.GRID_SIZE, false)
    } else if (action === ACTION.JUMP) {
      this._startMove(CONFIG.GRID_SIZE * 2, true)
    } else {
      return false
    }
    
    if (this.onActionStart) {
      this.onActionStart(action)
    }
    
    return true
  }
  
  /**
   * 获取AI决策所需的状态
   * @returns {Object} AI输入状态
   */
  getStateForAI() {
    const grid = this.player.grid
    return {
      playerGrid: grid,
      isJumping: this.player.status === STATUS.MOVING && this.player.y > CONFIG.GROUND_HEIGHT,
      // 前方3格的地形
      terrainAhead: [
        this._getTerrainAt(grid + 1),
        this._getTerrainAt(grid + 2),
        this._getTerrainAt(grid + 3)
      ]
    }
  }
  
  /**
   * 获取当前完整状态（用于渲染）
   */
  getState() {
    return {
      player: { ...this.player },
      camera: { ...this.camera },
      terrain: this.terrain,
      generation: this.generation
    }
  }

  // ========== 动作执行（核心逻辑） ==========
  
  _startMove(deltaX, isJump) {
    this._isProcessing = true
    this.player.status = STATUS.MOVING
    
    const startX = this.player.x
    const startY = this.player.y
    const targetX = startX + deltaX
    const duration = isJump ? CONFIG.JUMP_DURATION : CONFIG.MOVE_DURATION
    const startTime = performance.now()
    
    const animate = (time) => {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // 缓动函数：easeInOutQuad
      const t = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress
      
      // 更新位置
      this.player.x = startX + (targetX - startX) * t
      
      if (isJump) {
        // 抛物线跳跃
        const height = Math.sin(progress * Math.PI) * CONFIG.JUMP_HEIGHT
        this.player.y = startY + height
      } else {
        // 平地移动
        this.player.y = startY
      }
      
      // 移动中实时检测踩空（非跳跃时）
      if (!isJump && !this._isOnGround(this.player.x)) {
        this._die()
        return
      }
      
      this.player.grid = Math.floor(this.player.x / CONFIG.GRID_SIZE)
      this._updateCamera()
      this._notifyStateChange()
      
      if (progress < 1) {
        this._animationId = requestAnimationFrame(animate)
      } else {
        // 动作结束，落地检测
        this._finishMove(targetX)
      }
    }
    
    this._animationId = requestAnimationFrame(animate)
  }
  
  _finishMove(finalX) {
    this.player.y = CONFIG.GROUND_HEIGHT
    this._isProcessing = false
    
    const finalGrid = Math.floor(finalX / CONFIG.GRID_SIZE)
    
    // 检测落点
    if (this._isInPit(finalX)) {
      this._die()
    } else if (finalGrid >= CONFIG.WORLD_LENGTH - 1) {
      this._win()
    } else {
      this.player.status = STATUS.IDLE
      this._notifyStateChange()
      
      if (this.onActionEnd) {
        this.onActionEnd({ success: true, grid: finalGrid })
      }
    }
  }

  // ========== 胜负判定 ==========
  
  _die() {
    this.player.status = STATUS.DEAD
    this._isProcessing = false
    
    if (this.onDeath) this.onDeath()
    
    // 延迟后进入下一代
    setTimeout(() => this._nextGeneration(), 1500)
  }
  
  _win() {
    this.player.status = STATUS.WON
    this._isProcessing = false
    
    if (this.onWin) this.onWin()
    
    // 延迟后进入下一代
    setTimeout(() => this._nextGeneration(), 1500)
  }
  
  _nextGeneration() {
    this.generation++
    this.init()  // 先初始化世界（重建 DOM）
    if (this.onGenerationChange) {
      this.onGenerationChange(this.generation)  // 再清理视觉状态
    }
  }

  // ========== 地形生成 ==========
  
  _generateTerrain() {
    this.terrain = []
    
    let currentGrid = 0
    let lastWasPit = false
    
    // 起点（强制2格平地）
    this._addGround(0, 2)
    currentGrid = 2
    
    // 生成中间地形
    while (currentGrid < CONFIG.WORLD_LENGTH - 2) {
      if (lastWasPit) {
        // 上一个是坑，这次必须是平地
        const len = 1 + Math.floor(Math.random() * 2)
        this._addGround(currentGrid, len)
        currentGrid += len
        lastWasPit = false
      } else {
        // 上一个不是坑，60%概率平地，40%概率坑
        if (Math.random() < 0.6) {
          const len = 1 + Math.floor(Math.random() * 2)
          this._addGround(currentGrid, len)
          currentGrid += len
          lastWasPit = false
        } else {
          this._addPit(currentGrid)
          currentGrid += 1
          lastWasPit = true
        }
      }
    }
    
    // 终点前强制平地
    this._addGround(currentGrid, 2)
  }
  
  _addGround(startGrid, length) {
    this.terrain.push({
      type: TERRAIN.GROUND,
      start: startGrid * CONFIG.GRID_SIZE,
      end: (startGrid + length) * CONFIG.GRID_SIZE
    })
  }
  
  _addPit(grid) {
    this.terrain.push({
      type: TERRAIN.PIT,
      start: grid * CONFIG.GRID_SIZE,
      end: (grid + 1) * CONFIG.GRID_SIZE
    })
  }

  // ========== 碰撞检测 ==========
  
  /**
   * 检查某像素位置是否有地面
   */
  _isOnGround(x) {
    return this.terrain.some(t => 
      t.type === TERRAIN.GROUND && x >= t.start && x < t.end
    )
  }
  
  /**
   * 检查某像素位置是否在坑上
   */
  _isInPit(x) {
    return this.terrain.some(t => 
      t.type === TERRAIN.PIT && x >= t.start && x < t.end
    )
  }
  
  /**
   * 获取指定格子的地形类型
   */
  _getTerrainAt(grid) {
    const x = grid * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2
    if (this._isInPit(x)) return TERRAIN.PIT
    return TERRAIN.GROUND
  }

  // ========== 玩家与相机 ==========
  
  _resetPlayer() {
    this.player.x = CONFIG.GRID_SIZE * 0.5 - 20  // 第0格中间偏左
    this.player.y = CONFIG.GROUND_HEIGHT
    this.player.grid = 0
    this.player.status = STATUS.IDLE
    this._isProcessing = false
    this._updateCamera()
  }
  
  _updateCamera() {
    if (this.viewportWidth <= 0) return
    
    const targetX = this.player.x - this.viewportWidth * CONFIG.CAMERA_OFFSET_RATIO
    const maxX = (CONFIG.WORLD_LENGTH * CONFIG.GRID_SIZE) - this.viewportWidth
    this.camera.x = Math.max(0, Math.min(targetX, maxX))
  }

  // ========== 事件通知 ==========
  
  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(
        { ...this.player },
        { ...this.camera }
      )
    }
  }

  // ========== 清理 ==========
  
  destroy() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId)
    }
  }
}

export default JumpGame
