// ========== 因果链 AI Web 版 - Canvas 渲染器 ==========
// 渲染 11x11 局部视野

import type { LocalView, Cell } from "./types"

// 渲染配置
const RENDER_CONFIG = {
	viewRange: 5,        // 视野半径（11x11 = 5*2+1）
	cellSize: 32,        // 格子大小
	colors: {
		background: "#10141c",
		grid: "#2e3a48",
		wall: "#4a5568",
		floor: "#1a202c",
		agent: "#4ea1d3",
		key: "#f6ad55",
		doorClosed: "#e53e3e",
		doorOpen: "#48bb78",
		goal: "#9f7aea"
	}
}

// 视野渲染器
export class WorldRenderer {
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas
		const ctx = canvas.getContext("2d")
		if (!ctx) {
			throw new Error("无法获取 Canvas 上下文")
		}
		this.ctx = ctx
		
		// 设置 Canvas 大小（11x11 格子）
		const size = (RENDER_CONFIG.viewRange * 2 + 1) * RENDER_CONFIG.cellSize
		this.canvas.width = size
		this.canvas.height = size
	}

	// 渲染视野
	render(view: LocalView): void {
		const { ctx, canvas } = this
		const { cellSize, viewRange } = RENDER_CONFIG

		// 清空背景
		ctx.fillStyle = RENDER_CONFIG.colors.background
		ctx.fillRect(0, 0, canvas.width, canvas.height)

		// 渲染每个格子
		for (let dy = -viewRange; dy <= viewRange; dy++) {
			for (let dx = -viewRange; dx <= viewRange; dx++) {
				const cell = view.cells.get(`${dx},${dy}`)
				const screenX = (dx + viewRange) * cellSize
				const screenY = (dy + viewRange) * cellSize

				if (cell) {
					this.renderCell(cell, screenX, screenY, cellSize)
				}
			}
		}

		// 绘制网格线
		ctx.strokeStyle = RENDER_CONFIG.colors.grid
		ctx.lineWidth = 1
		for (let i = 0; i <= viewRange * 2 + 1; i++) {
			const pos = i * cellSize
			// 竖线
			ctx.beginPath()
			ctx.moveTo(pos, 0)
			ctx.lineTo(pos, canvas.height)
			ctx.stroke()
			// 横线
			ctx.beginPath()
			ctx.moveTo(0, pos)
			ctx.lineTo(canvas.width, pos)
			ctx.stroke()
		}

		// 高亮中心（玩家位置）
		const centerPos = viewRange * cellSize
		ctx.strokeStyle = RENDER_CONFIG.colors.agent
		ctx.lineWidth = 2
		ctx.strokeRect(centerPos + 2, centerPos + 2, cellSize - 4, cellSize - 4)
	}

	// 渲染单个格子
	private renderCell(cell: Cell, x: number, y: number, size: number): void {
		const { ctx } = this

		// 绘制地形背景
		if (cell.tile.type === "wall") {
			ctx.fillStyle = RENDER_CONFIG.colors.wall
			ctx.fillRect(x, y, size, size)
		} else {
			ctx.fillStyle = RENDER_CONFIG.colors.floor
			ctx.fillRect(x, y, size, size)
		}

		// 绘制对象
		if (cell.objects.length > 0) {
			// 优先显示非玩家对象
			const obj = cell.objects.find(o => o.type !== "agent") || cell.objects[0]
			if (obj) {
				this.renderObject(obj.type, obj.state, x, y, size)
			}
		}
	}

	// 渲染对象
	private renderObject(type: string, state: Record<string, unknown> | undefined, x: number, y: number, size: number): void {
		const { ctx } = this
		const centerX = x + size / 2
		const centerY = y + size / 2
		const radius = size * 0.35

		switch (type) {
		case "agent":
			ctx.fillStyle = RENDER_CONFIG.colors.agent
			ctx.beginPath()
			ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
			ctx.fill()
			break
		case "钥匙":
			ctx.fillStyle = RENDER_CONFIG.colors.key
			ctx.beginPath()
			ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2)
			ctx.fill()
			// 画钥匙形状
			ctx.fillStyle = "#000"
			ctx.font = `${size * 0.6}px monospace`
			ctx.textAlign = "center"
			ctx.textBaseline = "middle"
			ctx.fillText("🔑", centerX, centerY)
			break
		case "门":
			if (state?.open) {
				ctx.fillStyle = RENDER_CONFIG.colors.doorOpen
			} else {
				ctx.fillStyle = RENDER_CONFIG.colors.doorClosed
			}
			ctx.fillRect(x + 4, y + 4, size - 8, size - 8)
			// 画门状态
			ctx.fillStyle = "#fff"
			ctx.font = `${size * 0.5}px monospace`
			ctx.textAlign = "center"
			ctx.textBaseline = "middle"
			ctx.fillText(state?.open ? "开" : "锁", centerX, centerY)
			break
		case "终点":
			ctx.fillStyle = RENDER_CONFIG.colors.goal
			ctx.beginPath()
			ctx.moveTo(centerX, y + 4)
			ctx.lineTo(x + size - 4, centerY)
			ctx.lineTo(centerX, y + size - 4)
			ctx.lineTo(x + 4, centerY)
			ctx.closePath()
			ctx.fill()
			break
		}
	}
}
