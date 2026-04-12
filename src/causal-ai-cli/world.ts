// ========== 游戏世界 ==========

import type { Action, Position, GameObject, Cell, LocalView } from "./types"
import type { MapConfig } from "./maps"

export class World {
	private grid: Map<string, Cell> = new Map()
	private agentPos: Position = { x: 0, y: 0 }
	private agentFacing: Action = "右"
	private hasKey = false
	private width: number
	private height: number
	private mapConfig: MapConfig

	constructor(mapConfig: MapConfig) {
		this.mapConfig = mapConfig
		this.width = mapConfig.width
		this.height = mapConfig.height
		this.loadMap()
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

	private loadMap(): void {
		this.grid.clear()

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				this.setCell(x, y, { terrain: "．", objects: [] })
			}
		}

		for (const wall of this.mapConfig.walls) {
			this.setCell(wall.x, wall.y, { terrain: "＃", objects: [] })
		}

		this.addObject(this.mapConfig.agent.x, this.mapConfig.agent.y, { type: "agent", id: "p1" })
		this.addObject(this.mapConfig.key.x, this.mapConfig.key.y, { type: "钥匙", id: "k1" })
		this.addObject(this.mapConfig.door.x, this.mapConfig.door.y, { type: "门", id: "d1", state: { open: false } })
		this.addObject(this.mapConfig.goal.x, this.mapConfig.goal.y, { type: "终点", id: "goal" })

		this.agentPos = { x: this.mapConfig.agent.x, y: this.mapConfig.agent.y }
		this.agentFacing = "右"
		this.hasKey = false
	}

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

		if (nx !== ax || ny !== ay) {
			const targetCell = this.getCell(nx, ny)

			if (targetCell.terrain === "＃") {
				return { success: false, msg: "撞墙", reward: -0.1 }
			}

			const door = targetCell.objects.find(o => o.type === "门")
			if (door && !door.state?.open) {
				return { success: false, msg: "门关闭", reward: -0.1 }
			}

			this.removeObject(ax, ay, "p1")
			this.addObject(nx, ny, { type: "agent", id: "p1" })
			this.agentPos = { x: nx, y: ny }

			if (targetCell.objects.some(o => o.type === "终点")) {
				return { success: true, msg: "🎉 到达终点！", reward: 10 }
			}

			return { success: true, msg: `移动到 (${nx},${ny})`, reward: 0.1 }
		}

		return { success: false, msg: "无效动作", reward: 0 }
	}

	private handleInteract(x: number, y: number): { success: boolean; msg: string; reward: number } {
		const cell = this.getCell(x, y)

		const key = cell.objects.find(o => o.type === "钥匙")
		if (key) {
			this.removeObject(x, y, key.id)
			this.hasKey = true
			return { success: true, msg: "拾取钥匙", reward: 1 }
		}

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

		const door = ncell.objects.find(o => o.type === "门")
		if (door && !door.state?.open) {
			if (!this.hasKey) {
				return { success: false, msg: `面朝${name}方有门，但没有钥匙`, reward: -0.1 }
			}
			door.state = { open: true }
			this.hasKey = false
			return { success: true, msg: `打开${name}方的门（消耗钥匙）`, reward: 1 }
		}

		return { success: false, msg: `面朝${name}方，无可互对象`, reward: -0.1 }
	}

	getPlayerStatus(): string {
		const keyIcon = this.hasKey ? "🔑" : "❌"
		const facingIcon: Record<Action, string> = {
			"上": "↑", "下": "↓", "左": "←", "右": "→",
			"等": "○", "互": "✋"
		}
		return `位置(${this.agentPos.x},${this.agentPos.y}) 面朝${facingIcon[this.agentFacing]} 钥匙${keyIcon}`
	}

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
