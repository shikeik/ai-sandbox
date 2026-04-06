// ========== AI/决策类型 ==========

import type { ActionType } from "./action.js"
import type { WorldState } from "./world.js"
import type { Position } from "./position.js"

/** 想象结果（单步推演） */
export interface Imagination {
	action: ActionType          // 想象的动作
	predictedState: WorldState  // 预测的未来状态
	predictedReward: number     // 预测奖励
	steps: number               // 想象的步数
	killedEnemy?: boolean       // 是否击杀敌人
}

/** 大脑决策结果 */
export interface BrainDecision {
	selectedAction: ActionType
	imaginations: Imagination[]  // 所有想象的轨迹
	reasoning: string            // 决策理由（用于显示）
}

/** 探索记忆（用于高级AI） */
export interface ExplorationMemory {
	visited: Set<string>         // "x,y" 已访问
	frontier: Position[]         // 边界（可探索的邻居）
}
