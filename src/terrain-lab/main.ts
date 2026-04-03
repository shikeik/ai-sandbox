import type { ForwardResult, ActionType } from "./types.js"
import type { AppState } from "./state.js"
import {
	NUM_COLS, NUM_LAYERS, NUM_ELEMENTS, HIDDEN_DIM, OUTPUT_DIM,
	INPUT_DIM, ACTIONS, ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN,
	CURRICULUM_STAGES
} from "./constants.js"
import { zeroMat, zeroVec, easeOutQuad } from "./utils.js"
import { forward, backward, updateNetwork, cloneNet } from "./neural-network.js"
import {
	terrainToIndices, findHeroCol, getActionChecks, getLabel,
	isActionValidByChecks, generateTerrainData, generateRandomTerrain
} from "./terrain.js"
import { drawTerrainGrid, drawEmoji, getEditorCellAt } from "./renderer.js"
import { calculateAnimationPath } from "./animation.js"
import { createInitialState, resetState, setTerrainCell, stopAnimation } from "./state.js"

import { Logger } from "../engine/utils/Logger.js"
import { ConsolePanel } from "../engine/console/ConsolePanel.js"

// ========== 全局状态 ==========
const state: AppState = createInitialState()

// DOM 元素
let editorCanvas: HTMLCanvasElement
let mlpCanvas: HTMLCanvasElement
let embeddingCanvas: HTMLCanvasElement
let obsessionCanvas: HTMLCanvasElement

// UI 元素定义（多处复用）
const UI_ELEMENTS = [
	{ id: ELEM_AIR, name: "空气", emoji: "⬛" },
	{ id: ELEM_HERO, name: "狐狸", emoji: "🦊" },
	{ id: ELEM_GROUND, name: "平地", emoji: "🟩" },
	{ id: ELEM_SLIME, name: "史莱姆", emoji: "🦠" },
	{ id: ELEM_DEMON, name: "恶魔", emoji: "👿" },
	{ id: ELEM_COIN, name: "金币", emoji: "🪙" },
]

// 编辑器布局计算（抽离重复逻辑）
function getEditorLayout(rect: { width: number; height: number }) {
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

function drawEditorLabels(
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

// ========== 训练相关 ==========

async function trainBatch() {
	const btn = document.getElementById("btn-train") as HTMLButtonElement
	btn.disabled = true
	const batchSize = 32
	const steps = 100

	// 若快照为空，先保存初始状态（全局累积，不清空旧快照）
	if (state.snapshots.length === 0) {
		state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
		recordSnapshotStats(0)
		state.selectedSnapshotIndex = 0
	}

	for (let s = 0; s < steps; s++) {
		const gEmbed = zeroMat(NUM_ELEMENTS, 2)
		const gW1 = zeroMat(HIDDEN_DIM, INPUT_DIM)
		const gb1 = zeroVec(HIDDEN_DIM)
		const gW2 = zeroMat(OUTPUT_DIM, HIDDEN_DIM)
		const gb2 = zeroVec(OUTPUT_DIM)

		let lossSum = 0
		let correct = 0

		for (let b = 0; b < batchSize; b++) {
			const idx = Math.floor(Math.random() * state.dataset.length)
			const sample = state.dataset[idx]
			const fp = forward(state.net, sample.indices)
			const grad = backward(state.net, fp, sample.y)

			for (let e = 0; e < NUM_ELEMENTS; e++) {
				for (let d = 0; d < 2; d++) gEmbed[e][d] += grad.dEmbed[e][d] / batchSize
			}
			for (let i = 0; i < HIDDEN_DIM; i++) {
				for (let j = 0; j < INPUT_DIM; j++) gW1[i][j] += grad.dW1[i][j] / batchSize
				gb1[i] += grad.db1[i] / batchSize
			}
			for (let i = 0; i < OUTPUT_DIM; i++) {
				for (let j = 0; j < HIDDEN_DIM; j++) gW2[i][j] += grad.dW2[i][j] / batchSize
				gb2[i] += grad.db2[i] / batchSize
			}

			lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
			if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) correct++
		}

		updateNetwork(state.net, { dEmbed: gEmbed, dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, 1)

		state.trainSteps++
		if (s % 20 === 0 || s === steps - 1) {
			updateMetrics(lossSum / batchSize, (correct / batchSize) * 100, ((s + 1) / steps) * 100)
			// 保存快照
			state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
			recordSnapshotStats(state.snapshots.length - 1)
			await new Promise(r => setTimeout(r, 1))
		}
	}

	updateSnapshotSlider()
	evaluateAll()
	predict()
	drawObsessionCurve()
	btn.disabled = false
}

function recordSnapshotStats(snapshotIndex: number) {
	if (snapshotIndex < 0 || snapshotIndex >= state.snapshots.length) return
	const snap = state.snapshots[snapshotIndex]

	// 执念曲线概率
	if (state.observedSample) {
		const fp = forward(snap.net, state.observedSample.indices)
		snap.observedProbs = fp.o.slice()
	}

	// 准确率与损失
	if (state.dataset.length > 0) {
		let correct = 0
		let lossSum = 0
		for (const sample of state.dataset) {
			const fp = forward(snap.net, sample.indices)
			if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) correct++
			lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
		}
		snap.acc = (correct / state.dataset.length) * 100
		snap.loss = lossSum / state.dataset.length
	}
}

function updateSnapshotSlider() {
	const slider = document.getElementById("snapshot-slider") as HTMLInputElement
	const label = document.getElementById("snapshot-label")!
	slider.max = String(state.snapshots.length - 1)
	slider.value = String(state.snapshots.length - 1)
	slider.disabled = state.snapshots.length <= 1
	state.selectedSnapshotIndex = state.snapshots.length - 1
	const step = state.snapshots[state.selectedSnapshotIndex]?.step ?? 0
	label.textContent = `步数 ${step}`
}

function applySnapshot(index: number) {
	if (index < 0 || index >= state.snapshots.length) return
	state.selectedSnapshotIndex = index
	state.net = cloneNet(state.snapshots[index].net)
	const snap = state.snapshots[index]
	const label = document.getElementById("snapshot-label")!
	label.textContent = `步数 ${snap.step}`
	document.getElementById("step-count")!.textContent = String(snap.step)
	if (snap.acc !== undefined) {
		document.getElementById("acc-display")!.textContent = snap.acc.toFixed(1) + "%"
	}
	if (snap.loss !== undefined) {
		document.getElementById("loss-display")!.textContent = snap.loss.toFixed(4)
	}
	predict()
	drawObsessionCurve()
}

function updateMetrics(loss: number, acc?: number, progress?: number) {
	document.getElementById("step-count")!.textContent = String(state.trainSteps)
	if (loss !== undefined && loss !== 0) {
		document.getElementById("loss-display")!.textContent = loss.toFixed(4)
	}
	if (acc !== undefined) {
		document.getElementById("acc-display")!.textContent = acc.toFixed(0) + "%"
	}
	if (progress !== undefined) {
		;(document.getElementById("train-progress") as HTMLDivElement).style.width = progress + "%"
	}
}

function evaluateAll() {
	let correct = 0
	let lossSum = 0
	for (const sample of state.dataset) {
		const fp = forward(state.net, sample.indices)
		if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) correct++
		lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
	}
	document.getElementById("step-count")!.textContent = String(state.trainSteps)
	document.getElementById("acc-display")!.textContent = ((correct / state.dataset.length) * 100).toFixed(1) + "%"
	document.getElementById("loss-display")!.textContent = (lossSum / state.dataset.length).toFixed(4)
	;(document.getElementById("train-progress") as HTMLDivElement).style.width = "100%"
}

// ========== 数据生成 ==========

function generateData() {
	state.dataset = generateTerrainData(6000, state.terrainConfig)
	updateMetrics(0)
	document.getElementById("data-count")!.textContent = String(state.dataset.length)
	const btn = document.getElementById("btn-train") as HTMLButtonElement
	btn.disabled = state.dataset.length === 0
	updateExam(`已生成 ${state.dataset.length} 条合法训练数据`, "wait")
	// 默认随机选一个观察样本
	if (state.dataset.length > 0 && !state.observedSample) {
		setObservedRandom()
	}
}

// ========== 观察样本设置 ==========

function setObservedFromTerrain() {
	const indices = terrainToIndices(state.terrain)
	const label = getLabel(state.terrain)
	if (label === -1) {
		updateObsessionStatus("当前地形为死局，无法设为观察样本", "bad")
		return
	}
	state.observedSample = { t: state.terrain.map(row => row.slice()), indices, y: label }
	updateObsessionStatus(`观察样本：当前地形 | 规则答案：${ACTIONS[label]}`, "ok")
	// 若有快照，重新计算所有快照对该样本的概率
	for (let i = 0; i < state.snapshots.length; i++) {
		recordSnapshotStats(i)
	}
	drawObsessionCurve()
}

function setObservedRandom() {
	if (state.dataset.length === 0) {
		updateObsessionStatus("数据集为空，无法抽取样本", "bad")
		return
	}
	const sample = state.dataset[Math.floor(Math.random() * state.dataset.length)]
	state.observedSample = sample
	updateObsessionStatus(`观察样本：数据集第 ${state.dataset.indexOf(sample) + 1} 条 | 规则答案：${ACTIONS[sample.y]}`, "ok")
	for (let i = 0; i < state.snapshots.length; i++) {
		recordSnapshotStats(i)
	}
	drawObsessionCurve()
}

function updateObsessionStatus(text: string, cls: "ok" | "bad" | "wait") {
	const box = document.getElementById("obsession-status")!
	box.textContent = text
	box.style.color = cls === "ok" ? "#34a853" : cls === "bad" ? "#ea4335" : "#9aa0a6"
}

// ========== 预测与验证 ==========

function predict() {
	const indices = terrainToIndices(state.terrain)
	const fp = forward(state.net, indices)
	state.lastForwardResult = fp
	const pred = fp.o.indexOf(Math.max(...fp.o))
	const heroCol = findHeroCol(state.terrain)
	const checks = getActionChecks(state.terrain, heroCol)
	const correct = getLabel(state.terrain)

	const conf = (fp.o[pred] * 100).toFixed(1)

	if (correct === -1) {
		updateTerrainStatus(
			"bad",
			`AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)<br>规则答案: <b style="color:#f9ab00">此地形无解（死局）</b>`
		)
		drawMLP(fp)
		drawEmbedding()
		updateProbs(fp.o)
		stopAnimation(state)
		return
	}

	// 统一使用与合法性检查同一数据源的判定函数
	const isValid = isActionValidByChecks(checks, pred)
	const lines: string[] = []
	lines.push(`AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)`)
	lines.push(`规则答案: <b>${ACTIONS[correct]}</b>`)

	if (isValid) {
		if (pred === correct) {
			lines.push("<span style='color:#34a853'>✅ 最优</span>")
			updateTerrainStatus("ok", lines.join("<br>"))
		} else {
			lines.push("<span style='color:#f9ab00'>✅ 合法（但非最优）</span>")
			updateTerrainStatus("ok", lines.join("<br>"))
		}
	} else {
		lines.push("<span style='color:#ea4335'>❌ 非法</span>")
		updateTerrainStatus("bad", lines.join("<br>"))
	}

	drawMLP(fp)
	drawEmbedding()
	updateProbs(fp.o)
	playAnimation(ACTIONS[pred])
}

function validateTerrain() {
	const heroCol = findHeroCol(state.terrain)
	const checks = getActionChecks(state.terrain, heroCol)
	const walk = checks.canWalk
	const jump = checks.canJump
	const longJump = checks.canLongJump
	const wa = checks.canWalkAttack

	// 统计可行动作数
	const validActions: string[] = []
	if (walk.ok) validActions.push("走")
	if (jump.ok) validActions.push("跳")
	if (longJump.ok) validActions.push("远跳")
	if (wa.ok) validActions.push("走A")

	// 构建详细报告
	const lines: string[] = []
	lines.push(`<b>狐狸位置：x${heroCol}</b>`)
	lines.push("")

	if (validActions.length > 0) {
		lines.push(`✅ 可行动作：${validActions.join("、")}`)
	} else {
		lines.push("❌ 无可用动作（死局）")
	}

	// 显示各动作详情
	const actionDetails: string[] = []

	// 走
	if (walk.ok) {
		actionDetails.push(`✅ 走 → x${heroCol + 1}`)
	} else {
		actionDetails.push(`❌ 走：${walk.reasons[0] || "无法前行"}`)
	}

	// 跳
	if (jump.ok) {
		actionDetails.push(`✅ 跳 → x${heroCol + 2}`)
	} else {
		const jumpTarget = heroCol + 2
		if (jumpTarget >= NUM_COLS) {
			actionDetails.push("❌ 跳：超出地图边界")
		} else {
			actionDetails.push(`❌ 跳：${jump.reasons[0] || "无法跳跃"}`)
		}
	}

	// 远跳
	if (longJump.ok) {
		actionDetails.push(`✅ 远跳 → x${heroCol + 3}`)
	} else {
		const longJumpTarget = heroCol + 3
		if (longJumpTarget >= NUM_COLS) {
			actionDetails.push("❌ 远跳：超出地图边界")
		} else {
			actionDetails.push(`❌ 远跳：${longJump.reasons[0] || "无法远跳"}`)
		}
	}

	// 走A
	if (wa.ok) {
		const hasSlime = state.terrain[1][heroCol + 1] === ELEM_SLIME
		actionDetails.push(`✅ 走A → x${heroCol + 1}${hasSlime ? "（击杀史莱姆）" : ""}`)
	} else {
		const walkATarget = heroCol + 1
		if (walkATarget >= NUM_COLS) {
			actionDetails.push("❌ 走A：超出地图边界")
		} else {
			actionDetails.push(`❌ 走A：${wa.reasons[0] || "无法攻击"}`)
		}
	}

	lines.push("")
	lines.push(actionDetails.join("<br>"))

	updateTerrainStatus(validActions.length > 0 ? "ok" : "bad", lines.join("<br>"))
}

// ========== UI 辅助 ==========

function updateExam(html: string, cls: "ok" | "bad" | "wait") {
	const box = document.getElementById("exam-box") as HTMLDivElement
	box.innerHTML = html
	box.className = "exam-result " + cls
}

function updateTerrainStatus(cls: "ok" | "bad" | "wait", html: string) {
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

function updateProbs(probs: number[]) {
	const rows = document.querySelectorAll(".prob-row")
	for (let i = 0; i < 4; i++) {
		const p = probs[i] * 100
		rows[i].querySelector(".prob-fill")!.setAttribute("style", `width:${p}%`)
		rows[i].querySelector(".prob-val")!.textContent = p.toFixed(1) + "%"
	}
}

// ========== 渲染器 ==========

function getAllowedElementsForBrush(): number[] {
	const cfg = state.terrainConfig
	const allowed = [ELEM_AIR, ELEM_HERO, ELEM_GROUND]
	if (cfg.slime) allowed.push(ELEM_SLIME)
	if (cfg.demon) allowed.push(ELEM_DEMON)
	if (cfg.coin) allowed.push(ELEM_COIN)
	return allowed
}

function renderBrushes() {
	const list = document.getElementById("brush-list") as HTMLDivElement
	list.innerHTML = ""
	const allowed = getAllowedElementsForBrush()
	UI_ELEMENTS.forEach((el) => {
		if (!allowed.includes(el.id)) return
		const item = document.createElement("div")
		item.className = "brush-item" + (el.id === state.selectedBrush ? " active" : "")
		item.innerHTML = `<div class="brush-emoji">${el.emoji}</div><div class="brush-name">${el.name}</div>`
		item.onclick = () => {
			state.selectedBrush = el.id
			renderBrushes()
			updateTerrainStatus("wait", "已选择 " + el.name + "，点击上方格子绘制")
		}
		list.appendChild(item)
	})
}

function renderTerrainConfig() {
	const stageTabs = document.getElementById("stage-tabs")!
	const swGroundOnly = document.getElementById("sw-ground-only") as HTMLInputElement
	const swSlime = document.getElementById("sw-slime") as HTMLInputElement
	const swDemon = document.getElementById("sw-demon") as HTMLInputElement
	const swCoin = document.getElementById("sw-coin") as HTMLInputElement

	const cfg = state.terrainConfig
	let matchedStage = -1
	for (let i = 0; i < CURRICULUM_STAGES.length; i++) {
		const s = CURRICULUM_STAGES[i].config
		if (
			cfg.groundOnly === s.groundOnly &&
			cfg.slime === s.slime &&
			cfg.demon === s.demon &&
			cfg.coin === s.coin
		) {
			matchedStage = i
			break
		}
	}

	stageTabs.innerHTML = ""
	for (let i = 0; i < CURRICULUM_STAGES.length; i++) {
		const btn = document.createElement("div")
		btn.className = "stage-tab" + (i === matchedStage ? " active" : "")
		btn.textContent = CURRICULUM_STAGES[i].name
		btn.onclick = () => {
			state.terrainConfig = { ...CURRICULUM_STAGES[i].config }
			renderTerrainConfig()
			renderBrushes()
			updateTerrainStatus("wait", `已切换到「${CURRICULUM_STAGES[i].name}」，随机地形和生成数据将使用该配置`)
		}
		stageTabs.appendChild(btn)
	}

	swGroundOnly.checked = cfg.groundOnly
	swSlime.checked = cfg.slime
	swDemon.checked = cfg.demon
	swCoin.checked = cfg.coin
}

function onConfigChange() {
	const swGroundOnly = document.getElementById("sw-ground-only") as HTMLInputElement
	const swSlime = document.getElementById("sw-slime") as HTMLInputElement
	const swDemon = document.getElementById("sw-demon") as HTMLInputElement
	const swCoin = document.getElementById("sw-coin") as HTMLInputElement

	state.terrainConfig = {
		groundOnly: swGroundOnly.checked,
		slime: swSlime.checked,
		demon: swDemon.checked,
		coin: swCoin.checked,
	}
	renderTerrainConfig()
	renderBrushes()
	updateTerrainStatus("wait", "地形配置已更新")
}

function randomTerrain() {
	state.terrain = generateRandomTerrain(state.terrainConfig)
	stopAnimation(state)
	drawEditor()
	updateTerrainStatus("wait", "已随机生成新地形，点击「预测当前地形」查看 AI 判断")
	drawMLP(null)
	drawEmbedding()
	updateProbs([0, 0, 0, 0])
}

function resetNet() {
	resetState(state)
	document.getElementById("data-count")!.textContent = "0"
	updateMetrics(0)
	;(document.getElementById("train-progress") as HTMLDivElement).style.width = "0%"
	;(document.getElementById("btn-train") as HTMLButtonElement).disabled = true
	updateExam("网络已重置", "wait")
	drawMLP(null)
	drawEmbedding()
	updateProbs([0, 0, 0, 0])
	updateSnapshotSlider()
	drawObsessionCurve()
	updateObsessionStatus("未设置观察样本", "wait")
	updateCurriculumUI()
}

// ========== 课程学习 ==========

let curriculumStageIdx = 0
let curriculumRunning = false

function updateCurriculumUI() {
	const status = document.getElementById("curriculum-status")!
	const btnCurriculum = document.getElementById("btn-curriculum") as HTMLButtonElement
	const btnNext = document.getElementById("btn-next-stage") as HTMLButtonElement

	if (curriculumRunning) {
		status.textContent = `当前阶段：${CURRICULUM_STAGES[curriculumStageIdx].name}（训练中…）`
		btnCurriculum.disabled = true
		btnNext.disabled = true
		return
	}

	const stageName = CURRICULUM_STAGES[curriculumStageIdx]?.name ?? "已完成全部阶段"
	status.textContent = `当前阶段：${stageName}`
	btnCurriculum.disabled = false
	btnNext.disabled = curriculumStageIdx >= CURRICULUM_STAGES.length - 1
}

async function runCurriculum() {
	if (curriculumRunning) return
	if (curriculumStageIdx >= CURRICULUM_STAGES.length) {
		updateExam("已完成全部课程阶段！", "ok")
		return
	}

	curriculumRunning = true
	updateCurriculumUI()

	// 应用当前阶段配置
	state.terrainConfig = { ...CURRICULUM_STAGES[curriculumStageIdx].config }
	renderTerrainConfig()
	renderBrushes()

	// 生成数据
	state.dataset = generateTerrainData(6000, state.terrainConfig)
	document.getElementById("data-count")!.textContent = String(state.dataset.length)
	const btnTrain = document.getElementById("btn-train") as HTMLButtonElement
	btnTrain.disabled = state.dataset.length === 0

	// 清空旧快照，保留初始状态
	state.snapshots = [{ step: state.trainSteps, net: cloneNet(state.net) }]
	recordSnapshotStats(0)
	state.selectedSnapshotIndex = 0
	updateSnapshotSlider()

	const targetAcc = 90
	const maxTotalSteps = 3000
	const batchSize = 32
	const stepsPerBatch = 100
	let achieved = false

	while (state.trainSteps < maxTotalSteps) {
		for (let s = 0; s < stepsPerBatch; s++) {
			const gEmbed = zeroMat(NUM_ELEMENTS, 2)
			const gW1 = zeroMat(HIDDEN_DIM, INPUT_DIM)
			const gb1 = zeroVec(HIDDEN_DIM)
			const gW2 = zeroMat(OUTPUT_DIM, HIDDEN_DIM)
			const gb2 = zeroVec(OUTPUT_DIM)

			for (let b = 0; b < batchSize; b++) {
				const idx = Math.floor(Math.random() * state.dataset.length)
				const sample = state.dataset[idx]
				const fp = forward(state.net, sample.indices)
				const grad = backward(state.net, fp, sample.y)

				for (let e = 0; e < NUM_ELEMENTS; e++) {
					for (let d = 0; d < 2; d++) gEmbed[e][d] += grad.dEmbed[e][d] / batchSize
				}
				for (let i = 0; i < HIDDEN_DIM; i++) {
					for (let j = 0; j < INPUT_DIM; j++) gW1[i][j] += grad.dW1[i][j] / batchSize
					gb1[i] += grad.db1[i] / batchSize
				}
				for (let i = 0; i < OUTPUT_DIM; i++) {
					for (let j = 0; j < HIDDEN_DIM; j++) gW2[i][j] += grad.dW2[i][j] / batchSize
					gb2[i] += grad.db2[i] / batchSize
				}
			}

			updateNetwork(state.net, { dEmbed: gEmbed, dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, 1)
			state.trainSteps++
		}

		// 评估
		let evalCorrect = 0
		for (const sample of state.dataset) {
			const fp = forward(state.net, sample.indices)
			if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) evalCorrect++
		}
		const acc = (evalCorrect / state.dataset.length) * 100
		updateMetrics(0, acc, Math.min(state.trainSteps / maxTotalSteps, 1) * 100)

		// 保存快照
		state.snapshots.push({ step: state.trainSteps, net: cloneNet(state.net) })
		recordSnapshotStats(state.snapshots.length - 1)
		updateSnapshotSlider()
		drawObsessionCurve()

		// 检查是否达标
		if (acc >= targetAcc) {
			achieved = true
			break
		}

		await new Promise(r => setTimeout(r, 1))
	}

	curriculumRunning = false
	updateCurriculumUI()

	if (achieved) {
		updateExam(
			`${CURRICULUM_STAGES[curriculumStageIdx].name} 训练完成！准确率 ≥ ${targetAcc}%，可进入下一阶段`,
			"ok"
		)
	} else {
		updateExam(
			`${CURRICULUM_STAGES[curriculumStageIdx].name} 训练结束，未达到 ${targetAcc}% 准确率（当前：${document.getElementById("acc-display")!.textContent}）。建议重置网络再试一次。`,
			"bad"
		)
	}

	predict()
}

function nextCurriculumStage() {
	if (curriculumStageIdx < CURRICULUM_STAGES.length - 1) {
		curriculumStageIdx++
		state.terrainConfig = { ...CURRICULUM_STAGES[curriculumStageIdx].config }
		renderTerrainConfig()
		renderBrushes()
		updateCurriculumUI()
		updateExam(`已进入 ${CURRICULUM_STAGES[curriculumStageIdx].name}，点击「开始课程训练」生成数据并训练`, "wait")
	}
}

// ========== 编辑器绘制 ==========

function drawEditor() {
	drawEditorWithState()
}

function drawEditorWithState() {
	const ctx = editorCanvas.getContext("2d")!
	const rect = editorCanvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	editorCanvas.width = Math.floor(rect.width * dpr)
	editorCanvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.clearRect(0, 0, rect.width, rect.height)

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

// ========== MLP 绘制 ==========

function drawMLP(fp: ForwardResult | null) {
	const canvas = mlpCanvas
	const ctx = canvas.getContext("2d")!
	const rect = canvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	canvas.width = Math.floor(rect.width * dpr)
	canvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	const W = rect.width, H = rect.height
	ctx.clearRect(0, 0, W, H)

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

// ========== Embedding 绘制 ==========

function drawEmbedding() {
	const canvas = embeddingCanvas
	const ctx = canvas.getContext("2d")!
	const rect = canvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	canvas.width = Math.floor(rect.width * dpr)
	canvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	const W = rect.width, H = rect.height
	ctx.clearRect(0, 0, W, H)

	const cx = W / 2
	const cy = H / 2
	const padding = 34
	const availW = Math.max(W - padding * 2, 1)
	const availH = Math.max(H - padding * 2, 1)

	// 动态计算缩放因子，确保所有元素都在画布内
	let maxAbs = 0
	for (const el of UI_ELEMENTS) {
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
	const globalSizeFactor = Math.max(0.6, Math.min(1.4, 1.5 / maxAbs))

	// 元素点
	for (const el of UI_ELEMENTS) {
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

function drawObsessionCurve() {
	const canvas = obsessionCanvas
	const ctx = canvas.getContext("2d")!
	const rect = canvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	canvas.width = Math.floor(rect.width * dpr)
	canvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	const W = rect.width, H = rect.height
	ctx.clearRect(0, 0, W, H)

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
		ctx.lineWidth = a === state.observedSample.y ? 2.5 : 1.5
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

// ========== 动画 ==========

function playAnimation(action: ActionType) {
	stopAnimation(state)
	state.animation.animAction = action
	state.animation.animStartTime = performance.now()
	state.animation.animSlimeKilled = false
	state.animation.animId = requestAnimationFrame(stepAnimation)
}

function stepAnimation(now: number) {
	if (!state.animation.animAction) return

	const ctx = editorCanvas.getContext("2d")!
	const rect = editorCanvas.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	editorCanvas.width = Math.floor(rect.width * dpr)
	editorCanvas.height = Math.floor(rect.height * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	ctx.clearRect(0, 0, rect.width, rect.height)

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
		hideSlimeAt: null,
		hideHeroAtCol: startHeroCol,
		dimNonInteractive: false,
	})

	drawEmoji(ctx, "🦊", hx, hy, Math.min(cellW, cellH) * 0.65)

	if (t < 1) {
		state.animation.animId = requestAnimationFrame(stepAnimation)
	} else {
		finishAnimation()
	}
}

function finishAnimation() {
	if (state.animation.animId !== null) {
		cancelAnimationFrame(state.animation.animId)
		state.animation.animId = null
	}
	drawEditor()
}

// ========== 初始化 ==========

function init() {
	// 创建独立的 Logger 实例
	const logger = new Logger("terrain-lab")

	editorCanvas = document.getElementById("editor-canvas") as HTMLCanvasElement
	mlpCanvas = document.getElementById("mlp-canvas") as HTMLCanvasElement
	embeddingCanvas = document.getElementById("embedding-canvas") as HTMLCanvasElement
	obsessionCanvas = document.getElementById("obsession-canvas") as HTMLCanvasElement

	// 动态更新HTML标题
	const editorTitle = document.getElementById("editor-title")
	if (editorTitle) {
		editorTitle.textContent = `编辑预览视图 (${NUM_COLS}×${NUM_LAYERS}) — 点击绘制，狐狸可在任意列`
	}
	const mlpTitle = document.getElementById("mlp-title")
	if (mlpTitle) {
		mlpTitle.textContent = `MLP 网络状态 (${INPUT_DIM} → ${HIDDEN_DIM} → ${OUTPUT_DIM})`
	}

	renderBrushes()
	renderTerrainConfig()
	updateCurriculumUI()
	drawEditor()
	drawMLP(null)
	drawEmbedding()
	drawObsessionCurve()
	updateProbs([0, 0, 0, 0])

	const ro = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const target = entry.target as HTMLCanvasElement
			if (target === editorCanvas) {
				drawEditor()
			} else if (target === mlpCanvas && state.lastForwardResult) {
				drawMLP(state.lastForwardResult)
			} else if (target === embeddingCanvas) {
				drawEmbedding()
			} else if (target === obsessionCanvas) {
				drawObsessionCurve()
			}
		}
	})
	ro.observe(editorCanvas)
	ro.observe(mlpCanvas)
	ro.observe(embeddingCanvas)
	ro.observe(obsessionCanvas)

	// canvas 点击绘制
	editorCanvas.addEventListener("click", e => {
		const rect = editorCanvas.getBoundingClientRect()
		const cell = getEditorCellAt(e.clientX - rect.left, e.clientY - rect.top, rect)
		if (!cell) return
		paintCell(cell.r, cell.c)
	})

	// 快照滑块
	const slider = document.getElementById("snapshot-slider") as HTMLInputElement
	slider.addEventListener("input", () => {
		applySnapshot(Number(slider.value))
	})

	// 绑定全局函数
	;(window as any).generateData = generateData
	;(window as any).trainBatch = trainBatch
	;(window as any).resetNet = resetNet
	;(window as any).predict = predict
	;(window as any).validateTerrain = validateTerrain
	;(window as any).randomTerrain = randomTerrain
	;(window as any).resetView = () => {
		stopAnimation(state)
		drawEditor()
	}
	;(window as any).setObservedFromTerrain = setObservedFromTerrain
	;(window as any).setObservedRandom = setObservedRandom
	;(window as any).onConfigChange = onConfigChange
	;(window as any).runCurriculum = runCurriculum
	;(window as any).nextCurriculumStage = nextCurriculumStage

	// 初始化控制台
	const consolePanel = new ConsolePanel("#console-mount", logger)
	consolePanel.init()
	console.log("TERRAIN-LAB", "控制台初始化完成")

	// 暴露全局 console API
	;(window as any).toggleConsole = () => consolePanel.toggle()
	;(window as any).clearConsole = () => consolePanel.clear()
	;(window as any).downloadConsole = () => consolePanel.download()
}

function getAllowedElementsForLayer(layer: number): number[] {
	const cfg = state.terrainConfig
	const pool = [ELEM_AIR]
	if (layer === 0) {
		if (cfg.demon) pool.push(ELEM_DEMON)
		if (cfg.coin) pool.push(ELEM_COIN)
	} else if (layer === 1) {
		pool.push(ELEM_HERO)
		if (cfg.slime) pool.push(ELEM_SLIME)
		if (cfg.coin) pool.push(ELEM_COIN)
	} else if (layer === 2) {
		pool.push(ELEM_GROUND)
	}
	return pool
}

function paintCell(r: number, c: number) {
	const allowed = getAllowedElementsForLayer(r)
	if (!allowed.includes(state.selectedBrush)) {
		updateTerrainStatus("bad", `❌ 该元素不能放在 ${["天上", "地上", "地面"][r]}层`)
		return
	}
	stopAnimation(state)
	setTerrainCell(state, r, c, state.selectedBrush)
	drawEditor()
	updateTerrainStatus("wait", "地形已更新，点击「合法性检查」或「预测当前地形」查看结果")
}

init()
