// ========== causal-ai 核心常量配置 ==========

/** 规划器最大搜索深度 */
export const PLANNER_MAX_DEPTH = 100

/** 随机探索默认步数 */
export const EXPLORE_DEFAULT_COUNT = 10

/** 随机探索每步延迟（毫秒） */
export const EXPLORE_STEP_DELAY_MS = 100

/** 默认局部视野范围（range=2 表示 5×5） */
export const DEFAULT_VIEW_RANGE = 2

/** 移动类动作集合 */
export const MOVE_ACTIONS = ["上", "下", "左", "右"] as const
