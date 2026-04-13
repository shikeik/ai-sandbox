// ========== Agent API 测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { AgentAPI } from "../../../src/causal-ai/agent-api/index.js"
import type { MapData } from "../../../src/causal-ai/meta-gridworld/types.js"

function createMapData(overrides: Partial<MapData> = {}): MapData {
	return {
		id: "test",
		name: "测试地图",
		width: 5,
		height: 3,
		tiles: [
			"＃＃＃＃＃",
			"＃．．．＃",
			"＃＃＃＃＃"
		],
		objects: [
			{ id: "agent", type: "agent", pos: { x: 1, y: 1 } }
		],
		...overrides
	}
}

describe("AgentAPI", () => {
	describe("step", () => {
		it("应执行动作并返回结构化观测", () => {
			const api = new AgentAPI(createMapData())
			const obs = api.step("右")
			assert.ok(obs.lastResult.success)
			assert.deepStrictEqual(obs.agent.pos, { x: 2, y: 1 })
			assert.strictEqual(obs.stepCount, 1)
			assert.ok(obs.localView.cells.has("0,0"))
		})

		it("撞墙时应返回失败观测", () => {
			const api = new AgentAPI(createMapData())
			const obs = api.step("上")
			assert.ok(!obs.lastResult.success)
			assert.deepStrictEqual(obs.agent.pos, { x: 1, y: 1 })
		})
	})

	describe("getCurrentState", () => {
		it("应返回谓词集合", () => {
			const api = new AgentAPI(createMapData())
			const state = api.getCurrentState()
			assert.ok(state.has("at(agent,0,0)"))
			assert.ok(state.has("facing(右)"))
		})
	})

	describe("reset", () => {
		it("重置后应回到初始状态", () => {
			const api = new AgentAPI(createMapData())
			api.step("右")
			api.reset(createMapData())
			const obs = api.observe()
			assert.deepStrictEqual(obs.agent.pos, { x: 1, y: 1 })
			assert.strictEqual(obs.stepCount, 0)
		})
	})

	describe("共享世界实例", () => {
		it("两个 AgentAPI 共享同一 MetaGridworld 时应状态同步", async () => {
			const { MetaGridworld } = await import("../../../src/causal-ai/meta-gridworld/world-engine.js")
			const world = new MetaGridworld(createMapData())
			const api1 = new AgentAPI(world)
			const api2 = new AgentAPI(world)
			api1.step("右")
			const obs = api2.observe()
			assert.deepStrictEqual(obs.agent.pos, { x: 2, y: 1 })
		})
	})
})
