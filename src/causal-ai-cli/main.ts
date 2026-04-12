// ========== 因果链 AI - 命令行版本 ==========
// 运行: npx tsx src/causal-ai-cli/main.ts
// 指定地图: npx tsx src/causal-ai-cli/main.ts --map simple
// 自定义地图: 创建 map_xxx.ts 文件，然后 --map xxx

import * as readline from "node:readline"
import { MAPS, getMapById, listMaps, type MapConfig } from "./maps"
import { loadMap, listAllMaps } from "./map-loader"
import { World } from "./world"
import { renderView } from "./renderer"
import type { Action } from "./types"

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

// 启动游戏
function startGame(mapConfig: MapConfig): void {
	const world = new World(mapConfig)
	let totalReward = 0

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "指令(上/下/左/右/互/等/图/全/退): "
	})

	console.log(`\n===== ${mapConfig.name} (${mapConfig.width}×${mapConfig.height}) =====`)
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
			const action: Action = cmd as Action
			const result = world.execute(action)
			totalReward += result.reward
			console.log(`\n${result.msg} (奖励: ${result.reward}, 总奖励: ${totalReward.toFixed(1)})`)
			console.log(`[${world.getPlayerStatus()}]`)

			const view = world.getLocalView()
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

		case "退":
		case "quit":
		case "q":
			console.log("退出")
			rl.close()
			return

		default:
			console.log("未知指令。可用: 上/下/左/右/互/等/图/全/退")
		}

		rl.prompt()
	})

	rl.on("close", () => {
		console.log("\n再见!")
		process.exit(0)
	})
}

// 选图菜单
function showMenu(): void {
	const allMaps = listAllMaps()

	console.log("===== 因果链 AI - 命令行版 =====\n")
	console.log("可用地图:")
	for (const m of allMaps) {
		console.log(`  ${m.id} - ${m.name} (${m.source})`)
	}
	console.log("\n提示: 创建 gamedatas/maps/xxx.json 来自定义地图")

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})

	rl.question("\n输入地图ID (如: simple) 或按回车默认: ", (answer) => {
		rl.close()

		const input = answer.trim()
		let mapConfig: MapConfig | null = null

		if (input === "") {
			mapConfig = MAPS[0]
		} else {
			mapConfig = loadMap(input)
		}

		if (mapConfig) {
			startGame(mapConfig)
		} else {
			console.log(`未知地图: ${input}`)
			console.log(`可用地图: ${allMaps.map(m => m.id).join(", ")}`)
			console.log("使用默认地图 simple")
			startGame(MAPS[0])
		}
	})
}

// 主入口
function main(): void {
	const args = parseArgs()

	if (args.mapId) {
		const mapConfig = loadMap(args.mapId)
		if (mapConfig) {
			startGame(mapConfig)
		} else {
			console.log(`未知地图: ${args.mapId}`)
			console.log(`可用内置地图: ${MAPS.map(m => m.id).join(", ")}`)
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
