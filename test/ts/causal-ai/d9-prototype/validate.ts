// ========== d9 元归纳原型验证 ==========
// 目标：让 AI 从 "上" 和 "左" 的经验中，自动猜出 "右" 的效果

import { AgentAPI } from "../../../../src/causal-ai/agent-api/index"
import { MetaGridworld } from "../../../../src/causal-ai/meta-gridworld/world-engine"
import type { MapData } from "../../../../src/causal-ai/meta-gridworld/types"
import { extractStructuredDiff } from "./structured-diff"
import { induceConcreteRule, induceMetaRule, predictWithMetaRule } from "./meta-inductor"

function createMapData(): MapData {
	return {
		id: "proto",
		name: "验证地图",
		width: 5,
		height: 5,
		tiles: [
			"＃＃＃＃＃",
			"＃．．．＃",
			"＃．．．＃",
			"＃．．．＃",
			"＃＃＃＃＃"
		],
		objects: [{ id: "agent", type: "agent", pos: { x: 2, y: 2 } }]
	}
}

function assert(condition: boolean, msg: string) {
	if (!condition) {
		console.error("❌ 断言失败:", msg)
		process.exit(1)
	}
	console.log("✅", msg)
}

async function main() {
	const world = new MetaGridworld(createMapData())
	const api = new AgentAPI(world)

	console.log("=== d9 元归纳原型验证 ===\n")
	console.log("初始位置:", api.getAgentState().pos)

	// 步骤 1：执行 "上"，记录经验
	const beforeUp = api.observe()
	api.step("上")
	const afterUp = api.observe()
	const diffUp = extractStructuredDiff(beforeUp, afterUp, "上")
	const ruleUp = induceConcreteRule(diffUp)
	console.log("\n[经验 1] 上")
	console.log("  agent 移动:", diffUp.agentMoved, "delta:", diffUp.agentDelta)
	console.log("  目标格子 walkable:", diffUp.actionContext?.targetCell.walkable)
	console.log("  具体规则:", JSON.stringify(ruleUp, null, 2))

	// 步骤 2：执行 "左"，记录经验
	const beforeLeft = api.observe()
	api.step("左")
	const afterLeft = api.observe()
	const diffLeft = extractStructuredDiff(beforeLeft, afterLeft, "左")
	const ruleLeft = induceConcreteRule(diffLeft)
	console.log("\n[经验 2] 左")
	console.log("  agent 移动:", diffLeft.agentMoved, "delta:", diffLeft.agentDelta)
	console.log("  目标格子 walkable:", diffLeft.actionContext?.targetCell.walkable)
	console.log("  具体规则:", JSON.stringify(ruleLeft, null, 2))

	// 步骤 3：元归纳
	assert(ruleUp !== null, "应能从 '上' 提取具体规则")
	assert(ruleLeft !== null, "应能从 '左' 提取具体规则")
	const metaRule = induceMetaRule([ruleUp!, ruleLeft!])
	console.log("\n[元规则归纳]")
	console.log("  元规则:", JSON.stringify(metaRule, null, 2))
	assert(metaRule !== null, "应能从两条具体规则归纳出元规则")

	// 步骤 4：零样本预测 "右"
	const prediction = predictWithMetaRule(metaRule!, "右", [1, 0])
	console.log("\n[零样本预测] 右")
	console.log("  预测结果:", JSON.stringify(prediction, null, 2))
	assert(prediction !== null, "应能预测 '右' 的效果")
	assert(
		prediction!.preconditions.some(p => p.relX === 1 && p.relY === 0 && p.value === true),
		"预测 '右' 的前置条件应包含 relX=1,relY=0 且 walkable=true"
	)
	assert(
		prediction!.effects.some(e => e.target === "agent.pos.x" && e.delta === 1),
		"预测 '右' 的效果应是 agent.pos.x + 1"
	)

	// 步骤 5：验证预测（回到中间位置）
	api.step("下")
	api.step("右") // 回到 (2,2)
	const beforeRight = api.observe()
	api.step("右")
	const afterRight = api.observe()
	console.log("\n[验证预测] 右")
	console.log("  实际结果: 从", beforeRight.agent.pos, "到", afterRight.agent.pos)
	assert(
		afterRight.agent.pos.x === beforeRight.agent.pos.x + 1 && afterRight.agent.pos.y === beforeRight.agent.pos.y,
		"实际执行 '右' 后，agent 应向右移动一格"
	)

	// 步骤 6：测试撞墙（验证 walkable=false 的预测）
	api.step("右") // (3,2) -> (4,2) 是空地？不，地图是 5x5，x=4 是墙
	const beforeWall = api.observe()
	api.step("右") // 应该撞墙，因为 x=4 是墙
	const afterWall = api.observe()
	console.log("\n[验证失败条件] 撞墙")
	console.log("  尝试从", beforeWall.agent.pos, "向右移动")
	console.log("  实际结果: 位置变为", afterWall.agent.pos)
	assert(
		afterWall.agent.pos.x === beforeWall.agent.pos.x,
		"撞墙时应不移动"
	)

	const diffWall = extractStructuredDiff(beforeWall, afterWall, "右")
	const ruleWall = induceConcreteRule(diffWall)
	console.log("  撞墙规则:", JSON.stringify(ruleWall, null, 2))
	assert(
		ruleWall!.preconditions.some(p => p.relX === 1 && p.relY === 0 && p.value === false),
		"撞墙规则应包含 walkable=false"
	)

	console.log("\n🎉 所有验证通过！元归纳原型工作正常。")
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
