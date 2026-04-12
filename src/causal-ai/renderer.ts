// ========== 因果链 AI - 世界渲染器 ==========

import type { GameState } from "./types"
import { WORLD_CONFIG, GRID_SIZE, CELL_SIZE } from "./config"

// 颜色配置
const COLORS = {
	grid: "#2e405b",
	wall: "#3a4c5e",
	doorClosed: "#8b5e3c",
	doorOpen: "#3f5c3f",
	key: "#d4af37",
	keyDark: "#b8860b",
	flag: "#e63946",
	flagLight: "#f1fa8c",
	agent: "#4ea1d3",
	agentStroke: "#fff"
} as const

// 渲染器类
export class WorldRenderer {
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private width: number
	private height: number

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas
		const ctx = canvas.getContext("2d")
		if (!ctx) {
			throw new Error("无法获取 Canvas 2D 上下文")
		}
		this.ctx = ctx
		this.width = GRID_SIZE * CELL_SIZE
		this.height = GRID_SIZE * CELL_SIZE

		// 设置 canvas 尺寸
		canvas.width = this.width
		canvas.height = this.height
	}

	// 清空画布
	private clear(): void {
		this.ctx.clearRect(0, 0, this.width, this.height)
	}

	// 绘制网格
	private drawGrid(): void {
		this.ctx.strokeStyle = COLORS.grid
		this.ctx.lineWidth = 0.5

		for (let i = 0; i <= GRID_SIZE; i++) {
			const pos = i * CELL_SIZE
			// 垂直线
			this.ctx.beginPath()
			this.ctx.moveTo(pos, 0)
			this.ctx.lineTo(pos, this.height)
			this.ctx.stroke()

			// 水平线
			this.ctx.beginPath()
			this.ctx.moveTo(0, pos)
			this.ctx.lineTo(this.width, pos)
			this.ctx.stroke()
		}
	}

	// 绘制墙壁
	private drawWalls(): void {
		this.ctx.fillStyle = COLORS.wall
		WORLD_CONFIG.walls.forEach((coord) => {
			const [x, y] = coord.split(",").map(Number)
			this.ctx.fillRect(
				x * CELL_SIZE,
				y * CELL_SIZE,
				CELL_SIZE,
				CELL_SIZE
			)
		})
	}

	// 绘制门
	private drawDoor(isOpen: boolean): void {
		const { x, y } = WORLD_CONFIG.doorPos
		const px = x * CELL_SIZE
		const py = y * CELL_SIZE

		this.ctx.fillStyle = isOpen ? COLORS.doorOpen : COLORS.doorClosed
		this.ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE)

		// 门图标
		this.ctx.font = "bold 20px system-ui"
		this.ctx.textAlign = "center"
		this.ctx.textBaseline = "middle"
		this.ctx.fillStyle = isOpen ? COLORS.doorOpen : "#5d3a1c"
		this.ctx.fillText("🚪", px + CELL_SIZE / 2, py + CELL_SIZE / 2)
	}

	// 绘制钥匙
	private drawKey(exists: boolean): void {
		if (!exists) return

		const { x, y } = WORLD_CONFIG.keyPos
		const cx = x * CELL_SIZE + CELL_SIZE / 2
		const cy = y * CELL_SIZE + CELL_SIZE / 2

		// 钥匙圆圈
		this.ctx.fillStyle = COLORS.key
		this.ctx.beginPath()
		this.ctx.arc(cx, cy, 14, 0, Math.PI * 2)
		this.ctx.fill()

		// 钥匙图标
		this.ctx.fillStyle = COLORS.keyDark
		this.ctx.font = "18px system-ui"
		this.ctx.fillText("🔑", x * CELL_SIZE + 14, y * CELL_SIZE + 16)
	}

	// 绘制旗帜
	private drawFlag(): void {
		const { x, y } = WORLD_CONFIG.flagPos
		const cx = x * CELL_SIZE + 10
		const cy = y * CELL_SIZE + 8

		// 旗帜三角形
		this.ctx.fillStyle = COLORS.flag
		this.ctx.beginPath()
		this.ctx.moveTo(cx, cy)
		this.ctx.lineTo(x * CELL_SIZE + 30, y * CELL_SIZE + 20)
		this.ctx.lineTo(cx, y * CELL_SIZE + 32)
		this.ctx.fill()

		// 旗帜图标
		this.ctx.font = "bold 22px system-ui"
		this.ctx.fillStyle = COLORS.flagLight
		this.ctx.fillText("🚩", x * CELL_SIZE + 14, y * CELL_SIZE + 20)
	}

	// 绘制玩家
	private drawAgent(agentPos: { x: number; y: number }): void {
		const cx = agentPos.x * CELL_SIZE + CELL_SIZE / 2
		const cy = agentPos.y * CELL_SIZE + CELL_SIZE / 2

		// 玩家圆圈
		this.ctx.fillStyle = COLORS.agent
		this.ctx.beginPath()
		this.ctx.arc(cx, cy, 14, 0, Math.PI * 2)
		this.ctx.fill()

		// 白色描边
		this.ctx.strokeStyle = COLORS.agentStroke
		this.ctx.lineWidth = 2
		this.ctx.stroke()

		// 玩家图标
		this.ctx.font = "bold 16px system-ui"
		this.ctx.fillStyle = "white"
		this.ctx.fillText(
			"🧑",
			agentPos.x * CELL_SIZE + 14,
			agentPos.y * CELL_SIZE + 14
		)
	}

	// 渲染完整世界
	render(state: GameState): void {
		this.clear()
		this.drawGrid()
		this.drawWalls()
		this.drawDoor(state.doorOpen)
		this.drawKey(state.keyExists)
		this.drawFlag()
		this.drawAgent(state.agent)
	}
}
