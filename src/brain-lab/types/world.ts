// ========== 世界状态类型 ==========

import type { ElementType } from "./element.js"
import type { Position } from "./position.js"

/** 游戏世界状态 */
export interface WorldState {
	grid: number[][]           // [y][x] 格子元素ID
	hero: Position             // 主角位置
	enemies: Position[]        // 敌人位置
	triggers: boolean[]        // 机关触发状态
	spikeFalling?: boolean     // 尖刺是否正在坠落
	spikeY?: number            // 尖刺当前y坐标
}

/** 世界尺寸 */
export interface WorldSize {
	width: number
	height: number
}

/** 关卡数据定义 */
export interface LevelData {
	name: string
	map: string[]           // 字符地图（从上到下的视觉顺序）
	width: number
	height: number
}
