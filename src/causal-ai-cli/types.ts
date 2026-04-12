// ========== 类型定义 ==========

export type Action = "上" | "下" | "左" | "右" | "互" | "等"

export interface Position {
	x: number
	y: number
}

export interface GameObject {
	type: string
	id: string
	state?: Record<string, unknown>
}

export interface Cell {
	terrain: string
	objects: GameObject[]
}

export interface LocalView {
	cells: Map<string, Cell>
}
