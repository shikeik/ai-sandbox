import type { DatasetItem, ActionChecks } from "./types.js"
import type { TerrainConfig } from "./constants.js"
import {
	ELEMENTS, NUM_LAYERS, NUM_COLS,
	ELEM_AIR, ELEM_HERO, ELEM_GROUND, ELEM_SLIME, ELEM_DEMON, ELEM_COIN,
	DEFAULT_TERRAIN_CONFIG
} from "./constants.js"

// ========== 地形编码 ==========

export function terrainToIndices(t: number[][]): number[] {
	const indices: number[] = []
	for (let r = 0; r < NUM_LAYERS; r++) {
		for (let c = 0; c < NUM_COLS; c++) {
			indices.push(t[r][c])
		}
	}
	return indices
}

// 找到狐狸所在列
export function findHeroCol(t: number[][]): number {
	for (let c = 0; c < NUM_COLS; c++) {
		if (t[1][c] === ELEM_HERO) return c // 狐狸id=1，在地上层(r=1)
	}
	return 0 // 默认x0
}

// ========== 随机元素生成 ==========

export function getLayerPool(layer: number, config: TerrainConfig): number[] {
	if (layer === 2 && config.groundOnly) {
		return [ELEM_GROUND]
	}
	const pool = [ELEM_AIR]
	if (layer === 0) {
		if (config.demon) pool.push(ELEM_DEMON)
		if (config.coin) pool.push(ELEM_COIN)
	} else if (layer === 1) {
		if (config.slime) pool.push(ELEM_SLIME)
		if (config.coin) pool.push(ELEM_COIN)
	} else if (layer === 2) {
		pool.push(ELEM_GROUND)
	}
	return pool
}

export function randElemFromPool(pool: number[]): number {
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

export function getActionName(actionIdx: number): string {
	return ["走", "跳", "远跳", "走A"][actionIdx] ?? "未知"
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

// 根据 actionChecks 判断某个动作索引是否合法（与 validateTerrain 使用同一数据源）
export function isActionValidByChecks(checks: ActionChecks, actionIdx: number): boolean {
	if (actionIdx === 0) return checks.canWalk.ok
	if (actionIdx === 1) return checks.canJump.ok
	if (actionIdx === 2) return checks.canLongJump.ok
	if (actionIdx === 3) return checks.canWalkAttack.ok
	return false
}

// ========== 数据生成 ==========

function configLabel(config: TerrainConfig): string {
	const parts: string[] = []
	if (config.groundOnly) parts.push("地面=仅平地")
	else parts.push("地面=平地+坑")
	if (config.slime) parts.push("史莱姆")
	if (config.demon) parts.push("恶魔")
	if (config.coin) parts.push("金币")
	return parts.join(" / ")
}

export function generateTerrainData(count: number, config: TerrainConfig = DEFAULT_TERRAIN_CONFIG): DatasetItem[] {
	const dataset: DatasetItem[] = []
	let attempts = 0
	let validCount = 0
	const startTime = performance.now()

	console.log("DATA", `开始生成 ${count} 条训练数据 [${configLabel(config)}]`)

	const pools = [
		getLayerPool(0, config),
		getLayerPool(1, config),
		getLayerPool(2, config),
	]

	while (dataset.length < count && attempts < 50000) {
		const heroCol = Math.floor(Math.random() * NUM_COLS)
		const t = [
			Array.from({ length: NUM_COLS }, () => randElemFromPool(pools[0])),
			Array.from({ length: NUM_COLS }, () => randElemFromPool(pools[1])),
			Array.from({ length: NUM_COLS }, () => randElemFromPool(pools[2])),
		]
		// 确保只有 heroCol 位置是狐狸，其他位置若随机到狐狸则替换为空气
		for (let c = 0; c < NUM_COLS; c++) {
			if (c !== heroCol && t[1][c] === ELEM_HERO) t[1][c] = ELEM_AIR
		}
		t[1][heroCol] = ELEM_HERO

		attempts++
		if (!isValidTerrain(t)) continue

		validCount++
		dataset.push({ t, indices: terrainToIndices(t), y: getLabel(t) })
	}

	const duration = (performance.now() - startTime).toFixed(0)
	console.log("DATA", `完成: ${dataset.length}条有效 / ${attempts}次尝试 / 通过率${(validCount / (attempts || 1) * 100).toFixed(1)}% / ${duration}ms [${configLabel(config)}]`)

	return dataset
}

// ========== 生成随机地形 ==========

export function generateRandomTerrain(config: TerrainConfig = DEFAULT_TERRAIN_CONFIG): number[][] {
	let attempts = 0
	let terrain: number[][]

	const pools = [
		getLayerPool(0, config),
		getLayerPool(1, config),
		getLayerPool(2, config),
	]

	do {
		const heroCol = Math.floor(Math.random() * NUM_COLS)
		terrain = [
			Array.from({ length: NUM_COLS }, () => randElemFromPool(pools[0])),
			Array.from({ length: NUM_COLS }, () => randElemFromPool(pools[1])),
			Array.from({ length: NUM_COLS }, () => randElemFromPool(pools[2])),
		]
		// 确保只有 heroCol 位置是狐狸，其他位置若随机到狐狸则替换为空气
		for (let c = 0; c < NUM_COLS; c++) {
			if (c !== heroCol && terrain[1][c] === ELEM_HERO) terrain[1][c] = ELEM_AIR
		}
		// 放置狐狸
		terrain[1][heroCol] = ELEM_HERO
		attempts++
	} while (!isValidTerrain(terrain) && attempts < 1000)

	return terrain
}

// ========== 为指定动作生成地形 ==========

/**
 * 为指定动作生成地形
 * 确保只有该动作合法，其他动作不合法（或可选地也合法）
 * @param action 目标动作 (0=走, 1=跳, 2=远跳, 3=走A)
 * @param heroCol 狐狸位置（默认为0）
 * @param config 地形配置
 * @returns 生成的地形，如果无法生成则返回null
 */
export function generateTerrainForAction(
	action: number,
	heroCol: number = 0,
	config: TerrainConfig = DEFAULT_TERRAIN_CONFIG
): number[][] | null {
	// 生成32列完整地形（适配大地图生成器）
	const MAP_WIDTH = 32
	const t: number[][] = [
		Array(MAP_WIDTH).fill(ELEM_AIR),
		Array(MAP_WIDTH).fill(ELEM_AIR),
		Array(MAP_WIDTH).fill(ELEM_AIR),
	]

	// 放置狐狸
	t[1][heroCol] = ELEM_HERO

	// 根据动作设置地形（确定性的，不随机填充关键列）
	switch (action) {
		case 0: // 走：第1列平地，第2、3列都放坑（阻止跳和远跳）
			// 第1列：平地（确保能走）
			t[2][heroCol + 1] = ELEM_GROUND
			// 第2列：坑（阻止跳）
			t[2][heroCol + 2] = ELEM_AIR
			// 第3列：坑（阻止远跳）
			t[2][heroCol + 3] = ELEM_AIR
			break

		case 1: // 跳：第1列坑，第2列平地，第3列坑
			// 第1列：坑（阻止走）
			t[2][heroCol + 1] = ELEM_AIR
			// 第2列：平地（确保能跳）
			t[2][heroCol + 2] = ELEM_GROUND
			// 第3列：坑（阻止远跳）
			t[2][heroCol + 3] = ELEM_AIR
			break

		case 2: // 远跳：第1列坑，第2列坑，第3列平地
			// 第1列：坑（阻止走）
			t[2][heroCol + 1] = ELEM_AIR
			// 第2列：坑（阻止跳）
			t[2][heroCol + 2] = ELEM_AIR
			// 第3列：平地（确保能远跳）
			t[2][heroCol + 3] = ELEM_GROUND
			break

		case 3: // 走A：第1列平地+史莱姆
			if (!config.slime) {
				// 如果没有启用史莱姆，无法生成走A地形
				return null
			}
			// 第1列：平地+史莱姆（确保能走A）
			t[2][heroCol + 1] = ELEM_GROUND
			t[1][heroCol + 1] = ELEM_SLIME
			break

		default:
			return null
	}

	// 其他列保持空气（不随机填充，避免破坏动作合法性）
	// 这样既简单又可靠，零失败

	return t
}
