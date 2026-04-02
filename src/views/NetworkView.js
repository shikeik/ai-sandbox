/**
 * 网络拓扑视图
 * 上下布局：顶部信息栏 + 底部网络图
 */

// ========== 绘图配置常量 ==========
const CANVAS_MARGIN = {
	X: 0.15,
	Y: 0.12
}

const NODE_RADIUS = {
	DEFAULT: 18,
	OUTPUT: 22
}

const LINE_STYLE = {
	MAX_THICKNESS: 4,
	THICKNESS_MULTIPLIER: 2,
	THICKNESS_BASE: 0.5,
	MAX_ALPHA: 1,
	ALPHA_MULTIPLIER: 0.3,
	ALPHA_BASE: 0.2
}

const COLORS = {
	WEIGHT_POSITIVE: '46, 204, 113',
	WEIGHT_NEGATIVE: '231, 76, 60',
	DELTA_POSITIVE: '0, 255, 136',
	DELTA_NEGATIVE: '255, 85, 85',
	NODE_ACTIVE: '#e74c3c',
	NODE_INPUT_DEFAULT: '#95a5a6',
	NODE_SELECTED: '#f39c12',
	NODE_DEFAULT: '#34495e',
	NODE_STROKE: '#ecf0f1',
	TEXT_DEFAULT: '#fff'
}

const WEIGHT_TEXT_STYLE = {
	COLOR: 'rgba(255,255,255,0.9)',
	FONT: '10px monospace',
	POSITION_RATIO: 0.65,
	POSITION_STEP: 0.1
}

const HIGHLIGHT_STYLE = {
	LINE_WIDTH: 8,
	ALPHA: 0.95
}

export class NetworkView {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.canvas = null
		this.ctx = null
		this.infoBar = null
		this.lastData = null
		this.init()
		console.log('[NETWORK_VIEW]', '网络视图初始化完成，常量配置已加载')
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
		console.log('[NETWORK_VIEW]', '画布元素创建完成，等待尺寸计算...')
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

		// 首次设置尺寸时输出日志
		if (!this.width || !this.height) {
			console.log('[NETWORK_VIEW]', `初始化完成 | 画布尺寸=${w}x${h} 边距配置=${JSON.stringify(CANVAS_MARGIN)}`)
		}

		this.canvas.width = w * window.devicePixelRatio
		this.canvas.height = h * window.devicePixelRatio
		this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
		this.width = w
		this.height = h

		if (this.lastData && this.lastData.network) {
			this.render(this.lastData.network, this.lastData.inputs, this.lastData.action, this.lastData.isPreview, true, this.lastData.weightChanges)
		}
	}
	
	render(network, inputs = null, action = null, isPreview = false, isResize = false, weightChanges = null) {
		if (!isResize) {
			this.lastData = { network, inputs, action, isPreview, weightChanges }
		}

		// 只在有实际输入变化时输出日志，避免resize刷屏
		if (inputs && inputs.some(v => v !== null)) {
			console.log('[NETWORK_VIEW]', `渲染 | 输入=[${inputs.join(',')}] 动作=${action !== null ? action : 'null'} 预览=${isPreview}`)
		}

		// 更新信息栏
		this.updateInfoBar(network, isPreview)

		const ctx = this.ctx
		const w = this.width
		const h = this.height
	
		ctx.clearRect(0, 0, w, h)
	
		const structure = network.getStructure()
		const layers = network.layerSizes
		const weights = network.weights
	
		const nodePositions = this.calculatePositions(layers, w, h)
		this.drawConnections(ctx, nodePositions, weights, inputs, weightChanges)
		this.drawNodes(ctx, nodePositions, inputs, action, isPreview)
	}
	
	updateInfoBar(network, isPreview = false) {
		const structure = network.getStructure()
		const eps = (network.epsilon * 100).toFixed(0)
		const exploring = network.isExploring ? ' <span style="color:#f39c12">🎲</span>' : ''
		const previewTag = isPreview ? ' <span style="color:#3498db">[预览]</span>' : ''
		
		this.infoBar.innerHTML = `
			<span>结构:${structure.layerSizes.join('-')}</span>
			<span>权重:${structure.totalWeights}</span>
			<span style="color:rgba(255,255,255,0.6)">ε:${eps}%${exploring}${previewTag}</span>
		`
	}
	
	calculatePositions(layers, w, h) {
		const positions =[]
		const layerCount = layers.length
		const marginX = w * CANVAS_MARGIN.X
		const marginY = h * CANVAS_MARGIN.Y
	
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
	
	drawConnections(ctx, positions, weights, inputs, weightChanges = null) {
		for (let l = 0; l < weights.length; l++) {
			const fromLayer = positions[l]
			const toLayer = positions[l + 1]
			const layerWeights = weights[l]
			const layerChanges = weightChanges && weightChanges[l] ? weightChanges[l] : null
		
			for (let i = 0; i < fromLayer.length; i++) {
				for (let j = 0; j < toLayer.length; j++) {
					const weight = layerWeights[j][i]
					const from = fromLayer[i]
					const to = toLayer[j]
					const delta = layerChanges ? layerChanges[j][i] : 0
				
					const thickness = Math.min(
						LINE_STYLE.MAX_THICKNESS,
						Math.abs(weight) * LINE_STYLE.THICKNESS_MULTIPLIER + LINE_STYLE.THICKNESS_BASE
					)
					const alpha = Math.min(
						LINE_STYLE.MAX_ALPHA,
						Math.abs(weight) * LINE_STYLE.ALPHA_MULTIPLIER + LINE_STYLE.ALPHA_BASE
					)
					const color = weight > 0
						? `rgba(${COLORS.WEIGHT_POSITIVE}, ${alpha})`
						: `rgba(${COLORS.WEIGHT_NEGATIVE}, ${alpha})`
				
					ctx.beginPath()
					ctx.moveTo(from.x, from.y)
					ctx.lineTo(to.x, to.y)
					ctx.strokeStyle = color
					ctx.lineWidth = thickness
					ctx.stroke()
				
					// 高亮发生变化的连线（权重更新后最粗提示）
					if (delta !== 0) {
						ctx.beginPath()
						ctx.moveTo(from.x, from.y)
						ctx.lineTo(to.x, to.y)
						ctx.strokeStyle = delta > 0
							? `rgba(${COLORS.DELTA_POSITIVE}, ${HIGHLIGHT_STYLE.ALPHA})`
							: `rgba(${COLORS.DELTA_NEGATIVE}, ${HIGHLIGHT_STYLE.ALPHA})`
						ctx.lineWidth = HIGHLIGHT_STYLE.LINE_WIDTH
						ctx.stroke()
					}
				
					// 将文字移到靠近右侧的位置并阶梯状错开，防遮挡
					const ratio = WEIGHT_TEXT_STYLE.POSITION_RATIO + (i * WEIGHT_TEXT_STYLE.POSITION_STEP)
					const textX = from.x + (to.x - from.x) * ratio
					const textY = from.y + (to.y - from.y) * ratio
				
					ctx.fillStyle = WEIGHT_TEXT_STYLE.COLOR
					ctx.font = WEIGHT_TEXT_STYLE.FONT
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
		
				const radius = isOutput ? NODE_RADIUS.OUTPUT : NODE_RADIUS.DEFAULT
		
				ctx.beginPath()
				ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
		
				if (isInput && inputs) {
					const val = inputs[n]
					ctx.fillStyle = val > 0.5 ? COLORS.NODE_ACTIVE : COLORS.NODE_INPUT_DEFAULT
				} else if (isOutput && action === n) {
					ctx.fillStyle = COLORS.NODE_SELECTED
				} else {
					ctx.fillStyle = COLORS.NODE_DEFAULT
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
