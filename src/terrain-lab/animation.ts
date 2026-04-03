import type { ActionType } from "./types.js"
import { NUM_LAYERS, NUM_COLS } from "./constants.js"
import { easeOutQuad } from "./utils.js"

// ========== 动画状态 ==========

export interface AnimationState {
  animId: number | null
  animStartTime: number
  animAction: ActionType | null
  animSlimeKilled: boolean
}

export function createAnimationState(): AnimationState {
  return {
    animId: null,
    animStartTime: 0,
    animAction: null,
    animSlimeKilled: false,
  }
}

export function stopAnimation(state: AnimationState): void {
  if (state.animId !== null) {
    cancelAnimationFrame(state.animId)
    state.animId = null
  }
  state.animAction = null
  state.animSlimeKilled = false
}

// ========== 动画路径计算 ==========

export interface AnimationPath {
  startCol: number
  targetCol: number
  duration: number
  jumpHeight: number
  isJump: boolean
}

export function calculateAnimationPath(
  heroCol: number, 
  action: ActionType
): AnimationPath {
  let targetCol = heroCol
  let duration = 400
  let jumpHeight = 0
  let isJump = false

  if (action === "走" || action === "走A") {
    targetCol = heroCol + 1
    duration = 400
  } else if (action === "跳") {
    targetCol = heroCol + 2
    duration = 600
    jumpHeight = 10
    isJump = true
  } else if (action === "远跳") {
    targetCol = heroCol + 3
    duration = 900
    jumpHeight = 25
    isJump = true
  }
  
  targetCol = Math.min(targetCol, NUM_COLS - 1)

  return { startCol: heroCol, targetCol, duration, jumpHeight, isJump }
}

export interface AnimationPosition {
  x: number
  y: number
  progress: number
  shouldKillSlime: boolean
}

export function calculateAnimationPosition(
  path: AnimationPath,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
  gapX: number,
  gapY: number,
  now: number
): AnimationPosition {
  const targetX = startX + path.targetCol * (cellW + gapX) + cellW / 2
  const targetY = startY + 1 * (cellH + gapY) + cellH / 2
  
  let t = (now - path.duration) / path.duration
  if (t > 1) t = 1
  
  const hx = startX + path.startCol * (cellW + gapX) + cellW / 2 + 
             (targetX - (startX + path.startCol * (cellW + gapX) + cellW / 2)) * t
  
  let hy = startY + 1 * (cellH + gapY) + cellH / 2
  
  if (path.isJump) {
    const parabola = 4 * t * (1 - t)
    hy = hy - parabola * (cellH + path.jumpHeight)
  }
  
  // 走A动作在进度超过50%时击杀史莱姆
  const shouldKillSlime = path.duration === 400 && t > 0.5

  return { x: hx, y: hy, progress: t, shouldKillSlime }
}
