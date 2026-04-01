/**
 * 网络拓扑视图
 * 上下布局：顶部信息栏 + 底部网络图
 */

export class NetworkView {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.canvas = null
		this.ctx = null
		this.infoBar = null
		this.lastData = null
		this.init()
	}
	
	init() {
		// 清理旧元素
		this.container.innerHTML = ''
		
		// 创建顶部信息栏
		this.infoBar = document.createElement('div')
		this.infoBar.style.cssText = `
			height: 24px;
			display: flex;
			align-items: center;
			padding: 0 8px;
			background: rgba(0,0,0,0.2);
			border-bottom: 1px solid rgba(0,255,0,0.2);
			font-size: 11px;
			color: rgba(255,255,255,0.8);
			gap: 12px;
		`
		this.container.appendChild(this.infoBar)
		
		// 创建 canvas 容器
		const canvasContainer = document.createElement('div')
		canvasContainer.style.cssText = `
			position: relative;
			flex: 1;
			min-height: 0;
			width: 100%;
			overflow: hidden;
		`
		this.container.style.display = 'flex'
		this.container.style.flexDirection = 'column'
		this.container.appendChild(canvasContainer)
		
		// 创建 canvas
		this.canvas = document.createElement('canvas')
		this.canvas.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			display: block;
		`
		canvasContainer.appendChild(this.canvas)
		this.ctx = this.canvas.getContext('2d')
		
		// 监听容器尺寸变化
		this.resizeObserver = new ResizeObserver(() => {
			this.resize()
		})
		this.resizeObserver.observe(this.container)
	}
	
	resize() {
		// 使用 canvas 父容器的实际尺寸
		const canvasContainer = this.canvas.parentElement
		const w = canvasContainer.offsetWidth
		const h = canvasContainer.offsetHeight
		if (w === 0 || h === 0) {
			// 过渡动画期间布局可能尚未完成，延迟一帧重试
			requestAnimationFrame(() => this.resize())
			return
		}

		this.canvas.width = w * window.devicePixelRatio
		this.canvas.height = h * window.devicePixelRatio
		this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
		this.width = w
		this.height = h

		if (this.lastData && this.lastData.network) {
			this.render(this.lastData.network, this.lastData.inputs, this.lastData.action, true)
		}
	}
	
	render(network, inputs = null, action = null, isResize = false) {
		if (!isResize) {
			this.lastData = { network, inputs, action }
		}

		// 更新信息栏
		this.updateInfoBar(network)

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
	}
	
	updateInfoBar(network) {
		const structure = network.getStructure()
		const eps = (network.epsilon * 100).toFixed(0)
		const exploring = network.isExploring ? ' <span style="color:#f39c12">🎲</span>' : ''
		
		this.infoBar.innerHTML = `
			<span>结构:${structure.layerSizes.join('-')}</span>
			<span>权重:${structure.totalWeights}</span>
			<span style="color:rgba(255,255,255,0.6)">ε:${eps}%${exploring}</span>
		`
	}
	
	calculatePositions(layers, w, h) {
		const positions =[]
		const layerCount = layers.length
		const marginX = w * 0.15
		const marginY = h * 0.12
	
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
	
	destroy() {
		if (this.resizeObserver) this.resizeObserver.disconnect()
		this.container.innerHTML = ''
	}
}

export default NetworkView
