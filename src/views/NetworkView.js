/**
 * 网络拓扑视图
 * 动态渲染神经网络结构，支持任意层数
 */

export class NetworkView {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    this.canvas = null
    this.ctx = null
    // 绑定 resize 处理函数以便后续移除
    this._resizeHandler = () => this.resize()
    this.init()
  }
  
  init() {
    // 只移除已有的canvas和占位符，不清空整个容器（保留菜单按钮）
    const oldCanvas = this.container.querySelector('canvas')
    if (oldCanvas) oldCanvas.remove()
    
    // 移除 HTML 中的占位符
    const placeholder = this.container.querySelector('#neuron-placeholder')
    if (placeholder) placeholder.remove()
    
    this.canvas = document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
    
    // 响应式
    this.resize()
    window.addEventListener('resize', this._resizeHandler)
  }
  
  resize() {
    const rect = this.container.getBoundingClientRect()
    this.canvas.width = rect.width * window.devicePixelRatio
    this.canvas.height = rect.height * window.devicePixelRatio
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    this.width = rect.width
    this.height = rect.height
  }
  
  /**
   * 渲染网络
   * @param {NeuralNetwork} network - 神经网络实例
   * @param {number[]} inputs - 当前输入（用于高亮）
   * @param {number} action - 当前选中的动作
   */
  render(network, inputs = null, action = null) {
    const ctx = this.ctx
    const w = this.width
    const h = this.height
    
    // 清空
    ctx.clearRect(0, 0, w, h)
    
    // 获取结构
    const structure = network.getStructure()
    const layers = network.layerSizes
    const weights = network.weights
    
    // 计算节点位置
    const nodePositions = this.calculatePositions(layers, w, h)
    
    // 绘制连线
    this.drawConnections(ctx, nodePositions, weights, inputs)
    
    // 绘制节点
    this.drawNodes(ctx, nodePositions, inputs, action)
    
    // 绘制信息
    this.drawInfo(ctx, w, h, structure)
    
    // 绘制权重矩阵面板
    this.drawWeightMatrix(ctx, w, h, weights, inputs)
  }
  
  calculatePositions(layers, w, h) {
    const positions = []
    const layerCount = layers.length
    const marginX = w * 0.15
    const marginY = h * 0.15
    
    for (let l = 0; l < layerCount; l++) {
      const layerSize = layers[l]
      const x = marginX + (w - 2 * marginX) * l / (layerCount - 1)
      const layerPos = []
      
      for (let n = 0; n < layerSize; n++) {
        const y = marginY + (h - 2 * marginY) * n / Math.max(1, layerSize - 1)
        layerPos.push({ x, y })
      }
      
      positions.push(layerPos)
    }
    
    return positions
  }
  
  drawConnections(ctx, positions, weights, inputs) {
    for (let l = 0; l < weights.length; l++) {
      const fromLayer = positions[l]
      const toLayer = positions[l + 1]
      const layerWeights = weights[l]
      
      for (let i = 0; i < fromLayer.length; i++) {
        for (let j = 0; j < toLayer.length; j++) {
          const weight = layerWeights[j][i]
          const from = fromLayer[i]
          const to = toLayer[j]
          
          // 连线粗细表示权重绝对值
          const thickness = Math.min(4, Math.abs(weight) * 2 + 0.5)
          const alpha = Math.min(1, Math.abs(weight) * 0.3 + 0.2)
          
          // 颜色：正=绿，负=红
          const color = weight > 0 ? `rgba(46, 204, 113, ${alpha})` : `rgba(231, 76, 60, ${alpha})`
          
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.strokeStyle = color
          ctx.lineWidth = thickness
          ctx.stroke()
          
          // 显示权重数值（较大的）
          if (Math.abs(weight) > 0.5) {
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2
            ctx.fillStyle = 'rgba(255,255,255,0.7)'
            ctx.font = '10px monospace'
            ctx.textAlign = 'center'
            ctx.fillText(weight.toFixed(1), midX, midY)
          }
        }
      }
    }
  }
  
  drawNodes(ctx, positions, inputs, action) {
    const layerNames = ['输入', '输出']
    const actionNames = ['移动', '跳跃']
    
    for (let l = 0; l < positions.length; l++) {
      const layer = positions[l]
      
      for (let n = 0; n < layer.length; n++) {
        const pos = layer[n]
        const isInput = l === 0
        const isOutput = l === positions.length - 1
        
        // 节点大小
        const radius = isOutput ? 22 : 18
        
        // 背景
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
        
        if (isInput && inputs) {
          // 输入节点根据值着色
          const val = inputs[n]
          ctx.fillStyle = val > 0.5 ? '#e74c3c' : '#95a5a6'
        } else if (isOutput && action === n) {
          // 选中的输出节点高亮
          ctx.fillStyle = '#f39c12'
        } else {
          ctx.fillStyle = '#34495e'
        }
        
        ctx.fill()
        ctx.strokeStyle = '#ecf0f1'
        ctx.lineWidth = 2
        ctx.stroke()
        
        // 标签
        ctx.fillStyle = '#fff'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        if (isInput) {
          const labels = ['前一格', '前两格', '前三格']
          ctx.fillText(labels[n] || `i${n}`, pos.x, pos.y)
        } else if (isOutput) {
          ctx.fillText(actionNames[n], pos.x, pos.y)
        }
      }
    }
  }
  
  drawInfo(ctx, w, h, structure) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`结构: ${structure.layerSizes.join('-')}`, 10, 20)
    ctx.fillText(`权重数: ${structure.totalWeights}`, 10, 38)
  }
  
  /**
   * 绘制权重矩阵面板
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - 画布宽度
   * @param {number} h - 画布高度
   * @param {number[][][]} weights - 权重数组
   * @param {number[]} inputs - 当前输入（用于高亮相关权重）
   */
  drawWeightMatrix(ctx, w, h, weights, inputs) {
    // 只绘制第一层权重（输入→输出）
    if (!weights || weights.length === 0) return
    
    const layerWeights = weights[0]  // [输出数][输入数]
    const outputNames = ['移动', '跳跃']
    const inputLabels = ['前一格', '前两格', '前三格']
    
    // 面板位置和大小
    const panelW = 140
    const panelH = 100
    const x = w - panelW - 10
    const y = h - panelH - 10
    
    // 绘制背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(x, y, panelW, panelH)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, panelW, panelH)
    
    // 标题
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('权重矩阵', x + panelW / 2, y + 14)
    
    // 表头
    ctx.font = '10px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    for (let i = 0; i < inputLabels.length; i++) {
      ctx.fillText(inputLabels[i][0], x + 35 + i * 32, y + 30)  // 只显示第一个字
    }
    
    // 绘制权重值
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    for (let o = 0; o < layerWeights.length; o++) {
      // 输出行标签
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.textAlign = 'left'
      ctx.font = '10px sans-serif'
      ctx.fillText(outputNames[o], x + 4, y + 50 + o * 22)
      
      // 权重值
      ctx.textAlign = 'center'
      ctx.font = 'bold 11px monospace'
      for (let i = 0; i < layerWeights[o].length; i++) {
        const weight = layerWeights[o][i]
        // 正数绿色，负数红色，零灰色
        if (weight > 0) {
          ctx.fillStyle = '#2ecc71'
        } else if (weight < 0) {
          ctx.fillStyle = '#e74c3c'
        } else {
          ctx.fillStyle = '#95a5a6'
        }
        
        // 如果对应输入为1，高亮显示
        if (inputs && inputs[i] > 0.5) {
          ctx.fillStyle = weight > 0 ? '#27ae60' : '#c0392b'
        }
        
        ctx.fillText(weight.toFixed(1), x + 38 + i * 32, y + 50 + o * 22)
      }
    }
  }
  
  destroy() {
    // 清理 resize 监听器
    window.removeEventListener('resize', this._resizeHandler)
    this.canvas?.remove()
  }
}

export default NetworkView
