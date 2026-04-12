// ========== 游戏世界 ==========
// 规则驱动，与具体地图配置解耦

import type { 
	Action, Position, Tile, GameObject, 
	MapData, LocalView, ActionResult, AgentState 
} from "./types"
import { TILE_MAP } from "./types"
import { getRule } from "./rules"

export class World {
	private mapData: MapData
	private grid: Map<string, Tile> = new Map()
	private objects: Map<string, GameObject> = new Map()
	private agentState: AgentState
	private totalReward = 0
	private terminated = false

	constructor(mapData: MapData) {
		this.mapData = mapData
		this.agentState = {
			pos: { x: 0, y: 0 },
			facing: "右",
			inventory: []
		}
		this.loadMap()
	}

	// ========== 内部工具方法 ==========

	private getKey(x: number, y: number): string {
		return `${x},${y}`
	}

	private getTile(x: number, y: number): Tile {
		return this.grid.get(this.getKey(x, y)) || TILE_MAP["＃"]!
	}

	private inBounds(x: number, y: number): boolean {
		return x >= 0 && x < this.mapData.width && y >= 0 && y < this.mapData.height
	}

	// ========== 地图加载 ==========

	private loadMap(): void {
		// 加载地形
		for (let y = 0; y < this.mapData.height; y++) {
			const row = this.mapData.tiles[y] || ""
			for (let x = 0; x < this.mapData.width; x++) {
				const char = row[x] || "＃"
				const tile = TILE_MAP[char] || TILE_MAP["．"]!
				this.grid.set(this.getKey(x, y), tile)
			}
		}

		// 加载对象
		this.objects.clear()
		for (const obj of this.mapData.objects) {
			this.objects.set(obj.id, { ...obj })
			if (obj.type === "agent") {
				this.agentState.pos = { ...obj.pos }
			}
		}
	}

	// ========== 公共查询方法 ==========

	getObject(id: string): GameObject | undefined {
		return this.objects.get(id)
	}

	getObjectsAt(pos: Position): GameObject[] {
		const result: GameObject[] = []
		for (const obj of this.objects.values()) {
			if (obj.pos.x === pos.x && obj.pos.y === pos.y) {
				result.push(obj)
			}
		}
		return result
	}

	getObjectsByType(type: string): GameObject[] {
		return Array.from(this.objects.values()).filter(o => o.type === type)
	}

	getAgentState(): AgentState {
		return { ...this.agentState, pos: { ...this.agentState.pos } }
	}

	// ========== 对象操作 ==========

	removeObject(id: string): void {
		this.objects.delete(id)
	}

	setObjectState(id: string, key: string, value: unknown): void {
		const obj = this.objects.get(id)
		if (obj) {
			if (!obj.state) obj.state = {}
			obj.state[key] = value
		}
	}

	// ========== 动作执行 ==========

	execute(action: Action): { result: ActionResult; view: LocalView } {
		if (this.terminated) {
			return {
				result: { success: false, msg: "游戏已结束", reward: 0 },
				view: this.getLocalView()
			}
		}

		let result: ActionResult

		switch (action) {
		case "上":
		case "下":
		case "左":
		case "右":
			result = this.handleMove(action)
			break
		case "等":
			result = { success: true, msg: "等待", reward: 0 }
			break
		case "互":
			result = this.handleInteract()
			break
		default:
			result = { success: false, msg: "无效动作", reward: 0 }
		}

		this.totalReward += result.reward
		if (result.terminate) {
			this.terminated = true
		}

		return { result, view: this.getLocalView() }
	}

	private handleMove(action: Action): ActionResult {
		const [ax, ay] = [this.agentState.pos.x, this.agentState.pos.y]
		let nx = ax, ny = ay

		switch (action) {
		case "上": ny = ay - 1; this.agentState.facing = "上"; break
		case "下": ny = ay + 1; this.agentState.facing = "下"; break
		case "左": nx = ax - 1; this.agentState.facing = "左"; break
		case "右": nx = ax + 1; this.agentState.facing = "右"; break
		}

		// 边界检查
		if (!this.inBounds(nx, ny)) {
			return { success: false, msg: "超出边界", reward: -0.1 }
		}

		// 地形检查
		const targetTile = this.getTile(nx, ny)
		if (!targetTile.walkable) {
			return { success: false, msg: "撞墙", reward: -0.1 }
		}

		// 对象阻挡检查
		const objectsAtTarget = this.getObjectsAt({ x: nx, y: ny })
		for (const obj of objectsAtTarget) {
			const rule = getRule(obj.type)
			if (rule?.blocksMovement) {
				if (typeof rule.blocksMovement === "function") {
					if (rule.blocksMovement(obj.state)) {
						return { success: false, msg: `被${obj.type}阻挡`, reward: -0.1 }
					}
				} else {
					return { success: false, msg: `被${obj.type}阻挡`, reward: -0.1 }
				}
			}
		}

		// 执行移动
		this.agentState.pos = { x: nx, y: ny }

		// 同步更新 objects 中 agent 的位置
		const agentObj = Array.from(this.objects.values()).find(o => o.type === "agent")
		if (agentObj) {
			agentObj.pos = { x: nx, y: ny }
		}

		// 触发 onEnter
		for (const obj of objectsAtTarget) {
			const rule = getRule(obj.type)
			if (rule?.onEnter) {
				const ctx = { world: this, obj, agent: this.agentState }
				const enterResult = rule.onEnter(ctx)
				if (enterResult.sideEffect) {
					enterResult.sideEffect()
				}
				return enterResult
			}
		}

		return { success: true, msg: `移动到 (${nx},${ny})`, reward: 0.1 }
	}

	private handleInteract(): ActionResult {
		const { x, y } = this.agentState.pos
		const facingMap: Record<Action, [number, number, string]> = {
			"上": [0, -1, "上"],
			"下": [0, 1, "下"],
			"左": [-1, 0, "左"],
			"右": [1, 0, "右"],
			"等": [0, 0, "前"],
			"互": [0, 0, "前"]
		}

		// 先检查脚下
		const objectsHere = this.getObjectsAt({ x, y })
		for (const obj of objectsHere) {
			const rule = getRule(obj.type)
			if (rule?.onInteract) {
				const ctx = { world: this, obj, agent: this.agentState }
				const result = rule.onInteract(ctx)
				if (result.sideEffect) {
					result.sideEffect()
				}
				return result
			}
		}

		// 检查面朝方向
		const [dx, dy, name] = facingMap[this.agentState.facing]
		const nx = x + dx, ny = y + dy

		if (dx === 0 && dy === 0) {
			return { success: false, msg: "无可互对象", reward: -0.1 }
		}

		const objectsThere = this.getObjectsAt({ x: nx, y: ny })
		for (const obj of objectsThere) {
			const rule = getRule(obj.type)
			if (rule?.onInteract) {
				const ctx = { world: this, obj, agent: this.agentState }
				const result = rule.onInteract(ctx)
				if (result.sideEffect) {
					result.sideEffect()
				}
				return result
			}
		}

		return { success: false, msg: `面朝${name}方，无可互对象`, reward: -0.1 }
	}

	// ========== 视野获取 ==========

	getLocalView(range = 2): LocalView {
		const view: LocalView = { width: range * 2 + 1, height: range * 2 + 1, cells: new Map() }

		for (let dy = -range; dy <= range; dy++) {
			for (let dx = -range; dx <= range; dx++) {
				const x = this.agentState.pos.x + dx
				const y = this.agentState.pos.y + dy
				const tile = this.inBounds(x, y) ? this.getTile(x, y) : TILE_MAP["＃"]!
				const objects = this.inBounds(x, y) ? this.getObjectsAt({ x, y }) : []
				view.cells.set(`${dx},${dy}`, { tile, objects })
			}
		}

		return view
	}

	// ========== 状态查询 ==========

	getPlayerStatus(): string {
		const keyIcon = this.agentState.inventory.includes("钥匙") ? "🔑" : "❌"
		const facingIcon: Record<Action, string> = {
			"上": "↑", "下": "↓", "左": "←", "右": "→",
			"等": "○", "互": "✋"
		}
		return `位置(${this.agentState.pos.x},${this.agentState.pos.y}) 面朝${facingIcon[this.agentState.facing]} 钥匙${keyIcon}`
	}

	isTerminated(): boolean {
		return this.terminated
	}

	getTotalReward(): number {
		return this.totalReward
	}

	// ========== 调试输出 ==========

	printGlobalMap(): void {
		console.log("\n全局地图:")
		console.log("  " + Array.from({ length: this.mapData.width }, (_, i) => i).join(" "))
		for (let y = 0; y < this.mapData.height; y++) {
			let row = `${y} `
			for (let x = 0; x < this.mapData.width; x++) {
				const tile = this.getTile(x, y)
				const objects = this.getObjectsAt({ x, y })

				let char = this.getTileChar(tile)
				if (objects.length > 0) {
					char = this.getObjectChar(objects[0]!)
				}
				row += char + " "
			}
			console.log(row)
		}
	}

	private getTileChar(tile: Tile): string {
		for (const [char, t] of Object.entries(TILE_MAP)) {
			if (t.type === tile.type) return char
		}
		return "？"
	}

	private getObjectChar(obj: GameObject): string {
		switch (obj.type) {
		case "agent": return "＠"
		case "钥匙": return "🔑"
		case "门": return obj.state?.open ? "🚪" : "🚧"
		case "终点": return "🚩"
		default: return "？"
		}
	}
}
