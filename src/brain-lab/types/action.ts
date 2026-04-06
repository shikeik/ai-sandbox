// ========== 动作/动画类型定义 ==========

import type { Position } from "./position.js"

/** 玩家动作类型 */
export type ActionType = "LEFT" | "RIGHT" | "JUMP" | "WAIT" | "JUMP_LEFT" | "JUMP_RIGHT"

/** 动画事件类型 */
export type AnimationType = 
	| "HERO_MOVE" 
	| "HERO_JUMP" 
	| "HERO_FALL" 
	| "SPIKE_FALL" 
	| "ENEMY_DIE" 
	| "BUTTON_PRESS"
	| "GOAL_REACHED"

/** 动画事件 */
export interface AnimationEvent {
	type: AnimationType
	target: string
	from: Position
	to?: Position
	duration: number
	delay?: number
	payload?: any
}

/** 动作执行结果 */
export interface ActionResult {
	reachedGoal: boolean
	dead: boolean
	animations: AnimationEvent[]
	logs: string[]
	triggeredButton?: boolean
}

/** 动作名称映射（用于显示） */
export const ACTION_NAMES: Record<string, string> = {
	LEFT: "⬅️ 左移",
	RIGHT: "➡️ 右移",
	JUMP: "⬆️ 跳跃",
	WAIT: "⏸️ 等待",
	JUMP_LEFT: "↖️ 向左跳",
	JUMP_RIGHT: "↗️ 向右跳",
}
