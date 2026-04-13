// ========== 统一指令执行器 ==========
// 封装动作执行 + 经验记录 + 规则提取的完整流程
// DRY: CLI 和 Web 共用此逻辑

import type { Action, ActionResult } from "../../meta-gridworld/types"
import type { ExperienceDB, RuleDB } from "./learner"
import { extractRuleFromExperience } from "./learner"
import type { Experience } from "./types"
import type { WorldLike } from "../../agent-api/types"

// 执行上下文
export interface ExecuteContext {
	world: WorldLike
	expDB: ExperienceDB
	ruleDB: RuleDB
}

// 完整执行结果
export interface FullExecuteResult extends ActionResult {
	experience?: Experience
}

/**
 * 执行动作并自动记录经验、提取规则
 *
 * 统一的执行流程：
 * 1. 获取当前状态（before）
 * 2. 执行动作
 * 3. 获取新状态（after）
 * 4. 如果成功，记录经验并提取规则
 *
 * 使用场景：
 * - CLI 的学习模式
 * - Web 版的动作执行
 * - 规划的自动执行
 */
export function executeWithLearning(
	ctx: ExecuteContext,
	action: Action
): FullExecuteResult {
	const { world, expDB, ruleDB } = ctx

	// 1. 获取当前状态
	const beforeState = world.getCurrentState()

	// 2. 执行动作
	const { result } = world.execute(action)

	// 3. 获取新状态
	const afterState = world.getCurrentState()

	// 4. 如果动作成功，记录经验和规则
	if (result.success) {
		const experience: Experience = {
			before: beforeState,
			action,
			after: afterState
		}

		// 记录经验
		expDB.add(experience)

		// 提取并添加规则
		const rule = extractRuleFromExperience(experience)
		ruleDB.add(rule)

		return {
			...result,
			experience
		}
	}

	return result
}

/**
 * 仅执行动作，不记录经验
 *
 * 使用场景：
 * - 规划的自动执行（不重复记录经验）
 * - 测试动作效果
 */
export function executeOnly(
	world: WorldLike,
	action: Action
): ActionResult {
	const { result } = world.execute(action)
	return result
}
