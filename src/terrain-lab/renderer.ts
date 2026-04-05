// ========== 渲染辅助函数 ==========
// 职责：MLP网络图、Embedding空间、执念曲线绘制
// 注意：地形网格绘制已移至 GridWorldRenderer

import type { ForwardResult } from "./types.js"
import type { AppState } from "./state.js"
import {
	NUM_LAYERS, NUM_COLS, ELEMENTS, ELEM_AIR,
	HIDDEN_DIM, OUTPUT_DIM, ACTIONS,
	EMBED_SIZE_BASE, EMBED_SIZE_SENSITIVITY, EMBED_SIZE_OFFSET, EMBED_SIZE_MIN, EMBED_SIZE_MAX
} from "./constants.js"
import { setupHighDPICanvas } from "@/engine/utils/canvas.js"

// 重新导出，保持兼容性
export function setupCanvas(canvas: HTMLCanvasElement) {
	return setupHighDPICanvas(canvas)
}

// ========== Emoji 绘制辅助 ==========

export function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
	ctx.font = `${Math.floor(size)}px sans-serif`
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"
	ctx.fillText(emoji, x, y)
}

// ========== MLP 网络图绘制 ==========

export function drawMLP(
	mlpCanvas: HTMLCanvasElement,
	state: AppState,
	fp: ForwardResult | null
) {
	const { ctx, width: W, height: H } = setupCanvas(mlpCanvas)

	// 清空画布
	ctx.fillStyle = "#0b0c0f"
	ctx.fillRect(0, 0, W, H)

	// 左侧：5x3 环境网格（作为 embedding 输入源的可视化）
	const cellSize = 28, gapX = 4, gapY = 4
	const cellW = cellSize
	const cellH = cellSize
	const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
	const startX = 10
	const startY = (H - gridH) / 2

	// 绘制 MLP 左侧的小地形网格
	drawMiniTerrainGrid(ctx, state.terrain, cellW, cellH, gapX, gapY, startX, startY)

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

/**
 * MLP 内嵌的小地形网格绘制
 */
function drawMiniTerrainGrid(
	ctx: CanvasRenderingContext2D,
	terrain: number[][],
	cellW: number, cellH: number, gapX: number, gapY: number,
	startX: number, startY: number
) {
	// 绘制网格线框
	ctx.strokeStyle = "#3c4043"
	ctx.lineWidth = 1

	for (let r = 0; r < NUM_LAYERS; r++) {
		for (let c = 0; c < NUM_COLS; c++) {
			const x = startX + c * (cellW + gapX)
			const y = startY + r * (cellH + gapY)
			ctx.strokeRect(x, y, cellW, cellH)
		}
	}

	// 绘制元素
	for (let r = 0; r < NUM_LAYERS; r++) {
		for (let c = 0; c < NUM_COLS; c++) {
			const elemId = terrain[r]?.[c]
			if (elemId === undefined) continue

			const elem = ELEMENTS[elemId]
			if (elem) {
				const x = startX + c * (cellW + gapX) + cellW / 2
				const y = startY + r * (cellH + gapY) + cellH / 2
				drawEmoji(ctx, elem.emoji, x, y, Math.min(cellW, cellH) * 0.55)
			}
		}
	}
}

// ========== Embedding 空间绘制 ==========

export function drawEmbedding(
	embeddingCanvas: HTMLCanvasElement,
	state: AppState
) {
	const { ctx, width: W, height: H } = setupCanvas(embeddingCanvas)

	// 清空画布
	ctx.fillStyle = "#0b0c0f"
	ctx.fillRect(0, 0, W, H)

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

	// 清空画布
	ctx.fillStyle = "#0b0c0f"
	ctx.fillRect(0, 0, W, H)

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
