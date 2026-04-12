// ========== 因果链 AI - 类型定义 ==========

// 位置
export interface Position {
	x: number
	y: number
}

// 游戏状态
export interface GameState {
	agent: Position
	holding: ItemType | null
	keyExists: boolean
	doorOpen: boolean
}

// 物品类型
export type ItemType = "key"

// 动作类型
export type ActionType = "move_up" | "move_down" | "move_left" | "move_right" | "pickup"

// 移动方向
export type Direction = "up" | "down" | "left" | "right"

// 经验记录
export interface Experience {
	before: GameState
	action: ActionType
	after: GameState
}

// 规则结构
export interface Rule {
	action: string
	description: string
	struct: {
		action: string
		pre: (s: GameState) => boolean
		eff: (s: GameState) => Partial<GameState>
	}
}

// 网格单元格类型
export type CellType = "empty" | "wall" | "door" | "key" | "flag" | "agent"

// 规划节点
export interface PlanNode {
	state: GameState
	path: ActionType[]
}

// 地图配置
export interface WorldConfig {
	gridSize: number
	cellSize: number
	walls: Set<string>
	keyPos: Position
	doorPos: Position
	flagPos: Position
}
