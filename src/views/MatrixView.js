/**
 * 权重矩阵视图
 * 提供直观的表格形式展示权重矩阵
 */

export class MatrixView {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.canvas = null
		this.ctx = null
		this.lastData = null // 缓存渲染数据
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
	
		// 拉伸时利用缓存秒画
		if (this.lastData && this.lastData.network) {
			this.render(this.lastData.network, this.lastData.inputs, this.lastData.action, true)
		}
	}
	
	render(network, inputs = null, action = null, isResize = false) {
		if (!isResize) {
			this.lastData = { network, inputs, action } // 更新缓存
		}

		const ctx = this.ctx
		const w = this.width
		const h = this.height
	
		ctx.clearRect(0, 0, w, h)
	
		const weights = network.weights
		if (!weights || weights.length === 0) return
		const layerWeights = weights[0]
	
		const outputNames =['移动', '跳跃']
		const inputLabels =['前一格', '前两格', '前三格']
	
		const cellW = 80
		const cellH = 50
		const startX = (w - (inputLabels.length * cellW + 80)) / 2
		const startY = (h - (outputNames.length * cellH + 60)) / 2
	
		ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
		ctx.font = '14px sans-serif'
		ctx.textAlign = 'center'
		for (let i = 0; i < inputLabels.length; i++) {
			ctx.fillText(inputLabels[i], startX + 80 + i * cellW + cellW / 2, startY + 20)
		}
	
		for (let o = 0; o < layerWeights.length; o++) {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
			ctx.textAlign = 'right'
			ctx.fillText(outputNames[o], startX + 60, startY + 50 + o * cellH + cellH / 2 + 5)
		
			for (let i = 0; i < layerWeights[o].length; i++) {
				const weight = layerWeights[o][i]
				const x = startX + 80 + i * cellW
				const y = startY + 50 + o * cellH
		
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
				ctx.strokeRect(x, y, cellW, cellH)
		
				if (weight > 0) {
					ctx.fillStyle = '#2ecc71'
				} else if (weight < 0) {
					ctx.fillStyle = '#e74c3c'
				} else {
					ctx.fillStyle = '#95a5a6'
				}
		
				if (inputs && inputs[i] > 0.5) {
					ctx.fillStyle = weight > 0 ? '#27ae60' : (weight < 0 ? '#c0392b' : '#7f8c8d')
					ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2)
					ctx.fillStyle = '#fff'
				}
		
				ctx.textAlign = 'center'
				ctx.font = 'bold 18px monospace'
				ctx.fillText(weight.toFixed(2), x + cellW / 2, y + cellH / 2 + 6)
			}
		}
	}
	
	destroy() {
		if (this.resizeObserver) this.resizeObserver.disconnect()
		this.canvas?.remove()
	}
}

export default MatrixView