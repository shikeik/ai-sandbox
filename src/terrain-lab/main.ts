import type { ForwardResult, ActionType } from "./types.js"
import type { AppState } from "./state.js"
import { 
  NUM_COLS, NUM_LAYERS, NUM_ELEMENTS, HIDDEN_DIM, OUTPUT_DIM, 
  INPUT_DIM, ACTIONS, LR, ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN
} from "./constants.js"
import { zeroMat, zeroVec, easeOutQuad } from "./utils.js"
import { createNet, forward, backward, updateNetwork } from "./neural-network.js"
import { 
  terrainToOneHot, findHeroCol, getActionChecks, getLabel, 
  isValidTerrain, generateTerrainData, generateRandomTerrain, randElem 
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

// ========== 训练相关 ==========

async function trainBatch() {
  const btn = document.getElementById("btn-train") as HTMLButtonElement
  btn.disabled = true
  const batchSize = 32
  const steps = 100

  for (let s = 0; s < steps; s++) {
    const gW1 = zeroMat(HIDDEN_DIM, INPUT_DIM)
    const gb1 = zeroVec(HIDDEN_DIM)
    const gW2 = zeroMat(OUTPUT_DIM, HIDDEN_DIM)
    const gb2 = zeroVec(OUTPUT_DIM)

    let lossSum = 0
    let correct = 0

    for (let b = 0; b < batchSize; b++) {
      const idx = Math.floor(Math.random() * state.dataset.length)
      const sample = state.dataset[idx]
      const fp = forward(state.net, sample.x)
      const grad = backward(state.net, fp, sample.y)

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

    updateNetwork(state.net, { dW1: gW1, db1: gb1, dW2: gW2, db2: gb2 }, 1)

    state.trainSteps++
    if (s % 20 === 0) {
      updateMetrics(lossSum / batchSize, (correct / batchSize) * 100, ((s + 1) / steps) * 100)
      await new Promise(r => setTimeout(r, 1))
    }
  }

  evaluateAll()
  predict()
  btn.disabled = false
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
    const fp = forward(state.net, sample.x)
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
  state.dataset = generateTerrainData(6000)
  updateMetrics(0)
  document.getElementById("data-count")!.textContent = String(state.dataset.length)
  const btn = document.getElementById("btn-train") as HTMLButtonElement
  btn.disabled = state.dataset.length === 0
  updateExam(`已生成 ${state.dataset.length} 条合法训练数据`, "wait")
}

// ========== 预测与验证 ==========

function predict() {
  const x = terrainToOneHot(state.terrain)
  const fp = forward(state.net, x)
  state.lastForwardResult = fp
  const pred = fp.o.indexOf(Math.max(...fp.o))
  const correct = getLabel(state.terrain)
  if (correct === -1) {
    updateTerrainStatus(
      "bad",
      `AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${(fp.o[pred] * 100).toFixed(1)}%)<br>规则答案: <b style="color:#f9ab00">此地形无解（死局）</b>`
    )
    drawMLP(fp)
    updateProbs(fp.o)
    stopAnimation(state)
    return
  }
  const ok = pred === correct
  const conf = (fp.o[pred] * 100).toFixed(1)
  updateTerrainStatus(
    ok ? "ok" : "bad",
    `AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)<br>规则答案: <b>${ACTIONS[correct]}</b> ${ok ? "✅ 通过" : "❌ 错误"}`
  )
  drawMLP(fp)
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
    lines.push(`❌ 无可用动作（死局）`)
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
      actionDetails.push(`❌ 跳：超出地图边界`)
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
      actionDetails.push(`❌ 远跳：超出地图边界`)
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
      actionDetails.push(`❌ 走A：超出地图边界`)
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

function renderBrushes() {
  const list = document.getElementById("brush-list") as HTMLDivElement
  list.innerHTML = ""
  const elements = [
    { id: ELEM_AIR, name: "空气", emoji: "⬛" },
    { id: ELEM_HERO, name: "狐狸", emoji: "🦊" },
    { id: ELEM_GROUND, name: "平地", emoji: "🟩" },
    { id: 3, name: "史莱姆", emoji: "🦠" },
    { id: 4, name: "恶魔", emoji: "👿" },
    { id: 5, name: "金币", emoji: "🪙" },
  ]
  elements.forEach((el) => {
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

function randomTerrain() {
  state.terrain = generateRandomTerrain()
  stopAnimation(state)
  drawEditor()
  updateTerrainStatus("wait", "已随机生成新地形，点击「预测当前地形」查看 AI 判断")
  drawMLP(null)
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
  updateProbs([0, 0, 0, 0])
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

  const cellSize = 44
  const cellW = cellSize
  const cellH = cellSize
  const gapX = 6
  const gapY = 6
  const gridW = NUM_COLS * cellW + (NUM_COLS - 1) * gapX
  const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
  const startX = (rect.width - gridW) / 2
  const startY = (rect.height - gridH) / 2 + 10

  // 标签
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

  // 找到狐狸当前位置
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

  // 绘制网格
  drawTerrainGrid(ctx, state.terrain, {
    cellW, cellH, gapX, gapY, startX, startY,
    hideSlimeAt: state.animation.animSlimeKilled ? (heroCol + 1 < NUM_COLS ? heroCol + 1 : null) : null,
    hideHeroAtCol: state.animation.animAction !== null ? heroCol : null,
    dimNonInteractive: false,
  })
  
  // 动画时单独绘制移动的狐狸
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

  // 左侧：5x3 环境网格
  const cellSize = 28, gapX = 4, gapY = 4
  const cellW = cellSize
  const cellH = cellSize
  const gridW = NUM_COLS * cellW + (NUM_COLS - 1) * gapX
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

  // 输入->隐藏连线
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

  const cellSize = 44
  const cellW = cellSize
  const cellH = cellSize
  const gapX = 6
  const gapY = 6
  const gridW = NUM_COLS * cellW + (NUM_COLS - 1) * gapX
  const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
  const startX = (rect.width - gridW) / 2
  const startY = (rect.height - gridH) / 2 + 10

  // 标签
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

  // 找到狐狸起始位置
  const startHeroCol = findHeroCol(state.terrain)
  
  // 计算进度
  const path = calculateAnimationPath(startHeroCol, state.animation.animAction)
  const duration = path.duration
  let t = (now - state.animation.animStartTime) / duration
  if (t > 1) t = 1

  // 狐狸起始位置
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

  // 绘制地形（隐藏原位置的狐狸）
  drawTerrainGrid(ctx, state.terrain, {
    cellW, cellH, gapX, gapY, startX, startY,
    hideSlimeAt: null,
    hideHeroAtCol: startHeroCol,
    dimNonInteractive: false,
  })

  // 单独画移动的狐狸
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

  // 动态更新HTML标题
  const editorTitle = document.getElementById('editor-title')
  if (editorTitle) {
    editorTitle.textContent = `编辑预览视图 (${NUM_COLS}×${NUM_LAYERS}) — 点击绘制，狐狸可在任意列`
  }
  const mlpTitle = document.getElementById('mlp-title')
  if (mlpTitle) {
    mlpTitle.textContent = `MLP 网络状态 (${INPUT_DIM} → ${HIDDEN_DIM} → ${OUTPUT_DIM})`
  }

  renderBrushes()
  drawEditor()
  drawMLP(null)
  updateProbs([0, 0, 0, 0])
  
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = entry.target as HTMLCanvasElement
      if (target === editorCanvas) {
        drawEditor()
      } else if (target === mlpCanvas && state.lastForwardResult) {
        drawMLP(state.lastForwardResult)
      }
    }
  })
  ro.observe(editorCanvas)
  ro.observe(mlpCanvas)

  // canvas 点击绘制
  editorCanvas.addEventListener("click", e => {
    const rect = editorCanvas.getBoundingClientRect()
    const cell = getEditorCellAt(e.clientX - rect.left, e.clientY - rect.top, rect)
    if (!cell) return
    paintCell(cell.r, cell.c)
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

  // 初始化控制台
  const consolePanel = new ConsolePanel("#console-mount", logger)
  consolePanel.init()
  console.log("TERRAIN-LAB", "控制台初始化完成")

  // 暴露全局 console API
  ;(window as any).toggleConsole = () => consolePanel.toggle()
  ;(window as any).clearConsole = () => consolePanel.clear()
  ;(window as any).downloadConsole = () => consolePanel.download()
}

function paintCell(r: number, c: number) {
  const allowed = [
    [ELEM_AIR, ELEM_DEMON, ELEM_COIN],
    [ELEM_AIR, ELEM_HERO, 3, ELEM_COIN],
    [ELEM_AIR, ELEM_GROUND],
  ][r]
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
