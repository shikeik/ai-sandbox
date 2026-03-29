/**
 * 游戏渲染器
 * 负责将游戏状态渲染到 DOM
 */

import { CONFIG, TERRAIN } from '@game/JumpGame.js'

export class GameRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    this.worldEl = null
    this.playerEl = null
    
    // 信息面板元素
    this.posDisplay = document.getElementById('pos-display')
    this.genDisplay = document.getElementById('gen-display')
    this.statusText = document.getElementById('status-text')
  }

  /**
   * 初始化世界渲染（只需调用一次）
   */
  initWorld(terrain) {
    this.container.innerHTML = ''
    
    // 创建世界容器
    this.worldEl = document.createElement('div')
    this.worldEl.id = 'game-world'
    
    // 渲染网格线
    this._renderGridLines()
    
    // 渲染地形
    terrain.forEach(t => {
      if (t.type === TERRAIN.GROUND) {
        this._createGround(t.start, t.end - t.start)
      } else {
        this._createPit(t.start)
      }
    })
    
    // 渲染终点
    this._createGoal()
    
    // 渲染玩家
    this._createPlayer()
    
    this.container.appendChild(this.worldEl)
  }
  
  /**
   * 更新玩家和相机位置
   */
  update(player, camera) {
    if (this.playerEl) {
      this.playerEl.style.left = `${player.x}px`
      this.playerEl.style.bottom = `${player.y}px`
    }
    
    if (this.worldEl) {
      this.worldEl.style.transform = `translateX(${-camera.x}px)`
    }
    
    if (this.posDisplay) {
      this.posDisplay.textContent = player.grid
    }
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
    if (this.playerEl) {
      this.playerEl.classList.add('falling')
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
    if (this.playerEl) {
      this.playerEl.classList.remove('falling')
    }
    this._hideStatus()
  }

  // ========== 私有渲染方法 ==========
  
  _renderGridLines() {
    const gridOverlay = document.createElement('div')
    gridOverlay.className = 'world-grid'
    
    for (let i = 0; i <= CONFIG.WORLD_LENGTH; i++) {
      const x = i * CONFIG.GRID_SIZE
      
      // 竖线
      const line = document.createElement('div')
      line.className = 'grid-vline'
      line.style.left = `${x}px`
      gridOverlay.appendChild(line)
      
      // 编号（每5格显示）
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
    this.worldEl.appendChild(el)
  }
  
  _createPit(startX) {
    const el = document.createElement('div')
    el.className = 'pit-zone'
    el.style.left = `${startX}px`
    this.worldEl.appendChild(el)
  }
  
  _createGoal() {
    const el = document.createElement('div')
    el.className = 'goal'
    el.style.left = `${(CONFIG.WORLD_LENGTH - 1) * CONFIG.GRID_SIZE}px`
    el.innerHTML = `
      <div class="goal-pole"></div>
      <div class="goal-flag"></div>
    `
    this.worldEl.appendChild(el)
  }
  
  _createPlayer() {
    this.playerEl = document.createElement('div')
    this.playerEl.id = 'player'
    this.worldEl.appendChild(this.playerEl)
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
