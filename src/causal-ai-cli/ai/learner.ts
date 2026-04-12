// ========== 学习器：经验 → 规则 ==========

import type { Experience, Rule, State, Predicate } from "./types"
import type { Action } from "../types"

/**
 * 经验库：存储所有观察到的经验
 */
export class ExperienceDB {
	private experiences: Experience[] = []

	add(exp: Experience): void {
		this.experiences.push(exp)
	}

	getAll(): Experience[] {
		return [...this.experiences]
	}

	// 获取特定动作的所有经验
	getByAction(action: Action): Experience[] {
		return this.experiences.filter(e => e.action === action)
	}

	clear(): void {
		this.experiences = []
	}
}

/**
 * 从单条经验提取规则（最简单版本）
 * 直接将 before/after 的差异作为规则
 */
export function extractRuleFromExperience(exp: Experience): Rule {
	const { before, after, action } = exp

	// 计算差异
	const add = new Set<Predicate>()
	const remove = new Set<Predicate>()

	// 在 after 中但不在 before 中 → 新增
	for (const p of after) {
		if (!before.has(p)) {
			add.add(p)
		}
	}

	// 在 before 中但不在 after 中 → 删除
	for (const p of before) {
		if (!after.has(p)) {
			remove.add(p)
		}
	}

	return {
		action,
		preconditions: new Set(before),  // 简化为整个 before 状态
		effects: { add, remove }
	}
}

/**
 * 规则库
 */
export class RuleDB {
	private rules: Rule[] = []

	add(rule: Rule): void {
		// 简单去重：相同动作且效果相同的规则不重复添加
		const exists = this.rules.some(r => 
			r.action === rule.action &&
			setsEqual(r.effects.add, rule.effects.add) &&
			setsEqual(r.effects.remove, rule.effects.remove)
		)
		if (!exists) {
			this.rules.push(rule)
		}
	}

	getAll(): Rule[] {
		return [...this.rules]
	}

	// 获取特定动作的所有规则
	getByAction(action: Action): Rule[] {
		return this.rules.filter(r => r.action === action)
	}

	clear(): void {
		this.rules = []
	}
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
	if (a.size !== b.size) return false
	for (const item of a) {
		if (!b.has(item)) return false
	}
	return true
}
