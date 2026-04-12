// ========== 因果链 AI - 调试脚本 ==========
// 手动运行: npx tsx test/ts/causal-ai/debug.ts

import { Planner } from "../../../src/causal-ai/planner"
import { applyAction, getAllActions } from "../../../src/causal-ai/actions"
import { createInitialState } from "../../../src/causal-ai/state"
import { WORLD_CONFIG } from "../../../src/causal-ai/config"
import { getStateKey } from "../../../src/causal-ai/knowledge"
import type { GameState, ActionType } from "../../../src/causal-ai/types"
import { TEST_STATES, createKeyExperiences, SIMPLE_SOLUTION } from "../../../src/causal-ai/test-data"

// 辅助：打印状态
function printState(s: GameState, label: string): void {
	console.log(`${label}: (${s.agent.x},${s.agent.y}) 手持:${s.holding ?? "无"} 钥匙存在:${s.keyExists} 门开:${s.doorOpen}`)
}

// 辅助：验证路径是否有效
function validatePath(startState: GameState, path: ActionType[]): { valid: boolean; finalState: GameState; error?: string } {
	let state = JSON.parse(JSON.stringify(startState)) as GameState

	for (let i = 0; i < path.length; i++) {
		const action = path[i]
		const beforeKey = getStateKey(state)
		const newState = applyAction(state, action)
		const afterKey = getStateKey(newState)

		if (beforeKey === afterKey) {
			return {
				valid: false,
				finalState: state,
				error: `步骤 ${i} (${action}): 无效动作，状态无变化`
			}
		}

		state = newState
	}

	return { valid: true, finalState: state }
}

// 测试1：验证测试数据完整性
function testDataIntegrity(): void {
	const exps = createKeyExperiences()
	console.log("=== 关键经验 ===")
	console.log(`经验数量: ${exps.length}`)

	exps.forEach((exp, i) => {
		console.log(`\n经验 ${i + 1}: ${exp.action}`)
		printState(exp.before, "  before")
		printState(exp.after, "  after ")
	})
}

// 测试2：手动执行预期路径
function testManualPath(): void {
	const startState = createInitialState()
	console.log("\n=== 手动执行路径 ===")
	printState(startState, "初始")

	const result = validatePath(startState, SIMPLE_SOLUTION)

	if (!result.valid) {
		console.log(`路径无效: ${result.error}`)
	} else {
		printState(result.finalState, "最终")
		console.log(`路径长度: ${SIMPLE_SOLUTION.length}`)

		const reachedGoal =
			result.finalState.agent.x === WORLD_CONFIG.flagPos.x &&
			result.finalState.agent.y === WORLD_CONFIG.flagPos.y

		console.log(`是否到达终点: ${reachedGoal}`)
	}
}

// 测试3：规划器完整路径
function testPlanner(): void {
	const planner = new Planner()
	const startState = createInitialState()

	console.log("\n=== 完整规划测试 ===")
	printState(startState, "初始状态")
	console.log(`目标: (${WORLD_CONFIG.flagPos.x}, ${WORLD_CONFIG.flagPos.y})`)

	const plan = planner.plan(startState)

	console.log(`\n规划结果: ${plan.length > 0 ? `找到路径，长度 ${plan.length}` : "规划失败"}`)

	if (plan.length > 0) {
		console.log(`路径: ${plan.join(" → ")}`)

		const result = validatePath(startState, plan)
		if (!result.valid) {
			console.log(`路径验证失败: ${result.error}`)
		} else {
			printState(result.finalState, "路径终点")
			console.log(`✅ 规划成功！`)
		}
	} else {
		console.log("❌ 规划失败，执行 BFS 调试...")
		debugBFS(startState)
	}
}

// BFS 调试
function debugBFS(startState: GameState): void {
	const actions = getAllActions()
	const visited = new Set<string>()
	interface Node {
		state: GameState
		path: ActionType[]
	}
	const queue: Node[] = [{ state: startState, path: [] }]

	visited.add(getStateKey(startState))

	let iterations = 0
	const maxIterations = 1000

	console.log("\n=== BFS 调试 ===")

	while (queue.length > 0 && iterations < maxIterations) {
		iterations++
		const { state, path } = queue.shift()!

		if (state.agent.x === WORLD_CONFIG.flagPos.x && state.agent.y === WORLD_CONFIG.flagPos.y) {
			console.log(`✅ 找到路径! 长度: ${path.length}, 迭代: ${iterations}`)
			console.log("路径:", path.join(" → "))
			return
		}

		if (path.length >= 30) continue

		for (const action of actions) {
			const newState = applyAction(state, action)
			const key = getStateKey(newState)

			if (key !== getStateKey(state) && !visited.has(key)) {
				visited.add(key)
				queue.push({ state: newState, path: [...path, action] })
			}
		}
	}

	console.log(`❌ BFS结束，已访问: ${visited.size} 个状态`)
}

// 测试4：验证关键动作
function testKeyActions(): void {
	console.log("\n=== 关键动作验证 ===")

	// 拾取钥匙
	const afterPickup = applyAction(TEST_STATES.atKeyEmpty, "pickup")
	console.log("\n拾取钥匙:")
	printState(TEST_STATES.atKeyEmpty, "  before")
	printState(afterPickup, "  after ")

	// 开门
	const afterOpen = applyAction(TEST_STATES.atDoorLeftWithKey, "move_right")
	console.log("\n开门:")
	printState(TEST_STATES.atDoorLeftWithKey, "  before")
	printState(afterOpen, "  after ")

	console.log(`\n✅ 开门成功: ${afterOpen.doorOpen && afterOpen.agent.x === WORLD_CONFIG.doorPos.x}`)
}

// 运行所有测试
function main(): void {
	testDataIntegrity()
	testManualPath()
	testPlanner()
	testKeyActions()
}

main()
