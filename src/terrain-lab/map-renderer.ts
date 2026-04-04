// ========== 通用地图渲染器 ==========
// 支持任意宽度地图、横向滚动、相机跟随主角、触摸滑动

import { NUM_LAYERS, ELEM_HERO, ELEM_AIR, ELEMENTS } from "./constants.js"
import { drawEditorLabels, drawTerrainGrid, drawEmoji } from "./renderer.js"
import { calculateAnimationPath, type AnimationPath } from "./animation.js"
import { setupHighDPICanvas } from "../engine/utils/canvas.js"

export interface MapRendererConfig {
	canvas: HTMLCanvasElement
	mapWidth: number
	viewportCols: number
}

export interface AnimState {
	action: string
	startTime: number
	duration: number
	path: AnimationPath
	resolve: () => void
	slimeKilled: boolean
}

export class MapRenderer {
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private mapWidth: number
	private viewportCols: number

	// 相机位置
	private cameraCol = 0

	// 触摸滑动
	private isDragging = false
	private lastTouchX = 0
	private velocity = 0
	private lastMoveTime = 0
	private maxVelocity = 0  // 记录本次滑动的最大速度

	// 动画
	private animState: AnimState | null = null
	private animFrameId: number | null = null

	// 惯性滚动
	private inertiaFrameId: number | null = null
	private readonly FRICTION = 0.92  // 摩擦力系数，越小停得越快
	private readonly MIN_VELOCITY = 0.5  // 最小速度，低于此值停止
	private readonly BOUNCE_DAMPING = 0.3  // 边界回弹阻尼

	// 单元格尺寸
	private cellW = 0
	private cellH = 0
	private gapX = 0
	private gapY = 0
	private startX = 0
	private startY = 0

	// 当前地图和主角位置
	private currentMap: number[][] | null = null
	private currentHeroCol = 0

	constructor(config: MapRendererConfig) {
		this.canvas = config.canvas
		const ctx = this.canvas.getContext("2d")
		if (!ctx) throw new Error("无法获取 canvas context")
		this.ctx = ctx
		this.mapWidth = config.mapWidth
		this.viewportCols = config.viewportCols || 5

		this.setupTouchEvents()
	}

	setMapWidth(width: number): void {
		this.mapWidth = width
	}

	/**
	 * 设置相机位置（立即）
	 */
	setCameraPosition(col: number): void {
		this.cameraCol = Math.max(0, Math.min(col, this.mapWidth - this.viewportCols))
	}

	/**
	 * 设置相机跟随主角
	 */
	followHero(heroCol: number): void {
		// 让主角保持在视野最左侧
		this.setCameraPosition(heroCol)
	}

	/**
	 * 设置触摸滑动事件
	 */
	private setupTouchEvents(): void {
		const onStart = (x: number) => {
			this.isDragging = true
			this.lastTouchX = x
			this.velocity = 0
			this.maxVelocity = 0
			this.lastMoveTime = performance.now()
			// 取消正在进行的惯性滚动
			this.stopInertia()
		}

		const onMove = (x: number) => {
			if (!this.isDragging) return
			const delta = this.lastTouchX - x
			const now = performance.now()
			const dt = now - this.lastMoveTime

			// 计算瞬时速度（像素/毫秒）
			if (dt > 0) {
				this.velocity = delta / dt
				// 记录最大速度（带方向）
				if (Math.abs(this.velocity) > Math.abs(this.maxVelocity)) {
					this.maxVelocity = this.velocity
				}
			}

			this.lastTouchX = x
			this.lastMoveTime = now

			// 滑动调整相机
			const colDelta = delta / (this.cellW + this.gapX)
			let newCameraCol = this.cameraCol + colDelta
			newCameraCol = Math.max(0, Math.min(newCameraCol, this.mapWidth - this.viewportCols))
			this.cameraCol = newCameraCol

			if (this.currentMap) {
				this.drawImmediate(this.currentMap, this.currentHeroCol)
			}
		}

		const onEnd = () => {
			this.isDragging = false
			// 启动惯性滚动
			this.startInertia()
		}

		this.canvas.addEventListener("mousedown", (e) => onStart(e.clientX))
		window.addEventListener("mousemove", (e) => onMove(e.clientX))
		window.addEventListener("mouseup", onEnd)

		this.canvas.addEventListener("touchstart", (e) => {
			e.preventDefault()
			onStart(e.touches[0].clientX)
		}, { passive: false })
		this.canvas.addEventListener("touchmove", (e) => {
			e.preventDefault()
			onMove(e.touches[0].clientX)
		}, { passive: false })
		this.canvas.addEventListener("touchend", onEnd)
	}

	/**
	 * 计算布局 - 让格子占满宽度，支持高清屏
	 */
	private calculateLayout(): void {
		// 使用公共函数设置高清渲染
		const { width, height } = setupHighDPICanvas(this.canvas)

		// 边距更小，让格子更大
		const paddingX = 30
		const availableWidth = width - paddingX * 2

		// 计算单元格大小 - 让格子填满可用宽度
		this.cellW = Math.floor((availableWidth - (this.viewportCols - 1) * 4) / this.viewportCols)
		this.cellH = Math.min(this.cellW, Math.floor((height - 100) / 3))
		this.gapX = 4
		this.gapY = 8

		// 居中
		const totalWidth = this.cellW * this.viewportCols + this.gapX * (this.viewportCols - 1)
		this.startX = Math.floor((width - totalWidth) / 2)
		this.startY = 50
	}

	/**
	 * 获取视野内的地图数据（支持丝滑滚动，多取三列防止边缘裁剪）
	 */
	private getViewport(map: number[][]): number[][] {
		const viewport: number[][] = [[], [], []]
		// 始终从 cameraCol 的前一列开始取，确保丝滑滚动时左边界有数据
		const startCol = Math.floor(this.cameraCol) - 1

		// 多取三列：左边界一列 + 丝滑滚动一列 + 右边界缓冲一列
		const colsToRender = this.viewportCols + 3

		for (let layer = 0; layer < NUM_LAYERS; layer++) {
			for (let i = 0; i < colsToRender; i++) {
				const mapCol = startCol + i
				if (mapCol >= 0 && mapCol < this.mapWidth) {
					viewport[layer][i] = map[layer][mapCol]
				} else {
					viewport[layer][i] = ELEM_AIR
				}
			}
		}

		return viewport
	}

	/**
	 * 计算丝滑滚动的偏移量
	 */
	private getScrollOffset(): number {
		const fraction = this.cameraCol - Math.floor(this.cameraCol)
		return fraction * (this.cellW + this.gapX)
	}

	/**
	 * 主绘制函数
	 */
	draw(map: number[][], heroCol: number): void {
		this.currentMap = map
		this.currentHeroCol = heroCol
		this.drawImmediate(map, heroCol)
	}

	/**
	 * 立即绘制（支持丝滑滚动）
	 * 绘制顺序：背景 -> 网格/元素 -> 标签/覆盖层
	 */
	private drawImmediate(map: number[][], heroCol: number): void {
		this.calculateLayout()

		// 清空
		this.ctx.fillStyle = "#0b0c0f"
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

		// 获取视野（多一列用于丝滑滚动）
		const viewport = this.getViewport(map)

		// 计算丝滑滚动偏移量
		const scrollOffset = this.getScrollOffset()

		// 动画状态处理（索引+1，因为viewport从cameraCol-1开始取）
		let hideHeroAtCol: number | null = null
		let hideSlimeAt: number | null = null

		if (this.animState) {
			hideHeroAtCol = 1  // viewport[1] 对应 cameraCol
			if (this.animState.slimeKilled) {
				hideSlimeAt = 2  // 史莱姆在 heroCol+1，对应 viewport[2]
			}
		}

		// 1. 先绘制地形（网格 + emoji）
		this.drawTerrainGridSmooth(viewport, scrollOffset, hideSlimeAt, hideHeroAtCol)

		// 2. 动画狐狸
		if (this.animState) {
			this.drawAnimatedHero(scrollOffset)
		}

		// 3. 再绘制标签（在地图之上）
		this.drawColumnLabels(scrollOffset)
		this.drawLayerLabels()

		// 4. 最后绘制 UI 覆盖层
		this.drawPositionInfo(heroCol)
		this.drawScrollIndicator()
	}

	/**
	 * 绘制地形网格（支持丝滑滚动偏移）
	 * 不裁剪：地图只有32列，全部绘制开销可忽略
	 */
	private drawTerrainGridSmooth(
		viewport: number[][],
		scrollOffset: number,
		hideSlimeAt: number | null,
		hideHeroAtCol: number | null
	): void {
		const effectiveStartX = this.startX - scrollOffset
		const colsToRender = viewport[0].length

		// 绘制网格线框
		for (let r = 0; r < NUM_LAYERS; r++) {
			for (let c = 0; c < colsToRender; c++) {
				const x = effectiveStartX + c * (this.cellW + this.gapX)
				const y = this.startY + r * (this.cellH + this.gapY)

				this.ctx.strokeStyle = "#3c4043"
				this.ctx.lineWidth = 1
				this.ctx.strokeRect(x, y, this.cellW, this.cellH)
			}
		}

		// 绘制元素
		for (let r = 0; r < NUM_LAYERS; r++) {
			for (let c = 0; c < colsToRender; c++) {
				const x = effectiveStartX + c * (this.cellW + this.gapX)
				const y = this.startY + r * (this.cellH + this.gapY)

				const elemId = viewport[r][c]

				// 跳过被击杀的史莱姆
				if (r === 1 && c === (hideSlimeAt ?? -1)) continue

				// 动画时跳过原位置的狐狸（显示空气）
				if (r === 1 && c === (hideHeroAtCol ?? -1) && elemId === 1) {
					drawEmoji(this.ctx, " ", x + this.cellW / 2, y + this.cellH / 2, Math.min(this.cellW, this.cellH) * 0.55)
					continue
				}

				drawEmoji(this.ctx, ELEMENTS[elemId].emoji, x + this.cellW / 2, y + this.cellH / 2, Math.min(this.cellW, this.cellH) * 0.55)
			}
		}
	}

	/**
	 * 绘制列标签（x0, x1, x2...）带丝滑滚动
	 */
	private drawColumnLabels(scrollOffset: number): void {
		this.ctx.fillStyle = "#9aa0a6"
		this.ctx.font = "12px sans-serif"
		this.ctx.textAlign = "center"

		// 从 cameraCol-1 开始绘制，与 viewport 一致
		const startCol = Math.floor(this.cameraCol) - 1
		const effectiveStartX = this.startX - scrollOffset

		// 多绘制两列标签用于丝滑滚动显示
		for (let i = 0; i <= this.viewportCols + 1; i++) {
			const col = startCol + i
			if (col < 0) continue
			if (col >= this.mapWidth) break

			const x = effectiveStartX + i * (this.cellW + this.gapX) + this.cellW / 2
			const y = this.startY - 12
			this.ctx.fillText(`x${col}`, x, y)
		}
	}

	/**
	 * 绘制层标签
	 */
	private drawLayerLabels(): void {
		const layerNames = ["天上", "地上", "地面"]
		this.ctx.fillStyle = "#9aa0a6"
		this.ctx.font = "12px sans-serif"
		this.ctx.textAlign = "right"

		for (let r = 0; r < NUM_LAYERS; r++) {
			const y = this.startY + r * (this.cellH + this.gapY) + this.cellH / 2 + 4
			this.ctx.fillText(layerNames[r], this.startX - 10, y)
		}
	}

	/**
	 * 绘制动画中的狐狸（支持丝滑滚动）
	 */
	private drawAnimatedHero(scrollOffset: number): void {
		if (!this.animState) return

		const effectiveStartX = this.startX - scrollOffset
		const heroBaseX = effectiveStartX + 0 * (this.cellW + this.gapX) + this.cellW / 2
		const heroBaseY = this.startY + 1 * (this.cellH + this.gapY) + this.cellH / 2
		const targetX = effectiveStartX + this.animState.path.targetCol * (this.cellW + this.gapX) + this.cellW / 2

		let hx = heroBaseX
		let hy = heroBaseY
		const t = (performance.now() - this.animState.startTime) / this.animState.duration
		const clampedT = Math.min(1, Math.max(0, t))

		if (!this.animState.path.isJump) {
			hx = heroBaseX + (targetX - heroBaseX) * this.easeOutQuad(clampedT)
			hy = heroBaseY
		} else {
			hx = heroBaseX + (targetX - heroBaseX) * clampedT
			const parabola = 4 * clampedT * (1 - clampedT)
			hy = heroBaseY - parabola * (this.cellH + this.animState.path.jumpHeight)
		}

		drawEmoji(this.ctx, "🦊", hx, hy, Math.min(this.cellW, this.cellH) * 0.65)
	}

	private easeOutQuad(t: number): number {
		return t * (2 - t)
	}

	/**
	 * 绘制位置信息
	 */
	private drawPositionInfo(heroCol: number): void {
		const gridH = NUM_LAYERS * this.cellH + (NUM_LAYERS - 1) * this.gapY
		const bottomY = this.startY + gridH + 25

		this.ctx.fillStyle = "#8ab4f8"
		this.ctx.font = "13px sans-serif"
		this.ctx.textAlign = "center"

		const startCol = Math.floor(this.cameraCol)
		const endCol = Math.min(startCol + this.viewportCols - 1, this.mapWidth - 1)
		const cameraPrecise = this.cameraCol.toFixed(1)
		const text = `视野: ${startCol}-${endCol} / 0-${this.mapWidth - 1} | 相机: ${cameraPrecise} | 狐狸位置: ${heroCol}`
		this.ctx.fillText(text, this.canvas.width / 2, bottomY)
	}

	/**
	 * 绘制滚动指示器
	 */
	private drawScrollIndicator(): void {
		if (this.mapWidth <= this.viewportCols) return

		const barWidth = 150
		const barHeight = 4
		const barX = (this.canvas.width - barWidth) / 2
		const barY = this.canvas.height - 12

		this.ctx.fillStyle = "#2c2f36"
		this.ctx.fillRect(barX, barY, barWidth, barHeight)

		const visibleRatio = this.viewportCols / this.mapWidth
		const indicatorWidth = Math.max(30, barWidth * visibleRatio)
		const maxScroll = this.mapWidth - this.viewportCols
		const scrollRatio = this.cameraCol / maxScroll
		const indicatorX = barX + (barWidth - indicatorWidth) * scrollRatio

		this.ctx.fillStyle = "#8ab4f8"
		this.ctx.fillRect(indicatorX, barY, indicatorWidth, barHeight)
	}

	/**
	 * 播放动画
	 */
	async playAnimation(action: string): Promise<void> {
		this.stopAnimation()

		const path = calculateAnimationPath(0, action as any)

		return new Promise((resolve) => {
			this.animState = {
				action,
				startTime: performance.now(),
				duration: path.duration,
				path,
				resolve,
				slimeKilled: false
			}

			const animate = () => {
				if (!this.animState) return

				const elapsed = performance.now() - this.animState.startTime
				const t = elapsed / this.animState.duration

				if (this.currentMap) {
					this.drawImmediate(this.currentMap, this.currentHeroCol)
				}

				if (t >= 1) {
					this.animState.resolve()
					this.animState = null
					this.animFrameId = null
				} else {
					this.animFrameId = requestAnimationFrame(animate)
				}
			}

			this.animFrameId = requestAnimationFrame(animate)
		})
	}

	stopAnimation(): void {
		if (this.animFrameId !== null) {
			cancelAnimationFrame(this.animFrameId)
			this.animFrameId = null
		}
		this.animState = null
	}

	clear(): void {
		this.ctx.fillStyle = "#0b0c0f"
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
	}

	// ========== 惯性滚动 ==========

	/**
	 * 启动惯性滚动
	 */
	private startInertia(): void {
		// 使用最大速度作为初始速度
		let initialVelocity = this.maxVelocity

		// 速度太小不启动
		if (Math.abs(initialVelocity) < 0.05) return

		// 取消已有的惯性动画
		this.stopInertia()

		let velocity = initialVelocity * 20  // 放大系数，调整手感

		const animate = () => {
			// 摩擦力减速
			velocity *= this.FRICTION

			// 速度低于阈值停止
			if (Math.abs(velocity) < this.MIN_VELOCITY) {
				this.stopInertia()
				return
			}

			// 应用速度到相机位置
			const pxPerCol = this.cellW + this.gapX
			const colDelta = velocity / pxPerCol
			let newCameraCol = this.cameraCol + colDelta

			// 边界处理（带阻尼）
			let hitBoundary = false
			if (newCameraCol < 0) {
				newCameraCol = 0
				velocity *= this.BOUNCE_DAMPING
				hitBoundary = true
			} else if (newCameraCol > this.mapWidth - this.viewportCols) {
				newCameraCol = this.mapWidth - this.viewportCols
				velocity *= this.BOUNCE_DAMPING
				hitBoundary = true
			}

			this.cameraCol = newCameraCol

			// 绘制
			if (this.currentMap) {
				this.drawImmediate(this.currentMap, this.currentHeroCol)
			}

			// 如果撞边界且速度很小，停止
			if (hitBoundary && Math.abs(velocity) < this.MIN_VELOCITY * 2) {
				this.stopInertia()
				return
			}

			this.inertiaFrameId = requestAnimationFrame(animate)
		}

		this.inertiaFrameId = requestAnimationFrame(animate)
	}

	/**
	 * 停止惯性滚动
	 */
	private stopInertia(): void {
		if (this.inertiaFrameId !== null) {
			cancelAnimationFrame(this.inertiaFrameId)
			this.inertiaFrameId = null
		}
		this.velocity = 0
		this.maxVelocity = 0
	}
}
