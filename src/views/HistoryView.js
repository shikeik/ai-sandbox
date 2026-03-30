/**
 * 历史折线图视图
 * 支持数据密集时动态采样
 */

export class HistoryView {
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
   * 渲染历史折线
   * @param {Array} history - 历史数据数组
   * @param {number} maxPoints - 最大显示点数（默认100）
   */
  render(history, maxPoints = 100) {
    const ctx = this.ctx
    const w = this.width
    const h = this.height
    
    ctx.clearRect(0, 0, w, h)
    
    if (history.length === 0) {
      this.drawEmpty(ctx, w, h)
      return
    }
    
    // 动态采样
    const sampled = this.sampleData(history, maxPoints)
    
    // 计算范围
    const steps = sampled.map(d => d.steps)
    const maxStep = Math.max(...steps, 10)
    const minStep = 0
    
    // 边距
    const margin = { top: 40, right: 20, bottom: 40, left: 50 }
    const chartW = w - margin.left - margin.right
    const chartH = h - margin.top - margin.bottom
    
    // 绘制网格
    this.drawGrid(ctx, margin, chartW, chartH, maxStep)
    
    // 绘制折线
    this.drawLine(ctx, sampled, margin, chartW, chartH, maxStep, minStep)
    
    // 绘制标签
    this.drawLabels(ctx, margin, chartW, chartH, maxStep, sampled)
    
    // 绘制统计
    this.drawStats(ctx, w, h, history)
  }
  
  /**
   * 动态采样：数据密集时合并点
   */
  sampleData(data, maxPoints) {
    if (data.length <= maxPoints) {
      return data
    }
    
    const sampled = []
    const bucketSize = Math.ceil(data.length / maxPoints)
    
    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize)
      // 取桶内平均值
      const avgSteps = bucket.reduce((sum, d) => sum + d.steps, 0) / bucket.length
      sampled.push({
        generation: bucket[Math.floor(bucket.length / 2)].generation,
        steps: avgSteps
      })
    }
    
    return sampled
  }
  
  drawGrid(ctx, margin, chartW, chartH, maxStep) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    
    // 水平网格线（5条）
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + chartH * i / 5
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartW, y)
      ctx.stroke()
    }
  }
  
  drawLine(ctx, data, margin, chartW, chartH, maxStep, minStep) {
    if (data.length < 2) return
    
    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 2
    ctx.beginPath()
    
    for (let i = 0; i < data.length; i++) {
      const x = margin.left + chartW * i / (data.length - 1)
      const y = margin.top + chartH * (1 - (data[i].steps - minStep) / (maxStep - minStep))
      
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    ctx.stroke()
    
    // 绘制数据点
    ctx.fillStyle = '#ecf0f1'
    for (let i = 0; i < data.length; i += Math.ceil(data.length / 20)) {
      const x = margin.left + chartW * i / (data.length - 1)
      const y = margin.top + chartH * (1 - (data[i].steps - minStep) / (maxStep - minStep))
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  
  drawLabels(ctx, margin, chartW, chartH, maxStep, data) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    
    // Y轴标签
    for (let i = 0; i <= 5; i++) {
      const val = Math.round(maxStep * (1 - i / 5))
      const y = margin.top + chartH * i / 5 + 4
      ctx.fillText(val.toString(), margin.left - 8, y)
    }
    
    // X轴标签
    ctx.textAlign = 'center'
    ctx.fillText('世代', margin.left + chartW / 2, margin.top + chartH + 25)
    
    // 起始和结束世代
    if (data.length > 0) {
      ctx.fillText(data[0].generation.toString(), margin.left, margin.top + chartH + 18)
      ctx.fillText(data[data.length - 1].generation.toString(), margin.left + chartW, margin.top + chartH + 18)
    }
  }
  
  drawStats(ctx, w, h, history) {
    const steps = history.map(d => d.steps)
    const best = Math.max(...steps)
    const avg = steps.reduce((a, b) => a + b, 0) / steps.length
    
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    
    ctx.fillText(`共${history.length}代 最佳:${best} 平均:${avg.toFixed(1)}`, 10, 20)
  }
  
  drawEmpty(ctx, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('暂无训练数据', w / 2, h / 2)
  }
  
  destroy() {
    // 清理 resize 监听器
    window.removeEventListener('resize', this._resizeHandler)
    this.canvas?.remove()
  }
}

export default HistoryView
