// ========== 位置与方向工具函数测试 ==========

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import {
	isMoveAction,
	getDirectionDelta,
	applyDirection,
	getAgentPos
} from "../../../src/causal-ai/core/utils/position.js"


describe("position-utils", () => {
	describe("isMoveAction", () => {
		it("应识别移动类动作", () => {
			assert.ok(isMoveAction("上"))
			assert.ok(isMoveAction("下"))
			assert.ok(isMoveAction("左"))
			assert.ok(isMoveAction("右"))
		})

		it("应拒绝非移动类动作", () => {
			assert.ok(!isMoveAction("等"))
			assert.ok(!isMoveAction("互"))
			assert.ok(!isMoveAction("未知"))
		})
	})

	describe("getDirectionDelta", () => {
		it("应返回正确的方向偏移", () => {
			assert.deepStrictEqual(getDirectionDelta("上"), [0, -1])
			assert.deepStrictEqual(getDirectionDelta("下"), [0, 1])
			assert.deepStrictEqual(getDirectionDelta("左"), [-1, 0])
			assert.deepStrictEqual(getDirectionDelta("右"), [1, 0])
			assert.deepStrictEqual(getDirectionDelta("等"), [0, 0])
			assert.deepStrictEqual(getDirectionDelta("互"), [0, 0])
		})
	})

	describe("applyDirection", () => {
		it("应正确应用方向到位置", () => {
			const pos = { x: 3, y: 4 }
			assert.deepStrictEqual(applyDirection(pos, "上"), { x: 3, y: 3 })
			assert.deepStrictEqual(applyDirection(pos, "下"), { x: 3, y: 5 })
			assert.deepStrictEqual(applyDirection(pos, "左"), { x: 2, y: 4 })
			assert.deepStrictEqual(applyDirection(pos, "右"), { x: 4, y: 4 })
		})

		it("不应修改原始位置对象", () => {
			const pos = { x: 1, y: 1 }
			applyDirection(pos, "右")
			assert.deepStrictEqual(pos, { x: 1, y: 1 })
		})
	})

	describe("getAgentPos", () => {
		it("应从状态中提取玩家位置", () => {
			const state = new Set(["at(agent,2,3)", "facing(右)", "holding(none)"])
			assert.deepStrictEqual(getAgentPos(state), { x: 2, y: 3 })
		})

		it("应支持负坐标", () => {
			const state = new Set(["at(agent,-1,-2)"])
			assert.deepStrictEqual(getAgentPos(state), { x: -1, y: -2 })
		})

		it("无玩家位置时应返回 null", () => {
			const state = new Set(["facing(右)", "cell_empty(1,0)"])
			assert.strictEqual(getAgentPos(state), null)
		})

		it("格式不匹配时应返回 null", () => {
			const state = new Set(["at(agent,x,y)"])
			assert.strictEqual(getAgentPos(state), null)
		})
	})
})
