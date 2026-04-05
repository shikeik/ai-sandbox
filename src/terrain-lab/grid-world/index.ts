// ========== 格子世界系统 - 统一导出 ==========

export { GridWorld, createGridWorld, DEFAULT_ELEMENTS } from "./GridWorld.js"
export { GridWorldRenderer } from "./GridWorldRenderer.js"
export { GridWorldAnimator } from "./GridWorldAnimator.js"
export { GridWorldEditor } from "./GridWorldEditor.js"

export type {
	ElementDef,
	GridWorldConfig,
	GridWorldState,
	RenderOptions,
	LayoutMetrics,
	AnimationConfig,
	AnimationState,
	AnimationResult,
	ActionCheckResult,
	ActionResult,
	Position,
	EditorConfig,
	CellPos,
} from "./types.js"

// ========== 兼容性导出（替代 animation.ts）==========

import type { ActionType } from "../types.js"

/**
 * 创建动画状态（兼容旧版 animation.ts）
 */
export function createAnimationState(): {
	animId: number | null
	animStartTime: number
	animAction: ActionType | null
	animSlimeKilled: boolean
} {
	return {
		animId: null,
		animStartTime: 0,
		animAction: null,
		animSlimeKilled: false,
	}
}
