// ========== 因果链 AI - 命令行版本 ==========
// 纯逻辑验证，支持控制台输入指令
// 运行: npx tsx test/ts/causal-ai/cli-game.ts

import * as readline from "node:readline"

// ========== 类型定义 ==========

type Action = "上" | "下" | "左" | "右" | "互" | "等"

interface Position {
	x: number
	y: number
}

interface GameObject {
	type: string
	id: string
	state?: Record<string, unknown>
}

interface Cell {
	terrain: string
	objects: GameObject[]
}

// 视野只包含相对坐标 3x3
interface LocalView {
	cells: Map<string, Cell>  // key: "dx,dy"
}

// ========== 游戏世界 ==========

class World {
	private grid: Map<string, Cell> = new Map()
	private agentPos: Position = { x: 0, y: 0 }
	private agentFacing: Action = "右"  // 默认面朝右
	private hasKey = false  // 是否持有钥匙
	private width: number
	private height: number

	constructor(width: number, height: number) {
		this.width = width
		this.height = height
		this.initSimpleMap()
	}

	// 初始化简单地图：起点(0,0) - 钥匙(1,2) - 门(3,0) - 终点(5,0)
	private initSimpleMap(): void {
		// 清空
		this.grid.clear()

		// 填充空地
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				this.setCell(x, y, { terrain: "．", objects: [] })
			}
		}

		// 放置对象
		this.addObject(0, 0, { type: "agent", id: "p1" })
		this.addObject(1, 2, { type: "钥匙", id: "k1" })
		this.addObject(3, 0, { type: "门", id: "d1", state: { open: false } })
		this.addObject(5, 0, { type: "终点", id: "goal" })

		// 放置墙壁（简单阻挡）
		this.setCell(2, 1, { terrain: "＃", objects: [] })
		this.setCell(2, 2, { terrain: "＃", objects: [] })

		this.agentPos = { x: 0, y: 0 }
		this.agentFacing = "右"
		this.hasKey = false
	}

	private getKey(x: number, y: number): string {
		return `${x},${y}`
	}

	private getCell(x: number, y: number): Cell {
		return this.grid.get(this.getKey(x, y)) || { terrain: "＃", objects: [] }
	}

	private setCell(x: number, y: number, cell: Cell): void {
		this.grid.set(this.getKey(x, y), cell)
	}

	private addObject(x: number, y: number, obj: GameObject): void {
		const cell = this.getCell(x, y)
		cell.objects.push(obj)
		this.setCell(x, y, cell)
	}

	private removeObject(x: number, y: number, id: string): void {
		const cell = this.getCell(x, y)
		cell.objects = cell.objects.filter(o => o.id !== id)
		this.setCell(x, y, cell)
	}

	// 获取 Agent 的 5x5 局部视野
	getLocalView(): LocalView {
		const view: LocalView = { cells: new Map() }

		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				const x = this.agentPos.x + dx
				const y = this.agentPos.y + dy
				const cell = this.getCell(x, y)
				view.cells.set(`${dx},${dy}`, cell)
			}
		}

		return view
	}

	// 执行动作
	execute(action: Action): { success: boolean; msg: string; reward: number } {
		const [ax, ay] = [this.agentPos.x, this.agentPos.y]
		let nx = ax, ny = ay

		switch (action) {
		case "上": ny = ay - 1; this.agentFacing = "上"; break
		case "下": ny = ay + 1; this.agentFacing = "下"; break
		case "左": nx = ax - 1; this.agentFacing = "左"; break
		case "右": nx = ax + 1; this.agentFacing = "右"; break
		case "等":
			return { success: true, msg: "等", reward: 0 }
		case "互":
			return this.handleInteract(ax, ay)
		}

		// 移动逻辑
		if (nx !== ax || ny !== ay) {
			const targetCell = this.getCell(nx, ny)

			// 检查墙壁
			if (targetCell.terrain === "＃") {
				return { success: false, msg: "撞墙", reward: -0.1 }
			}

			// 检查关闭的门
			const door = targetCell.objects.find(o => o.type === "门")
			if (door && !door.state?.open) {
				return { success: false, msg: "门关闭", reward: -0.1 }
			}

			// 移动 Agent
			this.removeObject(ax, ay, "p1")
			this.addObject(nx, ny, { type: "agent", id: "p1" })
			this.agentPos = { x: nx, y: ny }

			// 检查终点
			if (targetCell.objects.some(o => o.type === "终点")) {
				return { success: true, msg: "🎉 到达终点！", reward: 10 }
			}

			return { success: true, msg: `移动到 (${nx},${ny})`, reward: 0.1 }
		}

		return { success: false, msg: "无效动作", reward: 0 }
	}

	private handleInteract(x: number, y: number): { success: boolean; msg: string; reward: number } {
		const cell = this.getCell(x, y)

		// 拾取钥匙（站上去拾取）
		const key = cell.objects.find(o => o.type === "钥匙")
		if (key) {
			this.removeObject(x, y, key.id)
			this.hasKey = true
			return { success: true, msg: "拾取钥匙", reward: 1 }
		}

		// 面朝方向开门
		const facingMap: Record<Action, [number, number, string]> = {
			"上": [0, -1, "上"],
			"下": [0, 1, "下"],
			"左": [-1, 0, "左"],
			"右": [1, 0, "右"],
			"等": [0, 0, "前"],
			"互": [0, 0, "前"]
		}

		const [dx, dy, name] = facingMap[this.agentFacing] as [number, number, string]
		const nx = x + dx, ny = y + dy
		const ncell = this.getCell(nx, ny)

		// 开门
		const door = ncell.objects.find(o => o.type === "门")
		if (door && !door.state?.open) {
			if (!this.hasKey) {
				return { success: false, msg: `面朝${name}方有门，但没有钥匙`, reward: -0.1 }
			}
			door.state = { open: true }
			this.hasKey = false  // 消耗钥匙
			return { success: true, msg: `打开${name}方的门（消耗钥匙）`, reward: 1 }
		}

		return { success: false, msg: `面朝${name}方，无可互对象`, reward: -0.1 }
	}

	// 获取玩家状态字符串
	getPlayerStatus(): string {
		const keyIcon = this.hasKey ? "🔑" : "❌"
		const facingIcon: Record<Action, string> = {
			"上": "↑", "下": "↓", "左": "←", "右": "→",
			"等": "○", "互": "✋"
		}
		return `位置(${this.agentPos.x},${this.agentPos.y}) 面朝${facingIcon[this.agentFacing]} 钥匙${keyIcon}`
	}

	// 获取全局地图（调试用）
	printGlobalMap(): void {
		console.log("\n全局地图:")
		console.log("  " + Array.from({length: this.width}, (_, i) => i).join(" "))
		for (let y = 0; y < this.height; y++) {
			let row = `${y} `
			for (let x = 0; x < this.width; x++) {
				const cell = this.getCell(x, y)
				let char = cell.terrain
				if (cell.objects.length > 0) {
					const obj = cell.objects[0]
					if (obj.type === "agent") char = "＠"
					else if (obj.type === "钥匙") char = "🔑"
					else if (obj.type === "门") char = obj.state?.open ? "🚪" : "🚧"
					else if (obj.type === "终点") char = "🚩"
				}
				row += char + " "
			}
			console.log(row)
		}
		console.log(`Agent 位置: (${this.agentPos.x}, ${this.agentPos.y})`)
	}
}

// ========== 渲染 ==========

function renderView(view: LocalView): string {
	let output = "\n局部视野 (5x5):\n"

	for (let dy = -2; dy <= 2; dy++) {
		let row = ""
		for (let dx = -2; dx <= 2; dx++) {
			const cell = view.cells.get(`${dx},${dy}`)
			let char = cell?.terrain || "？"

			// 显示对象（优先显示）
			if (cell?.objects.length) {
				const obj = cell.objects[0]
				switch (obj.type) {
				case "agent": char = "＠"; break
				case "钥匙": char = "🔑"; break
				case "门": char = obj.state?.open ? "🚪" : "🚧"; break
				case "终点": char = "🚩"; break
				}
			}

			// 中心 Agent 用不同标记
			if (dx === 0 && dy === 0) {
				row += char + " "  // Agent 位置
			} else {
				row += char + " "
			}
		}
		output += row + "\n"
	}

	return output
}


// ========== 命令行交互 ==========

function createCLI() {
	const world = new World(6, 4)
	let totalReward = 0

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "指令(上/下/左/右/互/等/图/全/退): "
	})

	console.log("===== 因果链 AI - 命令行版 =====")
	console.log("Agent 只能看到周围 5x5 格子")
	console.log("＠ = 你自己  🔑 = 钥匙  🚧 = 关闭的门  🚪 = 打开的门  🚩 = 终点  ＃ = 墙  ． = 空地")
	console.log("\n初始状态:")
	world.printGlobalMap()

	const view = world.getLocalView()
	console.log(renderView(view))

	rl.prompt()

	rl.on("line", (line) => {
		const cmd = line.trim()

		switch (cmd) {
		case "上":
		case "下":
		case "左":
		case "右":
		case "互":
		case "等": {
			const action: Action = cmd === "等" ? "等" : cmd as Action
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

// 启动
createCLI()
