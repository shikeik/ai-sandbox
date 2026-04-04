// ========== 连续挑战 UI 管理 ==========
// 职责：管理连续挑战界面的DOM操作和渲染

import type { ChallengeState, ChallengeResult } from "./challenge-controller.js"
// ForwardResult 由 terrain 计算得出，无需直接导入
import { ACTIONS } from "./constants.js"
import { forward } from "./neural-network.js"
import { terrainToIndices } from "./terrain.js"
import type { AppState } from "./state.js"
import { drawMLP, setupCanvas, getEditorLayout, drawTerrainGrid, drawEditorLabels } from "./renderer.js"

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
		this.setText("challenge-level", String(challengeState.currentLevel))
		this.setText("challenge-streak", String(challengeState.streakCount))
		this.setText("challenge-total", String(challengeState.totalCount))

		const rate = challengeState.totalCount === 0
			? "0%"
			: Math.round((challengeState.passedCount / challengeState.totalCount) * 100) + "%"
		this.setText("challenge-rate", rate)
	}

	// ========== 控制按钮状态 ==========

	updateControls(isRunning: boolean, isPaused: boolean): void {
		const startBtn = document.getElementById("btn-challenge-start") as HTMLButtonElement
		const pauseBtn = document.getElementById("btn-challenge-pause") as HTMLButtonElement

		if (startBtn) {
			startBtn.textContent = isRunning && isPaused ? "继续" : "开始挑战"
			startBtn.disabled = isRunning && !isPaused
		}

		if (pauseBtn) {
			pauseBtn.disabled = !isRunning || isPaused
		}
	}

	// ========== 结果展示 ==========

	updateResult(result: ChallengeResult | null): void {
		const resultEl = document.getElementById("challenge-result")
		if (!resultEl) return

		if (!result) {
			resultEl.className = "challenge-result waiting"
			resultEl.innerHTML = "点击「开始挑战」开始连续闯关"
			return
		}

		const conf = (result.probabilities[result.predictedAction] * 100).toFixed(1)

		if (result.isOptimal) {
			resultEl.className = "challenge-result success"
			resultEl.innerHTML = `
				<b>第${result.level}关</b> - <span style="color:#34a853">✅ 最优</span><br>
				AI预测：<b>${result.predictedActionName}</b> (置信度 ${conf}%)<br>
				正确答案：<b>${result.correctActionName}</b>
			`
		} else if (result.isValid) {
			resultEl.className = "challenge-result success"
			resultEl.innerHTML = `
				<b>第${result.level}关</b> - <span style="color:#f9ab00">✅ 合法（非最优）</span><br>
				AI预测：<b>${result.predictedActionName}</b> (置信度 ${conf}%)<br>
				正确答案：<b>${result.correctActionName}</b>
			`
		} else {
			resultEl.className = "challenge-result fail"
			resultEl.innerHTML = `
				<b>第${result.level}关</b> - <span style="color:#ea4335">❌ 失败</span><br>
				AI预测：<b>${result.predictedActionName}</b> (置信度 ${conf}%)<br>
				正确答案：<b>${result.correctActionName}</b>
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
			const statusText = item.isOptimal ? "最优" : (item.isValid ? "合法" : "失败")
			const conf = (item.probabilities[item.predictedAction] * 100).toFixed(0)

			return `
				<div class="history-item">
					<div class="history-level ${statusClass}">${item.level}</div>
					<div class="history-info">
						<div>预测：<span class="history-action">${item.predictedActionName}</span> (${conf}%)</div>
						<div style="color:#9aa0a6;font-size:10px;">答案：${item.correctActionName}</div>
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
	 * 绘制当前关卡地形
	 */
	drawTerrain(terrain: number[][] | null): void {
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

		drawEditorLabels(ctx, startX, startY, cellW, cellH, gapX, gapY)
		drawTerrainGrid(ctx, terrain, {
			cellW, cellH, gapX, gapY, startX, startY,
			hideSlimeAt: null,
			dimNonInteractive: false,
		})
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
