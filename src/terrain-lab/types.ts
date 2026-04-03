// ========== 类型定义 ==========

export type ElementType = "空气" | "狐狸" | "平地" | "史莱姆" | "恶魔" | "金币"
export type ActionType = "走" | "跳" | "远跳" | "走A"

export interface DatasetItem {
	t: number[][]
	indices: number[]
	y: number
}

export interface NetParams {
	embed: number[][]
	W1: number[][]
	b1: number[]
	W2: number[][]
	b2: number[]
}

export interface ForwardResult {
	indices: number[]
	x: number[]
	z1: number[]
	h: number[]
	z2: number[]
	o: number[]
}

export interface Gradients {
	dEmbed: number[][]
	dW1: number[][]
	db1: number[]
	dW2: number[][]
	db2: number[]
}

export interface DrawOptions {
	cellW: number
	cellH: number
	gapX: number
	gapY: number
	startX: number
	startY: number
	hideSlimeAt?: number | null  // 隐藏指定列的史莱姆（走A击杀）
	hideHeroAtCol?: number | null  // 隐藏指定列的狐狸（动画时）
	dimNonInteractive?: boolean
}

export interface ActionChecks {
	canWalk: { ok: boolean; reasons: string[] }
	canJump: { ok: boolean; reasons: string[] }
	canLongJump: { ok: boolean; reasons: string[] }
	canWalkAttack: { ok: boolean; reasons: string[] }
}
