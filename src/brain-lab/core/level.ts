// ========== 关卡加载与解析 ==========

import type { LevelData, WorldState, Position } from "../types/index.js"
import { Element } from "../types/index.js"
import { DEFAULT_LEVEL_MAP, CHAR_MAP, SPECIAL_CHARS } from "../config.js"

/**
 * 从关卡数据创建初始世界状态
 * 使用 map 实际尺寸作为世界宽高，配置值仅作后备
 */
export function createStateFromLevel(level: LevelData = DEFAULT_LEVEL_MAP): WorldState {
	const { map } = level
	const height = map.length
	const width = height > 0 ? map[0].length : 0
	const grid: number[][] = Array(height).fill(0).map(() =>
		Array(width).fill(Element.AIR)
	)

	let hero: Position = { x: 1, y: 1 }
	const enemies: Position[] = []

	// 解析字符地图（反转：数组第0行是视觉顶层，对应y=height-1）
	for (let row = 0; row < map.length && row < height; row++) {
		const line = map[row]
		const y = height - 1 - row  // 反转：视觉顶行 -> 逻辑底行

		for (let x = 0; x < line.length && x < width; x++) {
			const char = line[x]

			// 特殊标记：玩家起始位置
			if (char === SPECIAL_CHARS.heroStart) {
				hero = { x, y }
				grid[y][x] = CHAR_MAP[char] ?? Element.AIR
			}
			// 特殊标记：敌人位置
			else if (char === SPECIAL_CHARS.enemy) {
				enemies.push({ x, y })
				grid[y][x] = CHAR_MAP[char] ?? Element.AIR
			}
			// 其他格子使用 CHAR_MAP 映射
			else if (char in CHAR_MAP) {
				grid[y][x] = CHAR_MAP[char]
			}
			// 未识别字符保持为 AIR
		}
	}

	return {
		grid,
		hero,
		enemies,
		triggers: [false],
		spikeFalling: false,
		spikeY: 4,
	}
}

/**
 * 克隆世界状态
 */
export function cloneState(state: WorldState): WorldState {
	return {
		grid: state.grid.map(row => [...row]),
		hero: { ...state.hero },
		enemies: [...state.enemies],
		triggers: [...state.triggers],
		spikeFalling: state.spikeFalling,
		spikeY: state.spikeY,
	}
}
