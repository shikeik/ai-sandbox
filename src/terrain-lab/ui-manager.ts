// ========== UI 管理器 ==========
// 职责：所有 DOM 更新收口，不做任何业务判断

import type { AppState } from "./state.js"
import { ELEMENTS, CURRICULUM_STAGES, ACTIONS } from "./constants.js"

export interface MetricsData {
	loss?: number
	reward?: number
	acc?: number
	validRate?: number
	epsilon?: number
	progress?: number
}

export class UIManager {
	private state: AppState

	constructor(state: AppState) {
		this.state = state
	}

	// ========== 快照滑块 ==========
	updateSnapshotSlider(): void {
		const slider = document.getElementById("snapshot-slider") as HTMLInputElement
		const label = document.getElementById("snapshot-label")!
		slider.max = String(this.state.snapshots.length - 1)
		slider.value = String(this.state.snapshots.length - 1)
		slider.disabled = this.state.snapshots.length <= 1
		this.state.selectedSnapshotIndex = this.state.snapshots.length - 1
		const step = this.state.snapshots[this.state.selectedSnapshotIndex]?.step ?? 0
		label.textContent = `步数 ${step}`
	}

	applySnapshotLabel(step: number, acc?: number, loss?: number): void {
		const label = document.getElementById("snapshot-label")!
		label.textContent = `步数 ${step}`
		document.getElementById("step-count")!.textContent = String(step)
		if (acc !== undefined) {
			document.getElementById("acc-display")!.textContent = acc.toFixed(1) + "%"
		}
		if (loss !== undefined) {
			document.getElementById("loss-display")!.textContent = loss.toFixed(4)
		}
	}

	// ========== 指标更新 ==========
	updateMetrics(params: MetricsData): void {
		const { loss = 0, reward = 0, acc = 0, validRate = 0, epsilon = 0, progress = 0 } = params
		if (acc > 0 || validRate > 0) {
		}

		document.getElementById("step-count")!.textContent = String(this.state.trainSteps)
		document.getElementById("loss-display")!.textContent = loss > 0 ? loss.toFixed(4) : "-"
		document.getElementById("reward-display")!.textContent = reward !== 0 ? reward.toFixed(3) : "-"
		document.getElementById("acc-display")!.textContent = acc > 0 ? acc.toFixed(1) + "%" : "-"
		document.getElementById("valid-display")!.textContent = validRate > 0 ? validRate.toFixed(1) + "%" : "-"
		document.getElementById("epsilon-display")!.textContent = epsilon > 0 ? epsilon.toFixed(2) : "0.00"

		if (progress > 0) {
			;(document.getElementById("train-progress") as HTMLDivElement).style.width = progress + "%"
		}
	}

	updateFinalMetrics(steps: number, acc: number, validRate: number, loss: number): void {
		document.getElementById("step-count")!.textContent = String(steps)
		document.getElementById("acc-display")!.textContent = acc.toFixed(1) + "%"
		document.getElementById("valid-display")!.textContent = validRate.toFixed(1) + "%"
		document.getElementById("loss-display")!.textContent = loss.toFixed(4)
		;(document.getElementById("train-progress") as HTMLDivElement).style.width = "100%"
	}

	// ========== 考试/验证结果 ==========
	updateExam(html: string, cls: "ok" | "bad" | "wait"): void {
		const box = document.getElementById("exam-box") as HTMLDivElement
		box.innerHTML = html
		box.className = "exam-result " + cls
	}

	updateTerrainStatus(cls: "ok" | "bad" | "wait", html: string): void {
		const box = document.getElementById("terrain-status") as HTMLDivElement
		box.innerHTML = html
		if (cls === "ok") {
			box.style.color = "#e8eaed"
			box.style.borderColor = "#34a853"
			box.style.background = "#0d1f12"
		} else if (cls === "bad") {
			box.style.color = "#e8eaed"
			box.style.borderColor = "#ea4335"
			box.style.background = "#1f0d0d"
		} else {
			box.style.color = "#9aa0a6"
			box.style.borderColor = "#2c2f36"
			box.style.background = "#0b0c0f"
		}
	}

	// ========== 概率条 ==========
	updateProbs(probs: number[]): void {
		const rows = document.querySelectorAll(".prob-row")
		for (let i = 0; i < 4; i++) {
			const p = probs[i] * 100
			rows[i].querySelector(".prob-fill")!.setAttribute("style", `width:${p}%`)
			rows[i].querySelector(".prob-val")!.textContent = p.toFixed(1) + "%"
		}
	}

	resetProbs(): void {
		this.updateProbs([0, 0, 0, 0])
	}

	// ========== 观察样本状态 ==========
	updateObsessionStatus(text: string, cls: "ok" | "bad" | "wait"): void {
		const box = document.getElementById("obsession-status")!
		box.textContent = text
		box.style.color = cls === "ok" ? "#34a853" : cls === "bad" ? "#ea4335" : "#9aa0a6"
	}

	// ========== 笔刷渲染 ==========
	renderBrushes(selectedBrush: number, onSelect: (id: number) => void): void {
		const list = document.getElementById("brush-list") as HTMLDivElement
		list.innerHTML = ""
		const allowed = this.getAllowedElementsForBrush()
		ELEMENTS.forEach((el) => {
			if (!allowed.includes(el.id)) return
			const item = document.createElement("div")
			item.className = "brush-item" + (el.id === selectedBrush ? " active" : "")
			item.innerHTML = `<div class="brush-emoji">${el.emoji}</div><div class="brush-name">${el.name}</div>`
			item.onclick = () => onSelect(el.id)
			list.appendChild(item)
		})
	}

	private getAllowedElementsForBrush(): number[] {
		const cfg = this.state.terrainConfig
		const allowed: number[] = [0, 1, 2] // ELEM_AIR, ELEM_HERO, ELEM_GROUND
		if (cfg.slime) allowed.push(3) // ELEM_SLIME
		if (cfg.demon) allowed.push(4) // ELEM_DEMON
		if (cfg.coin) allowed.push(5) // ELEM_COIN
		return allowed
	}

	// ========== 地形配置渲染 ==========
	renderTerrainConfig(
		currentStageIdx: number,
		onStageSelect: (idx: number) => void,
		onConfigChange: () => void
	): void {
		const stageTabs = document.getElementById("stage-tabs")!
		const swGroundOnly = document.getElementById("sw-ground-only") as HTMLInputElement
		const swSlime = document.getElementById("sw-slime") as HTMLInputElement
		const swDemon = document.getElementById("sw-demon") as HTMLInputElement
		const swCoin = document.getElementById("sw-coin") as HTMLInputElement

		const cfg = this.state.terrainConfig

		stageTabs.innerHTML = ""
		for (let i = 0; i < CURRICULUM_STAGES.length; i++) {
			const btn = document.createElement("div")
			btn.className = "stage-tab" + (i === currentStageIdx ? " active" : "")
			btn.textContent = CURRICULUM_STAGES[i].name
			btn.onclick = () => onStageSelect(i)
			stageTabs.appendChild(btn)
		}

		swGroundOnly.checked = cfg.groundOnly
		swSlime.checked = cfg.slime
		swDemon.checked = cfg.demon
		swCoin.checked = cfg.coin

		// 绑定配置变化事件（只需绑定一次，这里简化处理）
		swGroundOnly.onchange = onConfigChange
		swSlime.onchange = onConfigChange
		swDemon.onchange = onConfigChange
		swCoin.onchange = onConfigChange
	}

	// ========== 学习模式 UI ==========
	updateModeUI(learningMode: "supervised" | "unsupervised"): void {
		const btn = document.getElementById("btn-mode") as HTMLButtonElement
		const label = document.getElementById("mode-label")!
		const metricValid = document.getElementById("metric-valid")!

		if (learningMode === "supervised") {
			btn.textContent = "切换"
			btn.className = "btn-primary"
			label.textContent = "监督学习（有标签）"
			label.style.color = "#8ab4f8"
		} else {
			btn.textContent = "切换"
			btn.className = "btn-accent"
			label.textContent = "无监督学习（自探索）"
			label.style.color = "#f9ab00"
		}
		metricValid.style.display = "block"
	}

	// ========== 课程学习 UI ==========
	updateCurriculumUI(
		stageIdx: number,
		isRunning: boolean,
		learningMode: "supervised" | "unsupervised"
	): void {
		const status = document.getElementById("curriculum-status")!
		const btnCurriculum = document.getElementById("btn-curriculum") as HTMLButtonElement
		const btnNext = document.getElementById("btn-next-stage") as HTMLButtonElement
		const modeText = learningMode === "supervised" ? "监督" : "无监督"

		if (isRunning) {
			status.textContent = `当前阶段：${CURRICULUM_STAGES[stageIdx].name}（${modeText}训练中…）`
			btnCurriculum.disabled = true
			btnNext.disabled = true
			return
		}

		const stageName = CURRICULUM_STAGES[stageIdx]?.name ?? "已完成全部阶段"
		status.textContent = `当前阶段：${stageName} | ${modeText}学习`
		btnCurriculum.disabled = false
		btnNext.disabled = stageIdx >= CURRICULUM_STAGES.length - 1
	}

	// ========== 数据计数 ==========
	updateDataCount(count: number): void {
		document.getElementById("data-count")!.textContent = String(count)
	}

	// ========== 网络重置 UI ==========
	resetNetworkUI(): void {
		document.getElementById("data-count")!.textContent = "0"
		document.getElementById("step-count")!.textContent = "0"
		document.getElementById("loss-display")!.textContent = "-"
		document.getElementById("reward-display")!.textContent = "-"
		document.getElementById("acc-display")!.textContent = "-"
		document.getElementById("valid-display")!.textContent = "-"
		document.getElementById("epsilon-display")!.textContent = "-"
		;(document.getElementById("train-progress") as HTMLDivElement).style.width = "0%"
		;(document.getElementById("btn-train") as HTMLButtonElement).disabled = true
	}

	// ========== 训练按钮状态 ==========
	setTrainButtonDisabled(disabled: boolean): void {
		const btn200 = document.getElementById("btn-train") as HTMLButtonElement
		const btn1000 = document.getElementById("btn-train-1000") as HTMLButtonElement
		if (btn200) btn200.disabled = disabled
		if (btn1000) btn1000.disabled = disabled
	}

	// ========== 配置变化处理 ==========
	getConfigFromUI(): { groundOnly: boolean; slime: boolean; demon: boolean; coin: boolean } {
		const swGroundOnly = document.getElementById("sw-ground-only") as HTMLInputElement
		const swSlime = document.getElementById("sw-slime") as HTMLInputElement
		const swDemon = document.getElementById("sw-demon") as HTMLInputElement
		const swCoin = document.getElementById("sw-coin") as HTMLInputElement

		return {
			groundOnly: swGroundOnly.checked,
			slime: swSlime.checked,
			demon: swDemon.checked,
			coin: swCoin.checked,
		}
	}
}
