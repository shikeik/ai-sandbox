/**
 * 网络拓扑视图
 * 动态渲染神经网络结构，支持任意层数
 */

export class NetworkView {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.canvas = null
		this.ctx = null
		this.lastData = null
		this.init()
	}
	
	init() {
		const oldCanvas = this.container.querySelector('canvas')
		if (oldCanvas) oldCanvas.remove()
	
		const placeholder = this.container.querySelector('#neuron-placeholder')
		if (placeholder) placeholder.remove()
	
		this.canvas = document.createElement('canvas')
		// 【修复无限拉伸】：绝对定位脱离文档流，不撑开父盒子
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

		if (this.lastData && this.lastData.network) {
			this.render(this.lastData.network, this.lastData.inputs, this.lastData.action, true)
		}
	}
	
	render(network, inputs = null, action = null, isResize = false) {
		if (!isResize) {
			this.lastData = { network, inputs, action }
		}

		const ctx = this.ctx
		const w = this.width
		const h = this.height
	
		ctx.clearRect(0, 0, w, h)
	
		const structure = network.getStructure()
		const layers = network.layerSizes
		const weights = network.weights
	
		const nodePositions = this.calculatePositions(layers, w, h)
		this.drawConnections(ctx, nodePositions, weights, inputs)
		this.drawNodes(ctx, nodePositions, inputs, action)
		this.drawInfo(ctx, w, h, structure, network)
	}
	
	calculatePositions(layers, w, h) {
		const positions =[]
		const layerCount = layers.length
		const marginX = w * 0.15
		const marginY = h * 0.15
	
		for (let l = 0; l < layerCount; l++) {
			const layerSize = layers[l]
			const x = marginX + (w - 2 * marginX) * l / (layerCount - 1)
			const layerPos =[]
		
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
			
					const thickness = Math.min(4, Math.abs(weight) * 2 + 0.5)
					const alpha = Math.min(1, Math.abs(weight) * 0.3 + 0.2)
					const color = weight > 0 ? `rgba(46, 204, 113, ${alpha})` : `rgba(231, 76, 60, ${alpha})`
			
					ctx.beginPath()
					ctx.moveTo(from.x, from.y)
					ctx.lineTo(to.x, to.y)
					ctx.strokeStyle = color
					ctx.lineWidth = thickness
					ctx.stroke()
			
					// 将文字移到靠近右侧的位置并阶梯状错开，防遮挡
					const ratio = 0.65 + (i * 0.1) 
					const textX = from.x + (to.x - from.x) * ratio
					const textY = from.y + (to.y - from.y) * ratio
			
					ctx.fillStyle = 'rgba(255,255,255,0.9)'
					ctx.font = '10px monospace'
					ctx.textAlign = 'center'
					ctx.fillText(weight.toFixed(1), textX, textY)
				}
			}
		}
	}
	
	drawNodes(ctx, positions, inputs, action) {
		const actionNames = ['移动', '跳跃']
	
		for (let l = 0; l < positions.length; l++) {
			const layer = positions[l]
		
			for (let n = 0; n < layer.length; n++) {
				const pos = layer[n]
				const isInput = l === 0
				const isOutput = l === positions.length - 1
		
				const radius = isOutput ? 22 : 18
		
				ctx.beginPath()
				ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
		
				if (isInput && inputs) {
					const val = inputs[n]
					ctx.fillStyle = val > 0.5 ? '#e74c3c' : '#95a5a6'
				} else if (isOutput && action === n) {
					ctx.fillStyle = '#f39c12'
				} else {
					ctx.fillStyle = '#34495e'
				}
		
				ctx.fill()
				ctx.strokeStyle = '#ecf0f1'
				ctx.lineWidth = 2
				ctx.stroke()
		
				ctx.fillStyle = '#fff'
				ctx.font = '11px sans-serif'
				ctx.textAlign = 'center'
				ctx.textBaseline = 'middle'
		
				if (isInput) {
					const labels =['前一格', '前两格', '前三格']
					ctx.fillText(labels[n] || `i${n}`, pos.x, pos.y)
				} else if (isOutput) {
					ctx.fillText(actionNames[n], pos.x, pos.y)
				}
			}
		}
	}
	
	drawInfo(ctx, w, h, structure, network) {
		ctx.fillStyle = 'rgba(255,255,255,0.8)'
		ctx.font = '12px monospace'
		ctx.textAlign = 'left'
		ctx.fillText(`结构: ${structure.layerSizes.join('-')}`, 10, 20)
		ctx.fillText(`权重数: ${structure.totalWeights}`, 10, 38)
	
		// --- 显示实时探索率 ---
		if (network) {
			const eps = (network.epsilon * 100).toFixed(0)
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
			ctx.fillText(`好奇心(ε): ${eps}%`, 10, 56)
		
			// 如果当前正在“探索”，在旁边画个小骰子或变色文字提醒
			if (network.isExploring) {
				ctx.fillStyle = '#f39c12' // 橘黄色
				ctx.fillText('🎲 正在探索随机路径', 10, 74)
			}
		}
	}
	
	destroy() {
		if (this.resizeObserver) this.resizeObserver.disconnect()
		this.canvas?.remove()
	}
}

export default NetworkView