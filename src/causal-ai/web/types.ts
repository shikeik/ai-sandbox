// ========== 因果链 AI Web 版 - 类型定义 ==========
// 基于 core 模块的谓词表示

import type { State, Experience, Rule, Plan, PlanResult, Action } from "../core"

// 重新导出 core 类型
export type { State, Experience, Rule, Plan, PlanResult }

// 复用 core 动作类型
export type { Action } from "../core"

// Web 版特有类型

// 位置
export interface Position {
	x: number
	y: number
}

// 地图数据（与 core 一致）
export interface MapData {
	id: string
	name: string
	width: number
	height: number
	tiles: string[]
	objects: GameObject[]
}

// 游戏对象
export interface GameObject {
	id: string
	type: string
	pos: Position
	state?: Record<string, unknown>
	properties?: Record<string, unknown>
}

// 视野中的格子
export interface Cell {
	tile: Tile
	objects: GameObject[]
}

// 地形
export interface Tile {
	type: string
	walkable: boolean
}

// 局部视野
export interface LocalView {
	width: number
	height: number
	cells: Map<string, Cell>  // key: "dx,dy"
}

// 玩家状态
export interface AgentState {
	pos: Position
	facing: Action
	inventory: string[]
}

// 动作结果
export interface ActionResult {
	success: boolean
	msg: string
	reward: number
	terminate?: boolean
}

// 经验显示（用于 UI）
export interface ExperienceDisplay {
	id: number
	action: Action
	before: string
	after: string
}

// 规则显示（用于 UI）
export interface RuleDisplay {
	id: number
	action: Action
	description: string
	preconditions: string
	effects: string
}
