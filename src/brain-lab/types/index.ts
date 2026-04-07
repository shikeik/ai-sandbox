// ========== Brain Lab 类型定义入口 ==========

// 元素
export { Element, ELEMENT_NAMES } from "./element.js"
export type { ElementType } from "./element.js"

// 位置
export type { Position, Pos } from "./position.js"

// 动作
export { ACTION_NAMES } from "./action.js"
export type { 
	ActionType, 
	AnimationType, 
	AnimationEvent, 
	ActionResult 
} from "./action.js"

// 世界
export type { WorldState, WorldSize, LevelData, SpikeState, ButtonSpikeBinding } from "./world.js"
