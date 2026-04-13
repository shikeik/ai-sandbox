// ========== 统一指令执行器 ==========
// 支持所有 CLI 风格指令的单段式执行
// 例: "学 上", "规 at(agent,3,0)", "选 obstacle"

import type { Action } from "../../meta-gridworld/types"
import type { ExperienceDB, RuleDB } from "./learner"
import { executeWithLearning, executeOnly } from "./executor"
import { plan, parseGoal } from "./planner"
import { PLANNER_MAX_DEPTH } from "../constants"
import type { WorldLike } from "../../agent-api/types"

// 指令执行上下文
export interface CommandContext {
	world: WorldLike
	expDB: ExperienceDB
	ruleDB: RuleDB
	// 计划操作接口（取代直接操作数组）
	getPlanLength: () => number
	getPlanSnapshot: () => Action[]
	setPlan: (actions: Action[]) => void
	clearPlan: () => void
	shiftPlan: () => Action | null
	// 回调函数
	onSwitchMap?: (mapId: string) => void
	onRender?: () => void
	onLog?: (msg: string) => void
	onPlanUpdate?: (plan: Action[]) => void
}

// 指令执行结果
export interface CommandResult {
	success: boolean
	msg: string
	terminate?: boolean
	// 是否更新了计划
	planUpdated?: boolean
	newPlan?: Action[]
}

/**
 * 解析并执行单条指令
 *
 * 支持的指令格式：
 * - 移动: 上, 下, 左, 右
 * - 互动: 互
 * - 等待: 等
 * - 学习: 学 <动作>  (例: 学 上)
 * - 规划: 规 <目标>  (例: 规 at(agent,3,0))
 * - 执行: 执         (执行计划的下一步)
 * - 地图: 图, 全
 * - 切换: 选 <地图ID> (例: 选 obstacle)
 * - 帮助: 帮助, help, ?
 */
export function executeCommand(
	ctx: CommandContext,
	command: string
): CommandResult {
	const { world, expDB, ruleDB, getPlanLength, getPlanSnapshot, setPlan, clearPlan, shiftPlan } = ctx
	const cmd = command.trim()

	if (cmd === "") {
		return { success: false, msg: "空指令" }
	}

	// 解析指令和参数
	const firstSpace = cmd.indexOf(" ")
	const baseCmd = firstSpace > 0 ? cmd.slice(0, firstSpace) : cmd
	const arg = firstSpace > 0 ? cmd.slice(firstSpace + 1).trim() : ""

	// 动作类指令
	if (["上", "下", "左", "右", "互", "等"].includes(baseCmd)) {
		if (world.isTerminated()) {
			return { success: false, msg: "游戏已结束" }
		}

		const action = baseCmd as Action
		const result = world.execute(action)

		if (result.result.terminate) {
			return {
				success: true,
				msg: `${result.result.msg} (奖励: ${result.result.reward})\n✅ 游戏通关！`,
				terminate: true
			}
		}

		return {
			success: true,
			msg: `${result.result.msg} (奖励: ${result.result.reward})`
		}
	}

	// 学习指令: 学 <动作>
	if (baseCmd === "学") {
		if (!arg) {
			return { success: false, msg: "用法: 学 <动作>\n例: 学 上" }
		}

		const action = arg as Action
		if (!["上", "下", "左", "右", "互", "等"].includes(action)) {
			return { success: false, msg: `无效动作: ${arg}` }
		}

		const result = executeWithLearning({ world, expDB, ruleDB }, action)

		let msg = `${result.msg} (奖励: ${result.reward})`
		if (result.experience) {
			msg += `\n📚 经验+1, 规则库: ${ruleDB.getAll().length} 条`
		}

		return { success: true, msg }
	}

	// 规划指令: 规 <目标>
	if (baseCmd === "规") {
		if (!arg) {
			return { success: false, msg: "用法: 规 <目标谓词>\n例: 规 at(agent,3,0)" }
		}

		const goal = parseGoal(arg)
		if (!goal) {
			return { success: false, msg: `无法解析目标: ${arg}` }
		}

		const rules = ruleDB.getAll()
		if (rules.length === 0) {
			return { success: false, msg: "规则库为空，请先学习 (例: 学 上)" }
		}

		const planResult = plan(
			world.getCurrentState(),
			goal,
			rules,
			PLANNER_MAX_DEPTH
		)

		if (planResult.success && planResult.plan) {
			// 更新计划
			setPlan(planResult.plan)
			ctx.onPlanUpdate?.(planResult.plan)

			return {
				success: true,
				msg: `${planResult.msg}\n计划: ${planResult.plan.join(" → ")}`,
				planUpdated: true,
				newPlan: planResult.plan
			}
		}

		return { success: false, msg: planResult.msg }
	}

	// 执行指令: 执
	if (baseCmd === "执") {
		if (getPlanLength() === 0) {
			return { success: false, msg: "没有待执行的计划，请先规划 (例: 规 at(agent,3,0))" }
		}

		const action = shiftPlan()
		if (!action) {
			return { success: false, msg: "没有待执行的计划" }
		}

		const result = executeOnly(world, action)

		const remaining = getPlanLength()
		ctx.onPlanUpdate?.(getPlanSnapshot())

		let msg = `▶️ 执行: ${action} (剩余 ${remaining} 步)\n${result.msg}`
		if (result.terminate) {
			msg += "\n✅ 游戏通关！"
			clearPlan()
		}

		return {
			success: true,
			msg,
			terminate: result.terminate
		}
	}

	// 地图指令
	if (baseCmd === "图") {
		return { success: true, msg: "[地图信息]" }
	}

	if (baseCmd === "全") {
		return { success: true, msg: "[地图+视野信息]" }
	}

	// 切换地图: 选 <地图ID>
	if (baseCmd === "选") {
		if (!arg) {
			return { success: false, msg: "用法: 选 <地图ID>\n例: 选 obstacle" }
		}

		ctx.onSwitchMap?.(arg)
		return { success: true, msg: `切换地图: ${arg}` }
	}

	// 帮助指令
	if (["帮助", "help", "?"].includes(baseCmd)) {
		return {
			success: true,
			msg: `指令列表:
  上/下/左/右/互/等 - 执行动作
  学 <动作>         - 学习并记录经验 (例: 学 上)
  规 <目标>         - 规划路径 (例: 规 at(agent,3,0))
  执                - 执行计划的下一步
  图/全             - 显示地图/视野
  选 <地图ID>       - 切换地图 (例: 选 obstacle)
  帮助/?            - 显示帮助`
		}
	}

	return { success: false, msg: `未知指令: ${baseCmd}\n输入 "?" 查看帮助` }
}
