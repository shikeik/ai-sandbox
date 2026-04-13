// ========== Agent API 类型定义 ==========

import type { Action, ActionResult, AgentState, LocalView } from "../meta-gridworld/types"
import type { State } from "../core/ai/types"

export interface Observation {
	agent: AgentState
	localView: LocalView
	lastResult: ActionResult
	stepCount: number
}

/**
 * WorldLike 接口：抽象 World 和 AgentAPI 的公共能力
 * 让 executor.ts 和 command-executor.ts 可以同时接受两者
 */
export interface WorldLike {
	execute(action: Action): { result: ActionResult; view: LocalView }
	getCurrentState(): State
	getAgentState(): AgentState
	getLocalView(range?: number): LocalView
	isTerminated(): boolean
}
