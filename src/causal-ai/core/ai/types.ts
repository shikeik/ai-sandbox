// ========== AI 类型定义 ==========

import type { Action } from "../world/types"

// 谓词：描述世界状态的原子事实
// 例如: "at(agent,1,1)", "cell_empty(2,1)", "holding(key)"
export type Predicate = string

// 状态：谓词的集合
export type State = Set<Predicate>

// 经验：一次动作的执行记录
export interface Experience {
	before: State      // 动作前的状态
	action: Action     // 执行的动作
	after: State       // 动作后的状态
}

// 规则：泛化后的因果知识
export interface Rule {
	action: Action
	preconditions: State    // 前提条件（谓词集合）
	effects: {
		add: State          // 新增的事实
		remove: State       // 删除的事实
	}
}

// 目标：AI 要达成的状态
export interface Goal {
	predicates: State   // 目标谓词集合
}

// 计划：动作序列
export type Plan = Action[]

// 规划结果
export interface PlanResult {
	success: boolean
	plan?: Plan
	msg: string
}
