// ========== Brain Lab API 响应类型定义 ==========

import type { WorldState, Position, AnimationEvent, BrainDecision } from "./index.js"

/** 基础 API 响应 */
export interface APIResponse {
	type: string
	step?: number
}

/** 状态查询响应 */
export interface APIStateResponse {
	timestamp: number
	step: number
	hero: Position
	enemies: Position[]
	triggers: boolean[]
	spikes: {
		x: number
		initialY: number
		currentY: number
		falling: boolean
		triggered: boolean
		buttonX: number
		buttonY: number
	}[]
	gridVisual: string[]
	gridRaw: number[][]
}

/** AI 单步执行响应 */
export interface APIStepResponse extends APIResponse {
	type: "AI_STEP"
	decision: {
		action: string
		reasoning: string
		imaginations: {
			action: string
			predictedPos: Position
			predictedReward: number
			killedEnemy: boolean
		}[]
	}
	animations: AnimationEvent[]
	result: {
		newPos: Position
		enemiesRemaining: number
		reachedGoal: boolean
		triggered: boolean[]
		dead: boolean
	}
}

/** 手动移动响应 */
export interface APIMoveResponse extends APIResponse {
	type: "MANUAL_MOVE"
	action: string
	from: Position
	to: Position
	animations: AnimationEvent[]
	result: {
		enemiesRemaining: number
		triggeredButton: boolean
		reachedGoal: boolean
		dead: boolean
	}
}

/** 重置响应 */
export interface APIResetResponse extends APIResponse {
	type: "RESET"
	state: APIStateResponse
}

/** 思考模式响应 */
export interface APIThinkResponse extends APIResponse {
	type: "THINK_ONLY"
	currentPos: Position
	decision: {
		selected: string
		reasoning: string
		allOptions: {
			action: string
			predictedPos: Position
			predictedReward: number
			killedEnemy: boolean
		}[]
	}
}

/** 设置深度响应 */
export interface APISetDepthResponse {
	type: "SET_DEPTH"
	depth: number
	ok: boolean
}

/** 设置关卡响应 */
export interface APISetLevelResponse {
	type: "SET_LEVEL"
	level: string
	ok: boolean
}

/** 日志响应 */
export interface APILogsResponse {
	logs: Array<{
		time: string
		tag: string
		msg: string
	}>
}

/** 清除日志响应 */
export interface APIClearLogsResponse {
	cleared: boolean
}

/** 错误响应 */
export interface APIErrorResponse {
	error: string
}
