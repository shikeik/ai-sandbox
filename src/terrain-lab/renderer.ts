import type { DrawOptions, ForwardResult } from "./types.js"
import type { AppState } from "./state.js"
import {
	NUM_LAYERS, NUM_COLS, ELEMENTS, ELEM_AIR, NUM_ELEMENTS,
	HIDDEN_DIM, OUTPUT_DIM, ACTIONS,
	EMBED_SIZE_BASE, EMBED_SIZE_SENSITIVITY, EMBED_SIZE_OFFSET, EMBED_SIZE_MIN, EMBED_SIZE_MAX
} from "./constants.js"
import { findHeroCol } from "./terrain.js"
import { calculateAnimationPath } from "./animation.js"

// ========== Canvas 工具函数 ==========

/**
 * 设置 Canvas 的高 DPI 渲染
 * - 根据 devicePixelRatio 调整 canvas 实际尺寸
 * - 设置 transform 保证绘制内容清晰
 * - 清空画布
 * @returns 包含 ctx、rect、dpr、width、height 的对象
 */
export function setupCanvas(canvas: HTMLCanvasElement): {
	ctx: CanvasRenderingContext2D
	rect: { width: number; height: number; left: number; top: number }
	dpr: number
	width: number
	height: number
} {
	const ctx = canvas.getContext("2d")!
	const rect = canvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	canvas.width = Math.floor(rect.width * dpr)
	canvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.clearRect(0, 0, rect.width, rect.height)
	return { ctx, rect, dpr, width: rect.width, height: rect.height }
}

// ========== 编辑器布局计算 ==========

export function getEditorLayout(rect: { width: number; height: number }) {
	const cellSize = 44
	const cellW = cellSize
	const cellH = cellSize
	const gapX = 6
	const gapY = 6
	const gridW = NUM_COLS * cellW + (NUM_COLS - 1) * gapX
	const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
	const startX = (rect.width - gridW) / 2
	const startY = (rect.height - gridH) / 2 + 10
	return { cellW, cellH, gapX, gapY, gridW, gridH, startX, startY }
}

export function drawEditorLabels(
	ctx: CanvasRenderingContext2D,
	startX: number, startY: number,
	cellW: number, cellH: number, gapX: number, gapY: number
) {
	ctx.fillStyle = "#9aa0a6"
	ctx.font = "10px sans-serif"
	ctx.textAlign = "right"
	for (let r = 0; r < NUM_LAYERS; r++) {
		ctx.fillText(["天上", "地上", "地面"][r], startX - 8, startY + r * (cellH + gapY) + cellH / 2 + 3)
	}
	ctx.textAlign = "center"
	const labels = Array.from({ length: NUM_COLS }, (_, i) => `x${i}`)
	for (let c = 0; c < NUM_COLS; c++) {
		ctx.fillText(labels[c], startX + c * (cellW + gapX) + cellW / 2, startY - 8)
	}
}

// ========== 地形网格绘制 ==========

export function drawTerrainGrid(
	ctx: CanvasRenderingContext2D,
	t: number[][],
	opts: DrawOptions
) {
	const { cellW, cellH, gapX, gapY, startX, startY, hideSlimeAt, hideHeroAtCol } = opts

	// 绘制网格线框（所有列统一处理）
	for (let r = 0; r < NUM_LAYERS; r++) {
		for (let c = 0; c < NUM_COLS; c++) {
			const x = startX + c * (cellW + gapX)
			const y = startY + r * (cellH + gapY)

			ctx.strokeStyle = "#3c4043"
			ctx.lineWidth = 1
			ctx.strokeRect(x, y, cellW, cellH)
		}
	}

	// 绘制元素
	for (let r = 0; r < NUM_LAYERS; r++) {
		for (let c = 0; c < NUM_COLS; c++) {
			const x = startX + c * (cellW + gapX)
			const y = startY + r * (cellH + gapY)

			const elemId = t[r][c]

			// 跳过被击杀的史莱姆
			if (r === 1 && c === (hideSlimeAt ?? -1)) continue

			// 动画时跳过原位置的狐狸
			if (r === 1 && c === (hideHeroAtCol ?? -1) && elemId === 1) {
				drawEmoji(ctx, ELEMENTS[ELEM_AIR].emoji, x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.55)
				continue
			}

			drawEmoji(ctx, ELEMENTS[elemId].emoji, x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.55)
		}
	}
}

export function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
	ctx.font = `${Math.floor(size)}px sans-serif`
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"
	ctx.fillText(emoji, x, y)
}

// ========== 编辑器绘制 ==========

export function drawEditorWithState(
	editorCanvas: HTMLCanvasElement,
	state: AppState
) {
	const { ctx, rect } = setupCanvas(editorCanvas)

	const { cellW, cellH, gapX, gapY, startX, startY } = getEditorLayout(rect)
	drawEditorLabels(ctx, startX, startY, cellW, cellH, gapX, gapY)

	const heroCol = findHeroCol(state.terrain)

	// 动画状态
	let animHeroX: number | null = null
	let animHeroY: number | null = null

	if (state.animation.animAction !== null) {
		const heroBaseX = startX + heroCol * (cellW + gapX) + cellW / 2
		const heroBaseY = startY + 1 * (cellH + gapY) + cellH / 2
		const path = calculateAnimationPath(heroCol, state.animation.animAction)
		const targetX = startX + path.targetCol * (cellW + gapX) + cellW / 2
		const duration = path.duration
		let t = (performance.now() - state.animation.animStartTime) / duration
		if (t > 1) t = 1
		animHeroX = heroBaseX + (targetX - heroBaseX) * t
		if (path.isJump) {
			const parabola = 4 * t * (1 - t)
			animHeroY = heroBaseY - parabola * (cellH + path.jumpHeight)
		} else {
			animHeroY = heroBaseY
		}
	}

	drawTerrainGrid(ctx, state.terrain, {
		cellW, cellH, gapX, gapY, startX, startY,
		hideSlimeAt: state.animation.animSlimeKilled ? (heroCol + 1 < NUM_COLS ? heroCol + 1 : null) : null,
		hideHeroAtCol: state.animation.animAction !== null ? heroCol : null,
		dimNonInteractive: false,
	})

	if (animHeroX !== null && animHeroY !== null) {
		drawEmoji(ctx, "🦊", animHeroX, animHeroY, Math.min(cellW, cellH) * 0.65)
	}
}

// ========== MLP 网络图绘制 ==========

export function drawMLP(
	mlpCanvas: HTMLCanvasElement,
	state: AppState,
	fp: ForwardResult | null
) {
	const { ctx, width: W, height: H } = setupCanvas(mlpCanvas)

	// 左侧：5x3 环境网格（作为 embedding 输入源的可视化）
	const cellSize = 28, gapX = 4, gapY = 4
	const cellW = cellSize
	const cellH = cellSize
	const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
	const startX = 10
	const startY = (H - gridH) / 2

	drawTerrainGrid(ctx, state.terrain, {
		cellW, cellH, gapX, gapY, startX, startY,
		hideSlimeAt: null,
		dimNonInteractive: true,
	})

	// 隐藏层
	const hidX = W / 2
	const hidY = Array.from({ length: HIDDEN_DIM }, (_, i) => {
		const gap = H / (HIDDEN_DIM + 1)
		return gap * (i + 1)
	})

	// 输出层
	const outX = W - 50
	const outY = Array.from({ length: OUTPUT_DIM }, (_, i) => {
		const gap = H / (OUTPUT_DIM + 1)
		return gap * (i + 1)
	})

	// 输入->隐藏连线（装饰性）
	ctx.lineWidth = 0.5
	for (let r = 0; r < NUM_LAYERS; r++) {
		for (let c = 0; c < NUM_COLS; c++) {
			const x1 = startX + c * (cellW + gapX) + cellW / 2
			const y1 = startY + r * (cellH + gapY) + cellH / 2
			for (let h = 0; h < HIDDEN_DIM; h++) {
				ctx.strokeStyle = "rgba(95,99,104,0.15)"
				ctx.beginPath()
				ctx.moveTo(x1, y1)
				ctx.lineTo(hidX, hidY[h])
				ctx.stroke()
			}
		}
	}

	// 隐藏->输出连线
	for (let h = 0; h < HIDDEN_DIM; h++) {
		for (let o = 0; o < OUTPUT_DIM; o++) {
			let w = 0
			if (fp) w = state.net.W2[o][h]
			const alpha = Math.min(Math.abs(w) * 2, 1)
			ctx.strokeStyle = w > 0 ? `rgba(138,180,248,${alpha})` : `rgba(249,171,0,${alpha})`
			ctx.lineWidth = Math.max(0.5, Math.abs(w) * 2)
			ctx.beginPath()
			ctx.moveTo(hidX, hidY[h])
			ctx.lineTo(outX, outY[o])
			ctx.stroke()
		}
	}
	ctx.lineWidth = 1

	// 隐藏层节点
	for (let h = 0; h < HIDDEN_DIM; h++) {
		ctx.beginPath()
		ctx.arc(hidX, hidY[h], 6, 0, Math.PI * 2)
		ctx.fillStyle = "#16181d"
		ctx.fill()
		ctx.strokeStyle = "#8ab4f8"
		ctx.stroke()
		if (fp) {
			ctx.fillStyle = "#e8eaed"
			ctx.font = "8px monospace"
			ctx.textAlign = "center"
			ctx.fillText(fp.h[h].toFixed(1), hidX, hidY[h] + 2)
		}
	}

	// 输出层节点
	for (let o = 0; o < OUTPUT_DIM; o++) {
		ctx.beginPath()
		ctx.arc(outX, outY[o], 10, 0, Math.PI * 2)
		ctx.fillStyle = "#16181d"
		ctx.fill()
		ctx.strokeStyle = "#8ab4f8"
		ctx.lineWidth = 2
		ctx.stroke()
		if (fp) {
			ctx.fillStyle = "#e8eaed"
			ctx.font = "10px monospace"
			ctx.textAlign = "center"
			ctx.fillText(fp.o[o].toFixed(2), outX, outY[o] + 3)
		}
		ctx.fillStyle = "#9aa0a6"
		ctx.font = "9px sans-serif"
		ctx.fillText(ACTIONS[o], outX, outY[o] + 24)
	}
}

// ========== Embedding 空间绘制 ==========

export function drawEmbedding(
	embeddingCanvas: HTMLCanvasElement,
	state: AppState
) {
	const { ctx, width: W, height: H } = setupCanvas(embeddingCanvas)

	const cx = W / 2
	const cy = H / 2
	const padding = 34
	const availW = Math.max(W - padding * 2, 1)
	const availH = Math.max(H - padding * 2, 1)

	// 动态计算缩放因子，确保所有元素都在画布内
	let maxAbs = 0
	for (const el of ELEMENTS) {
		maxAbs = Math.max(maxAbs, Math.abs(state.net.embed[el.id][0]), Math.abs(state.net.embed[el.id][1]))
	}
	maxAbs = Math.max(maxAbs, 0.5) // 防止初始全在0附近时scale过大

	const scaleX = availW / 2 / maxAbs
	const scaleY = availH / 2 / maxAbs
	const scale = Math.min(scaleX, scaleY)
	const halfSide = maxAbs * scale

	// 方形边界框（以最远元素为半径）
	ctx.strokeStyle = "rgba(95,99,104,0.4)"
	ctx.lineWidth = 1
	ctx.setLineDash([4, 4])
	ctx.strokeRect(cx - halfSide, cy - halfSide, halfSide * 2, halfSide * 2)
	ctx.setLineDash([])

	// 标注半径数值（画布右上角，远离元素）
	ctx.fillStyle = "#5f6368"
	ctx.font = "9px sans-serif"
	ctx.textAlign = "right"
	ctx.textBaseline = "top"
	ctx.fillText(`R=${maxAbs.toFixed(2)}`, W - 6, 6)

	// 坐标轴
	ctx.strokeStyle = "#3c4043"
	ctx.lineWidth = 1
	ctx.beginPath()
	ctx.moveTo(cx - W / 2 + 10, cy)
	ctx.lineTo(cx + W / 2 - 10, cy)
	ctx.stroke()
	ctx.beginPath()
	ctx.moveTo(cx, cy - H / 2 + 10)
	ctx.lineTo(cx, cy + H / 2 - 10)
	ctx.stroke()

	// 全局大小系数：由外框半径 R 统一决定，R 越小整体越大，R 越大整体越小
	const globalSizeFactor = Math.max(
		EMBED_SIZE_MIN,
		Math.min(EMBED_SIZE_MAX, EMBED_SIZE_BASE - EMBED_SIZE_SENSITIVITY * (maxAbs - EMBED_SIZE_OFFSET))
	)

	// 元素点
	for (const el of ELEMENTS) {
		const ex = state.net.embed[el.id][0]
		const ey = state.net.embed[el.id][1]
		const px = cx + ex * scale
		const py = cy - ey * scale
		const r = 3 * globalSizeFactor

		ctx.beginPath()
		ctx.arc(px, py, r, 0, Math.PI * 2)
		ctx.fillStyle = "#8ab4f8"
		ctx.fill()
		ctx.strokeStyle = "#e8eaed"
		ctx.lineWidth = 1
		ctx.stroke()

		ctx.font = `${Math.floor(9 * globalSizeFactor)}px sans-serif`
		ctx.textAlign = "left"
		ctx.textBaseline = "middle"
		ctx.fillStyle = "#e8eaed"
		ctx.fillText(el.emoji, px + r + 2, py)
		ctx.fillStyle = "#9aa0a6"
		ctx.font = `${Math.floor(8 * globalSizeFactor)}px sans-serif`
		ctx.fillText(el.name, px + r + 2 + 11 * globalSizeFactor, py)
	}
}

// ========== 执念曲线绘制 ==========

export function drawObsessionCurve(
	obsessionCanvas: HTMLCanvasElement,
	state: AppState
) {
	const { ctx, width: W, height: H } = setupCanvas(obsessionCanvas)

	if (!state.observedSample || state.snapshots.length < 2) {
		ctx.fillStyle = "#5f6368"
		ctx.font = "11px sans-serif"
		ctx.textAlign = "center"
		ctx.fillText(state.observedSample ? "训练后此处将显示概率演变曲线" : "请先设置观察样本", W / 2, H / 2)
		return
	}

	const padding = { left: 36, right: 10, top: 16, bottom: 24 }
	const chartW = W - padding.left - padding.right
	const chartH = H - padding.top - padding.bottom

	// 坐标轴
	ctx.strokeStyle = "#3c4043"
	ctx.lineWidth = 1
	ctx.beginPath()
	ctx.moveTo(padding.left, padding.top)
	ctx.lineTo(padding.left, H - padding.bottom)
	ctx.lineTo(W - padding.right, H - padding.bottom)
	ctx.stroke()

	// 数据
	const steps = state.snapshots.map(s => s.step)
	const maxStep = steps[steps.length - 1]
	const colors = ["#8ab4f8", "#f9ab00", "#34a853", "#ea4335"]

	// 绘制每条动作概率线
	for (let a = 0; a < OUTPUT_DIM; a++) {
		ctx.strokeStyle = colors[a]
		ctx.lineWidth = a === state.observedSample!.y ? 2.5 : 1.5
		ctx.beginPath()
		let hasPoint = false
		for (let i = 0; i < state.snapshots.length; i++) {
			const probs = state.snapshots[i].observedProbs
			if (!probs) continue
			const x = padding.left + (steps[i] / maxStep) * chartW
			const y = (H - padding.bottom) - probs[a] * chartH
			if (!hasPoint) {
				ctx.moveTo(x, y)
				hasPoint = true
			} else {
				ctx.lineTo(x, y)
			}
		}
		ctx.stroke()
	}

	// 当前选中快照指示线
	if (state.selectedSnapshotIndex >= 0) {
		const curStep = steps[state.selectedSnapshotIndex]
		const x = padding.left + (curStep / maxStep) * chartW
		ctx.strokeStyle = "rgba(255,255,255,0.3)"
		ctx.lineWidth = 1
		ctx.setLineDash([4, 4])
		ctx.beginPath()
		ctx.moveTo(x, padding.top)
		ctx.lineTo(x, H - padding.bottom)
		ctx.stroke()
		ctx.setLineDash([])
	}

	// Y轴刻度
	ctx.fillStyle = "#5f6368"
	ctx.font = "9px sans-serif"
	ctx.textAlign = "right"
	ctx.textBaseline = "middle"
	for (const v of [0, 0.5, 1]) {
		const y = (H - padding.bottom) - v * chartH
		ctx.fillText(String(v), padding.left - 6, y)
	}

	// X轴标签
	ctx.textAlign = "center"
	ctx.textBaseline = "top"
	ctx.fillText("0", padding.left, H - padding.bottom + 4)
	ctx.fillText(String(maxStep), W - padding.right, H - padding.bottom + 4)

	// 图例
	ctx.textAlign = "left"
	ctx.textBaseline = "top"
	let lx = padding.left + 4
	for (let a = 0; a < OUTPUT_DIM; a++) {
		ctx.fillStyle = colors[a]
		ctx.fillText(ACTIONS[a], lx, padding.top - 12)
		lx += 32
	}
}

// ========== 动画帧绘制 ==========

export function stepAnimation(
	editorCanvas: HTMLCanvasElement,
	state: AppState,
	now: number
): number {
	if (!state.animation.animAction) return 1

	const { ctx, rect } = setupCanvas(editorCanvas)

	const { cellW, cellH, gapX, gapY, startX, startY } = getEditorLayout(rect)
	drawEditorLabels(ctx, startX, startY, cellW, cellH, gapX, gapY)

	const startHeroCol = findHeroCol(state.terrain)
	const path = calculateAnimationPath(startHeroCol, state.animation.animAction)
	const duration = path.duration
	let t = (now - state.animation.animStartTime) / duration
	if (t > 1) t = 1

	const heroBaseX = startX + startHeroCol * (cellW + gapX) + cellW / 2
	const heroBaseY = startY + 1 * (cellH + gapY) + cellH / 2

	let hx = heroBaseX
	let hy = heroBaseY
	const targetX = startX + path.targetCol * (cellW + gapX) + cellW / 2

	if (!path.isJump) {
		hx = heroBaseX + (targetX - heroBaseX) * easeOutQuad(t)
		hy = heroBaseY
		if (state.animation.animAction === "走A" && t > 0.5) state.animation.animSlimeKilled = true
	} else {
		hx = heroBaseX + (targetX - heroBaseX) * t
		const parabola = 4 * t * (1 - t)
		hy = heroBaseY - parabola * (cellH + path.jumpHeight)
	}

	drawTerrainGrid(ctx, state.terrain, {
		cellW, cellH, gapX, gapY, startX, startY,
		hideSlimeAt: state.animation.animSlimeKilled ? (startHeroCol + 1 < NUM_COLS ? startHeroCol + 1 : null) : null,
		hideHeroAtCol: startHeroCol,
		dimNonInteractive: false,
	})

	drawEmoji(ctx, "🦊", hx, hy, Math.min(cellW, cellH) * 0.65)

	return t
}

// ========== 获取编辑器单元格 ==========

export interface CellPos { r: number; c: number }

export function getEditorCellAt(
	mx: number, my: number,
	rect: { width: number; height: number; left: number; top: number },
	cellSize: number = 44,
	gap: number = 6
): CellPos | null {
	const cellW = cellSize
	const cellH = cellSize
	const gapX = gap
	const gapY = gap
	const gridW = NUM_COLS * cellW + (NUM_COLS - 1) * gapX
	const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
	const startX = (rect.width - gridW) / 2
	const startY = (rect.height - gridH) / 2 + 10

	const x = mx - startX
	const y = my - startY
	const c = Math.floor(x / (cellW + gapX))
	const r = Math.floor(y / (cellH + gapY))

	if (c < 0 || c >= NUM_COLS || r < 0 || r >= NUM_LAYERS) return null

	// 检查是否在格子内部（不在 gap 上）
	const localX = x - c * (cellW + gapX)
	const localY = y - r * (cellH + gapY)
	if (localX < 0 || localX > cellW || localY < 0 || localY > cellH) return null

	return { r, c }
}

// 缓动函数
function easeOutQuad(t: number): number {
	return t * (2 - t)
}
