// ========== 工具函数 ==========

export function randn(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export function createMat(rows: number, cols: number, scale = 1): number[][] {
  return Array.from({ length: rows }, () => 
    Array.from({ length: cols }, () => randn() * scale)
  )
}

export function zeroVec(n: number): number[] { 
  return Array(n).fill(0) 
}

export function zeroMat(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

export function easeOutQuad(t: number): number {
  return t * (2 - t)
}
