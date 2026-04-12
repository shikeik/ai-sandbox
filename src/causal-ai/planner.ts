// ========== 因果链 AI - 规划器 ==========

import type { GameState, ActionType } from "./types"
import { WORLD_CONFIG } from "./config"
import { applyAction, getAllActions } from "./actions"
import { getStateKey } from "./knowledge"
import { PLANNER_CONFIG } from "./config"

// 规划节点
interface PlanNode {
	state: GameState
	path: ActionType[]
}

// 规划器类
export class Planner {
	private goalPos = WORLD_CONFIG.flagPos

	// 设置目标位置
	setGoal(pos: { x: number; y: number }): void {
		this.goalPos = pos
	}

	// BFS 正向搜索规划
	plan(startState: GameState): ActionType[] {
		// 已在目标位置
		if (
			startState.agent.x === this.goalPos.x &&
			startState.agent.y === this.goalPos.y
		) {
			return []
		}

		const visited = new Set<string>()
		const queue: PlanNode[] = [{ state: startState, path: [] }]

		visited.add(getStateKey(startState))

		while (queue.length > 0) {
			const { state, path } = queue.shift()!

			// 检查是否到达目标
			if (
				state.agent.x === this.goalPos.x &&
				state.agent.y === this.goalPos.y
			) {
				return path
			}

			// 深度限制
			if (path.length >= PLANNER_CONFIG.maxDepth) {
				continue
			}

			// 探索所有可能的动作
			const actions = getAllActions()
			for (const action of actions) {
				const newState = applyAction(state, action)

				// 检查是否产生了状态变化
				const changed =
					JSON.stringify(state) !== JSON.stringify(newState)

				if (changed) {
					const key = getStateKey(newState)
					if (!visited.has(key)) {
						visited.add(key)
						queue.push({
							state: newState,
							path: [...path, action]
						})
					}
				}
			}
		}

		// 未找到路径
		return []
	}

	// 获取规划的日志信息
	getPlanInfo(startState: GameState, plan: ActionType[]): string {
		if (plan.length === 0) {
			if (
				startState.agent.x === this.goalPos.x &&
				startState.agent.y === this.goalPos.y
			) {
				return "已在目标位置"
			}
			return "未找到路径"
		}
		return `路径: ${plan.join(" → ")}`
	}
}
