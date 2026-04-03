import type { DrawOptions } from "./types.js"
import { NUM_LAYERS, NUM_COLS, ELEMENTS, ELEM_AIR } from "./constants.js"

// ========== 绘制函数 ==========

export function drawTerrainGrid(
  ctx: CanvasRenderingContext2D,
  t: number[][],
  opts: DrawOptions
) {
  const { cellW, cellH, gapX, gapY, startX, startY, hideSlimeAt, hideHeroAtCol } = opts

  // 绘制网格线框（所有列统一处理）
  for (let r = 0; r < NUM_LAYERS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const x = startX + c * (cellW + gapX)
      const y = startY + r * (cellH + gapY)
      
      ctx.strokeStyle = "#3c4043"
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, cellW, cellH)
    }
  }

  // 绘制元素
  for (let r = 0; r < NUM_LAYERS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const x = startX + c * (cellW + gapX)
      const y = startY + r * (cellH + gapY)
      
      const elemId = t[r][c]
      
      // 跳过被击杀的史莱姆
      if (r === 1 && c === (hideSlimeAt ?? -1)) continue
      
      // 动画时跳过原位置的狐狸
      if (r === 1 && c === (hideHeroAtCol ?? -1) && elemId === 1) {
        drawEmoji(ctx, ELEMENTS[ELEM_AIR].emoji, x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.55)
        continue
      }
      
      drawEmoji(ctx, ELEMENTS[elemId].emoji, x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.55)
    }
  }
}

export function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  ctx.font = `${Math.floor(size)}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(emoji, x, y)
}

// ========== 获取编辑器单元格 ==========

export interface CellPos { r: number; c: number }

export function getEditorCellAt(
  mx: number, my: number, 
  rect: { width: number; height: number; left: number; top: number },
  cellSize: number = 44,
  gap: number = 6
): CellPos | null {
  const cellW = cellSize
  const cellH = cellSize
  const gapX = gap
  const gapY = gap
  const gridW = NUM_COLS * cellW + (NUM_COLS - 1) * gapX
  const gridH = NUM_LAYERS * cellH + (NUM_LAYERS - 1) * gapY
  const startX = (rect.width - gridW) / 2
  const startY = (rect.height - gridH) / 2 + 10

  const x = mx - startX
  const y = my - startY
  const c = Math.floor(x / (cellW + gapX))
  const r = Math.floor(y / (cellH + gapY))

  if (c < 0 || c >= NUM_COLS || r < 0 || r >= NUM_LAYERS) return null
  
  // 检查是否在格子内部（不在 gap 上）
  const localX = x - c * (cellW + gapX)
  const localY = y - r * (cellH + gapY)
  if (localX < 0 || localX > cellW || localY < 0 || localY > cellH) return null
  
  return { r, c }
}
