// ========== 因果链 AI - 命令行版本 ==========
// 运行: npx tsx src/causal-ai/cli/main.ts
// 指定地图: npx tsx src/causal-ai/cli/main.ts --map default

import * as readline from "node:readline"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { type MapData, loadMapData, listMaps, setMapBasePath, DEFAULT_MAP_ID } from "./maps"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { renderView } from "./renderer"
import { CliAPI } from "./cli-api"
import { LegacyAgent } from "../agents/legacy"
import { ExperienceDB, RuleDB } from "../core/ai/learner"

// 设置地图基础路径
setMapBasePath(path.join(__dirname, "../../../gamedatas/maps"))

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

// 异步加载地图
async function resolveMap(id: string): Promise<MapData | null> {
	return await loadMapData(id)
}

// 显示可用地图列表
function printMapList(): void {
	const maps = listMaps()
	console.log("\n可用地图:")
	for (const m of maps) {
		console.log(`  ${m.id} - ${m.name}`)
	}
}

// 显示地图选择菜单
async function showMenu(): Promise<void> {
	printMapList()
	console.log("\n提示: 创建 gamedatas/maps/xxx.json 来自定义地图")
	console.log("      输入 '退' 或 'quit' 或 'q' 退出程序")
	console.log("      输入 '?' 查看游戏内指令帮助\n")

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "选择地图ID (按回车默认 default): "
	})

	rl.prompt()

	rl.on("line", async (line) => {
		const input = line.trim()

		if (input === "" || input === "default") {
			rl.close()
			const map = await loadMapData(DEFAULT_MAP_ID)
			if (map) startGame(map)
			return
		}

		if (["退", "quit", "q"].includes(input)) {
			rl.close()
			return
		}

		const mapData = await resolveMap(input)
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
	// CLI 直接操作世界（用于人类界面渲染）
	const cliApi = new CliAPI(mapData)
	// Legacy Agent 通过 AgentAPI 与世界交互，共享同一个底层世界实例
	const legacyAgent = new LegacyAgent(cliApi.getWorld(), globalExpDB, globalRuleDB)

	console.log(`\n[知识库] 经验: ${legacyAgent.expDB.getAll().length} 条, 规则: ${legacyAgent.ruleDB.getAll().length} 条`)
	console.log(`\n===== ${mapData.name} (${mapData.width}×${mapData.height}) =====`)
	console.log("Agent 只能看到周围 5x5 格子")
	console.log("＠ = 你自己  🔑 = 钥匙  🚧 = 关闭的门  🚪 = 打开的门  🚩 = 终点  ＃ = 墙  ． = 空地\n")

	// 初始状态
	console.log("初始状态:")
	console.log(renderView(cliApi.getLocalView()))

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "> "
	})

	let switching = false
	let closed = false

	rl.prompt()

	rl.on("line", async (line) => {
		if (closed) return

		const cmd = line.trim()
		if (cmd === "") {
			rl.prompt()
			return
		}

		// 退出指令
		if (["退", "quit", "q"].includes(cmd)) {
			console.log("退出")
			closed = true
			rl.close()
			return
		}

		// 人类专属指令（直接操作 CliAPI）
		if (cmd === "图") {
			cliApi.printGlobalMap()
			rl.prompt()
			return
		}

		if (cmd === "全") {
			cliApi.printGlobalMap()
			console.log(renderView(cliApi.getLocalView()))
			rl.prompt()
			return
		}

		// 其他指令通过 LegacyAgent 执行
		const result = legacyAgent.runCommand(cmd, {
			onSwitchMap: async (mapId) => {
				const newMap = await resolveMap(mapId)
				if (newMap) {
					switching = true
					closed = true
					rl.close()
					startGame(newMap)
				}
			},
			onPlanUpdate: () => {}
		})

		// 输出结果
		console.log(`\n${result.msg}`)

		// 显示视野（动作类指令后）
		if (["上", "下", "左", "右", "互", "等", "执", "学"].some(c => cmd.startsWith(c))) {
			console.log(`[${cliApi.getPlayerStatus()}]`)
			const plan = legacyAgent.getPlanSnapshot()
			if (plan.length > 0) {
				console.log(`剩余计划: ${plan.join(" → ")}`)
			}
			console.log(renderView(cliApi.getLocalView()))
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

// 异步启动
async function main(): Promise<void> {
	const args = parseArgs()

	if (args.mapId) {
		const mapData = await resolveMap(args.mapId)
		if (mapData) {
			startGame(mapData)
		} else {
			console.error(`找不到地图: ${args.mapId}`)
			printMapList()
			process.exit(1)
		}
	} else {
		await showMenu()
	}
}

main()
