// ========== 学习器测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import {
	ExperienceDB,
	RuleDB,
	extractRuleFromExperience
} from "../../../src/causal-ai/core/ai/learner.js"
import type { Experience, Rule } from "../../../src/causal-ai/core/ai/types.js"

function makeExperience(action: string, before: string[], after: string[]): Experience {
	return {
		before: new Set(before),
		action: action as Experience["action"],
		after: new Set(after)
	}
}

describe("ExperienceDB", () => {
	it("应添加并查询经验", () => {
		const db = new ExperienceDB()
		const exp = makeExperience("右", ["at(agent,0,0)"], ["at(agent,1,0)"])
		db.add(exp)
		assert.strictEqual(db.getAll().length, 1)
		assert.deepStrictEqual(db.getByAction("右"), [exp])
	})

	it("clear 后应为空", () => {
		const db = new ExperienceDB()
		db.add(makeExperience("右", [], []))
		db.clear()
		assert.strictEqual(db.getAll().length, 0)
	})
})

describe("RuleDB", () => {
	it("应添加并查询规则", () => {
		const db = new RuleDB()
		const rule: Rule = {
			action: "右",
			preconditions: new Set(["at(agent,0,0)"]),
			effects: { add: new Set(["at(agent,1,0)"]), remove: new Set(["at(agent,0,0)"]) }
		}
		db.add(rule)
		assert.strictEqual(db.getAll().length, 1)
	})

	it("相同规则不应重复添加", () => {
		const db = new RuleDB()
		const rule: Rule = {
			action: "右",
			preconditions: new Set(),
			effects: { add: new Set(["a"]), remove: new Set() }
		}
		db.add(rule)
		db.add(rule)
		assert.strictEqual(db.getAll().length, 1)
	})
})

describe("extractRuleFromExperience", () => {
	it("应提取移动类规则", () => {
		const exp = makeExperience(
			"右",
			["at(agent,0,0)", "cell_empty(1,0)", "facing(右)"],
			["at(agent,1,0)", "cell_empty(0,0)", "facing(右)"]
		)
		const rule = extractRuleFromExperience(exp)
		assert.strictEqual(rule.action, "右")
		assert.ok(rule.preconditions.has("at(agent,0,0)"))
		assert.ok(rule.preconditions.has("cell_empty(1,0)"))
		assert.ok(rule.effects.add.has("at(agent,1,0)"))
		assert.ok(rule.effects.remove.has("at(agent,0,0)"))
	})

	it("应提取交互类规则", () => {
		const exp = makeExperience(
			"互",
			["at(agent,1,1)", "at(key,1,1)", "holding(none)"],
			["at(agent,1,1)", "holding(key)"]
		)
		const rule = extractRuleFromExperience(exp)
		assert.strictEqual(rule.action, "互")
		assert.ok(rule.effects.add.has("holding(key)"))
		assert.ok(rule.effects.remove.has("holding(none)"))
	})
})
