// ========== 游戏世界 - 核心协调器 ==========

import type { WorldState, ActionResult } from "../types/index.js"
import { DEFAULT_WORLD_SIZE } from "../config.js"
import { createStateFromLevel, cloneState } from "./level.js"
import { executeAction } from "./actions.js"
import { assertEq } from "../../engine/utils/assert.js"

/**
 * 游戏世界 - 管理世界状态和执行动作
 * 
 * 职责：
 * - 维护世界状态
 * - 执行玩家动作
 * - 提供状态快照
 */
export class GameWorld {
	private width: number
	private height: number
	private state: WorldState

	constructor(width: number = DEFAULT_WORLD_SIZE.width, height: number = DEFAULT_WORLD_SIZE.height) {
		this.width = width
		this.height = height
		this.state = createStateFromLevel()
	}

	/** 获取当前状态（只读副本） */
	getState(): WorldState {
		return cloneState(this.state)
	}

	/** 执行动作 */
	execute(action: string): ActionResult {
		return executeAction(this.state, action, this.width, this.height)
	}

	/** 重置世界 */
	reset(): void {
		this.state = createStateFromLevel()

		// 断言：重置后所有按钮触发状态必须为 false
		for (let i = 0; i < this.state.triggers.length; i++) {
			assertEq(this.state.triggers[i], false, `按钮${i}重置后状态断言`, {
				buttonIdx: i,
				triggerValue: this.state.triggers[i]
			})
		}
	}

	/** 获取世界尺寸 */
	getSize(): { width: number; height: number } {
		return { width: this.width, height: this.height }
	}
}
