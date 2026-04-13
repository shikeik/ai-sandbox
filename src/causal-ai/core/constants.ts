// ========== causal-ai 核心常量配置 ==========

/** 规划器最大搜索深度 */
export const PLANNER_MAX_DEPTH = 100

/** 随机探索默认步数 */
export const EXPLORE_DEFAULT_COUNT = 10

/** 随机探索每步延迟（毫秒） */
export const EXPLORE_STEP_DELAY_MS = 100

/** 移动类动作集合 */
export const MOVE_ACTIONS = ["上", "下", "左", "右"] as const

// 从 meta-gridworld 重新导出视野常量
export { DEFAULT_VIEW_RANGE } from "../meta-gridworld/constants"
