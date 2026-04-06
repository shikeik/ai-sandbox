// ========== 状态预测器 - 用于AI的"想象力" ==========
// 给定当前状态+动作，预测未来状态

import type { WorldState, ActionType, Position } from "../types/index.js"
import { Element } from "../types/index.js"
import { DEFAULT_WORLD_SIZE, AI_CONFIG, REWARDS } from "../config.js"
import { cloneState } from "./level.js"
import { findPlatformY, checkButtonTrigger } from "./physics.js"

/**
 * 状态预测器 - AI用来"想象"动作结果
 */
export class Predictor {
	private width: number
	private height: number

	constructor(width: number = DEFAULT_WORLD_SIZE.width, height: number = DEFAULT_WORLD_SIZE.height) {
		this.width = width
		this.height = height
	}

	/**
	 * 预测：如果我做这个动作，会发生什么？
	 */
	predict(state: WorldState, action: ActionType): WorldState {
		const newState = cloneState(state)
		const hero = { ...newState.hero }

		switch (action) {
			case "LEFT":
				hero.x = Math.max(0, hero.x - 1)
				hero.y = findPlatformY(newState.grid, hero.x, hero.y)
				break

			case "RIGHT":
				hero.x = Math.min(this.width - 1, hero.x + 1)
				hero.y = findPlatformY(newState.grid, hero.x, hero.y)
				break

			case "JUMP": {
				// 跳跃：x+2，尝试上到更高平台
				const jumpX = Math.min(this.width - 1, hero.x + 2)
				// 先检查是否能上到更高层（平台或按钮）- 左下坐标系，y+1是更高
				const upperY = hero.y + 1
				if (upperY < this.height && 
				    (newState.grid[upperY][jumpX] === Element.PLATFORM || 
				     newState.grid[upperY][jumpX] === Element.BUTTON)) {
					hero.x = jumpX
					hero.y = upperY
				} else {
					// 否则落到同级或下级
					hero.x = jumpX
					hero.y = findPlatformY(newState.grid, hero.x, hero.y)
				}
				break
			}

			case "WAIT":
				// 什么都不发生
				break
		}

		// 检查是否踩到按钮触发机关
		const buttonIdx = checkButtonTrigger(newState, hero.x, hero.y)
		if (buttonIdx >= 0) {
			newState.triggers[buttonIdx] = true
			// 获取对应尖刺
			const spike = newState.spikes[buttonIdx]
			if (spike) {
				spike.triggered = true
				// 机关触发：杀死尖刺下方的敌人
				newState.enemies = newState.enemies.filter(e => {
					return !(e.x === spike.x && e.y <= 1)  // 尖刺落到y=1层杀死敌人
				})
			}
		}

		newState.hero = hero
		return newState
	}

	/**
	 * 评估状态价值（用于规划）
	 */
	evaluate(state: WorldState): number {
		let score = 0

		// 到达终点
		if (state.grid[state.hero.y][state.hero.x] === Element.GOAL) {
			score += REWARDS.reachGoal
		}

		// 靠近终点（假设终点在右边）
		score += state.hero.x * REWARDS.perStepX

		// 死亡惩罚
		if (state.hero.y >= this.height) {
			score += REWARDS.death
		}

		// 清除敌人奖励
		const totalEnemies = state.enemies.length
		score += (2 - totalEnemies) * REWARDS.killEnemy

		return score
	}
}
