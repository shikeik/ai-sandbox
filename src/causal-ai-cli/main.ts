// ========== 因果链 AI - 命令行版本 ==========
// 运行: npx tsx src/causal-ai-cli/main.ts
// 指定地图: npx tsx src/causal-ai-cli/main.ts --map simple

import * as readline from "node:readline"
import { MAPS, type MapData } from "./maps"
import { loadMap, listAllMaps } from "./map-loader"
import { World } from "./world"
import { renderView } from "./renderer"
import type { Action } from "./types"
import { stateToPredicates, stateToString } from "./ai/state"
import { ExperienceDB, RuleDB, extractRuleFromExperience } from "./ai/learner"
import { plan, parseGoal } from "./ai/planner"
import type { State } from "./ai/types"

// 全局 AI 知识库（跨游戏共享）
const globalExpDB = new ExperienceDB()
const globalRuleDB = new RuleDB()

// 解析命令行参数
function parseArgs(): { mapId?: string } {
	const args = process.argv.slice(2)
	const result: { mapId?: string } = {}

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--map" && i + 1 < args.length) {
			result.mapId = args[i + 1]
			i++
		}
	}

	return result
}

// 加载地图（复用逻辑）
function resolveMap(mapId: string): MapData | null {
	return loadMap(mapId)
}

// 显示可用地图列表
function printMapList(): void {
	const allMaps = listAllMaps()
	console.log("可用地图:")
	for (const m of allMaps) {
		console.log(`  ${m.id} - ${m.name} (${m.source})`)
	}
}

// 启动游戏
// onExit: 游戏结束时的回调（用于选图切换）
function startGame(mapData: MapData, onExit?: () => void): void {
	const world = new World(mapData)
	let switching = false
	let closed = false

	// AI 相关（使用全局知识库）
	const expDB = globalExpDB
	const ruleDB = globalRuleDB
	let lastState: State | null = null
	let plannedActions: Action[] = []
	
	// 显示当前知识库状态
	console.log(`\n[知识库] 经验: ${expDB.getAll().length} 条, 规则: ${ruleDB.getAll().length} 条`)

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "指令(上/下/左/右/互/等/图/全/学/规/执/选/退): "
	})

	console.log(`\n===== ${mapData.name} (${mapData.width}×${mapData.height}) =====`)
	console.log("Agent 只能看到周围 5x5 格子")
	console.log("＠ = 你自己  🔑 = 钥匙  🚧 = 关闭的门  🚪 = 打开的门  🚩 = 终点  ＃ = 墙  ． = 空地")
	console.log("\n初始状态:")
	world.printGlobalMap()

	const view = world.getLocalView()
	console.log(renderView(view))

	rl.prompt()

	rl.on("line", (line) => {
		const cmd = line.trim()

		// 空指令直接忽略
		if (cmd === "") {
			rl.prompt()
			return
		}

		switch (cmd) {
		case "上":
		case "下":
		case "左":
		case "右":
		case "互":
		case "等": {
			// 游戏已结束，禁止移动/互动类指令
			if (world.isTerminated()) {
				console.log("游戏已结束，请重新启动")
				rl.prompt()
				return
			}
			const action: Action = cmd as Action
			const { result, view } = world.execute(action)
			console.log(`\n${result.msg} (奖励: ${result.reward}, 总奖励: ${world.getTotalReward().toFixed(1)})`)
			console.log(`[${world.getPlayerStatus()}]`)

			if (result.terminate) {
				console.log("\n✅ 游戏通关！")
			}

			console.log(renderView(view))
			break
		}

		case "图":
			world.printGlobalMap()
			break

		case "全":
			world.printGlobalMap()
			console.log(renderView(world.getLocalView()))
			break

		case "学": {
			// 学习模式：记录当前状态，执行动作，记录新状态
			const agent = world.getAgentState()
			const view = world.getLocalView()
			const currentState = stateToPredicates(agent.pos, agent.facing, agent.inventory.includes("钥匙"), view)

			console.log("\n当前状态:")
			console.log(stateToString(currentState))

			// 询问要执行的动作
			rl.question("输入要学习的动作(上/下/左/右/互/等): ", (actionInput) => {
				const action = actionInput.trim() as Action
				if (!["上", "下", "左", "右", "互", "等"].includes(action)) {
					console.log("无效动作")
					rl.prompt()
					return
				}

				// 执行动作
				const { result, view: newView } = world.execute(action)
				console.log(`\n${result.msg} (奖励: ${result.reward})`)

				// 获取新状态
				const newAgent = world.getAgentState()
				const newState = stateToPredicates(newAgent.pos, newAgent.facing, newAgent.inventory.includes("钥匙"), newView)

				// 记录经验
				expDB.add({ before: currentState, action, after: newState })

				// 提取规则
				const rule = extractRuleFromExperience({ before: currentState, action, after: newState })
				ruleDB.add(rule)

				console.log("\n新增规则:")
				console.log(`  动作: ${action}`)
				console.log(`  效果+: ${Array.from(rule.effects.add).join(", ") || "无"}`)
				console.log(`  效果-: ${Array.from(rule.effects.remove).join(", ") || "无"}`)
				console.log(`\n经验库: ${expDB.getAll().length} 条, 规则库: ${ruleDB.getAll().length} 条`)

				console.log(renderView(newView))
				rl.prompt()
			})
			return  // 异步处理，不继续执行后面的 prompt
		}

		case "规": {
			// 规划模式：给定目标，生成计划
			rl.question("输入目标(如: 去 3,1 或 at(agent,1,0)): ", (goalInput) => {
				const goal = parseGoal(goalInput.trim())
				if (!goal) {
					console.log("无法解析目标")
					rl.prompt()
					return
				}

				console.log("\n目标状态:")
				console.log(stateToString(goal))

				// 获取当前状态
				const agent = world.getAgentState()
				const view = world.getLocalView()
				const currentState = stateToPredicates(agent.pos, agent.facing, agent.inventory.includes("钥匙"), view)

				console.log("\n当前状态:")
				console.log(stateToString(currentState))

				// 执行规划
				const rules = ruleDB.getAll()
				if (rules.length === 0) {
					console.log("\n规则库为空，请先学习")
					rl.prompt()
					return
				}

				const result = plan(currentState, goal, rules, 10)
				if (result.success && result.plan) {
					plannedActions = result.plan
					console.log(`\n${result.msg}`)
					console.log(`计划: ${plannedActions.join(" → ")}`)
				} else {
					console.log(`\n${result.msg}`)
					plannedActions = []
				}

				rl.prompt()
			})
			return
		}

		case "执": {
			// 执行计划
			if (plannedActions.length === 0) {
				console.log("没有待执行的计划，请先规划")
				break
			}

			const action = plannedActions.shift()!
			const { result, view } = world.execute(action)
			console.log(`\n执行: ${action} → ${result.msg} (奖励: ${result.reward})`)
			console.log(`[${world.getPlayerStatus()}]`)
			console.log(`剩余计划: ${plannedActions.join(" → ") || "无"}`)
			console.log(renderView(view))
			break
		}

		case "选": {
			switching = true
			closed = true
			rl.close()
			showMenu()
			return
		}

		case "退":
		case "quit":
		case "q":
			console.log("退出")
			closed = true
			rl.close()
			return

		default:
			console.log("未知指令。可用: 上/下/左/右/互/等/图/全/学/规/执/选/退")
			console.log("  学 - 学习模式: 执行动作并记录因果规则")
			console.log("  规 - 规划模式: 输入目标，AI生成行动计划")
			console.log("  执 - 执行计划: 执行规划好的下一步动作")
		}

		if (!closed) {
			rl.prompt()
		}
	})

	rl.on("close", () => {
		if (!switching) {
			if (onExit) {
				onExit()
			} else {
				console.log("\n再见!")
				process.exit(0)
			}
		}
	})
}

// 选图菜单
function showMenu(): void {
	console.log("\n===== 因果链 AI - 命令行版 =====\n")
	printMapList()
	console.log("\n提示: 创建 gamedatas/maps/xxx.json 来自定义地图")
	console.log("      输入 '退' 或 'quit' 或 'q' 退出程序")

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})

	rl.question("\n输入地图ID (如: simple) 或按回车默认: ", (answer) => {
		rl.close()

		const input = answer.trim()

		// 退出指令
		if (input === "退" || input === "quit" || input === "q") {
			console.log("退出")
			process.exit(0)
		}

		let mapData: MapData | null = null

		if (input === "") {
			mapData = MAPS[0]
		} else {
			mapData = resolveMap(input)
		}

		if (mapData) {
			startGame(mapData, () => {
				// 游戏结束回调，递归显示菜单
				showMenu()
			})
		} else {
			console.log(`\n未知地图: ${input}`)
			printMapList()
			console.log("\n使用默认地图")
			startGame(MAPS[0]!, () => {
				showMenu()
			})
		}
	})
}

// 主入口
function main(): void {
	const args = parseArgs()

	if (args.mapId) {
		const mapData = resolveMap(args.mapId)
		if (mapData) {
			startGame(mapData, () => {
				// 游戏结束后返回菜单
				showMenu()
			})
		} else {
			console.log(`未知地图: ${args.mapId}`)
			printMapList()
			console.log("\n你也可以创建 JSON 地图文件:")
			console.log(`  创建 gamedatas/maps/${args.mapId}.json`)
			process.exit(1)
		}
	} else {
		showMenu()
	}
}

// 启动
main()
