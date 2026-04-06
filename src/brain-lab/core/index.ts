// ========== Core 模块入口 ==========

// 主世界类
export { GameWorld } from "./game-world.js"

// 预测器（AI用）
export { Predictor } from "./predictor.js"

// 关卡相关
export { createStateFromLevel, cloneState } from "./level.js"

// 物理规则
export {
	createPhysicsContext,
	isWall,
	hasSupport,
	findJumpLandingY,
	findGroundY,
	findPlatformY,
	checkButtonTrigger,
	checkGoalReached,
} from "./physics.js"
export type { PhysicsContext } from "./physics.js"

// 动作执行
export { executeAction } from "./actions.js"
