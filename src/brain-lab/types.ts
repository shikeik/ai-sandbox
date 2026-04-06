// ========== Brain Lab 类型定义 ==========

// 元素类型
export const ELEM = {
	AIR: 0,
	HERO: 1,
	PLATFORM: 2,
	ENEMY: 3,
	GOAL: 4,
	SPIKE: 5,      // 尖刺（机关）
	BUTTON: 6,     // 按钮（触发机关）
} as const

export type ElementType = typeof ELEM[keyof typeof ELEM]

// 动作类型
export type ActionType = "LEFT" | "RIGHT" | "JUMP" | "WAIT"

// 位置
export interface Pos {
	x: number
	y: number
}

// 世界状态
export interface WorldState {
	grid: number[][]      // [y][x] 格子ID
	hero: Pos             // 主角位置
	enemies: Pos[]        // 敌人位置（可能被机关杀死）
	triggers: boolean[]   // 机关触发状态
	spikeFalling?: boolean  // 尖刺是否正在坠落
	spikeY?: number        // 尖刺当前y坐标
}

// 想象结果
export interface Imagination {
	action: ActionType           // 想象的动作
	predictedState: WorldState   // 预测的未来状态
	predictedReward: number      // 预测奖励
	steps: number                // 想象的步数
}

// 大脑决策
export interface BrainDecision {
	selectedAction: ActionType
	imaginations: Imagination[]  // 所有想象的轨迹
	reasoning: string            // 决策理由（用于显示）
}

// 探索记忆
export interface ExplorationMemory {
	visited: Set<string>         // "x,y" 已访问
	frontier: Pos[]              // 边界（可探索的邻居）
}
