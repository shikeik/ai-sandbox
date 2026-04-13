// ========== 因果链 AI - 命令行版本 ==========
// 运行: npx tsx src/causal-ai/cli/main.ts
// 指定地图: npx tsx src/causal-ai/cli/main.ts --map simple

import * as readline from "node:readline"
import { MAPS, type MapData } from "./maps"
import { loadMap, listAllMaps } from "./map-loader"
import { World } from "../core"
import { renderView } from "./renderer"
import type { Action } from "../core"
import { stateToPredicates, stateToString } from "../core"
import { ExperienceDB, RuleDB } from "../core"
import { executeCommand } from "../core"
import type { CommandContext, CommandResult } from "../core"

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

// 解析地图 ID（内置优先，其次 JSON 文件）
function resolveMap(id: string): MapData | null {
	// 先检查内置地图
	const builtIn = MAPS.find(m => m.id === id)
	if (builtIn) return builtIn

	// 尝试从 JSON 文件加载
	return loadMap(id)
}

// 显示可用地图列表
function printMapList(): void {
	const maps = listAllMaps()
	console.log("\n可用地图:")
	for (const m of maps) {
		console.log(`  ${m.id} - ${m.name} (${m.source})`)
	}
}

// 显示地图选择菜单
function showMenu(): void {
	printMapList()
	console.log("\n提示: 创建 gamedatas/maps/xxx.json 来自定义地图")
	console.log("      输入 '退' 或 'quit' 或 'q' 退出程序")
	console.log("      输入 '?' 查看游戏内指令帮助\n")

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "选择地图ID (如: simple) 或按回车默认: "
	})

	rl.prompt()

	rl.on("line", (line) => {
		const input = line.trim()

		if (input === "" || input === "default") {
			rl.close()
			startGame(MAPS[0]!)
			return
		}

		if (["退", "quit", "q"].includes(input)) {
			rl.close()
			return
		}

		const mapData = resolveMap(input)
		if (mapData) {
			rl.close()
			startGame(mapData)
		} else {
			console.log(`未知地图: ${input}`)
			printMapList()
			rl.prompt()
		}
	})
}

// 游戏主循环
function startGame(mapData: MapData): void {
	console.log(`\n[知识库] 经验: ${globalExpDB.getAll().length} 条, 规则: ${globalRuleDB.getAll().length} 条`)
	console.log(`\n===== ${mapData.name} (${mapData.width}×${mapData.height}) =====`)
	console.log("Agent 只能看到周围 5x5 格子")
	console.log("＠ = 你自己  🔑 = 钥匙  🚧 = 关闭的门  🚪 = 打开的门  🚩 = 终点  ＃ = 墙  ． = 空地\n")

	const world = new World(mapData)
	const expDB = globalExpDB
	const ruleDB = globalRuleDB

	// 计划队列
	const plannedActions: Action[] = []

	// 初始状态
	console.log("初始状态:")
	console.log(renderView(world.getLocalView()))

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "指令(上/下/左/右/互/等/图/全/学/规/执/选/退/?): "
	})

	let switching = false
	let closed = false

	rl.prompt()

	rl.on("line", (line) => {
		if (closed) return

		const cmd = line.trim()
		if (cmd === "") {
			rl.prompt()
			return
		}

		// 退出指令（在 executeCommand 之前处理）
		if (["退", "quit", "q"].includes(cmd)) {
			console.log("退出")
			closed = true
			rl.close()
			return
		}

		// 使用统一指令执行器
		const ctx: CommandContext = {
			world,
			expDB,
			ruleDB,
			plannedActions,
			onSwitchMap: (mapId) => {
				const newMap = resolveMap(mapId)
				if (newMap) {
					switching = true
					closed = true
					rl.close()
					startGame(newMap)
				}
			},
			onPlanUpdate: () => {}
		}

		const result = executeCommand(ctx, cmd)

		// 处理特殊指令
		if (cmd === "图") {
			world.printGlobalMap()
		} else if (cmd === "全") {
			world.printGlobalMap()
			console.log(renderView(world.getLocalView()))
		}

		// 输出结果
		console.log(`\n${result.msg}`)

		// 显示视野（动作类指令后）
		if (["上", "下", "左", "右", "互", "等", "执"].some(c => cmd.startsWith(c))) {
			console.log(`[${world.getPlayerStatus()}]`)
			if (plannedActions.length > 0) {
				console.log(`剩余计划: ${plannedActions.join(" → ")}`)
			}
			console.log(renderView(world.getLocalView()))
		}

		// 游戏结束
		if (result.terminate) {
			console.log("\n✅ 游戏通关！")
		}

		if (!closed && !switching) {
			rl.prompt()
		}
	})
}

// 启动
const args = parseArgs()

if (args.mapId) {
	const mapData = resolveMap(args.mapId)
	if (mapData) {
		startGame(mapData)
	} else {
		console.error(`找不到地图: ${args.mapId}`)
		printMapList()
		process.exit(1)
	}
} else {
	showMenu()
}
