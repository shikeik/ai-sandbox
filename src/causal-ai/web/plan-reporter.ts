// ========== 规划报告生成器 ==========
// 纯函数：将规划过程和结果格式化为日志文本行

import type { State, Rule, PlanResult } from "../core"

export interface PlanReportInput {
	currentState: State
	goal: State
	rules: Rule[]
	planResult: PlanResult
	checkRuleApplicable: (state: State, rule: Rule) => boolean
}

/**
 * 生成规划报告的日志文本行数组
 */
export function generatePlanReport(input: PlanReportInput): string[] {
	const { currentState, goal, rules, planResult, checkRuleApplicable } = input
	const lines: string[] = []

	lines.push("=== 规划开始 ===")

	// 当前状态
	lines.push("")
	lines.push("【当前状态】")
	for (const pred of Array.from(currentState).sort()) {
		lines.push(`  ${pred}`)
	}

	// 目标状态
	lines.push("")
	lines.push("【目标状态】")
	for (const pred of Array.from(goal).sort()) {
		lines.push(`  ${pred}`)
	}

	// 知识库
	lines.push("")
	lines.push(`【知识库】 ${rules.length} 条规则`)

	if (rules.length === 0) {
		lines.push("❌ 规则库为空")
		lines.push("💡 请先执行 '学 上/下/左/右/互' 积累经验和规则")
		return lines
	}

	// 规则检查
	lines.push("")
	lines.push("【规则检查】")
	let applicableCount = 0
	for (const rule of rules) {
		const canApply = checkRuleApplicable(currentState, rule)
		const status = canApply ? "✅" : "⛔"
		const preStr = Array.from(rule.preconditions).join(", ") || "无前提"
		const addStr = Array.from(rule.effects.add).join(", ") || "无添加"
		lines.push(`  ${status} ${rule.action}: ${preStr} → ${addStr}`)
		if (canApply) applicableCount++
	}
	lines.push(`  当前可应用: ${applicableCount}/${rules.length} 条`)

	// 规划搜索
	lines.push("")
	lines.push("【规划搜索】")

	if (planResult.success && planResult.plan) {
		lines.push(`✅ ${planResult.msg}`)
		lines.push("")
		lines.push("【执行计划】")
		for (let i = 0; i < planResult.plan.length; i++) {
			lines.push(`  ${i + 1}. ${planResult.plan[i]}`)
		}
		lines.push("")
		lines.push("💡 输入 '执' 执行下一步")
	} else {
		lines.push(`❌ ${planResult.msg}`)
		lines.push("")
		lines.push("【失败分析】")
		lines.push("可能原因:")
		lines.push("  1. 缺少到达目标位置的经验")
		lines.push("  2. 路径被阻挡（门未开/有墙）")
		lines.push("  3. 需要先获取钥匙才能通过门")
		lines.push("")
		lines.push("💡 尝试执行 '学 右' 移动到目标位置，再规划回来")
	}

	return lines
}
