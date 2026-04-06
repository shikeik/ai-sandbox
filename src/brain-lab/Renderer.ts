// ========== 渲染器：让世界和大脑可见 ==========

import { WorldState, Imagination, BrainDecision, ELEM } from "./types.js"

export class Renderer {
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private cellSize: number = 40
	private gap: number = 4

	constructor(canvasId: string) {
		const canvas = document.getElementById(canvasId) as HTMLCanvasElement
		if (!canvas) throw new Error(`Canvas ${canvasId} not found`)
		this.canvas = canvas
		const ctx = canvas.getContext("2d")
		if (!ctx) throw new Error("Cannot get 2D context")
		this.ctx = ctx
	}

	// 渲染世界状态
	renderWorld(state: WorldState): void {
		const grid = state.grid
		const height = grid.length
		const width = grid[0].length

		// 清空
		this.ctx.fillStyle = "#1a1a2e"
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

		// 计算偏移居中
		const totalWidth = width * (this.cellSize + this.gap)
		const totalHeight = height * (this.cellSize + this.gap)
		const offsetX = (this.canvas.width - totalWidth) / 2
		const offsetY = (this.canvas.height - totalHeight) / 2

		// 绘制网格
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const px = offsetX + x * (this.cellSize + this.gap)
				const py = offsetY + y * (this.cellSize + this.gap)

				// 绘制格子背景
				this.drawCell(grid[y][x], px, py)
			}
		}

		// 绘制敌人
		this.ctx.fillStyle = "#e74c3c"
		for (const enemy of state.enemies) {
			const px = offsetX + enemy.x * (this.cellSize + this.gap)
			const py = offsetY + enemy.y * (this.cellSize + this.gap)
			this.ctx.fillRect(px + 5, py + 5, this.cellSize - 10, this.cellSize - 10)
			this.ctx.fillStyle = "#fff"
			this.ctx.font = "16px Arial"
			this.ctx.fillText("👿", px + 8, py + 28)
			this.ctx.fillStyle = "#e74c3c"
		}

		// 绘制主角
		const heroPx = offsetX + state.hero.x * (this.cellSize + this.gap)
		const heroPy = offsetY + state.hero.y * (this.cellSize + this.gap)
		this.ctx.fillStyle = "#3498db"
		this.ctx.beginPath()
		this.ctx.arc(
			heroPx + this.cellSize / 2,
			heroPy + this.cellSize / 2,
			this.cellSize / 2 - 5,
			0,
			Math.PI * 2
		)
		this.ctx.fill()
		this.ctx.fillStyle = "#fff"
		this.ctx.font = "20px Arial"
		this.ctx.fillText("🦊", heroPx + 8, heroPy + 28)
	}

	// 绘制单个格子
	private drawCell(element: number, x: number, y: number): void {
		const colors: Record<number, string> = {
			[ELEM.AIR]: "#16213e",
			[ELEM.PLATFORM]: "#2ecc71",
			[ELEM.GOAL]: "#f39c12",
			[ELEM.BUTTON]: "#9b59b6",
			[ELEM.SPIKE]: "#e74c3c",
		}

		this.ctx.fillStyle = colors[element] || "#16213e"
		this.ctx.fillRect(x, y, this.cellSize, this.cellSize)

		// 绘制图标
		this.ctx.fillStyle = "#fff"
		this.ctx.font = "20px Arial"
		const icons: Record<number, string> = {
			[ELEM.AIR]: "",
			[ELEM.PLATFORM]: "",
			[ELEM.GOAL]: "🏁",
			[ELEM.BUTTON]: "🔘",
			[ELEM.SPIKE]: "🔺",
		}
		if (icons[element]) {
			this.ctx.fillText(icons[element], x + 8, y + 28)
		}
	}

	// 渲染大脑的想象（关键可视化）
	renderImagination(decision: BrainDecision, state: WorldState): void {
		const container = document.getElementById("brain-panel")
		if (!container) return

		// 清空面板
		container.innerHTML = ""

		// 标题
		const title = document.createElement("div")
		title.className = "brain-title"
		title.textContent = "🧠 大脑正在思考..."
		container.appendChild(title)

		// 决策理由
		const reasoning = document.createElement("div")
		reasoning.className = "brain-reasoning"
		reasoning.textContent = decision.reasoning
		container.appendChild(reasoning)

		// 想象对比
		const grid = document.createElement("div")
		grid.className = "imagination-grid"

		for (const img of decision.imaginations) {
			const card = document.createElement("div")
			card.className = `imagination-card ${img.action === decision.selectedAction ? 'selected' : ''}`

			const actionName: Record<string, string> = {
				LEFT: "⬅️ 左移",
				RIGHT: "➡️ 右移",
				JUMP: "⬆️ 跳跃",
				WAIT: "⏸️ 等待",
			}

			card.innerHTML = `
				<div class="action-name">${actionName[img.action]}</div>
				<div class="predicted-pos">预测位置: (${img.predictedState.hero.x}, ${img.predictedState.hero.y})</div>
				<div class="predicted-reward">预测奖励: ${img.predictedReward.toFixed(1)}</div>
				${img.predictedState.enemies.length < state.enemies.length ? '<div class="bonus">✨ 清除敌人!</div>' : ''}
			`
			grid.appendChild(card)
		}

		container.appendChild(grid)
	}
}
