// ========== 元归纳器（原型）==========
// 从结构化差异中提取具体规则，并尝试泛化为元规则

import type { StructuredTransition } from "./structured-diff"

// ========== 规则表示 ==========

export interface ConcreteRule {
	action: {
		raw: string           // 原始动作，如 "上"
		type: string          // 抽象类型，如 "move"
		vector: [number, number]
	}
	preconditions: Condition[]
	effects: Effect[]
}

export interface Condition {
	relX: number
	relY: number
	property: string
	value: unknown
}

export interface Effect {
	target: string      // "agent.pos.x" | "agent.pos.y" | "inventory.add" | "inventory.remove"
	delta: unknown
}

export interface MetaRule {
	id: string
	actionPattern: {
		type: string
		vector: [string, string] | [number, number]  // "$dir" 或具体值
	}
	preconditionPattern: MetaCondition[]
	effectPattern: MetaEffect[]
	coverage: string[]    // 覆盖的具体动作名
	confidence: number
}

export interface MetaCondition {
	relX: string   // 如 "$dir.x"
	relY: string   // 如 "$dir.y"
	property: string
	value: unknown
}

export interface MetaEffect {
	target: string   // 如 "agent.pos.$axis"
	delta: unknown
}

// ========== 具体规则归纳 ==========

function vectorToAxis(v: [number, number]): "x" | "y" | null {
	if (v[0] !== 0 && v[1] === 0) return "x"
	if (v[0] === 0 && v[1] !== 0) return "y"
	return null
}

function vectorToDelta(v: [number, number]): number {
	return v[0] !== 0 ? v[0] : v[1]
}

export function induceConcreteRule(trans: StructuredTransition): ConcreteRule | null {
	const moveActions = ["上", "下", "左", "右"] as const
	const isMove = moveActions.includes(trans.action as typeof moveActions[number])

	if (!isMove) return null

	const vector: [number, number] = [trans.agentDelta.dx, trans.agentDelta.dy]
	const axis = vectorToAxis(vector)

	const rule: ConcreteRule = {
		action: {
			raw: trans.action,
			type: "move",
			vector
		},
		preconditions: [],
		effects: []
	}

	// 移动类：前置条件是目标格子的属性
	if (trans.actionContext) {
		rule.preconditions.push({
			relX: trans.actionContext.targetCell.relX,
			relY: trans.actionContext.targetCell.relY,
			property: "walkable",
			value: trans.actionContext.targetCell.walkable
		})
	}

	// 效果：agent 坐标变化
	if (axis) {
		rule.effects.push({
			target: `agent.pos.${axis}`,
			delta: vectorToDelta(vector)
		})
	}

	return rule
}

// ========== 元规则归纳 ==========

function areStructuresCompatible(a: ConcreteRule, b: ConcreteRule): boolean {
	if (a.action.type !== b.action.type) return false
	if (a.preconditions.length !== b.preconditions.length) return false
	if (a.effects.length !== b.effects.length) return false

	// 检查 precondition 的结构是否相同（仅比较 property）
	for (let i = 0; i < a.preconditions.length; i++) {
		if (a.preconditions[i]!.property !== b.preconditions[i]!.property) return false
	}

	// 检查 effect 的 target 是否遵循相同模式（忽略具体 axis）
	for (let i = 0; i < a.effects.length; i++) {
		const ta = a.effects[i]!.target
		const tb = b.effects[i]!.target
		if (ta.startsWith("agent.pos.") && tb.startsWith("agent.pos.")) {
			// 兼容
		} else if (ta !== tb) {
			return false
		}
	}

	return true
}

export function induceMetaRule(rules: ConcreteRule[]): MetaRule | null {
	if (rules.length < 2) return null

	// 先检查是否全部结构兼容
	for (let i = 1; i < rules.length; i++) {
		if (!areStructuresCompatible(rules[0]!, rules[i]!)) return null
	}

	// 生成元规则
	const coverage = rules.map(r => r.action.raw)

	const prePatterns: MetaCondition[] = rules[0]!.preconditions.map(p => ({
		relX: "$dir.x",
		relY: "$dir.y",
		property: p.property,
		value: p.value
	}))

	const effPatterns: MetaEffect[] = rules[0]!.effects.map(e => ({
		target: e.target.replace(/x|y$/, "$axis"),
		delta: "$dir.delta"
	}))

	return {
		id: `meta_${rules[0]!.action.type}_${Date.now()}`,
		actionPattern: {
			type: rules[0]!.action.type,
			vector: ["$dir.x", "$dir.y"]
		},
		preconditionPattern: prePatterns,
		effectPattern: effPatterns,
		coverage,
		confidence: Math.min(1, rules.length / 4)  // 4 个方向为满信心
	}
}

// ========== 基于元规则预测 ==========

export function predictWithMetaRule(
	metaRule: MetaRule,
	targetAction: string,
	directionVector: [number, number]
): { preconditions: Condition[]; effects: Effect[] } | null {
	if (!metaRule.coverage.includes(targetAction) && metaRule.confidence < 1) {
		// 对于未覆盖的方向，尝试泛化预测
	}

	const axis = vectorToAxis(directionVector)
	if (!axis) return null

	const delta = vectorToDelta(directionVector)

	return {
		preconditions: metaRule.preconditionPattern.map(p => ({
			relX: directionVector[0],
			relY: directionVector[1],
			property: p.property,
			value: p.value
		})),
		effects: metaRule.effectPattern.map(e => ({
			target: e.target.replace("$axis", axis),
			delta: e.delta === "$dir.delta" ? delta : e.delta
		}))
	}
}
