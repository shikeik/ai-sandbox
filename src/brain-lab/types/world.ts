// ========== 世界状态类型 ==========

import type { ElementType } from "./element.js"
import type { Position } from "./position.js"

/** 尖刺状态 */
export interface SpikeState {
	x: number                  // 尖刺x坐标（固定）
	initialY: number           // 初始y坐标
	currentY: number           // 当前y坐标
	falling: boolean           // 是否正在坠落
	triggered: boolean         // 是否已触发
	buttonX: number            // 关联按钮的x坐标（用于颜色绑定）
	buttonY: number            // 关联按钮的y坐标（用于颜色绑定）
}

/** 游戏世界状态 */
export interface WorldState {
	grid: number[][]           // [y][x] 格子元素ID
	hero: Position             // 主角位置
	enemies: Position[]        // 敌人位置
	triggers: boolean[]        // 按钮触发状态
	spikes: SpikeState[]       // 多个尖刺状态
}

/** 世界尺寸 */
export interface WorldSize {
	width: number
	height: number
}

/** 按钮-尖刺绑定关系（一对一） */
export interface ButtonSpikeBinding {
	button: { x: number; y: number }  // 按钮坐标
	spike: { x: number; y: number }   // 绑定的尖刺坐标
}

/** 关卡数据定义 */
export interface LevelData {
	name: string
	map: string[]           // 字符地图（从上到下的视觉顺序）
	width: number
	height: number
	bindings?: ButtonSpikeBinding[]  // 按钮-尖刺绑定关系（可选，默认按x坐标排序绑定）
}
