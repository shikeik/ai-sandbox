// ========== 世界管理器 - 重构版 ==========

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

	// 创建初始世界 - 重设计机关谜题
	// 使用左下坐标系：y=0是地面，y=height-1是天空
	private createInitialState(): WorldState {
		// 创建空网格
		const grid: number[][] = Array(this.height).fill(0).map(() =>
			Array(this.width).fill(ELEM.AIR)
		)

		// ========== 地面层 y=0 ==========
		for (let x = 0; x < this.width; x++) {
			grid[0][x] = ELEM.PLATFORM
		}

		// ========== 左侧起始区 y=1 ==========
		grid[1][1] = ELEM.PLATFORM  // 狐狸起始位置
		grid[1][2] = ELEM.PLATFORM  // 连接

		// ========== 中央危险区 y=1 ==========
		// 敌人在这里巡逻，需要机关清除
		grid[1][4] = ELEM.PLATFORM  // 敌人站立的平台
		// 注意：x=3,5留空，形成左右缺口，狐狸不能直接走过去

		// ========== 上层按钮平台 y=2 ==========
		// 设计：需要从左侧跳上去
		for (let x = 2; x <= 5; x++) {
			if (x === 4) {
				grid[2][x] = ELEM.BUTTON  // 中央按钮
			} else {
				grid[2][x] = ELEM.PLATFORM
			}
		}

		// ========== 右侧终点区 y=1 ==========
		// 需要先清除敌人才能安全通过
		for (let x = 6; x < this.width; x++) {
			grid[1][x] = ELEM.PLATFORM
		}
		grid[1][8] = ELEM.GOAL  // 终点

		// ========== 天空层 - 悬挂的尖刺 y=4 ==========
		// 尖刺在按钮正上方，距离地面4格，距离按钮2格
		// 这样坠落时有明显的视觉过程
		grid[4][4] = ELEM.SPIKE

		return {
			grid,
			hero: { x: 1, y: 1 },
			enemies: [{ x: 4, y: 1 }],  // 敌人在中央平台
			triggers: [false],  // 按钮是否被触发
			spikeFalling: false,  // 尖刺是否正在坠落
			spikeY: 4,  // 尖刺当前y坐标（初始悬挂高度）
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

	// 执行动作（确定性）- 返回动画事件列表
	executeAction(action: string): ActionResult {
		const hero = { ...this.state.hero }
		const animations: AnimationEvent[] = []
		const logs: string[] = []

		switch (action) {
			case "LEFT":
				if (hero.x > 0) {
					const oldPos = { ...hero }
					hero.x--
					hero.y = this.findPlatformY(hero.x, hero.y)
					
					// 检测是否需要坠落
					if (hero.y < oldPos.y) {
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldPos.y },
							to: { x: hero.x, y: hero.y },
							duration: 300 + (oldPos.y - hero.y) * 100
						})
					} else {
						animations.push({
							type: "HERO_MOVE",
							target: "hero",
							from: oldPos,
							to: { ...hero },
							duration: 250
						})
					}
				}
				break

			case "RIGHT":
				if (hero.x < this.width - 1) {
					const oldPos = { ...hero }
					hero.x++
					hero.y = this.findPlatformY(hero.x, hero.y)
					
					// 检测是否需要坠落
					if (hero.y < oldPos.y) {
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldPos.y },
							to: { x: hero.x, y: hero.y },
							duration: 300 + (oldPos.y - hero.y) * 100
						})
					} else {
						animations.push({
							type: "HERO_MOVE",
							target: "hero",
							from: oldPos,
							to: { ...hero },
							duration: 250
						})
					}
				}
				break

			case "JUMP": {
				const oldPos = { ...hero }
				const jumpX = Math.min(this.width - 1, hero.x + 2)
				
				// 尝试上到更高层（平台或按钮）- 左下坐标系，y+1是更高
				const upperY = hero.y + 1
				if (upperY < this.height && 
				    (this.state.grid[upperY][jumpX] === ELEM.PLATFORM ||
				     this.state.grid[upperY][jumpX] === ELEM.BUTTON)) {
					hero.x = jumpX
					hero.y = upperY
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { ...hero },
						duration: 500
					})
				} else {
					hero.x = jumpX
					hero.y = this.findPlatformY(hero.x, hero.y)
					
					if (hero.y < oldPos.y) {
						animations.push({
							type: "HERO_JUMP",
							target: "hero",
							from: oldPos,
							to: { x: hero.x, y: oldPos.y },  // 跳到半空
							duration: 250
						})
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldPos.y },
							to: { ...hero },
							duration: 300 + (oldPos.y - hero.y) * 100,
							delay: 250
						})
					} else {
						animations.push({
							type: "HERO_JUMP",
							target: "hero",
							from: oldPos,
							to: { ...hero },
							duration: 500
						})
					}
				}
				break
			}
		}

		// 更新英雄位置
		this.state.hero = hero

		// 检查按钮触发
		if (this.state.grid[hero.y][hero.x] === ELEM.BUTTON && !this.state.triggers[0]) {
			this.state.triggers[0] = true
			this.state.spikeFalling = true
			
			logs.push("[WORLD] 按钮触发！尖刺开始坠落...")
			
			// 按钮按下动画
			animations.push({
				type: "BUTTON_PRESS",
				target: "button",
				from: { x: hero.x, y: hero.y },
				duration: 200
			})
			
			// 尖刺坠落动画
			const spikeFromY = this.state.spikeY ?? 4
			const spikeToY = 1  // 坠落到敌人高度
			
			animations.push({
				type: "SPIKE_FALL",
				target: "spike",
				from: { x: 4, y: spikeFromY },
				to: { x: 4, y: spikeToY },
				duration: 600,
				delay: 200  // 按钮触发后延迟
			})
			
			// 更新尖刺位置
			this.state.spikeY = spikeToY
			
			// 检查是否击杀敌人
			const killedEnemies = this.state.enemies.filter(e => e.x === 4 && e.y === spikeToY)
			if (killedEnemies.length > 0) {
				logs.push(`[WORLD] 尖刺击杀 ${killedEnemies.length} 个敌人！`)
				
				// 敌人死亡动画
				killedEnemies.forEach((enemy, i) => {
					animations.push({
						type: "ENEMY_DIE",
						target: `enemy-${enemy.x}-${enemy.y}`,
						from: { ...enemy },
						duration: 400,
						delay: 600  // 尖刺落地后
					})
				})
				
				// 移除被杀死的敌人
				this.state.enemies = this.state.enemies.filter(e => !(e.x === 4 && e.y === spikeToY))
			}
			
			// 尖刺继续坠落（可选：留在地面或消失）
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
		if (this.state.grid[hero.y][hero.x] === ELEM.GOAL) {
			logs.push("[WORLD] 到达终点！")
			reachedGoal = true
		}

		return { reachedGoal, animations, logs }
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
		// 如果没找到，返回地面
		return 0
	}

	reset(): void {
		this.state = this.createInitialState()
	}
}
