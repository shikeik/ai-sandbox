// ========== 因果链 AI - 游戏配置 ==========

import type { Position, WorldConfig } from "./types"

// 网格配置
export const GRID_SIZE = 10
export const CELL_SIZE = 40

// 地图元素位置
export const KEY_POS: Position = { x: 1, y: 8 }
export const DOOR_POS: Position = { x: 3, y: 5 }
export const FLAG_POS: Position = { x: 9, y: 0 }

// 墙壁生成 - 垂直墙壁在 x=3，y=0~9，但门位置留空
function createWalls(): Set<string> {
	const walls = new Set<string>()
	for (let y = 0; y < GRID_SIZE; y++) {
		walls.add(`3,${y}`)
	}
	// 门位置不是墙
	walls.delete(`${DOOR_POS.x},${DOOR_POS.y}`)
	return walls
}

// 世界配置对象
export const WORLD_CONFIG: WorldConfig = {
	gridSize: GRID_SIZE,
	cellSize: CELL_SIZE,
	walls: createWalls(),
	keyPos: KEY_POS,
	doorPos: DOOR_POS,
	flagPos: FLAG_POS
}

// 移动方向映射
export const DIRECTION_DELTA: Record<string, Position> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 }
}

// 动作到方向的映射
export const ACTION_TO_DIRECTION: Record<string, string> = {
	move_up: "up",
	move_down: "down",
	move_left: "left",
	move_right: "right"
}

// 探索配置
export const EXPLORE_CONFIG = {
	steps: 10,
	intervalMs: 80
} as const

// 规划配置
export const PLANNER_CONFIG = {
	maxDepth: 30, // 足够从起点到终点: 到钥匙9 + 拾取1 + 回门4 + 开门1 + 到终点11 = 26
	executionDelayMs: 150
} as const

// 初始玩家位置
export const INITIAL_AGENT_POS: Position = { x: 0, y: 0 }
