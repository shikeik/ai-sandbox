// ========== 世界管理器 ==========

import { WorldState, Pos, ELEM } from "./types.js"

export class World {
	private width: number
	private height: number
	private state: WorldState

	constructor(width: number, height: number) {
		this.width = width
		this.height = height
		this.state = this.createInitialState()
	}

	// 创建初始世界（包含机关谜题）
	// 使用左下坐标系：y=0是地面，y=height-1是天空
	private createInitialState(): WorldState {
		// 创建空网格
		const grid: number[][] = Array(this.height).fill(0).map(() =>
			Array(this.width).fill(ELEM.AIR)
		)

		// 地面平台（y=0，最底层）
		for (let x = 0; x < this.width; x++) {
			grid[0][x] = ELEM.PLATFORM
		}

		// 设计一个需要"大脑"的谜题：
		// 狐狸在左，终点在右，但中间有敌人挡路
		// 上方有按钮可以触发机关杀死敌人

		// 起始平台（y=1）
		grid[1][1] = ELEM.PLATFORM

		// 上层平台（y=2，需要跳上去）
		for (let x = 3; x < 6; x++) {
			if (x !== 4) {  // x=4是按钮，不设置平台
				grid[2][x] = ELEM.PLATFORM
			}
		}

		// 按钮平台（y=2）
		grid[2][4] = ELEM.BUTTON

		// 右侧平台（终点，y=1）
		for (let x = 7; x < this.width; x++) {
			grid[1][x] = ELEM.PLATFORM
		}

		// 终点（y=1）
		grid[1][this.width - 2] = ELEM.GOAL

		// 尖刺（机关，y=3，在按钮正上方x=4）
		grid[3][4] = ELEM.SPIKE

		return {
			grid,
			hero: { x: 1, y: 1 },  // 起始位置y=1
			enemies: [{ x: 4, y: 1 }],  // 敌人在按钮正下方x=4
			triggers: [false],
		}
	}

	// 获取当前状态
	getState(): WorldState {
		return {
			grid: this.state.grid.map(row => [...row]),
			hero: { ...this.state.hero },
			enemies: [...this.state.enemies],
			triggers: [...this.state.triggers],
		}
	}

	// 执行动作（确定性）
	executeAction(action: string): boolean {
		const hero = { ...this.state.hero }

		switch (action) {
			case "LEFT":
				if (hero.x > 0) {
					hero.x--
					hero.y = this.findPlatformY(hero.x, hero.y)
				}
				break
			case "RIGHT":
				if (hero.x < this.width - 1) {
					hero.x++
					hero.y = this.findPlatformY(hero.x, hero.y)
				}
				break
			case "JUMP":
				const jumpX = Math.min(this.width - 1, hero.x + 2)
				// 尝试上到更高层（平台或按钮）- 左下坐标系，y+1是更高
				const upperY = hero.y + 1
				if (upperY < this.height && (this.state.grid[upperY][jumpX] === ELEM.PLATFORM ||
				                   this.state.grid[upperY][jumpX] === ELEM.BUTTON)) {
					hero.x = jumpX
					hero.y = upperY
				} else {
					hero.x = jumpX
					hero.y = this.findPlatformY(hero.x, hero.y)
				}
				break
		}

		// 先更新英雄位置
		this.state.hero = hero

		// 检查按钮触发
		if (this.state.grid[hero.y][hero.x] === ELEM.BUTTON) {
			this.state.triggers[0] = true
			// 机关触发：杀死下方敌人（左下坐标系，y更小是下方）
			this.state.enemies = this.state.enemies.filter(e => {
				return !(e.x === hero.x && e.y < hero.y)
			})
			console.log("[WORLD] 机关触发！敌人被清除")
		}

		// 检查是否到达终点
		if (this.state.grid[hero.y][hero.x] === ELEM.GOAL) {
			console.log("[WORLD] 到达终点！")
			return true
		}

		return false
	}

	// 寻找某x列的最近平台y坐标（从下往上找，返回平台所在y）
	private findPlatformY(x: number, startY: number): number {
		// 从startY往下找（y减小），找第一个能支撑的平台
		for (let y = startY; y >= 0; y--) {
			if (this.state.grid[y][x] === ELEM.PLATFORM ||
			    this.state.grid[y][x] === ELEM.BUTTON) {
				return y  // 站在平台上
			}
		}
		// 如果没找到，往下继续找（防越界）
		return 0
	}

	reset(): void {
		this.state = this.createInitialState()
	}
}
