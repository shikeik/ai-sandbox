// ========== 指令执行器测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { executeCommand } from "../../../src/causal-ai/core/ai/command-executor.js"
import { World } from "../../../src/causal-ai/core/world/world.js"
import { ExperienceDB, RuleDB } from "../../../src/causal-ai/core/ai/learner.js"
import type { MapData } from "../../../src/causal-ai/core/world/types.js"
import type { CommandContext } from "../../../src/causal-ai/core/ai/command-executor.js"

function createEmptyMap(): MapData {
	return {
		id: "empty",
		name: "空地",
		width: 5,
		height: 3,
		tiles: [
			"＃＃＃＃＃",
			"＃．．．＃",
			"＃＃＃＃＃"
		],
		objects: [{ id: "agent", type: "agent", pos: { x: 1, y: 1 } }]
	}
}

function createContext(world: World): CommandContext {
	const plannedActions: string[] = []
	return {
		world,
		expDB: new ExperienceDB(),
		ruleDB: new RuleDB(),
		getPlanLength: () => plannedActions.length,
		getPlanSnapshot: () => [...plannedActions],
		setPlan: (actions) => {
			plannedActions.length = 0
			plannedActions.push(...actions)
		},
		clearPlan: () => {
			plannedActions.length = 0
		},
		shiftPlan: () => {
			return (plannedActions.shift() as CommandContext["shiftPlan"] extends () => infer R ? R : never) || null
		}
	}
}

describe("command-executor", () => {
	describe("移动指令", () => {
		it("应执行右移动作", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "右")
			assert.ok(result.success)
			assert.ok(result.msg.includes("移动"))
		})

		it("撞墙时应提示撞墙", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "上") // (1,1) 往上到 (1,0) 是墙
			// 注意：command-executor 对移动指令始终返回 success=true
			// 实际动作结果体现在 msg 中
			assert.ok(result.msg.includes("撞墙"))
		})
	})

	describe("学习指令", () => {
		it("学 右 应记录经验并提取规则", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "学 右")
			assert.ok(result.success)
			assert.strictEqual(ctx.expDB.getAll().length, 1)
			assert.ok(ctx.ruleDB.getAll().length > 0)
		})

		it("无效动作应返回错误", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "学 跳")
			assert.ok(!result.success)
		})
	})

	describe("规划指令", () => {
		it("规则库为空时应提示先学习", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "规 at(agent,2,1)")
			assert.ok(!result.success)
			assert.ok(result.msg.includes("规则库为空"))
		})

		it("有规则时应成功规划", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			// 先学习移动经验（当前规则只支持单步相对移动）
			executeCommand(ctx, "学 右")
			const result = executeCommand(ctx, "规 at(agent,1,0)")
			assert.ok(result.success)
			assert.ok(result.planUpdated)
		})
	})

	describe("执行指令", () => {
		it("无计划时应返回错误", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "执")
			assert.ok(!result.success)
		})
	})

	describe("帮助指令", () => {
		it("? 应返回帮助信息", () => {
			const world = new World(createEmptyMap())
			const ctx = createContext(world)
			const result = executeCommand(ctx, "?")
			assert.ok(result.success)
			assert.ok(result.msg.includes("指令列表"))
		})
	})
})
