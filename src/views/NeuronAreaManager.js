/**
 * 神经元区域管理器
 * 负责视图切换和菜单控制
 */

import { NetworkView } from './NetworkView.js'
import { HistoryView } from './HistoryView.js'

export class NeuronAreaManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    this.currentView = null
    this.views = new Map()
    this.activeViewName = 'network'
    
    this.init()
  }
  
  init() {
    // 创建菜单按钮
    this.createMenuButton()
    this.createMenuDropdown()
    
    // 注册视图
    this.registerView('network', NetworkView)
    this.registerView('history', HistoryView)
    
    // 默认显示网络视图
    this.switchView('network')
    
    // 添加双指横滑切换
    this.setupSwipeGesture()
  }
  
  /**
   * 双指横滑切换视图
   */
  setupSwipeGesture() {
    let touchStartX = 0
    let touchStartTime = 0
    
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {  // 双指
        touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        touchStartTime = Date.now()
      }
    }, { passive: true })
    
    this.container.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 2) {
        const touchEndX = (e.changedTouches[0].clientX + e.changedTouches[1].clientX) / 2
        const deltaX = touchEndX - touchStartX
        const deltaTime = Date.now() - touchStartTime
        
        // 快速滑动超过50px
        if (Math.abs(deltaX) > 50 && deltaTime < 500) {
          const views = Array.from(this.views.keys())
          const currentIndex = views.indexOf(this.activeViewName)
          
          if (deltaX > 0 && currentIndex > 0) {
            // 右滑 → 上一个视图
            this.switchView(views[currentIndex - 1])
          } else if (deltaX < 0 && currentIndex < views.length - 1) {
            // 左滑 → 下一个视图
            this.switchView(views[currentIndex + 1])
          }
        }
      }
    }, { passive: true })
  }
  
  createMenuButton() {
    const btn = document.createElement('button')
    btn.id = 'view-menu-btn'
    btn.innerHTML = '☰'
    btn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 4px;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.3);
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    
    btn.addEventListener('click', () => this.toggleMenu())
    this.container.appendChild(btn)
    this.menuBtn = btn
  }
  
  createMenuDropdown() {
    const menu = document.createElement('div')
    menu.id = 'view-menu-dropdown'
    menu.style.cssText = `
      position: absolute;
      top: 48px;
      right: 10px;
      background: #2c3e50;
      border: 1px solid #5a7a94;
      border-radius: 4px;
      padding: 8px 0;
      min-width: 120px;
      z-index: 2001;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `
    
    // 添加分隔线
    const addDivider = () => {
      const divider = document.createElement('div')
      divider.style.cssText = `
        height: 1px;
        background: rgba(255,255,255,0.2);
        margin: 4px 0;
      `
      menu.appendChild(divider)
    }
    
    // 模式切换
    const modes = [
      { id: 'player', label: '👤 玩家游玩' },
      { id: 'ai', label: '🤖 AI控制' },
      { id: 'train', label: '📊 AI训练' }
    ]
    
    let currentMode = 'player'
    
    modes.forEach(item => {
      const el = document.createElement('div')
      el.className = 'menu-item'
      el.textContent = item.label
      el.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        color: #fff;
        font-size: 13px;
      `
      el.addEventListener('click', () => {
        currentMode = item.id
        if (this.onModeChange) {
          this.onModeChange(item.id)
        }
        this.hideMenu()
      })
      el.addEventListener('mouseenter', () => {
        el.style.background = 'rgba(255,255,255,0.1)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent'
      })
      menu.appendChild(el)
    })
    
    addDivider()
    
    // 视图切换
    const items = [
      { id: 'network', label: '🧠 网络结构' },
      { id: 'history', label: '📈 训练历史' }
    ]
    
    items.forEach(item => {
      const el = document.createElement('div')
      el.className = 'menu-item'
      el.textContent = item.label
      el.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        color: #fff;
        font-size: 13px;
      `
      el.addEventListener('click', () => {
        this.switchView(item.id)
        this.hideMenu()
      })
      el.addEventListener('mouseenter', () => {
        el.style.background = 'rgba(255,255,255,0.1)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent'
      })
      menu.appendChild(el)
    })
    
    this.container.appendChild(menu)
    this.menuDropdown = menu
    
    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (!this.menuBtn.contains(e.target) && !this.menuDropdown.contains(e.target)) {
        this.hideMenu()
      }
    })
  }
  
  toggleMenu() {
    if (this.menuDropdown.style.display === 'none') {
      this.showMenu()
    } else {
      this.hideMenu()
    }
  }
  
  showMenu() {
    this.menuDropdown.style.display = 'block'
  }
  
  hideMenu() {
    this.menuDropdown.style.display = 'none'
  }
  
  registerView(name, ViewClass) {
    this.views.set(name, ViewClass)
  }
  
  switchView(name) {
    if (!this.views.has(name)) return
    
    // 销毁旧视图
    if (this.currentView) {
      this.currentView.destroy()
    }
    
    // 清空容器（保留菜单）
    const children = Array.from(this.container.children)
    children.forEach(child => {
      if (child.id !== 'view-menu-btn' && child.id !== 'view-menu-dropdown') {
        child.remove()
      }
    })
    
    // 创建新视图
    const ViewClass = this.views.get(name)
    this.currentView = new ViewClass('neuron-area')
    this.activeViewName = name
    
    // 更新菜单按钮状态
    this.updateMenuButton()
  }
  
  updateMenuButton() {
    const icons = {
      network: '🧠',
      history: '📈'
    }
    this.menuBtn.innerHTML = icons[this.activeViewName] || '☰'
  }
  
  /**
   * 获取当前视图实例
   */
  getCurrentView() {
    return this.currentView
  }
  
  /**
   * 渲染当前视图
   */
  render(...args) {
    if (this.currentView && this.currentView.render) {
      this.currentView.render(...args)
    }
  }
}

export default NeuronAreaManager
