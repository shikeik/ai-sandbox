// ========== 2D 极简世界（从0到1试验场）==========
// 每个格子只有一个二元属性：true | false
// Agent 只能感知上下左右 4 个紧邻邻居的属性

export type Action = "上" | "下" | "左" | "右"

export interface Position {
	x: number
	y: number
}

export interface Observation {
	agent: Position
	// 只有 4 个邻居的属性，key 是方向名
	neighbors: Record<string, boolean>
}

export interface MapConfig {
	width: number
	height: number
	// 每个格子的属性，key: "x,y"
	cells: Map<string, boolean>
	agentStart: Position
}

export class MinimalWorld {
	private width: number
	private height: number
	private cells: Map<string, boolean>
	private agent: Position

	constructor(config: MapConfig) {
		this.width = config.width
		this.height = config.height
		this.cells = new Map(config.cells)
		this.agent = { ...config.agentStart }
	}

	private getKey(x: number, y: number): string {
		return `${x},${y}`
	}

	private inBounds(x: number, y: number): boolean {
		return x >= 0 && x < this.width && y >= 0 && y < this.height
	}

	private getCell(x: number, y: number): boolean {
		return this.cells.get(this.getKey(x, y)) ?? false
	}

	private getNeighbors(): Record<string, boolean> {
		const { x, y } = this.agent
		return {
			"上": this.inBounds(x, y - 1) ? this.getCell(x, y - 1) : false,
			"下": this.inBounds(x, y + 1) ? this.getCell(x, y + 1) : false,
			"左": this.inBounds(x - 1, y) ? this.getCell(x - 1, y) : false,
			"右": this.inBounds(x + 1, y) ? this.getCell(x + 1, y) : false
		}
	}

	private getDirectionDelta(action: Action): [number, number] {
		switch (action) {
		case "上": return [0, -1]
		case "下": return [0, 1]
		case "左": return [-1, 0]
		case "右": return [1, 0]
		}
	}

	step(action: Action): { observation: Observation; result: { success: boolean } } {
		const [dx, dy] = this.getDirectionDelta(action)
		const nx = this.agent.x + dx
		const ny = this.agent.y + dy

		// 移动规则：目标格子属性为 true 才能移动
		// 超出边界视为 false（不能移动）
		const canMove = this.inBounds(nx, ny) && this.getCell(nx, ny)

		if (canMove) {
			this.agent = { x: nx, y: ny }
		}

		return {
			observation: {
				agent: { ...this.agent },
				neighbors: this.getNeighbors()
			},
			result: { success: canMove }
		}
	}

	observe(): Observation {
		return {
			agent: { ...this.agent },
			neighbors: this.getNeighbors()
		}
	}

	reset(config: MapConfig): void {
		this.width = config.width
		this.height = config.height
		this.cells = new Map(config.cells)
		this.agent = { ...config.agentStart }
	}
}
