// ========== 关卡加载与解析 ==========

import type { LevelData, WorldState, Position, SpikeState } from "../types/index.js"
import { Element } from "../types/index.js"
import { DEFAULT_LEVEL_MAP, ADVANCED_LEVEL_MAP, CHAR_MAP, SPECIAL_CHARS } from "../config.js"

/** 当前使用的关卡 */
let currentLevel: LevelData = DEFAULT_LEVEL_MAP

/**
 * 设置当前关卡
 */
export function setCurrentLevel(level: LevelData): void {
	currentLevel = level
}

/**
 * 获取当前关卡
 */
export function getCurrentLevel(): LevelData {
	return currentLevel
}

/**
 * 从关卡数据创建初始世界状态
 * 使用 map 实际尺寸作为世界宽高，配置值仅作后备
 */
export function createStateFromLevel(level: LevelData = currentLevel): WorldState {
	const { map } = level
	const height = map.length
	const width = height > 0 ? map[0].length : 0
	const grid: number[][] = Array(height).fill(0).map(() =>
		Array(width).fill(Element.AIR)
	)

	let hero: Position = { x: 1, y: 1 }
	const enemies: Position[] = []
	const spikes: SpikeState[] = []
	const buttons: Position[] = []  // 记录按钮位置，用于建立对应关系

	// 第一遍扫描：收集所有元素位置
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
			// 尖刺位置（从顶层开始找）
			else if (char === "＾") {
				spikes.push({
					x,
					initialY: y,
					currentY: y,
					falling: false,
					triggered: false,
					buttonX: x,  // 临时值，后续绑定按钮时更新
					buttonY: y
				})
				grid[y][x] = CHAR_MAP[char] ?? Element.SPIKE
			}
			// 按钮位置（记录用于建立对应关系）
			else if (char === "！") {
				buttons.push({ x, y })
				grid[y][x] = CHAR_MAP[char] ?? Element.BUTTON
			}
			// 其他格子使用 CHAR_MAP 映射
			else if (char in CHAR_MAP) {
				grid[y][x] = CHAR_MAP[char]
			}
			// 未识别字符保持为 AIR
		}
	}

	// 如果没有找到尖刺，添加默认尖刺
	if (spikes.length === 0) {
		spikes.push({ x: 4, initialY: 4, currentY: 4, falling: false, triggered: false, buttonX: 2, buttonY: 2 })
	}

	// 按钮和尖刺按x坐标排序后建立对应关系
	// 每个尖刺绑定到对应按钮的坐标（用于颜色计算）
	buttons.sort((a, b) => a.x - b.x)
	spikes.sort((a, b) => a.x - b.x)

	// 为尖刺添加绑定的按钮坐标
	spikes.forEach((spike, index) => {
		const button = buttons[index]
		if (button) {
			spike.buttonX = button.x
			spike.buttonY = button.y
		} else {
			// 备用：使用自己的坐标
			spike.buttonX = spike.x
			spike.buttonY = spike.initialY
		}
	})

	return {
		grid,
		hero,
		enemies,
		triggers: buttons.map(() => false),  // 每个按钮一个触发状态
		spikes,
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
		spikes: state.spikes.map(s => ({ ...s })),
	}
}
