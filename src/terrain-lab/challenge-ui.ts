// ========== 连续挑战 UI 管理 ==========
// 职责：管理连续挑战界面的DOM操作和渲染

import type { ChallengeState, ChallengeResult } from "./challenge-controller.js"
import { ACTIONS, NUM_LAYERS } from "./constants.js"
import { forward } from "./neural-network.js"
import { terrainToIndices } from "./terrain.js"
import type { AppState } from "./state.js"
import { drawMLP, setupCanvas, getEditorLayout, drawTerrainGrid, drawEditorLabels, drawEmoji } from "./renderer.js"

// ========== UI 管理器 ==========

export class ChallengeUIManager {
	private state: AppState
	private challengeCanvas: HTMLCanvasElement
	private mlpCanvas: HTMLCanvasElement
	private resizeObserver: ResizeObserver | null = null

	constructor(state: AppState) {
		this.state = state
		this.challengeCanvas = document.getElementById("challenge-canvas") as HTMLCanvasElement
		this.mlpCanvas = document.getElementById("challenge-mlp-canvas") as HTMLCanvasElement
	}

	// ========== 初始化 ==========

	init(onResize: () => void): void {
		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const target = entry.target as HTMLCanvasElement
				if (target === this.challengeCanvas || target === this.mlpCanvas) {
					onResize()
				}
			}
		})
		this.resizeObserver.observe(this.challengeCanvas)
		this.resizeObserver.observe(this.mlpCanvas)
	}

	destroy(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		}
	}

	// ========== 统计面板更新 ==========

	updateStats(challengeState: ChallengeState): void {
		this.setText("challenge-step", String(challengeState.currentStep))
		this.setText("challenge-streak", String(challengeState.streakCount))
		this.setText("challenge-total", String(challengeState.totalSteps))

		const rate = challengeState.totalSteps === 0
			? "0%"
			: Math.round((challengeState.passedSteps / challengeState.totalSteps) * 100) + "%"
		this.setText("challenge-rate", rate)

		// 更新位置显示
		this.setText("challenge-position", `${challengeState.heroCol}/31`)
	}

	// ========== 控制按钮状态 ==========

	updateControls(isRunning: boolean, isPaused: boolean, isStepMode: boolean = false): void {
		const startBtn = document.getElementById("btn-challenge-start") as HTMLButtonElement
		const pauseBtn = document.getElementById("btn-challenge-pause") as HTMLButtonElement
		const stepBtn = document.getElementById("btn-challenge-step") as HTMLButtonElement

		if (startBtn) {
			if (isRunning && isPaused) {
				startBtn.textContent = "继续"
			} else {
				startBtn.textContent = "开始挑战"
			}
			startBtn.disabled = isRunning && !isPaused
		}

		if (pauseBtn) {
			if (isRunning && !isPaused) {
				pauseBtn.textContent = "暂停"
				pauseBtn.disabled = false
			} else if (isRunning && isPaused) {
				pauseBtn.textContent = "暂停中"
				pauseBtn.disabled = true
			} else {
				pauseBtn.textContent = "暂停"
				pauseBtn.disabled = true
			}
		}

		if (stepBtn) {
			stepBtn.disabled = isRunning && !isPaused && !isStepMode
		}
	}

	// ========== 结果展示 ==========

	updateResult(result: ChallengeResult | null, gameOver: boolean = false, gameWon: boolean = false): void {
		const resultEl = document.getElementById("challenge-result")
		if (!resultEl) return

		if (!result && !gameOver) {
			resultEl.className = "challenge-result waiting"
			resultEl.innerHTML = "点击「开始挑战」开始跑酷闯关<br><small>目标：从起点(0)到达终点(31)</small>"
			return
		}

		if (gameOver) {
			if (gameWon) {
				resultEl.className = "challenge-result success"
				resultEl.innerHTML = `
					🎉 <b>挑战成功！</b><br>
					狐狸成功到达终点！<br>
					<small>共 ${result?.step ?? 0} 步</small>
				`
			} else {
				const conf = result ? (result.probabilities[result.predictedAction] * 100).toFixed(1) : "0"
				resultEl.className = "challenge-result fail"
				resultEl.innerHTML = `
					💥 <b>挑战失败</b><br>
					${result ? `AI选择了<b>${result.predictedActionName}</b> (置信度 ${conf}%)` : "游戏结束"}<br>
					<small>位置：第 ${result?.heroCol ?? 0} 列</small>
				`
			}
			return
		}

		if (!result) return

		const conf = (result.probabilities[result.predictedAction] * 100).toFixed(1)

		if (result.isValid) {
			resultEl.className = "challenge-result success"
			resultEl.innerHTML = `
				<b>第${result.step}步</b> - <span style="color:#34a853">✅ 合法</span><br>
				位置：第 ${result.heroCol} 列 → ${result.heroCol + (result.predictedAction === 0 || result.predictedAction === 3 ? 1 : result.predictedAction === 1 ? 2 : 3)} 列<br>
				AI预测：<b>${result.predictedActionName}</b> (置信度 ${conf}%)
			`
		} else {
			resultEl.className = "challenge-result fail"
			resultEl.innerHTML = `
				<b>第${result.step}步</b> - <span style="color:#ea4335">❌ 非法</span><br>
				位置：第 ${result.heroCol} 列<br>
				AI预测：<b>${result.predictedActionName}</b> (置信度 ${conf}%)<br>
				<small>此动作在当前视野不可行</small>
			`
		}
	}

	// ========== 游戏结束显示 ==========

	showGameOver(won: boolean, finalCol: number): void {
		const resultEl = document.getElementById("challenge-result")
		if (!resultEl) return

		if (won) {
			resultEl.className = "challenge-result success"
			resultEl.innerHTML = `
				🎉 <b>挑战成功！</b><br>
				狐狸成功到达终点！<br>
				<small>最终位置：第 ${finalCol} 列</small>
			`
		} else {
			resultEl.className = "challenge-result fail"
			resultEl.innerHTML = `
				💥 <b>挑战失败</b><br>
				狐狸在第 ${finalCol} 列停下脚步<br>
				<small>可能是选择了非法动作或掉进了坑</small>
			`
		}
	}

	// ========== 历史记录 ==========

	updateHistory(history: ChallengeResult[]): void {
		const historyEl = document.getElementById("challenge-history")
		if (!historyEl) return

		if (history.length === 0) {
			historyEl.innerHTML = "<div class='empty-history'>暂无挑战记录</div>"
			return
		}

		historyEl.innerHTML = history.map(item => {
			const statusClass = item.isValid ? "success" : "fail"
			const statusText = item.isValid ? "成功" : "失败"
			const conf = (item.probabilities[item.predictedAction] * 100).toFixed(0)

			return `
				<div class="history-item">
					<div class="history-level ${statusClass}">${item.step}</div>
					<div class="history-info">
						<div>位置：${item.heroCol} → ${item.heroCol + (item.predictedAction === 0 || item.predictedAction === 3 ? 1 : item.predictedAction === 1 ? 2 : 3)}</div>
						<div>预测：<span class="history-action">${item.predictedActionName}</span> (${conf}%)</div>
					</div>
					<div class="history-status ${statusClass}">${statusText}</div>
				</div>
			`
		}).join("")
	}

	// ========== 概率条 ==========

	updateProbs(probs: number[]): void {
		const container = document.getElementById("challenge-prob-bars")
		if (!container) return

		const maxIdx = probs.indexOf(Math.max(...probs))

		container.innerHTML = ACTIONS.map((name, i) => {
			const pct = (probs[i] * 100).toFixed(1)
			const isMax = i === maxIdx
			const fillColor = isMax ? "#8ab4f8" : "#5f6368"
			return `
				<div class="prob-row">
					<div class="prob-name">${name}</div>
					<div class="prob-track"><div class="prob-fill" style="width:${pct}%;background:${fillColor}"></div></div>
					<div class="prob-val" style="color:${fillColor}">${pct}%</div>
				</div>
			`
		}).join("")
	}

	resetProbs(): void {
		const container = document.getElementById("challenge-prob-bars")
		if (!container) return

		container.innerHTML = ACTIONS.map(name => `
			<div class="prob-row">
				<div class="prob-name">${name}</div>
				<div class="prob-track"><div class="prob-fill" style="width:0%"></div></div>
				<div class="prob-val">0%</div>
			</div>
		`).join("")
	}

	// ========== Canvas 绘制 ==========

	/**
	 * 绘制当前视野地形（5×3窗口）
	 */
	drawTerrain(terrain: number[][] | null, heroCol: number = 0, fullMapLength: number = 32): void {
		if (!terrain) {
			const { ctx, width, height } = setupCanvas(this.challengeCanvas)
			ctx.fillStyle = "#5f6368"
			ctx.font = "14px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText("等待挑战开始...", width / 2, height / 2)
			return
		}

		const { ctx, rect } = setupCanvas(this.challengeCanvas)
		const { cellW, cellH, gapX, gapY, startX, startY } = getEditorLayout(rect)

		// 绘制标签
		drawEditorLabels(ctx, startX, startY, cellW, cellH, gapX, gapY)

		// 计算绘制区域高度
		const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
		const bottomY = startY + gridH + 16

		// 绘制坐标信息（左下角，避免和上方文字重叠）
		ctx.fillStyle = "#8ab4f8"
		ctx.font = "11px sans-serif"
		ctx.textAlign = "left"
		ctx.fillText(`位置: ${heroCol}-${Math.min(heroCol + 4, fullMapLength - 1)} / 0-31`, startX, bottomY)

		// 绘制视野窗口
		drawTerrainGrid(ctx, terrain, {
			cellW, cellH, gapX, gapY, startX, startY,
			hideSlimeAt: null,
			dimNonInteractive: false,
		})

		// 绘制终点标记（如果在视野内）
		const endCol = 31
		if (endCol >= heroCol && endCol <= heroCol + 4) {
			const viewportCol = endCol - heroCol
			const x = startX + viewportCol * (cellW + gapX)
			const y = startY - cellH - 5
			ctx.fillStyle = "#f9ab00"
			ctx.font = "10px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText("🏁终点", x + cellW / 2, y)
		}
	}

	/**
	 * 绘制MLP网络图
	 */
	drawMLP(terrain: number[][] | null): void {
		if (!terrain) {
			const { ctx, width, height } = setupCanvas(this.mlpCanvas)
			ctx.fillStyle = "#5f6368"
			ctx.font = "12px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText("等待挑战开始...", width / 2, height / 2)
			return
		}

		const indices = terrainToIndices(terrain)
		const fp = forward(this.state.net, indices)
		drawMLP(this.mlpCanvas, this.state, fp)
	}

	// ========== 辅助方法 ==========

	private setText(id: string, text: string): void {
		const el = document.getElementById(id)
		if (el) el.textContent = text
	}
}
