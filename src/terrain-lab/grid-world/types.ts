// ========== 格子世界系统 - 类型定义 ==========
// 职责：统一的地形世界类型定义

import type { ActionType } from "../types.js"

// ========== 元素定义 ==========

export interface ElementDef {
	id: number
	name: string
	emoji: string
	layer: number | number[]  // 可放置的层（单层或数组）
	isSolid?: boolean         // 是否实心（影响跳跃着陆）
	isEnemy?: boolean         // 是否敌人（可被击杀）
	isCollectible?: boolean   // 是否可收集
	blocksWalk?: boolean      // 是否阻挡行走
	blocksJump?: boolean      // 是否阻挡跳跃
}

// ========== 格子世界配置 ==========

export interface GridWorldConfig {
	width: number             // 地图宽度（列数）
	height: number            // 地图高度（层数）
	elements: ElementDef[]    // 元素定义
	viewportWidth?: number    // 视野宽度（默认全部显示）
	cellSize?: number         // 格子大小（默认44）
	gap?: number              // 格子间距（默认6）
	scale?: number            // 整体缩放比例（默认1.0）
}

// ========== 渲染配置 ==========

export interface RenderOptions {
	canvas: HTMLCanvasElement
	heroCol?: number          // 主角列位置（世界坐标）
	cameraCol?: number        // 相机位置（用于滚动）
	hideHeroAtCol?: number | null    // 隐藏指定列的狐狸（动画时）
	hideSlimeAtCol?: number | null   // 隐藏指定列的史莱姆（击杀时）
	showLayerLabels?: boolean // 是否显示层标签
	showColLabels?: boolean   // 是否显示列标签
}

export interface LayoutMetrics {
	cellW: number
	cellH: number
	gapX: number
	gapY: number
	startX: number
	startY: number
	gridW: number
	gridH: number
}

// ========== 动画配置 ==========

export interface AnimationConfig {
	duration: number          // 动画持续时间（ms）
	jumpHeight?: number       // 跳跃高度（像素）
	easing?: (t: number) => number  // 缓动函数
}

export interface AnimationState {
	isPlaying: boolean
	startTime: number
	progress: number          // 0-1
	action: ActionType | null
	slimeKilled: boolean
}

export interface AnimationResult {
	success: boolean
	progress: number
	slimeKilled: boolean
}

// ========== 动作检查结果 ==========

export interface ActionCheckResult {
	ok: boolean
	reasons: string[]
	targetCol: number
	isJump: boolean
}

export interface ActionResult {
	action: ActionType
	fromCol: number
	targetCol: number
	isValid: boolean
	isJump: boolean
	isDeath: boolean
	deathReason?: string
	killedEnemies: Position[]    // 击杀的敌人位置
	collectedItems: Position[]   // 收集的物品位置
}

export interface Position {
	row: number
	col: number
}

// ========== 格子世界状态 ==========

export interface GridWorldState {
	grid: number[][]          // 地形数据 [layer][col]
	heroCol: number           // 主角列位置
	heroRow: number           // 主角层位置（固定为1）
	cameraCol: number         // 相机位置（用于滚动视图）
	animation: AnimationState
}

// ========== 编辑器配置 ==========

export interface EditorConfig {
	enabled: boolean
	selectedBrush: number
	allowedElements: number[][]  // 每层允许的元素 [layer] -> elementIds
}

export interface CellPos {
	row: number
	col: number
}
