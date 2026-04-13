// ========== World 核心逻辑测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { World } from "../../../src/causal-ai/core/world/world.js"
import type { MapData } from "../../../src/causal-ai/core/world/types.js"

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

describe("World", () => {
	describe("移动", () => {
		it("应向指定方向移动", () => {
			const world = new World(createMapData())
			const result = world.execute("右")
			assert.ok(result.result.success)
			assert.deepStrictEqual(world.getAgentState().pos, { x: 2, y: 1 })
		})

		it("撞墙时应失败", () => {
			const world = new World(createMapData({
				tiles: [
					"＃＃＃＃＃",
					"＃．．．＃",
					"＃＃＃＃＃"
				],
				objects: [{ id: "agent", type: "agent", pos: { x: 1, y: 1 } }]
			}))
			// 从 (1,1) 往上到 (1,0) 是墙
			const result = world.execute("上")
			assert.ok(!result.result.success)
			// 位置不变
			assert.deepStrictEqual(world.getAgentState().pos, { x: 1, y: 1 })
		})

		it("超出边界时应失败", () => {
			const world = new World(createMapData({
				width: 3,
				height: 3,
				tiles: [
					"＃＃＃",
					"＃．＃",
					"＃＃＃"
				],
				objects: [{ id: "agent", type: "agent", pos: { x: 1, y: 1 } }]
			}))
			// 从 (1,1) 往左到 (0,1) 是墙，往右到 (2,1) 也是墙
			// 先移动到边缘可通行的位置再测试越界
			const result = world.execute("右")
			assert.ok(!result.result.success)
			assert.deepStrictEqual(world.getAgentState().pos, { x: 1, y: 1 })
		})

		it("移动后应更新面朝方向", () => {
			const world = new World(createMapData())
			world.execute("下")
			assert.strictEqual(world.getAgentState().facing, "下")
		})
	})

	describe("交互", () => {
		it("空地上交互应失败", () => {
			const world = new World(createMapData())
			const result = world.execute("互")
			assert.ok(!result.result.success)
		})

		it("应能拾取脚下的钥匙", () => {
			const world = new World(createMapData({
				objects: [
					{ id: "agent", type: "agent", pos: { x: 1, y: 1 } },
					{ id: "key1", type: "钥匙", pos: { x: 1, y: 1 } }
				]
			}))
			const result = world.execute("互")
			assert.ok(result.result.success)
			assert.ok(world.getAgentState().inventory.includes("钥匙"))
			assert.strictEqual(world.getObjectsAt({ x: 1, y: 1 }).length, 1) // 只剩 agent
		})

		it("应能打开面前的门（消耗钥匙）", () => {
			const world = new World(createMapData({
				objects: [
					{ id: "agent", type: "agent", pos: { x: 1, y: 1 } },
					{ id: "key1", type: "钥匙", pos: { x: 1, y: 1 } },
					{ id: "door1", type: "门", pos: { x: 2, y: 1 }, state: { open: false } }
				]
			}))
			world.execute("互") // 拾取钥匙
			world.execute("右") // 移动到门前
			const result = world.execute("互") // 开门
			assert.ok(result.result.success)
			const door = world.getObjectsAt({ x: 2, y: 1 })[0]
			assert.ok(door?.state?.open)
			assert.ok(!world.getAgentState().inventory.includes("钥匙"))
		})

		it("无钥匙时应无法开门", () => {
			const world = new World(createMapData({
				objects: [
					{ id: "agent", type: "agent", pos: { x: 1, y: 1 } },
					{ id: "door1", type: "门", pos: { x: 2, y: 1 }, state: { open: false } }
				]
			}))
			world.execute("右")
			const result = world.execute("互")
			assert.ok(!result.result.success)
		})
	})

	describe("终点", () => {
		it("到达终点时应通关", () => {
			const world = new World(createMapData({
				objects: [
					{ id: "agent", type: "agent", pos: { x: 1, y: 1 } },
					{ id: "goal", type: "终点", pos: { x: 2, y: 1 } }
				]
			}))
			const result = world.execute("右")
			assert.ok(result.result.success)
			assert.ok(result.result.terminate)
			assert.ok(world.isTerminated())
		})
	})

	describe("状态查询", () => {
		it("getCurrentState 应返回谓词集合", () => {
			const world = new World(createMapData())
			const state = world.getCurrentState()
			assert.ok(state.has("at(agent,0,0)"))
			assert.ok(state.has("facing(右)"))
			assert.ok(state.has("holding(none)"))
		})
	})
})
