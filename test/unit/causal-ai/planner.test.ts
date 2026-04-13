// ========== 规划器测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { plan } from "../../../src/causal-ai/core/ai/planner.js"
import type { State, Rule } from "../../../src/causal-ai/core/ai/types.js"

function makeState(...preds: string[]): State {
	return new Set(preds)
}

function makeRule(
	action: string,
	preconditions: string[],
	add: string[],
	remove: string[]
): Rule {
	return {
		action: action as Rule["action"],
		preconditions: new Set(preconditions),
		effects: {
			add: new Set(add),
			remove: new Set(remove)
		}
	}
}

describe("planner", () => {
	describe("基础规划", () => {
		it("应找到单步路径", () => {
			const initial = makeState("at(agent,0,0)", "facing(右)", "cell_empty(1,0)")
			const goal = makeState("at(agent,1,0)")
			const rules: Rule[] = [
				makeRule("右", ["at(agent,0,0)", "cell_empty(1,0)"], ["at(agent,1,0)"], ["at(agent,0,0)"])
			]

			const result = plan(initial, goal, rules, 10)
			assert.ok(result.success)
			assert.deepStrictEqual(result.plan, ["右"])
		})

		it("应找到多步路径", () => {
			const initial = makeState(
				"at(agent,0,0)", "facing(右)",
				"cell_empty(1,0)", "cell_empty(2,0)"
			)
			const goal = makeState("at(agent,2,0)")
			const rules: Rule[] = [
				makeRule("右", ["at(agent,0,0)", "cell_empty(1,0)"], ["at(agent,1,0)"], ["at(agent,0,0)"]),
				makeRule("右", ["at(agent,1,0)", "cell_empty(2,0)"], ["at(agent,2,0)"], ["at(agent,1,0)"])
			]

			const result = plan(initial, goal, rules, 10)
			assert.ok(result.success)
			assert.deepStrictEqual(result.plan, ["右", "右"])
		})

		it("目标已达成时应返回空计划", () => {
			const initial = makeState("at(agent,0,0)", "holding(key)")
			const goal = makeState("holding(key)")
			const result = plan(initial, goal, [], 10)
			assert.ok(result.success)
			assert.deepStrictEqual(result.plan, [])
		})
	})

	describe("边界情况", () => {
		it("无可用规则时应返回失败", () => {
			const initial = makeState("at(agent,0,0)")
			const goal = makeState("at(agent,1,0)")
			const result = plan(initial, goal, [], 10)
			assert.ok(!result.success)
		})

		it("超过最大深度时应返回失败", () => {
			const initial = makeState("at(agent,0,0)", "cell_empty(1,0)")
			const goal = makeState("at(agent,2,0)")
			const rules: Rule[] = [
				makeRule("右", ["at(agent,0,0)", "cell_empty(1,0)"], ["at(agent,1,0)"], ["at(agent,0,0)"])
			]

			const result = plan(initial, goal, rules, 1)
			assert.ok(!result.success)
		})

		it("应避免循环状态", () => {
			const initial = makeState("at(agent,0,0)")
			const goal = makeState("at(agent,1,0)")
			const rules: Rule[] = [
				makeRule("左", ["at(agent,0,0)"], ["at(agent,0,0)"], ["at(agent,0,0)"])
			]

			const result = plan(initial, goal, rules, 10)
			assert.ok(!result.success)
		})
	})
})
