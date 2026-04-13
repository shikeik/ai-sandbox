// ========== 规划器：BFS 正向搜索 ==========

import type { State, Rule, PlanResult, Plan } from "./types"
import { isMoveAction, getAgentPos, applyDirection } from "../utils/position"
import { PLANNER_MAX_DEPTH } from "../constants"

/**
 * 应用规则到状态，返回新状态
 */
function applyRule(state: State, rule: Rule): State {
	const newState = new Set(state)
	
	// 移动类动作的特殊处理：更新玩家位置
	if (isMoveAction(rule.action)) {
		const pos = getAgentPos(state)
		if (pos) {
			const newPos = applyDirection(pos, rule.action)

			// 删除旧位置，添加新位置
			newState.delete(`at(agent,${pos.x},${pos.y})`)
			newState.add(`at(agent,${newPos.x},${newPos.y})`)

			// 更新面朝方向
			for (const p of Array.from(newState)) {
				if (p.startsWith("facing(")) {
					newState.delete(p)
				}
			}
			newState.add(`facing(${rule.action})`)
		}

		return newState
	}

	// 非移动类动作：直接应用效果
	// 删除效果
	for (const p of rule.effects.remove) {
		newState.delete(p)
	}

	// 添加效果
	for (const p of rule.effects.add) {
		newState.add(p)
	}

	return newState
}

/**
 * 检查规则是否可应用（前提条件满足）
 * 
 * 对于移动类动作：检查当前位置和面朝方向是否匹配规则中的相对变化
 * 简化策略：检查是否有 at(agent,...) 和 facing(...)，以及目标方向是否为空
 */
function canApply(state: State, rule: Rule): boolean {
	// 移动类规则的特殊处理：只要当前状态有玩家位置，且目标方向可行
	if (isMoveAction(rule.action)) {
		const pos = getAgentPos(state)
		if (!pos) return false

		const target = applyDirection(pos, rule.action)
		return state.has(`cell_empty(${target.x},${target.y})`)
	}
	
	// 非移动类动作：严格检查所有前提
	for (const pre of rule.preconditions) {
		if (!state.has(pre)) {
			return false
		}
	}
	return true
}

/**
 * 检查是否达到目标
 */
function isGoalReached(state: State, goal: State): boolean {
	for (const g of goal) {
		if (!state.has(g)) {
			return false
		}
	}
	return true
}

/**
 * BFS 规划
 * 
 * 从当前状态出发，尝试所有可能的动作，找到一条到达目标状态的路径
 */
export function plan(
	initialState: State,
	goal: State,
	rules: Rule[],
	maxDepth: number = PLANNER_MAX_DEPTH
): PlanResult {
	// BFS 队列：每个元素是 [当前状态, 动作序列]
	const queue: Array<[State, Plan]> = [[initialState, []]]
	const visited = new Set<string>()

	visited.add(stateToKey(initialState))

	while (queue.length > 0) {
		const [currentState, plan] = queue.shift()!

		// 检查是否达到目标
		if (isGoalReached(currentState, goal)) {
			return { success: true, plan, msg: `找到计划，长度 ${plan.length}` }
		}

		// 超过最大深度
		if (plan.length >= maxDepth) {
			continue
		}

		// 尝试所有规则
		for (const rule of rules) {
			if (canApply(currentState, rule)) {
				const newState = applyRule(currentState, rule)
				const stateKey = stateToKey(newState)

				// 避免重复访问
				if (!visited.has(stateKey)) {
					visited.add(stateKey)
					queue.push([newState, [...plan, rule.action]])
				}
			}
		}
	}

	return { success: false, msg: "未找到计划" }
}

/**
 * 将状态转换为字符串键（用于去重）
 */
function stateToKey(state: State): string {
	return Array.from(state).sort().join("|")
}

/**
 * 解析目标字符串为谓词集合
 * 
 * 支持格式:
 * - "at(agent,2,0)"  → 单谓词
 * - "holding(key)"   → 持有状态
 */
export function parseGoal(input: string): State | null {
	const predicates = new Set<string>()

	// 直接解析谓词格式
	if (input.includes("(")) {
		predicates.add(input.trim())
		return predicates
	}

	return null
}
