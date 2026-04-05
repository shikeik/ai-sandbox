// ========== 地图生成器测试 ==========
// 验证 generateTerrainForAction 为各动作生成的地形是否正确

import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { generateTerrainForAction, getActionChecks, getLabel } from "./terrain.js"
import { ELEM_AIR, ELEM_GROUND, ELEM_HERO, ELEM_SLIME } from "./constants.js"
import type { TerrainConfig } from "./constants.js"

// 测试配置（启用所有元素）
const TEST_CONFIG: TerrainConfig = {
	groundOnly: false,
	slime: true,
	demon: true,
	coin: true,
}

// 测试配置（无史莱姆）
const NO_SLIME_CONFIG: TerrainConfig = {
	groundOnly: false,
	slime: false,
	demon: true,
	coin: true,
}

describe("地图生成器 - generateTerrainForAction", () => {
	describe("动作 0: 走", () => {
		it("应生成只有'走'合法的地形", () => {
			const t = generateTerrainForAction(0, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")

			// 打印单步生成（只显示实际生成的列，用.表示未生成）
			const formatCol = (val: number, isGenerated: boolean) => isGenerated ? String(val) : "."
			const showCols = 6  // 显示前6列作为示例

			console.log("\n=== 单步生成（狐狸在第0列，走）===")
			console.log("层2 (天上):", t[2].slice(0, showCols).map((v, i) => formatCol(v, i <= 1)).join(","))
			console.log("层1 (地上):", t[1].slice(0, showCols).map((v, i) => formatCol(v, i <= 1)).join(","))
			console.log("层0 (地面):", t[0].slice(0, showCols).map((v, i) => formatCol(v, i <= 1)).join(","))
			console.log("图例: .=未生成, 0=坑, 1=狐狸, 2=平地")

			// 真正用 generateTerrainForAction 跑多步累积生成完整地图
			console.log("\n=== 多步累积生成完整地图（32列）===")
			
			// 初始化32列空地图
			const fullMap: number[][] = [
				Array(32).fill(-1),
				Array(32).fill(-1),
				Array(32).fill(-1),
			]
			fullMap[0][0] = 2  // 起点地面
			fullMap[1][0] = 1  // 起点狐狸
			fullMap[2][0] = 0  // 起点天上

			let heroPos = 0
			let path = "0"

			// 模拟走10步生成，使用existingMap参数直接在同一张地图上生成
			for (let step = 0; step < 10 && heroPos < 28; step++) {
				const action = [0, 1, 0, 2, 0, 1, 0, 0, 2, 0][step]  // 预设动作序列
				
				// 使用existingMap参数，在同一张地图上继续生成
				generateTerrainForAction(action, heroPos, TEST_CONFIG, fullMap)

				// 移动狐狸
				fullMap[1][heroPos] = 0  // 旧位置清空
				if (action === 0 || action === 3) heroPos += 1
				else if (action === 1) heroPos += 2
				else if (action === 2) heroPos += 3
				fullMap[1][heroPos] = 1  // 新位置放狐狸

				path += `→${heroPos}(${
					action === 0 ? "走" : action === 1 ? "跳" : action === 2 ? "远跳" : "走A"
				})`
			}

			// 格式化输出（-1显示为.）
			const format = (arr: number[]) => arr.map(v => v === -1 ? "." : v).join(",")

			console.log(`路径: ${path}`)
			console.log("层2 (天上):", format(fullMap[2]))
			console.log("层1 (地上):", format(fullMap[1]))
			console.log("层0 (地面):", format(fullMap[0]))
			console.log("图例: .=未生成, 0=空气/坑, 1=狐狸, 2=平地, 3=史莱姆, 4=恶魔, 5=金币")
			console.log("")

			const checks = getActionChecks(t, 0)

			// 走应该合法
			assert.ok(checks.canWalk.ok, "走应该合法")

			// 跳不应该合法（第2列是坑）
			assert.ok(!checks.canJump.ok, "跳不应该合法")

			// 远跳不应该合法（第3列是坑）
			assert.ok(!checks.canLongJump.ok, "远跳不应该合法")

			// 验证地形结构（走只生成第1列）
			assert.strictEqual(t[1][0], ELEM_HERO, "第0列地上应该是狐狸")
			assert.strictEqual(t[0][1], ELEM_GROUND, "第1列地面应该是平地")
			// 第2、3列保持空气（未生成，由边界检查阻止跳/远跳）
		})

		it("getLabel 应该返回 0（走）", () => {
			const t = generateTerrainForAction(0, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")
			assert.strictEqual(getLabel(t), 0, "最优动作应该是走")
		})
	})

	describe("动作 1: 跳", () => {
		it("应生成只有'跳'合法的地形", () => {
			const t = generateTerrainForAction(1, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")

			const checks = getActionChecks(t, 0)

			// 走不应该合法（第1列是坑）
			assert.ok(!checks.canWalk.ok, "走不应该合法")

			// 跳应该合法
			assert.ok(checks.canJump.ok, "跳应该合法")

			// 远跳不应该合法（第3列是坑）
			assert.ok(!checks.canLongJump.ok, "远跳不应该合法")

			// 验证地形结构（跳生成第1、2列）
			assert.strictEqual(t[1][0], ELEM_HERO, "第0列地上应该是狐狸")
			assert.strictEqual(t[0][1], ELEM_AIR, "第1列地面应该是坑（阻止走）")
			assert.strictEqual(t[0][2], ELEM_GROUND, "第2列地面应该是平地")
			// 第3列保持空气（未生成）
		})

		it("getLabel 应该返回 1（跳）", () => {
			const t = generateTerrainForAction(1, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")
			assert.strictEqual(getLabel(t), 1, "最优动作应该是跳")
		})
	})

	describe("动作 2: 远跳", () => {
		it("应生成只有'远跳'合法的地形", () => {
			const t = generateTerrainForAction(2, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")

			const checks = getActionChecks(t, 0)

			// 走不应该合法
			assert.ok(!checks.canWalk.ok, "走不应该合法")

			// 跳不应该合法（第2列是坑）
			assert.ok(!checks.canJump.ok, "跳不应该合法")

			// 远跳应该合法
			assert.ok(checks.canLongJump.ok, "远跳应该合法")

			// 验证地形结构（远跳生成第1、2、3列）
			assert.strictEqual(t[1][0], ELEM_HERO, "第0列地上应该是狐狸")
			assert.strictEqual(t[0][1], ELEM_AIR, "第1列地面应该是坑（阻止走）")
			assert.strictEqual(t[0][2], ELEM_AIR, "第2列地面应该是坑（阻止跳）")
			assert.strictEqual(t[0][3], ELEM_GROUND, "第3列地面应该是平地")
		})

		it("getLabel 应该返回 2（远跳）", () => {
			const t = generateTerrainForAction(2, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")
			assert.strictEqual(getLabel(t), 2, "最优动作应该是远跳")
		})
	})

	describe("动作 3: 走A", () => {
		it("应生成只有'走A'合法的地形（有史莱姆配置）", () => {
			const t = generateTerrainForAction(3, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")

			const checks = getActionChecks(t, 0)

			// 走不应该合法（第1列有史莱姆）
			assert.ok(!checks.canWalk.ok, "走不应该合法（有史莱姆）")

			// 走A应该合法
			assert.ok(checks.canWalkAttack.ok, "走A应该合法")

			// 验证地形结构
			assert.strictEqual(t[1][0], ELEM_HERO, "第0列地上应该是狐狸")
			assert.strictEqual(t[0][1], ELEM_GROUND, "第1列地面应该是平地")
			assert.strictEqual(t[1][1], ELEM_SLIME, "第1列地上应该是史莱姆")
		})

		it("getLabel 应该返回 3（走A）", () => {
			const t = generateTerrainForAction(3, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")
			assert.strictEqual(getLabel(t), 3, "最优动作应该是走A")
		})

		it("无史莱姆配置时应返回 null", () => {
			const t = generateTerrainForAction(3, 0, NO_SLIME_CONFIG)
			assert.strictEqual(t, null, "无史莱姆配置时应返回 null")
		})
	})

	describe("边界情况", () => {
		it("生成的地形应为32列", () => {
			const t = generateTerrainForAction(0, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")
			assert.strictEqual(t.length, 3, "应该有3层")
			assert.strictEqual(t[0].length, 32, "应该有32列")
			assert.strictEqual(t[1].length, 32, "应该有32列")
			assert.strictEqual(t[2].length, 32, "应该有32列")
		})

		it("地形数组结构正确", () => {
			const t = generateTerrainForAction(1, 0, TEST_CONFIG)
			assert.ok(t, "地形生成失败")

			// 验证每一层都是数组
			assert.ok(Array.isArray(t[0]), "天上层应该是数组")
			assert.ok(Array.isArray(t[1]), "地上层应该是数组")
			assert.ok(Array.isArray(t[2]), "地面层应该是数组")

			// 验证元素都是数字
			assert.ok(typeof t[0][1] === "number", "地面元素应该是数字")
			assert.ok(t[0][1] >= 0 && t[0][1] <= 5, "元素ID应在0-5范围内")
		})
	})

	describe("随机性测试", () => {
		it("多次生成应都满足条件（零失败验证）", () => {
			for (let i = 0; i < 50; i++) {
				const action = i % 4
				if (action === 3) continue // 跳过走A，因为需要史莱姆配置

				const t = generateTerrainForAction(action, 0, TEST_CONFIG)
				assert.ok(t, `第${i}次生成失败（动作${action}）`)

				const actualAction = getLabel(t)
				assert.strictEqual(actualAction, action, `第${i}次生成的动作不匹配`)
			}
		})
	})
})
