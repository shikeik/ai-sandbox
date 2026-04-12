// ========== 因果链 AI - 动作系统 ==========

import type { GameState, ActionType, Direction, Position } from "./types"
import { WORLD_CONFIG, DIRECTION_DELTA, ACTION_TO_DIRECTION } from "./config"

// 检查位置是否在边界内
function isInBounds(pos: Position): boolean {
	return (
		pos.x >= 0 &&
		pos.x < WORLD_CONFIG.gridSize &&
		pos.y >= 0 &&
		pos.y < WORLD_CONFIG.gridSize
	)
}

// 检查位置是否是墙
function isWall(pos: Position): boolean {
	return WORLD_CONFIG.walls.has(`${pos.x},${pos.y}`)
}

// 检查位置是否是门
function isDoor(pos: Position): boolean {
	return pos.x === WORLD_CONFIG.doorPos.x && pos.y === WORLD_CONFIG.doorPos.y
}

// 检查位置是否是钥匙
function isKey(pos: Position): boolean {
	return pos.x === WORLD_CONFIG.keyPos.x && pos.y === WORLD_CONFIG.keyPos.y
}

// 计算新位置
function calculateNewPosition(pos: Position, dir: Direction): Position {
	const delta = DIRECTION_DELTA[dir]
	return {
		x: pos.x + delta.x,
		y: pos.y + delta.y
	}
}

// 移动动作（纯函数）
function applyMove(state: GameState, dir: Direction): GameState {
	const newPos = calculateNewPosition(state.agent, dir)

	// 边界检查
	if (!isInBounds(newPos)) {
		return state
	}

	// 墙检查
	if (isWall(newPos)) {
		return state
	}

	// 门检查
	if (isDoor(newPos)) {
		// 门关着且手持钥匙，可以开门并进入
		if (!state.doorOpen && state.holding === "key") {
			return {
				...state,
				agent: newPos,
				doorOpen: true
			}
		}
		// 门关着且没钥匙，不能通过
		if (!state.doorOpen) {
			return state
		}
		// 门开着，可以通过
		return {
			...state,
			agent: newPos
		}
	}

	// 普通移动
	return {
		...state,
		agent: newPos
	}
}

// 拾取动作（纯函数）
function applyPickup(state: GameState): GameState {
	// 必须有钥匙且站在钥匙位置且手中为空
	if (
		state.keyExists &&
		isKey(state.agent) &&
		state.holding === null
	) {
		return {
			...state,
			holding: "key",
			keyExists: false
		}
	}
	return state
}

// 应用动作（纯函数，无副作用）
export function applyAction(state: GameState, action: ActionType): GameState {
	if (action === "pickup") {
		return applyPickup(state)
	}

	// 移动动作
	const dir = ACTION_TO_DIRECTION[action] as Direction | undefined
	if (dir) {
		return applyMove(state, dir)
	}

	return state
}

// 检查动作是否会导致状态变化
export function isActionValid(state: GameState, action: ActionType): boolean {
	const newState = applyAction(state, action)
	return JSON.stringify(state) !== JSON.stringify(newState)
}

// 获取所有可能的动作
export function getAllActions(): ActionType[] {
	return ["move_up", "move_down", "move_left", "move_right", "pickup"]
}

// 从方向获取动作
export function getActionFromDirection(dir: Direction): ActionType {
	return `move_${dir}` as ActionType
}
