// ========== 规划器：BFS 正向搜索 ==========

import type { State, Rule, PlanResult, Plan } from "./types"
import type { Action } from "../types"

/**
 * 应用规则到状态，返回新状态
 */
function applyRule(state: State, rule: Rule): State {
	const newState = new Set(state)

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
 * 简化版：检查所有前提是否都在当前状态中
 */
function canApply(state: State, rule: Rule): boolean {
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
	maxDepth: number = 10
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
 * - "去 2,0"         → 解析为 at(agent,2,0)
 */
export function parseGoal(input: string): State | null {
	const predicates = new Set<string>()

	// 尝试解析 "去 x,y"
	const goMatch = input.match(/去\s*(\d+)\s*,\s*(\d+)/)
	if (goMatch) {
		const x = Number(goMatch[1])
		const y = Number(goMatch[2])
		// 转换为相对坐标（需要知道当前位置，这里简化处理）
		// 实际应该由调用者处理绝对坐标到相对坐标的转换
		predicates.add(`at(agent,${x},${y})`)
		return predicates
	}

	// 尝试直接解析谓词
	if (input.includes("(")) {
		predicates.add(input.trim())
		return predicates
	}

	return null
}
