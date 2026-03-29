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
 * game.execute('right')          // 执行动作（立即完成逻辑）
 * game.execute('jump')
 * 
 * 【获取AI输入】
 * game.getStateForAI() -> { playerGrid, terrainAhead[], isMoving }
 */

// ========== 游戏常量 ==========
// 所有尺寸使用"单位"(unit)，1 unit = 1格 = GRID_SIZE 像素
export const CONFIG = {
  WORLD_LENGTH: 32,       // 世界总格子数
  
  // 视野配置（单位）
  VIEWPORT_GRID_W: 6,     // 视野宽度（单位）
  VIEWPORT_GRID_H: 4,     // 视野高度（单位）
  
  // 运行时动态计算的像素值
  GRID_SIZE: 100,         // 1 unit = ? 像素（正方形）
  
  // 游戏元素尺寸（单位）
  GROUND_HEIGHT: 0.8,     // 地面高度（单位）
  PLAYER_SIZE: 0.45,      // 玩家大小（单位）- 稍微小一点，留出视觉空间
  GOAL_SIZE: 0.8,         // 终点旗子大小（单位）- 比之前大一点
  JUMP_HEIGHT: 1.0,       // 跳跃高度（单位）
  // 坐标系说明：玩家位置(x,y)是左下角坐标（对应CSS left/bottom）
  // 第0格范围：[0, 1] unit，中心在 0.5 unit
  // 玩家居中放置：左边缘 = 格子中心 - 玩家大小/2 = 0.5 - 0.45/2 = 0.275
  PLAYER_START_X: 0.275,  // 玩家初始X位置（单位），使玩家在第0格居中
  
  // 动画
  MOVE_DURATION: 400,     // 移动动画时长(ms)
  JUMP_DURATION: 600,     // 跳跃动画时长(ms)
  CAMERA_OFFSET_RATIO: 0.3, // 玩家在屏幕左侧30%位置
  
  // 辅助函数：单位转像素
  toPx(units) { return Math.floor(units * this.GRID_SIZE) },
  // 辅助函数：像素转单位
  toUnits(px) { return px / this.GRID_SIZE }
}

// 动作类型
export const ACTION = {
  RIGHT: 'right',
  JUMP: 'jump'
}

// 游戏状态
export const STATUS = {
  IDLE: 'idle',      // 待机，可接受操作
  MOVING: 'moving',  // 移动中（视觉动画播放中，逻辑已完成）
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
 * 逻辑层：动作立即执行，无等待
 * 视觉层：由渲染器处理补间动画
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
    
    // 事件回调
    this.onStateChange = null    // (player, camera) => void
    this.onActionStart = null    // (action, from, to, isJump) => void
    this.onActionEnd = null      // (result) => void
    this.onDeath = null          // () => void - 延迟到补间完成
    this.onWin = null            // () => void - 延迟到补间完成
    this.onGenerationChange = null // (gen) => void
    
    // 视觉状态（等待补间完成）
    this._pendingDeath = false
    this._pendingWin = false
    
    // 输入控制（独立于视觉状态）
    this._inputLocked = false
  }

  // ========== 初始化 ==========
  
  init() {
    this._pendingDeath = false
    this._pendingWin = false
    this._inputLocked = false
    this._generateTerrain()
    this._resetPlayer()
    this._notifyStateChange()
    return this
  }
  
  /**
   * 设置视口大小，动态计算 1 unit = ? 像素
   * @param {number} width - 视口宽度（像素）
   */
  setViewportSize(width) {
    // 计算 1 unit = ? 像素
    CONFIG.GRID_SIZE = Math.floor(width / CONFIG.VIEWPORT_GRID_W)
    
    this.viewportWidth = width
    this.viewportHeight = CONFIG.toPx(CONFIG.VIEWPORT_GRID_H)
    
    this._updateCamera()
  }

  // ========== 核心操作 ==========
  
  /**
   * 执行动作（立即完成逻辑）
   * @param {string} action - 'right' | 'jump'
   * @returns {Object|null} - 动作信息或失败
   */
  execute(action) {
    // 检查输入是否被锁定（死亡/胜利状态）
    if (this._inputLocked) {
      return null
    }
    
    const fromX = this.player.x
    const fromY = this.player.y
    const isJump = action === ACTION.JUMP
    
    // 计算目标位置（像素）
    let targetX
    if (action === ACTION.RIGHT) {
      targetX = fromX + CONFIG.toPx(1)  // 移动 1 unit
    } else if (action === ACTION.JUMP) {
      targetX = fromX + CONFIG.toPx(2)  // 跳跃 2 unit
    } else {
      return null
    }
    
    // 立即执行逻辑
    this.player.x = targetX
    this.player.y = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
    this.player.grid = Math.floor(targetX / CONFIG.GRID_SIZE)
    this.player.status = STATUS.MOVING  // 视觉上还在移动
    
    // 更新相机
    this._updateCamera()
    
    // 通知动作开始（提供补间所需信息）
    if (this.onActionStart) {
      this.onActionStart(action, { x: fromX, y: fromY }, { x: targetX, y: CONFIG.toPx(CONFIG.GROUND_HEIGHT) }, isJump)
    }
    
    this._notifyStateChange()
    
    // 立即检测结果
    this._checkResult(targetX)
    
    return { action, fromX, fromY, targetX, isJump }
  }
  
  /**
   * 通知渲染层动画完成（由渲染器调用）
   */
  notifyVisualComplete() {
    // 优先处理死亡/胜利
    if (this._pendingDeath) {
      this.triggerDeath()
      return
    }
    if (this._pendingWin) {
      this.triggerWin()
      return
    }
    
    // 正常完成
    if (this.player.status === STATUS.MOVING) {
      this.player.status = STATUS.IDLE
      this._notifyStateChange()
      
      if (this.onActionEnd) {
        this.onActionEnd({ success: true, grid: this.player.grid })
      }
    }
  }
  
  getStateForAI() {
    const grid = this.player.grid
    return {
      playerGrid: grid,
      isMoving: this.player.status === STATUS.MOVING,
      terrainAhead: [
        this._getTerrainAt(grid + 1),
        this._getTerrainAt(grid + 2),
        this._getTerrainAt(grid + 3)
      ]
    }
  }
  
  getState() {
    return {
      player: { ...this.player },
      camera: { ...this.camera },
      terrain: this.terrain,
      generation: this.generation
    }
  }

  // ========== 结果判定 ==========
  
  _checkResult(finalX) {
    // 检测落点
    if (this._isInPit(finalX)) {
      this.player.status = STATUS.DEAD
      this._pendingDeath = true
      this._inputLocked = true  // 锁定输入，等待死亡动画
    } else if (this.player.grid >= CONFIG.WORLD_LENGTH - 1) {
      this.player.status = STATUS.WON
      this._pendingWin = true
      this._inputLocked = true  // 锁定输入，等待胜利动画
    }
    // 否则等待动画完成，由 notifyVisualComplete 设为 IDLE
  }
  
  /**
   * 触发死亡（由渲染器在补间完成后调用）
   */
  triggerDeath() {
    if (!this._pendingDeath) return
    this._pendingDeath = false
    this._inputLocked = true  // 锁定输入
    if (this.onDeath) this.onDeath()
    setTimeout(() => this._nextGeneration(), 1500)
  }
  
  /**
   * 触发胜利（由渲染器在补间完成后调用）
   */
  triggerWin() {
    if (!this._pendingWin) return
    this._pendingWin = false
    this._inputLocked = true  // 锁定输入
    if (this.onWin) this.onWin()
    setTimeout(() => this._nextGeneration(), 1500)
  }
  
  _nextGeneration() {
    this.generation++
    this.init()
    if (this.onGenerationChange) {
      this.onGenerationChange(this.generation)
    }
  }

  // ========== 地形生成 ==========
  
  _generateTerrain() {
    this.terrain = []
    let currentGrid = 0
    let lastWasPit = false
    
    this._addGround(0, 2)
    currentGrid = 2
    
    while (currentGrid < CONFIG.WORLD_LENGTH - 2) {
      if (lastWasPit) {
        const len = 1 + Math.floor(Math.random() * 2)
        this._addGround(currentGrid, len)
        currentGrid += len
        lastWasPit = false
      } else {
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
    
    this._addGround(currentGrid, 2)
  }
  
  _addGround(startGrid, length) {
    this.terrain.push({
      type: TERRAIN.GROUND,
      start: CONFIG.toPx(startGrid),
      end: CONFIG.toPx(startGrid + length)
    })
  }
  
  _addPit(grid) {
    this.terrain.push({
      type: TERRAIN.PIT,
      start: CONFIG.toPx(grid),
      end: CONFIG.toPx(grid + 1)
    })
  }

  // ========== 碰撞检测 ==========
  
  _isInPit(x) {
    return this.terrain.some(t => 
      t.type === TERRAIN.PIT && x >= t.start && x < t.end
    )
  }
  
  _getTerrainAt(grid) {
    const x = CONFIG.toPx(grid) + CONFIG.toPx(0.5)  // 格子中心
    if (this._isInPit(x)) return TERRAIN.PIT
    return TERRAIN.GROUND
  }

  // ========== 玩家与相机 ==========
  
  _resetPlayer() {
    // 玩家初始位置：第0格 + 偏移量，使其居中
    this.player.x = CONFIG.toPx(CONFIG.PLAYER_START_X)
    this.player.y = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
    this.player.grid = 0
    this.player.status = STATUS.IDLE
    this._updateCamera()
  }
  
  _updateCamera(playerX = this.player.x) {
    if (this.viewportWidth <= 0) return
    const targetX = playerX - this.viewportWidth * CONFIG.CAMERA_OFFSET_RATIO
    const maxX = CONFIG.toPx(CONFIG.WORLD_LENGTH) - this.viewportWidth
    this.camera.x = Math.max(0, Math.min(targetX, maxX))
  }

  // ========== 事件通知 ==========
  
  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.player }, { ...this.camera })
    }
  }
}

export default JumpGame
