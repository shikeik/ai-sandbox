import type { DatasetItem, ActionChecks } from "./types.js"
import { 
  ELEMENTS, LAYER_LIMITS, NUM_LAYERS, NUM_COLS, NUM_ELEMENTS, 
  ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN 
} from "./constants.js"

// ========== 地形编码 ==========

export function terrainToOneHot(t: number[][]): number[] {
  const vec = Array(NUM_COLS * NUM_LAYERS * NUM_ELEMENTS).fill(0)
  // 编码 x0-x4 (列 0-4)，共5列，每列3层，每层6种元素
  for (let r = 0; r < NUM_LAYERS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const id = t[r][c]
      const idx = (c * NUM_LAYERS + r) * NUM_ELEMENTS + id
      vec[idx] = 1
    }
  }
  return vec
}

// 找到狐狸所在列
export function findHeroCol(t: number[][]): number {
  for (let c = 0; c < NUM_COLS; c++) {
    if (t[1][c] === ELEM_HERO) return c // 狐狸id=1，在地上层(r=1)
  }
  return 0 // 默认x0
}

// ========== 随机元素生成 ==========

export function randElem(layer: number): number {
  const pool = LAYER_LIMITS[layer]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ========== 规则判定 ==========

export interface BoundaryCheck {
  inBounds: boolean
  targetCol: number
  reason?: string
}

export function checkBoundaries(heroCol: number): {
  walk: BoundaryCheck
  jump: BoundaryCheck
  longJump: BoundaryCheck
  walkAttack: BoundaryCheck
} {
  const col1 = heroCol + 1
  const col2 = heroCol + 2
  const col3 = heroCol + 3
  
  return {
    walk: {
      inBounds: col1 < NUM_COLS,
      targetCol: col1,
      reason: col1 >= NUM_COLS ? `前1(x${col1})超出地图边界` : undefined
    },
    jump: {
      inBounds: col2 < NUM_COLS,
      targetCol: col2,
      reason: col2 >= NUM_COLS ? `前2(x${col2})超出地图边界` : undefined
    },
    longJump: {
      inBounds: col3 < NUM_COLS,
      targetCol: col3,
      reason: col3 >= NUM_COLS ? `前3(x${col3})超出地图边界` : undefined
    },
    walkAttack: {
      inBounds: col1 < NUM_COLS,
      targetCol: col1,
      reason: col1 >= NUM_COLS ? `前1(x${col1})超出地图边界` : undefined
    },
  }
}

export function getActionChecks(t: number[][], heroCol: number): ActionChecks {
  // 安全获取元素名，超出边界返回"空气"
  const getName = (r: number, c: number): string => {
    if (c >= NUM_COLS) return "空气"
    return ELEMENTS[t[r][c]]?.name ?? "空气"
  }
  
  const bounds = checkBoundaries(heroCol)
  
  const col1 = heroCol + 1
  const col2 = heroCol + 2
  const col3 = heroCol + 3
  
  const sky0 = getName(0, col1)
  const sky1 = getName(0, col2)
  const sky2 = getName(0, col3)
  const ground0 = getName(2, col1)
  const ground1 = getName(2, col2)
  const ground2 = getName(2, col3)
  const mid0 = getName(1, col1)
  const mid1 = getName(1, col2)
  const mid2 = getName(1, col3)

  // 检查边界，如果超出地图，直接返回不可行
  const walkReasons: (string | null)[] = []
  if (!bounds.walk.inBounds) {
    walkReasons.push(bounds.walk.reason!)
  } else {
    walkReasons.push(ground0 !== "平地" ? `前1(x${col1})地面不是平地` : null)
    walkReasons.push(sky0 === "恶魔" ? `前1(x${col1})天上有恶魔` : null)
    walkReasons.push(mid0 === "史莱姆" ? `前1(x${col1})地上有史莱姆` : null)
  }

  const jumpReasons: (string | null)[] = []
  if (!bounds.jump.inBounds) {
    jumpReasons.push(bounds.jump.reason!)
  } else {
    jumpReasons.push(sky0 === "恶魔" ? `前1(x${col1})天上有恶魔` : null)
    jumpReasons.push(ground1 !== "平地" ? `前2(x${col2})地面不是平地` : null)
    jumpReasons.push(sky1 === "恶魔" ? `前2(x${col2})天上有恶魔` : null)
    jumpReasons.push(mid1 === "史莱姆" ? `前2(x${col2})地上有史莱姆` : null)
  }

  const longJumpReasons: (string | null)[] = []
  if (!bounds.longJump.inBounds) {
    longJumpReasons.push(bounds.longJump.reason!)
  } else {
    longJumpReasons.push(sky0 === "恶魔" ? `前1(x${col1})天上有恶魔` : null)
    longJumpReasons.push(sky1 === "恶魔" ? `前2(x${col2})天上有恶魔` : null)
    longJumpReasons.push(ground2 !== "平地" ? `前3(x${col3})地面不是平地` : null)
    longJumpReasons.push(sky2 === "恶魔" ? `前3(x${col3})天上有恶魔` : null)
    longJumpReasons.push(mid2 === "史莱姆" ? `前3(x${col3})地上有史莱姆` : null)
  }

  const walkAttackReasons: (string | null)[] = []
  if (!bounds.walkAttack.inBounds) {
    walkAttackReasons.push(bounds.walkAttack.reason!)
  } else {
    walkAttackReasons.push(ground0 !== "平地" ? `前1(x${col1})地面不是平地` : null)
  }

  return {
    canWalk: {
      ok: bounds.walk.inBounds && ground0 === "平地" && mid0 !== "史莱姆",
      reasons: walkReasons.filter(Boolean) as string[],
    },
    canJump: {
      ok: bounds.jump.inBounds && sky0 !== "恶魔" && ground1 === "平地" && sky1 !== "恶魔" && mid1 !== "史莱姆",
      reasons: jumpReasons.filter(Boolean) as string[],
    },
    canLongJump: {
      ok: bounds.longJump.inBounds && sky0 !== "恶魔" && sky1 !== "恶魔" && ground2 === "平地" && sky2 !== "恶魔" && mid2 !== "史莱姆",
      reasons: longJumpReasons.filter(Boolean) as string[],
    },
    canWalkAttack: {
      ok: bounds.walkAttack.inBounds && ground0 === "平地",
      reasons: walkAttackReasons.filter(Boolean) as string[],
    },
  }
}

export function getLabel(t: number[][]): number {
  const heroCol = findHeroCol(t)
  const checks = getActionChecks(t, heroCol)
  if (checks.canWalk.ok) return 0
  if (checks.canJump.ok) return 1
  if (checks.canLongJump.ok) return 2
  if (checks.canWalkAttack.ok) return 3
  return -1
}

export function isValidTerrain(t: number[][]): boolean {
  return getLabel(t) !== -1
}

// ========== 数据生成 ==========

export function generateTerrainData(count: number): DatasetItem[] {
  const dataset: DatasetItem[] = []
  let attempts = 0
  let validCount = 0
  const startTime = performance.now()
  
  console.log("DATA", "开始生成 " + count + " 条训练数据...")
  
  while (dataset.length < count && attempts < 50000) {
    const heroCol = Math.floor(Math.random() * NUM_COLS)
    const t = [
      Array.from({ length: NUM_COLS }, () => randElem(0)),
      Array(NUM_COLS).fill(ELEM_AIR),
      Array.from({ length: NUM_COLS }, () => randElem(2)),
    ]
    t[1][heroCol] = ELEM_HERO
    
    attempts++
    if (!isValidTerrain(t)) continue
    
    validCount++
    dataset.push({ t, x: terrainToOneHot(t), y: getLabel(t) })
  }
  
  const duration = (performance.now() - startTime).toFixed(0)
  console.log("DATA", `完成: ${dataset.length}条有效 / ${attempts}次尝试 / 通过率${(validCount/attempts*100).toFixed(1)}% / ${duration}ms`)
  
  return dataset
}

// ========== 生成随机地形 ==========

export function generateRandomTerrain(): number[][] {
  let attempts = 0
  let terrain: number[][]
  
  do {
    const heroCol = Math.floor(Math.random() * NUM_COLS)
    terrain = [
      Array.from({ length: NUM_COLS }, () => randElem(0)), // 天上
      Array(NUM_COLS).fill(ELEM_AIR), // 地上
      Array.from({ length: NUM_COLS }, () => randElem(2)), // 地面
    ]
    // 放置狐狸
    terrain[1][heroCol] = ELEM_HERO
    attempts++
  } while (!isValidTerrain(terrain) && attempts < 1000)
  
  return terrain
}
