/**
 * 网络拓扑视图
 * 上下布局：顶部信息栏 + 底部网络图
 */

import { NeuralNetwork } from '@ai/NeuralNetwork.js'

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

const PREVIEW_HIGHLIGHT = {
	WIDTH_MULTIPLIER: 1.5,
	ALPHA: 1,
	BRIGHTNESS_BOOST: 1.5
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

interface Position {
	x: number
	y: number
}

interface LastRenderData {
	network: NeuralNetwork
	inputs: number[] | null
	action: number | null
	isPreview: boolean
	weightChanges: number[][][] | null
}

export class NetworkView {
	private container: HTMLElement
	private canvas: HTMLCanvasElement | null = null
	private ctx: CanvasRenderingContext2D | null = null
	private infoBar: HTMLElement | null = null
	private resizeObserver: ResizeObserver | null = null
	private width: number = 0
	private height: number = 0
	private lastData: LastRenderData | null = null

	constructor(containerId: string) {
		const el = document.getElementById(containerId)
		if (!el) {
			throw new Error(`NetworkView: 找不到元素 #${containerId}`)
		}
		this.container = el
		this.init()
		console.log('[NETWORK_VIEW]', '网络视图初始化完成，常量配置已加载')
	}
	
	init(): void {
		this.container.innerHTML = ''
		
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
		
		this.resizeObserver = new ResizeObserver(() => {
			this.resize()
		})
		this.resizeObserver.observe(this.container)
		console.log('[NETWORK_VIEW]', '画布元素创建完成，等待尺寸计算...')
	}

	resize(): void {
		if (!this.canvas) return
		const canvasContainer = this.canvas.parentElement
		if (!canvasContainer) return
		
		const w = canvasContainer.offsetWidth
		const h = canvasContainer.offsetHeight
		if (w === 0 || h === 0) {
			requestAnimationFrame(() => this.resize())
			return
		}

		if (!this.width || !this.height) {
			console.log('[NETWORK_VIEW]', `初始化完成 | 画布尺寸=${w}x${h}`)
		}

		this.canvas.width = w * window.devicePixelRatio
		this.canvas.height = h * window.devicePixelRatio
		this.ctx?.scale(window.devicePixelRatio, window.devicePixelRatio)
		this.width = w
		this.height = h

		if (this.lastData) {
			this.render(this.lastData.network, this.lastData.inputs, this.lastData.action, this.lastData.isPreview, true, this.lastData.weightChanges)
		}
	}
	
	render(
		network: NeuralNetwork, 
		inputs: number[] | null = null, 
		action: number | null = null, 
		isPreview: boolean = false, 
		isResize: boolean = false, 
		weightChanges: number[][][] | null = null
	): void {
		if (!isResize) {
			this.lastData = { network, inputs, action, isPreview, weightChanges }
		}

		if (inputs && inputs.some(v => v !== null)) {
			console.log('[NETWORK_VIEW]', `渲染 | 输入=[${inputs.join(',')}] 动作=${action !== null ? action : 'null'} 预览=${isPreview} weightChanges=${weightChanges ? '有' : '无'}`)
		}

		this.updateInfoBar(network, isPreview)

		if (!this.ctx) return
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
	
	updateInfoBar(network: NeuralNetwork, isPreview: boolean = false): void {
		if (!this.infoBar) return
		
		const structure = network.getStructure()
		const epsilon = network.getEpsilon()
		const eps = (epsilon * 100).toFixed(0)
		const exploring = network.isExploring ? ' <span style="color:#f39c12">🎲</span>' : ''
		const previewTag = isPreview ? ' <span style="color:#3498db">[预览]</span>' : ''
		
		const modeIcon = network.exploreMode === 'none' ? '⊘' : 
			                  network.exploreMode === 'fixed' ? '🔒' : '⚡'
		
		this.infoBar.innerHTML = `
			<span>结构:${structure.layerSizes.join('-')}</span>
			<span>权重:${structure.totalWeights}</span>
			<span style="color:rgba(255,255,255,0.6)">ε:${eps}%${exploring}${previewTag}</span>
			<span style="color:#0f0" title="探索模式:${network.exploreMode}">${modeIcon}</span>
		`
	}
	
	calculatePositions(layers: number[], w: number, h: number): Position[][] {
		const positions: Position[][] = []
		const layerCount = layers.length
		const marginX = w * CANVAS_MARGIN.X
		const marginY = h * CANVAS_MARGIN.Y
	
		for (let l = 0; l < layerCount; l++) {
			const layerSize = layers[l]
			const x = marginX + (w - 2 * marginX) * l / (layerCount - 1)
			const layerPos: Position[] = []
		
			for (let n = 0; n < layerSize; n++) {
				const y = marginY + (h - 2 * marginY) * n / Math.max(1, layerSize - 1)
				layerPos.push({ x, y })
			}
		
			positions.push(layerPos)
		}
	
		return positions
	}
	
	drawConnections(
		ctx: CanvasRenderingContext2D, 
		positions: Position[][], 
		weights: number[][][], 
		inputs: number[] | null, 
		weightChanges: number[][][] | null = null
	): void {
		console.log('[NETWORK_VIEW]', `drawConnections | weightChanges=${weightChanges ? '有' : '无'} layers=${weights.length}`)
		this._logWeightChanges(weightChanges)
		
		for (let l = 0; l < weights.length; l++) {
			const fromLayer = positions[l]
			const toLayer = positions[l + 1]
			const layerWeights = weights[l]
			const layerChanges = weightChanges?.[l] ?? null
		
			for (let i = 0; i < fromLayer.length; i++) {
				for (let j = 0; j < toLayer.length; j++) {
					const weight = layerWeights[j][i]
					const from = fromLayer[i]
					const to = toLayer[j]
					const delta = layerChanges?.[j]?.[i] ?? 0
					
					this._drawConnectionLine(ctx, from, to, weight)
					this._drawHighlight(ctx, from, to, delta, weight)
					this._drawWeightText(ctx, from, to, weight, i)
				}
			}
		}
	}

	private _logWeightChanges(weightChanges: number[][][] | null): void {
		if (!weightChanges) return
		const flatChanges = weightChanges.flat(2)
		const nonZeroCount = flatChanges.filter(c => Math.abs(c) > 0.0001).length
		console.log('[NETWORK_VIEW]', `weightChanges详情 | 总数量=${flatChanges.length} 非零数量=${nonZeroCount}`)
	}

	private _drawConnectionLine(ctx: CanvasRenderingContext2D, from: Position, to: Position, weight: number): void {
		const { thickness, color } = this._calculateLineStyle(weight)
		
		ctx.beginPath()
		ctx.moveTo(from.x, from.y)
		ctx.lineTo(to.x, to.y)
		ctx.strokeStyle = color
		ctx.lineWidth = thickness
		ctx.stroke()
	}

	private _calculateLineStyle(weight: number): { thickness: number, color: string } {
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
		
		return { thickness, color }
	}

	private _drawHighlight(ctx: CanvasRenderingContext2D, from: Position, to: Position, delta: number, weight: number): void {
		if (Math.abs(delta) <= 0.0001) return
		
		const highlightWidth = LINE_STYLE.MAX_THICKNESS * PREVIEW_HIGHLIGHT.WIDTH_MULTIPLIER
		const highlightColor = delta > 0 ? '#ffd700' : '#ff3366'
		
		console.log('[NETWORK_VIEW]', `绘制高亮 | weight=${weight.toFixed(2)} delta=${delta.toFixed(4)} width=${highlightWidth} color=${highlightColor}`)
		
		ctx.beginPath()
		ctx.moveTo(from.x, from.y)
		ctx.lineTo(to.x, to.y)
		ctx.strokeStyle = highlightColor
		ctx.lineWidth = highlightWidth
		ctx.stroke()
	}

	private _drawWeightText(ctx: CanvasRenderingContext2D, from: Position, to: Position, weight: number, fromIndex: number): void {
		const ratio = WEIGHT_TEXT_STYLE.POSITION_RATIO + (fromIndex * WEIGHT_TEXT_STYLE.POSITION_STEP)
		const textX = from.x + (to.x - from.x) * ratio
		const textY = from.y + (to.y - from.y) * ratio
		
		ctx.fillStyle = WEIGHT_TEXT_STYLE.COLOR
		ctx.font = WEIGHT_TEXT_STYLE.FONT
		ctx.textAlign = 'center'
		ctx.fillText(weight.toFixed(1), textX, textY)
	}

	drawNodes(
		ctx: CanvasRenderingContext2D, 
		positions: Position[][], 
		inputs: number[] | null, 
		action: number | null,
		isPreview: boolean = false
	): void {
		const actionNames = ['移动', '跳跃', '远跳']
		console.log('[NETWORK_VIEW]', `绘制节点 | inputs=[${inputs?.join(',')}] action=${action} layers=${positions.length}`)
	
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
					const labels = ['前一格', '前两格', '前三格', '前四格']
					ctx.fillText(labels[n] || `i${n}`, pos.x, pos.y)
				} else if (isOutput) {
					ctx.fillText(actionNames[n], pos.x, pos.y)
				}
			}
		}
	}
	
	destroy(): void {
		if (this.resizeObserver) this.resizeObserver.disconnect()
		this.container.innerHTML = ''
	}
}

export default NetworkView
