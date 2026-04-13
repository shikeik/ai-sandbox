// ========== 位置与方向工具函数 ==========

import type { Action } from "../world/types"
import type { Position } from "../world/types"
import type { State } from "../ai/types"
import { MOVE_ACTIONS } from "../constants"

/**
 * 判断动作是否为移动类动作
 */
export function isMoveAction(action: string): action is Action {
	return MOVE_ACTIONS.includes(action as (typeof MOVE_ACTIONS)[number])
}

/**
 * 获取动作对应的方向偏移量
 */
export function getDirectionDelta(action: Action): [number, number] {
	switch (action) {
	case "上": return [0, -1]
	case "下": return [0, 1]
	case "左": return [-1, 0]
	case "右": return [1, 0]
	case "等":
	case "互":
	default:
		return [0, 0]
	}
}

/**
 * 将方向偏移应用到位置上
 */
export function applyDirection(pos: Position, action: Action): Position {
	const [dx, dy] = getDirectionDelta(action)
	return { x: pos.x + dx, y: pos.y + dy }
}

/**
 * 从状态中提取玩家当前位置
 */
export function getAgentPos(state: State): Position | null {
	for (const p of state) {
		if (p.startsWith("at(agent,")) {
			const match = p.match(/at\(agent,(-?\d+),(-?\d+)\)/)
			if (match) {
				return { x: Number(match[1]), y: Number(match[2]) }
			}
		}
	}
	return null
}
