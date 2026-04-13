// ========== 2D 从0到1验证脚本 ==========
// 目标：AI 在不知道 walkable、不知道方向绑定的情况下
// 通过假设-验证，自己发现移动规则

import { MinimalWorld, type MapConfig, type Action } from "./minimal-world"
import { HypothesisEngine } from "./hypothesis-engine"

function createMapConfig(): MapConfig {
	const cells = new Map<string, boolean>()
	// 5x3 地图
	// 第0行：true true true true true
	for (let x = 0; x < 5; x++) cells.set(`${x},0`, true)
	// 第1行：false true true true false
	cells.set("0,1", false)
	cells.set("1,1", true)
	cells.set("2,1", true)
	cells.set("3,1", true)
	cells.set("4,1", false)
	// 第2行：true true true true true
	for (let x = 0; x < 5; x++) cells.set(`${x},2`, true)

	return {
		width: 5,
		height: 3,
		cells,
		agentStart: { x: 2, y: 1 }
	}
}

function assert(condition: boolean, msg: string) {
	if (!condition) {
		console.error("❌ 断言失败:", msg)
		process.exit(1)
	}
	console.log("✅", msg)
}

function runExperiment(world: MinimalWorld, engine: HypothesisEngine, action: Action): void {
	const before = world.observe()
	const { observation: after, result } = world.step(action)
	engine.addExperiment({ action, before, result })
	console.log(`  ${action}: 从 (${before.agent.x},${before.agent.y}) → (${after.agent.x},${after.agent.y}) | ${result.success ? "成功" : "失败"} | 邻居: 上=${before.neighbors["上"]} 下=${before.neighbors["下"]} 左=${before.neighbors["左"]} 右=${before.neighbors["右"]}`)
}

function main() {
	const world = new MinimalWorld(createMapConfig())
	const engine = new HypothesisEngine()

	console.log("=== 2D 极简世界：从0到1验证 ===\n")
	console.log("地图规则：agent 只能看到上下左右4邻居的 true/false")
	console.log("AI 先验知识：无。它不知道 true 意味着什么，不知道哪个邻居对应哪个动作。\n")

	// 实验序列：通过控制变量，让每个动作的结果只和一个邻居相关
	console.log("[实验序列]")

	// 右：成功 → 失败
	runExperiment(world, engine, "右") // (2,1) → (3,1) success
	runExperiment(world, engine, "右") // (3,1) → (3,1) fail

	// 左：成功 → 成功 → 失败
	runExperiment(world, engine, "左") // (3,1) → (2,1) success
	runExperiment(world, engine, "左") // (2,1) → (1,1) success
	runExperiment(world, engine, "左") // (1,1) → (1,1) fail

	// 回到中心
	runExperiment(world, engine, "右") // (1,1) → (2,1) success

	// 上：成功 → 失败（越界）
	runExperiment(world, engine, "上") // (2,1) → (2,0) success
	runExperiment(world, engine, "上") // (2,0) → (2,0) fail

	// 下：成功 → 成功 → 失败（越界）
	runExperiment(world, engine, "下") // (2,0) → (2,1) success
	runExperiment(world, engine, "下") // (2,1) → (2,2) success
	runExperiment(world, engine, "下") // (2,2) → (2,2) fail

	// 打印每个动作的存活假设
	const actions: Action[] = ["上", "下", "左", "右"]
	for (const action of actions) {
		engine.printState(action)
	}

	// 验证：存活假设中必须有完整匹配对，且最佳假设以匹配方向为主
	for (const action of actions) {
		const survivors = engine.getSurvivingHypotheses(action)
		const best = engine.getBestHypotheses(action)

		console.log(`\n[${action}] 最佳假设详情:`)
		for (const h of best) {
			console.log(`  ${h.condition.neighbor}=${h.condition.value} → ${h.predictedResult ? "success" : "fail"} (支持:${h.supportCount})`)
		}

		const matchingAll = survivors.filter(h => h.condition.neighbor === action)
		const matchingBest = best.filter(h => h.condition.neighbor === action)
		const nonMatchingBest = best.filter(h => h.condition.neighbor !== action)

		const maxMatchingSupport = matchingBest.length > 0
			? Math.max(...matchingBest.map(h => h.supportCount))
			: 0
		const maxNonMatchingSupport = nonMatchingBest.length > 0
			? Math.max(...nonMatchingBest.map(h => h.supportCount))
			: 0

		assert(
			matchingAll.length === 2,
			`${action}: 存活假设中应恰好有2条匹配假设，实际有 ${matchingAll.length} 条`
		)
		assert(
			maxMatchingSupport >= maxNonMatchingSupport,
			`${action}: 匹配假设的最高支持度应不低于非匹配假设`
		)
		assert(
			matchingAll.some(h => h.condition.value === true && h.predictedResult === true),
			`${action}: 应有 "${action}邻居=true → success" 假设`
		)
		assert(
			matchingAll.some(h => h.condition.value === false && h.predictedResult === false),
			`${action}: 应有 "${action}邻居=false → fail" 假设`
		)
	}

	console.log("\n🎉 所有验证通过！AI 自己发现了方向绑定和 true/false 的含义。")
	console.log("\nAI 的内心独白:")
	console.log("  '原来 \"上\" 只和上面的邻居有关，\"右\" 只和右边的邻居有关...'")
	console.log("  '而且邻居是 true 的时候我能移动过去，false 的时候不行...'")
	console.log("  '这就是我从纯粹的 0/1 像素中自己发现的规则！'")
}

main()
