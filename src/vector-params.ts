type ElementType = "空气" | "平地" | "史莱姆" | "恶魔" | "金币"
type ActionType = "走" | "跳" | "远跳" | "走A"

interface DatasetItem {
  t: number[][]
  x: number[]
  y: number
}

interface NetParams {
  W1: number[][]
  b1: number[]
  W2: number[][]
  b2: number[]
}

interface ForwardResult {
  x: number[]
  z1: number[]
  h: number[]
  z2: number[]
  o: number[]
}

// ========== 常量 ==========
const ELEMENTS: { id: number; name: ElementType; emoji: string }[] = [
  { id: 0, name: "空气", emoji: "⬜" },
  { id: 1, name: "平地", emoji: "🟩" },
  { id: 2, name: "史莱姆", emoji: "🦠" },
  { id: 3, name: "恶魔", emoji: "👿" },
  { id: 4, name: "金币", emoji: "🪙" },
]

// 层限制：0=天上，1=地上，2=地面
const LAYER_LIMITS: number[][] = [
  [0, 3, 4], // 天上: 空气, 恶魔, 金币
  [0, 2, 4], // 地上: 空气, 史莱姆, 金币
  [0, 1],    // 地面: 空气, 平地
]

const ACTIONS: ActionType[] = ["走", "跳", "远跳", "走A"]
const ROW_NAMES = ["天上", "地上", "地面"]
const COLS = 5 // x0-x4
const INTERACTIVE_START = 1 // x1 开始可交互
const INPUT_DIM = 60 // 4列(x1-x4) * 3层 * 5元素
const HIDDEN_DIM = 16
const OUTPUT_DIM = 4
const LR = 0.05

// 主角固定状态 (x0列)
const HERO_COL: number[] = [0, 0, 1] // 天上=空气, 地上=狐狸(用特殊处理), 地面=平地

// ========== 状态 ==========
let terrain: number[][] = [
  [0, 0, 0, 0, 0], // 天上
  [0, 0, 0, 0, 0], // 地上 (y1=狐狸占位)
  [1, 1, 0, 0, 0], // 地面 (x0=平地, x1=平地)
]
let selectedBrush = 0
let dataset: DatasetItem[] = []
let trainSteps = 0
let net: NetParams = createNet()

// 动画状态
let animId: number | null = null
let animStartTime = 0
let animAction: ActionType | null = null
let animSlimeKilled = false

// ========== 工具函数 ==========
function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function createMat(rows: number, cols: number, scale = 1): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => randn() * scale))
}

function zeroVec(n: number): number[] { return Array(n).fill(0) }
function zeroMat(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

function createNet(): NetParams {
  return {
    W1: createMat(HIDDEN_DIM, INPUT_DIM, Math.sqrt(2 / INPUT_DIM)),
    b1: zeroVec(HIDDEN_DIM),
    W2: createMat(OUTPUT_DIM, HIDDEN_DIM, Math.sqrt(2 / HIDDEN_DIM)),
    b2: zeroVec(OUTPUT_DIM),
  }
}

function relu(x: number[]): number[] { return x.map(v => Math.max(0, v)) }

function softmax(z: number[]): number[] {
  const max = Math.max(...z)
  const exps = z.map(v => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(v => v / sum)
}

function forward(net: NetParams, x: number[]): ForwardResult {
  const z1 = net.W1.map((row, i) => row.reduce((s, w, j) => s + w * x[j], 0) + net.b1[i])
  const h = relu(z1)
  const z2 = net.W2.map((row, i) => row.reduce((s, w, j) => s + w * h[j], 0) + net.b2[i])
  const o = softmax(z2)
  return { x, z1, h, z2, o }
}

function backward(net: NetParams, fp: ForwardResult, target: number) {
  const dz2 = fp.o.map((v, i) => v - (i === target ? 1 : 0))
  const dW2 = dz2.map(dz => fp.h.map(v => dz * v))
  const db2 = dz2.slice()

  const dh = Array(HIDDEN_DIM).fill(0)
  for (let j = 0; j < HIDDEN_DIM; j++) {
    for (let i = 0; i < OUTPUT_DIM; i++) dh[j] += dz2[i] * net.W2[i][j]
  }
  const dz1 = dh.map((v, i) => (fp.z1[i] > 0 ? v : 0))
  const dW1 = dz1.map(dz => fp.x.map(v => dz * v))
  const db1 = dz1.slice()
  return { dW1, db1, dW2, db2 }
}

// ========== 地形编码 ==========
function terrainToOneHot(t: number[][]): number[] {
  const vec = Array(INPUT_DIM).fill(0)
  // 只编码 x1-x4 (列 1-4)
  for (let r = 0; r < 3; r++) {
    for (let c = 1; c < 5; c++) {
      const id = t[r][c]
      const idx = ((c - 1) * 3 + r) * 5 + id
      vec[idx] = 1
    }
  }
  return vec
}

function randElem(layer: number): number {
  const pool = LAYER_LIMITS[layer]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ========== 规则判定 ==========
function getActionChecks(t: number[][], col = 1) {
  const sky0 = ELEMENTS[t[0][col]].name
  const sky1 = ELEMENTS[t[0][col + 1]] ? ELEMENTS[t[0][col + 1]].name : "空气"
  const sky2 = ELEMENTS[t[0][col + 2]] ? ELEMENTS[t[0][col + 2]].name : "空气"
  const ground0 = ELEMENTS[t[2][col]].name
  const ground1 = ELEMENTS[t[2][col + 1]] ? ELEMENTS[t[2][col + 1]].name : "空气"
  const ground2 = ELEMENTS[t[2][col + 2]] ? ELEMENTS[t[2][col + 2]].name : "空气"
  const mid0 = ELEMENTS[t[1][col]].name
  const mid1 = ELEMENTS[t[1][col + 1]] ? ELEMENTS[t[1][col + 1]].name : "空气"
  const mid2 = ELEMENTS[t[1][col + 2]] ? ELEMENTS[t[1][col + 2]].name : "空气"

  return {
    canWalk: {
      ok: ground0 === "平地" && sky0 !== "恶魔" && mid0 !== "史莱姆",
      reasons: [
        ground0 !== "平地" ? "前1地面不是平地" : null,
        sky0 === "恶魔" ? "前1天上有恶魔" : null,
        mid0 === "史莱姆" ? "前1地上有史莱姆" : null,
      ].filter(Boolean) as string[],
    },
    canJump: {
      ok: sky0 !== "恶魔" && ground1 === "平地" && sky1 !== "恶魔" && mid1 !== "史莱姆",
      reasons: [
        sky0 === "恶魔" ? "前1天上有恶魔" : null,
        ground1 !== "平地" ? "前2(落点)地面不是平地" : null,
        sky1 === "恶魔" ? "前2天上有恶魔" : null,
        mid1 === "史莱姆" ? "前2地上有史莱姆" : null,
      ].filter(Boolean) as string[],
    },
    canLongJump: {
      ok: sky0 !== "恶魔" && sky1 !== "恶魔" && ground2 === "平地" && sky2 !== "恶魔" && mid2 !== "史莱姆",
      reasons: [
        sky0 === "恶魔" ? "前1天上有恶魔" : null,
        sky1 === "恶魔" ? "前2天上有恶魔" : null,
        ground2 !== "平地" ? "前3(落点)地面不是平地" : null,
        sky2 === "恶魔" ? "前3天上有恶魔" : null,
        mid2 === "史莱姆" ? "前3地上有史莱姆" : null,
      ].filter(Boolean) as string[],
    },
    canWalkAttack: {
      ok: ground0 === "平地",
      reasons: [
        ground0 !== "平地" ? "前1地面不是平地" : null,
      ].filter(Boolean) as string[],
    },
  }
}

function getLabel(t: number[][]): number {
  const checks = getActionChecks(t, 1)
  if (checks.canWalk.ok) return 0
  if (checks.canJump.ok) return 1
  if (checks.canLongJump.ok) return 2
  if (checks.canWalkAttack.ok) return 3
  return -1
}

function isValidTerrain(t: number[][]): boolean {
  return getLabel(t) !== -1
}

// ========== 数据生成 ==========
function generateData() {
  dataset = []
  let attempts = 0
  while (dataset.length < 6000 && attempts < 50000) {
    const t = [
      [0, randElem(0), randElem(0), randElem(0), randElem(0)], // 天上 (x0=空气)
      [0, randElem(1), randElem(1), randElem(1), randElem(1)], // 地上 (x0=狐狸占位)
      [1, randElem(2), randElem(2), randElem(2), randElem(2)], // 地面 (x0=平地)
    ]
    attempts++
    if (!isValidTerrain(t)) continue
    const y = getLabel(t)
    dataset.push({ t, x: terrainToOneHot(t), y })
  }
  updateMetrics(0)
  const btn = document.getElementById("btn-train") as HTMLButtonElement
  btn.disabled = dataset.length === 0
  updateExam(`已生成 ${dataset.length} 条合法训练数据`, "wait")
}

// ========== 训练 ==========
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
      const idx = Math.floor(Math.random() * dataset.length)
      const sample = dataset[idx]
      const fp = forward(net, sample.x)
      const grad = backward(net, fp, sample.y)

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

    for (let i = 0; i < HIDDEN_DIM; i++) {
      for (let j = 0; j < INPUT_DIM; j++) net.W1[i][j] -= LR * gW1[i][j]
      net.b1[i] -= LR * gb1[i]
    }
    for (let i = 0; i < OUTPUT_DIM; i++) {
      for (let j = 0; j < HIDDEN_DIM; j++) net.W2[i][j] -= LR * gW2[i][j]
      net.b2[i] -= LR * gb2[i]
    }

    trainSteps++
    if (s % 20 === 0) {
      updateMetrics(lossSum / batchSize, (correct / batchSize) * 100, ((s + 1) / steps) * 100)
      await new Promise(r => setTimeout(r, 1))
    }
  }

  evaluateAll()
  btn.disabled = false
  predict()
}

function updateMetrics(loss: number, acc?: number, progress?: number) {
  document.getElementById("step-count")!.textContent = String(trainSteps)
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
  for (const sample of dataset) {
    const fp = forward(net, sample.x)
    if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) correct++
    lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
  }
  document.getElementById("step-count")!.textContent = String(trainSteps)
  document.getElementById("acc-display")!.textContent = ((correct / dataset.length) * 100).toFixed(1) + "%"
  document.getElementById("loss-display")!.textContent = (lossSum / dataset.length).toFixed(4)
  ;(document.getElementById("train-progress") as HTMLDivElement).style.width = "100%"
}

function resetNet() {
  net = createNet()
  trainSteps = 0
  dataset = []
  document.getElementById("data-count")!.textContent = "0"
  updateMetrics(0)
  ;(document.getElementById("train-progress") as HTMLDivElement).style.width = "0%"
  ;(document.getElementById("btn-train") as HTMLButtonElement).disabled = true
  updateExam("网络已重置", "wait")
  drawMLP(null)
  updateProbs([0, 0, 0, 0])
  stopAnimation()
}

// ========== 预测 / 考试 ==========
function predict() {
  const x = terrainToOneHot(terrain)
  const fp = forward(net, x)
  const pred = fp.o.indexOf(Math.max(...fp.o))
  const correct = getLabel(terrain)
  if (correct === -1) {
    updateExam(
      `AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${(fp.o[pred] * 100).toFixed(1)}%)<br>规则答案: <b style="color:#f9ab00">此地形无解（死局）</b>`,
      "bad"
    )
    drawMLP(fp)
    updateProbs(fp.o)
    stopAnimation()
    return
  }
  const ok = pred === correct
  const conf = (fp.o[pred] * 100).toFixed(1)
  updateExam(
    `AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)<br>规则答案: <b>${ACTIONS[correct]}</b> ${ok ? "✅ 通过" : "❌ 错误"}`,
    ok ? "ok" : "bad"
  )
  drawMLP(fp)
  updateProbs(fp.o)
  playAnimation(ACTIONS[pred])
}

function validateTerrain() {
  const checks = getActionChecks(terrain, 1)
  const walk = checks.canWalk
  const jump = checks.canJump
  const longJump = checks.canLongJump
  const wa = checks.canWalkAttack

  const invalidReasons: string[] = []
  if (!walk.ok) invalidReasons.push(`❌ 不可走：${walk.reasons.join("，")}`)
  if (!jump.ok) invalidReasons.push(`❌ 不可跳：${jump.reasons.join("，")}`)
  if (!longJump.ok) invalidReasons.push(`❌ 不可远跳：${longJump.reasons.join("，")}`)
  if (!wa.ok) invalidReasons.push(`❌ 不可走A：${wa.reasons.join("，")}`)

  const validReasons: string[] = []
  if (walk.ok) validReasons.push("✅ 可走")
  if (jump.ok) validReasons.push("✅ 可跳")
  if (longJump.ok) validReasons.push("✅ 可远跳")
  if (wa.ok) validReasons.push("✅ 可走A")

  if (validReasons.length > 0) {
    updateTerrainStatus("ok", validReasons.join("<br>") + (invalidReasons.length > 0 ? "<br><br>" + invalidReasons.join("<br>") : ""))
  } else {
    updateTerrainStatus("bad", invalidReasons.join("<br>"))
  }
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

// ========== 编辑器 UI ==========
function renderTerrain() {
  const wrap = document.getElementById("terrain-wrap") as HTMLDivElement
  wrap.innerHTML = ""
  for (let r = 0; r < 3; r++) {
    const rowDiv = document.createElement("div")
    rowDiv.className = "terrain-row"
    const label = document.createElement("div")
    label.className = "row-label"
    label.textContent = ROW_NAMES[r]
    rowDiv.appendChild(label)
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div")
      cell.className = "terrain-cell"
      const id = terrain[r][c]
      const el = ELEMENTS[id]
      cell.textContent = el.emoji
      cell.title = el.name

      if (c === 0) {
        // x0 主角区域：不可交互，但显示固定内容
        cell.style.background = "#1a2332"
        cell.style.borderColor = "#2c3e50"
        cell.style.cursor = "default"
        if (r === 1) {
          cell.textContent = "🦊"
          cell.title = "狐狸"
        }
      } else {
        cell.onclick = () => paintCell(r, c)
      }
      rowDiv.appendChild(cell)
    }
    wrap.appendChild(rowDiv)
  }
}

function renderBrushes() {
  const list = document.getElementById("brush-list") as HTMLDivElement
  list.innerHTML = ""
  ELEMENTS.forEach((el, i) => {
    const item = document.createElement("div")
    item.className = "brush-item" + (i === selectedBrush ? " active" : "")
    item.innerHTML = `<div class="brush-emoji">${el.emoji}</div><div class="brush-name">${el.name}</div>`
    item.onclick = () => {
      selectedBrush = i
      renderBrushes()
      updateTerrainStatus("wait", "已选择 " + el.name + "，点击上方格子绘制")
    }
    list.appendChild(item)
  })
}

function paintCell(r: number, c: number) {
  if (c === 0) return
  const allowed = LAYER_LIMITS[r]
  if (!allowed.includes(selectedBrush)) {
    updateTerrainStatus("bad", `❌ ${ELEMENTS[selectedBrush].name} 不能放在 ${ROW_NAMES[r]}层`)
    return
  }
  terrain[r][c] = selectedBrush
  renderTerrain()
  updateTerrainStatus("wait", "地形已更新，点击「合法性检查」或「预测当前地形」查看结果")
}

function randomTerrain() {
  let attempts = 0
  do {
    terrain = [
      [0, randElem(0), randElem(0), randElem(0), randElem(0)],
      [0, randElem(1), randElem(1), randElem(1), randElem(1)],
      [1, randElem(2), randElem(2), randElem(2), randElem(2)],
    ]
    attempts++
  } while (!isValidTerrain(terrain) && attempts < 1000)
  renderTerrain()
  updateTerrainStatus("wait", "已随机生成新地形，点击「预测当前地形」查看 AI 判断")
  drawMLP(null)
  updateProbs([0, 0, 0, 0])
  stopAnimation()
}

// ========== MLP Canvas ==========
function drawMLP(fp: ForwardResult | null) {
  const canvas = document.getElementById("mlp-canvas") as HTMLCanvasElement
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)
  const ctx = canvas.getContext("2d")!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = rect.width, H = rect.height
  ctx.clearRect(0, 0, W, H)

  // 左侧：只画 x1-x4 的 4x3 网格
  const cellW = 28, cellH = 24, gapX = 4, gapY = 4
  const gridW = 4 * cellW + 3 * gapX
  const gridH = 3 * cellH + 2 * gapY
  const startX = 10
  const startY = (H - gridH) / 2

  for (let r = 0; r < 3; r++) {
    for (let c = 1; c < 5; c++) {
      const id = terrain[r][c]
      const x = startX + (c - 1) * (cellW + gapX)
      const y = startY + r * (cellH + gapY)
      const colors = ["#1a1a1a", "#2d4059", "#2f4f2f", "#4a1c1c", "#4a4a1c"]
      ctx.fillStyle = colors[id]
      ctx.fillRect(x, y, cellW, cellH)
      ctx.strokeStyle = "#3c4043"
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, cellW, cellH)
      ctx.fillStyle = "#e8eaed"
      ctx.font = "12px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(ELEMENTS[id].emoji, x + cellW / 2, y + cellH / 2 + 4)
    }
  }

  // 隐藏层
  const hidX = W / 2
  const hidY = Array.from({ length: 16 }, (_, i) => {
    const gap = H / (16 + 1)
    return gap * (i + 1)
  })

  // 输出层
  const outX = W - 50
  const outY = Array.from({ length: 4 }, (_, i) => {
    const gap = H / (4 + 1)
    return gap * (i + 1)
  })

  // 输入->隐藏连线
  ctx.lineWidth = 0.5
  for (let r = 0; r < 3; r++) {
    for (let c = 1; c < 5; c++) {
      const x1 = startX + (c - 1) * (cellW + gapX) + cellW / 2
      const y1 = startY + r * (cellH + gapY) + cellH / 2
      for (let h = 0; h < 16; h++) {
        ctx.strokeStyle = "rgba(95,99,104,0.15)"
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(hidX, hidY[h])
        ctx.stroke()
      }
    }
  }

  // 隐藏->输出连线
  for (let h = 0; h < 16; h++) {
    for (let o = 0; o < 4; o++) {
      let w = 0
      if (fp) w = net.W2[o][h]
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
  for (let h = 0; h < 16; h++) {
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
  for (let o = 0; o < 4; o++) {
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
function stopAnimation() {
  if (animId !== null) {
    cancelAnimationFrame(animId)
    animId = null
  }
  animAction = null
  animSlimeKilled = false
}

function playAnimation(action: ActionType) {
  stopAnimation()
  animAction = action
  animStartTime = performance.now()
  animSlimeKilled = false
  animId = requestAnimationFrame(stepAnimation)
}

function stepAnimation(now: number) {
  const canvas = document.getElementById("anim-canvas") as HTMLCanvasElement
  const ctx = canvas.getContext("2d")!
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(rect.width * dpr)
  canvas.height = Math.floor(rect.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = rect.width, H = rect.height
  ctx.clearRect(0, 0, W, H)

  const cellW = 36
  const cellH = 30
  const gapX = 6
  const gapY = 6
  const gridW = 5 * cellW + 4 * gapX
  const startX = (W - gridW) / 2
  const startY = (H - 3 * cellH - 2 * gapY) / 2

  // 绘制背景格子
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const x = startX + c * (cellW + gapX)
      const y = startY + r * (cellH + gapY)
      if (c === 0) {
        ctx.fillStyle = "#1a2332"
        ctx.fillRect(x, y, cellW, cellH)
        ctx.strokeStyle = "#2c3e50"
      } else {
        ctx.fillStyle = "#0b0c0f"
        ctx.fillRect(x, y, cellW, cellH)
        ctx.strokeStyle = "#3c4043"
      }
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, cellW, cellH)

      // 绘制地形元素 (x0固定显示，或动态)
      let showSlime = true
      if (c === 1 && animSlimeKilled) showSlime = false

      const id = terrain[r][c]
      if (c === 0) {
        if (r === 0) drawEmoji(ctx, "⬜", x + cellW / 2, y + cellH / 2)
        else if (r === 1) {
          // 狐狸在动画中会移动，所以这里不画静态狐狸
        }
        else if (r === 2) drawEmoji(ctx, "🟩", x + cellW / 2, y + cellH / 2)
      } else {
        if (r === 1 && c === 1 && !showSlime) {
          // 史莱姆被击杀，不画
        } else {
          drawEmoji(ctx, ELEMENTS[id].emoji, x + cellW / 2, y + cellH / 2)
        }
      }
    }
  }

  // 计算进度
  const duration = animAction === "远跳" ? 900 : (animAction === "跳" ? 600 : 400)
  let t = (now - animStartTime) / duration
  if (t > 1) t = 1

  // 狐狸路径
  const heroBaseX = startX + cellW / 2
  const heroBaseY = startY + cellH + cellH / 2 // y1 中心

  let hx = heroBaseX
  let hy = heroBaseY

  if (animAction === "走" || animAction === "走A") {
    const targetX = startX + 1 * (cellW + gapX) + cellW / 2
    hx = heroBaseX + (targetX - heroBaseX) * easeOutQuad(t)
    hy = heroBaseY
    if (animAction === "走A" && t > 0.5) animSlimeKilled = true
  } else if (animAction === "跳") {
    const targetX = startX + 2 * (cellW + gapX) + cellW / 2
    const peakY = heroBaseY - cellH // 跳到前1格天上高度
    hx = heroBaseX + (targetX - heroBaseX) * t
    // 抛物线：先上升到 peakY 再下降
    const parabola = 4 * t * (1 - t)
    hy = heroBaseY - parabola * (cellH + 10)
  } else if (animAction === "远跳") {
    const targetX = startX + 3 * (cellW + gapX) + cellW / 2
    const peakY = heroBaseY - cellH - 15
    hx = heroBaseX + (targetX - heroBaseX) * t
    const parabola = 4 * t * (1 - t)
    hy = heroBaseY - parabola * (cellH + 25)
  }

  // 画狐狸
  drawFox(ctx, hx, hy)

  if (t < 1) {
    animId = requestAnimationFrame(stepAnimation)
  }
}

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number) {
  ctx.font = "18px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(emoji, x, y + 2)
}

function drawFox(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.font = "20px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("🦊", x, y + 2)
}

function easeOutQuad(t: number): number {
  return t * (2 - t)
}

// ========== 初始化 ==========
function init() {
  renderTerrain()
  renderBrushes()
  drawMLP(null)
  updateProbs([0, 0, 0, 0])
  window.addEventListener("resize", () => drawMLP(null))

  // 绑定全局函数到 window 供 HTML 调用
  ;(window as any).generateData = generateData
  ;(window as any).trainBatch = trainBatch
  ;(window as any).resetNet = resetNet
  ;(window as any).predict = predict
  ;(window as any).validateTerrain = validateTerrain
  ;(window as any).randomTerrain = randomTerrain
}

init()
