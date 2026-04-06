// ========== 世界模型：大脑的"想象力" ==========
// 给定当前状态+动作，预测未来状态

import { WorldState, Pos, ActionType, ELEM } from "./types.js"

export class WorldModel {
	private width: number
	private height: number

	constructor(width: number, height: number) {
		this.width = width
		this.height = height
	}

	// 核心：想象"如果我做这个动作，会发生什么？"
	predict(state: WorldState, action: ActionType): WorldState {
		const newState = this.cloneState(state)
		const hero = { ...newState.hero }

		switch (action) {
			case "LEFT":
				hero.x = Math.max(0, hero.x - 1)
				// 落下到最近的平台
				hero.y = this.findPlatformY(newState.grid, hero.x, hero.y)
				break

			case "RIGHT":
				hero.x = Math.min(this.width - 1, hero.x + 1)
				hero.y = this.findPlatformY(newState.grid, hero.x, hero.y)
				break

			case "JUMP": {
				// 跳跃：x+2，尝试上到更高平台
				const jumpX = Math.min(this.width - 1, hero.x + 2)
				// 先检查是否能上到更高层（平台或按钮）- 左下坐标系，y+1是更高
				const upperY = hero.y + 1
				if (upperY < this.height && (newState.grid[upperY][jumpX] === ELEM.PLATFORM || newState.grid[upperY][jumpX] === ELEM.BUTTON)) {
					hero.x = jumpX
					hero.y = upperY
				} else {
					// 否则落到同级或下级
					hero.x = jumpX
					hero.y = this.findPlatformY(newState.grid, hero.x, hero.y)
				}
				break
			}

			case "WAIT":
				// 什么都不发生，但可能触发机关效果
				break
		}

		// 检查是否踩到按钮触发机关
		if (newState.grid[hero.y][hero.x] === ELEM.BUTTON) {
			newState.triggers[0] = true
			// 机关触发：杀死下方敌人（左下坐标系，y更小是下方）
			newState.enemies = newState.enemies.filter(e => {
				// 如果敌人在按钮正下方（同一x，y更小），被杀死
				return !(e.x === hero.x && e.y < hero.y)
			})
		}

		newState.hero = hero
		return newState
	}

	// 寻找某x列的最近平台y坐标（从上往下找，返回平台所在y）
	private findPlatformY(grid: number[][], x: number, startY: number): number {
		// 从startY往下找（y减小），找第一个能支撑的平台
		for (let y = startY; y >= 0; y--) {
			if (grid[y][x] === ELEM.PLATFORM ||
			    grid[y][x] === ELEM.BUTTON ||
			    grid[y][x] === ELEM.GOAL) {
				return y  // 站在平台上（包括终点）
			}
		}
		return 0  // 默认回到地面
	}

	// 评估状态价值（用于规划）
	evaluate(state: WorldState): number {
		let score = 0

		// 到达终点
		if (state.grid[state.hero.y][state.hero.x] === ELEM.GOAL) {
			score += 1000
		}

		// 靠近终点（假设终点在右边）
		score += state.hero.x * 10

		// 死亡惩罚
		if (state.hero.y >= this.height) {
			score -= 100
		}

		// 清除敌人奖励
		const totalEnemies = state.enemies.length
		score += (2 - totalEnemies) * 50  // 每杀一个敌人+50

		return score
	}

	// 克隆状态
	private cloneState(state: WorldState): WorldState {
		return {
			grid: state.grid.map(row => [...row]),
			hero: { ...state.hero },
			enemies: [...state.enemies],
			triggers: [...state.triggers],
			spikeFalling: state.spikeFalling,
			spikeY: state.spikeY,
		}
	}
}
