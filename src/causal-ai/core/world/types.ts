// ========== 类型定义 ==========

export type Action = "上" | "下" | "左" | "右" | "互" | "等"

export interface Position {
	x: number
	y: number
}

// ========== 地图相关类型 ==========

export interface Tile {
	type: string
	walkable: boolean
}

// 地形字符映射（全角字符）
export const TILE_MAP: Record<string, Tile> = {
	"＃": { type: "wall", walkable: false },
	"．": { type: "floor", walkable: true },
	"～": { type: "water", walkable: false },
}

export interface GameObject {
	id: string
	type: string
	pos: Position
	state?: Record<string, unknown>
	properties?: Record<string, unknown>
}

export interface MapData {
	id: string
	name: string
	width: number
	height: number
	tiles: string[]        // 每行一个字符串，使用全角字符
	objects: GameObject[]
}

// ========== 游戏规则相关类型 ==========

export interface ActionResult {
	success: boolean
	msg: string
	reward: number
	terminate?: boolean
	sideEffect?: () => void
}

export interface AgentState {
	pos: Position
	facing: Action
	inventory: string[]
}

export interface RuleContext {
	world: World
	obj: GameObject
	agent: AgentState
}

export interface ObjectRule {
	blocksMovement?: boolean | ((state: Record<string, unknown>) => boolean)
	onInteract?: (ctx: RuleContext) => ActionResult
	onEnter?: (ctx: RuleContext) => ActionResult
	onExit?: (ctx: RuleContext) => ActionResult
}

// 前向声明 World 类用于 RuleContext
export declare class World {
	getObject(id: string): GameObject | undefined
	removeObject(id: string): void
	setObjectState(id: string, key: string, value: unknown): void
	getObjectsAt(pos: Position): GameObject[]
	getAgentState(): AgentState
}

// ========== 视野相关类型 ==========

export interface LocalView {
	width: number
	height: number
	// key: "dx,dy", value: 该位置的 Tile 和 Objects
	cells: Map<string, { tile: Tile; objects: GameObject[] }>
}
