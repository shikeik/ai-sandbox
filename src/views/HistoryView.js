/**
 * 历史折线图视图
 * 支持数据密集时动态采样
 */

export class HistoryView {
	constructor(containerId) {
	this.container = document.getElementById(containerId)
	this.canvas = null
	this.ctx = null
	this.lastData = null // 缓存数据
	this.init()
	}
	
	init() {
	const oldCanvas = this.container.querySelector('canvas')
	if (oldCanvas) oldCanvas.remove()
	
	const placeholder = this.container.querySelector('#neuron-placeholder')
	if (placeholder) placeholder.remove()
	
	this.canvas = document.createElement('canvas')
	// 【修复无限拉伸】：绝对定位脱离文档流
	this.canvas.style.position = 'absolute'
	this.canvas.style.top = '0'
	this.canvas.style.left = '0'
	this.canvas.style.width = '100%'
	this.canvas.style.height = '100%'
	this.canvas.style.display = 'block'
	this.container.appendChild(this.canvas)
	this.ctx = this.canvas.getContext('2d')
	
	this.resizeObserver = new ResizeObserver(() => {
		this.resize()
	})
	this.resizeObserver.observe(this.container)
	}
	
	resize() {
	const rect = this.container.getBoundingClientRect()
	if (rect.width === 0 || rect.height === 0) return

	this.canvas.width = rect.width * window.devicePixelRatio
	this.canvas.height = rect.height * window.devicePixelRatio
	this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
	this.width = rect.width
	this.height = rect.height
	
	if (this.lastData && this.lastData.history) {
		this.render(this.lastData.history, this.lastData.maxPoints, true)
	}
	}
	
	render(history, maxPoints = 100, isResize = false) {
	if (!isResize) {
		this.lastData = { history, maxPoints }
	}

	const ctx = this.ctx
	const w = this.width
	const h = this.height
	
	ctx.clearRect(0, 0, w, h)
	
	if (!history || history.length === 0) {
		this.drawEmpty(ctx, w, h)
		return
	}
	
	const sampled = this.sampleData(history, maxPoints)
	const steps = sampled.map(d => d.steps)
	const maxStep = Math.max(...steps, 10)
	const minStep = 0
	
	const margin = { top: 40, right: 20, bottom: 40, left: 50 }
	const chartW = w - margin.left - margin.right
	const chartH = h - margin.top - margin.bottom
	
	this.drawGrid(ctx, margin, chartW, chartH, maxStep)
	this.drawLine(ctx, sampled, margin, chartW, chartH, maxStep, minStep)
	this.drawLabels(ctx, margin, chartW, chartH, maxStep, sampled)
	this.drawStats(ctx, w, h, history)
	}
	
	sampleData(data, maxPoints) {
	if (data.length <= maxPoints) {
		return data
	}
	
	const sampled =[]
	const bucketSize = Math.ceil(data.length / maxPoints)
	
	for (let i = 0; i < data.length; i += bucketSize) {
		const bucket = data.slice(i, i + bucketSize)
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
	
	for (let i = 0; i <= 5; i++) {
		const val = Math.round(maxStep * (1 - i / 5))
		const y = margin.top + chartH * i / 5 + 4
		ctx.fillText(val.toString(), margin.left - 8, y)
	}
	
	ctx.textAlign = 'center'
	ctx.fillText('世代', margin.left + chartW / 2, margin.top + chartH + 25)
	
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
	if (this.resizeObserver) this.resizeObserver.disconnect()
	this.canvas?.remove()
	}
}

export default HistoryView