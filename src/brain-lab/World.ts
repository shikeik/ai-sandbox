// ========== 世界管理器 - Fox-Jump式物理 ==========
// 玩家站在空中，脚下必须有平台支撑，否则会坠落

import { WorldState, Pos, ELEM } from "./types.js"

export interface AnimationEvent {
	type: "HERO_MOVE" | "HERO_JUMP" | "HERO_FALL" | "SPIKE_FALL" | "ENEMY_DIE" | "BUTTON_PRESS"
	target: string
	from: Pos
	to?: Pos
	duration: number
	delay?: number
	payload?: any
}

export interface ActionResult {
	reachedGoal: boolean
	dead: boolean
	animations: AnimationEvent[]
	logs: string[]
}

export class World {
	private width: number
	private height: number
	private state: WorldState

	constructor(width: number = 10, height: number = 6) {
		this.width = width
		this.height = height
		this.state = this.createInitialState()
	}

	// 创建初始世界 - Fox-Jump式物理
	// y=0是地面层（平台），玩家站在y=1（空中，脚下有平台支撑）
	private createInitialState(): WorldState {
		const grid: number[][] = Array(this.height).fill(0).map(() =>
			Array(this.width).fill(ELEM.AIR)
		)

		// ========== 地面层 y=0 ==========
		// 地面平台定义哪些x位置有支撑
		// x=1: 起始平台
		// x=2: 连接
		// x=4: 敌人平台
		// x=6,7,8,9: 右侧终点区
		grid[0][1] = ELEM.PLATFORM
		grid[0][2] = ELEM.PLATFORM
		grid[0][4] = ELEM.PLATFORM  // 敌人站立的地方
		for (let x = 6; x < this.width; x++) {
			grid[0][x] = ELEM.PLATFORM
		}
		grid[0][8] = ELEM.GOAL  // 终点在地面层

		// ========== 中层平台 y=1 ==========
		// 上层按钮平台，需要跳跃才能到达
		for (let x = 2; x <= 5; x++) {
			if (x === 4) {
				grid[1][x] = ELEM.BUTTON
			} else {
				grid[1][x] = ELEM.PLATFORM
			}
		}

		// ========== 天空层 y=4 ==========
		// 悬挂的尖刺
		grid[4][4] = ELEM.SPIKE

		return {
			grid,
			hero: { x: 1, y: 1 },  // 玩家站在y=1（空中），脚下y=0有平台
			enemies: [{ x: 4, y: 1 }],  // 敌人也站在y=1
			triggers: [false],
			spikeFalling: false,
			spikeY: 4,
		}
	}

	// 获取当前状态
	getState(): WorldState {
		return {
			grid: this.state.grid.map(row => [...row]),
			hero: { ...this.state.hero },
			enemies: [...this.state.enemies],
			triggers: [...this.state.triggers],
			spikeFalling: this.state.spikeFalling,
			spikeY: this.state.spikeY,
		}
	}

	// 检查指定位置是否有支撑（平台/按钮/终点）
	private hasSupport(x: number, y: number): boolean {
		if (y < 0) return false
		const cell = this.state.grid[y][x]
		return cell === ELEM.PLATFORM || cell === ELEM.BUTTON || cell === ELEM.GOAL
	}

	// 寻找玩家下方的支撑平台y坐标
	private findGroundY(x: number, startY: number): number {
		// 从startY往下找，找第一个支撑平台
		for (let y = startY; y >= 0; y--) {
			if (this.hasSupport(x, y)) {
				return y
			}
		}
		return -1  // 没有支撑（会坠落死亡）
	}

	// 执行动作（Fox-Jump式物理）
	executeAction(action: string): ActionResult {
		const hero = { ...this.state.hero }
		const animations: AnimationEvent[] = []
		const logs: string[] = []
		let dead = false

		switch (action) {
			case "LEFT":
				if (hero.x > 0) {
					const oldX = hero.x
					hero.x--
					
					// 检查新位置脚下是否有支撑
					const groundY = this.findGroundY(hero.x, hero.y)
					if (groundY < 0) {
						// 坠落死亡
						logs.push(`[WORLD] 向左移动后脚下没有支撑，坠落！`)
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: hero.y },
							to: { x: hero.x, y: -1 },
							duration: 500
						})
						dead = true
					} else {
						// 下落到支撑点上方
						const oldY = hero.y
						hero.y = groundY + 1
						
						if (hero.y < oldY) {
							animations.push({
								type: "HERO_FALL",
								target: "hero",
								from: { x: hero.x, y: oldY },
								to: { x: hero.x, y: hero.y },
								duration: 300
							})
						} else {
							animations.push({
								type: "HERO_MOVE",
								target: "hero",
								from: { x: oldX, y: hero.y },
								to: { x: hero.x, y: hero.y },
								duration: 250
							})
						}
					}
				}
				break

			case "RIGHT":
				if (hero.x < this.width - 1) {
					const oldX = hero.x
					hero.x++
					
					// 检查新位置脚下是否有支撑
					const groundY = this.findGroundY(hero.x, hero.y)
					if (groundY < 0) {
						logs.push(`[WORLD] 向右移动后脚下没有支撑，坠落！`)
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: hero.y },
							to: { x: hero.x, y: -1 },
							duration: 500
						})
						dead = true
					} else {
						// 下落到支撑点上方
						const oldY = hero.y
						hero.y = groundY + 1
						
						if (hero.y < oldY) {
							animations.push({
								type: "HERO_FALL",
								target: "hero",
								from: { x: hero.x, y: oldY },
								to: { x: hero.x, y: hero.y },
								duration: 300
							})
						} else {
							animations.push({
								type: "HERO_MOVE",
								target: "hero",
								from: { x: oldX, y: hero.y },
								to: { x: hero.x, y: hero.y },
								duration: 250
							})
						}
					}
				}
				break

			case "JUMP": {
				const oldPos = { ...hero }
				// 跳跃：x+2，y+1（上到更高层）
				const jumpX = Math.min(this.width - 1, hero.x + 2)
				const jumpY = hero.y + 1
				
				// 检查目标位置是否有支撑
				const groundY = this.findGroundY(jumpX, jumpY)
				if (groundY >= 0) {
					// 可以跳到目标位置
					hero.x = jumpX
					hero.y = groundY + 1
					
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { ...hero },
						duration: 500
					})
				} else {
					// 没有支撑，坠落
					logs.push(`[WORLD] 跳跃后脚下没有支撑，坠落！`)
					hero.x = jumpX
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { x: jumpX, y: oldPos.y },
						duration: 250
					})
					animations.push({
						type: "HERO_FALL",
						target: "hero",
						from: { x: jumpX, y: oldPos.y },
						to: { x: jumpX, y: -1 },
						duration: 500,
						delay: 250
					})
					dead = true
				}
				break
			}
		}

		if (dead) {
			return { reachedGoal: false, dead: true, animations, logs }
		}

		// 更新英雄位置
		this.state.hero = hero

		// 检查按钮触发（玩家踩在中层平台的按钮上）
		if (this.state.grid[hero.y - 1][hero.x] === ELEM.BUTTON && !this.state.triggers[0]) {
			this.state.triggers[0] = true
			this.state.spikeFalling = true
			
			logs.push("[WORLD] 按钮触发！尖刺开始坠落...")
			
			animations.push({
				type: "BUTTON_PRESS",
				target: "button",
				from: { x: hero.x, y: hero.y - 1 },
				duration: 200
			})
			
			// 尖刺坠落
			const spikeFromY = this.state.spikeY ?? 4
			const spikeToY = 1  // 坠落到敌人高度
			
			animations.push({
				type: "SPIKE_FALL",
				target: "spike",
				from: { x: 4, y: spikeFromY },
				to: { x: 4, y: spikeToY },
				duration: 600,
				delay: 200
			})
			
			this.state.spikeY = spikeToY
			
			// 击杀敌人
			const killedEnemies = this.state.enemies.filter(e => e.x === 4 && e.y === spikeToY)
			if (killedEnemies.length > 0) {
				logs.push(`[WORLD] 尖刺击杀 ${killedEnemies.length} 个敌人！`)
				killedEnemies.forEach((enemy, i) => {
					animations.push({
						type: "ENEMY_DIE",
						target: `enemy-${enemy.x}-${enemy.y}`,
						from: { ...enemy },
						duration: 400,
						delay: 600
					})
				})
				this.state.enemies = this.state.enemies.filter(e => !(e.x === 4 && e.y === spikeToY))
			}
			
			animations.push({
				type: "SPIKE_FALL",
				target: "spike",
				from: { x: 4, y: spikeToY },
				to: { x: 4, y: 0 },
				duration: 300,
				delay: 800
			})
			this.state.spikeY = 0
		}

		// 检查是否到达终点
		let reachedGoal = false
		if (this.state.grid[hero.y - 1][hero.x] === ELEM.GOAL) {
			logs.push("[WORLD] 到达终点！")
			reachedGoal = true
		}

		return { reachedGoal, dead: false, animations, logs }
	}

	reset(): void {
		this.state = this.createInitialState()
	}
}
