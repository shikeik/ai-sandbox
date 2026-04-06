// ========== 世界管理器 - Fox-Jump式物理 ==========
// 玩家站在空中，脚下必须有平台支撑，否则会坠落
// 移动时如果目标位置是墙(平台/按钮/终点)，则移动失败

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

// 关卡字符地图（视觉从上到下，代码会反转）
const LEVEL_MAP = [
	"．．．．＾．．．．．",  // y=4 顶层：尖刺悬挂
	"．．．．．．．．．．",  // y=3
	"．．．．．．．．．．",  // y=2
	"．．＃！＃￠．．．．",  // y=1：平台、按钮、敌人
	"．．＃＃．＃＃＃＠．",  // y=0 底层：地面平台，@是玩家起点
]

// 字符映射
const CHAR_MAP: Record<string, number> = {
	"．": ELEM.AIR,      // 全角句点 - 空气
	"＃": ELEM.PLATFORM, // 全角井号 - 平台/墙
	"！": ELEM.BUTTON,   // 全角叹号 - 按钮
	"￡": ELEM.GOAL,     // 全角英镑 - 终点
	"＾": ELEM.SPIKE,    // 全角脱字符 - 尖刺
	"￠": ELEM.AIR,      // 全角分币 - 敌人（下方需要有平台）
	"＠": ELEM.AIR,      // 全角at - 玩家起点（下方需要有平台）
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

	// 从字符地图创建世界
	private createInitialState(): WorldState {
		const grid: number[][] = Array(this.height).fill(0).map(() =>
			Array(this.width).fill(ELEM.AIR)
		)

		let heroPos: Pos = { x: 1, y: 1 }
		const enemies: Pos[] = []

		// 解析字符地图（反转：数组第0行是视觉顶层，对应y=height-1）
		for (let row = 0; row < LEVEL_MAP.length && row < this.height; row++) {
			const line = LEVEL_MAP[row]
			const y = this.height - 1 - row  // 反转：视觉顶行 -> 逻辑底行

			for (let x = 0; x < line.length && x < this.width; x++) {
				const char = line[x]
				
				if (char === "＠") {
					// 玩家起始位置
					heroPos = { x, y }
					// 玩家站在平台上方，下方必须是平台
					grid[y][x] = ELEM.AIR  // 玩家所在格是空气
				} else if (char === "￠") {
					// 敌人位置
					enemies.push({ x, y })
					grid[y][x] = ELEM.AIR  // 敌人所在格是空气
				} else if (char === "＾") {
					// 尖刺（机关，不是墙）
					grid[y][x] = ELEM.SPIKE
				} else if (char === "！") {
					// 按钮
					grid[y][x] = ELEM.BUTTON
				} else if (char === "￡") {
					// 终点
					grid[y][x] = ELEM.GOAL
				} else if (char === "＃") {
					// 平台/墙
					grid[y][x] = ELEM.PLATFORM
				}
				// ．和其他未识别字符保持为 AIR
			}
		}

		return {
			grid,
			hero: heroPos,
			enemies,
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

	// 检查指定格子是否是墙（有碰撞）
	private isWall(x: number, y: number): boolean {
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true  // 边界也是墙
		const cell = this.state.grid[y][x]
		return cell === ELEM.PLATFORM || cell === ELEM.BUTTON || cell === ELEM.GOAL
	}

	// 检查指定位置是否有支撑（平台/按钮/终点）
	private hasSupport(x: number, y: number): boolean {
		if (y < 0) return false
		if (y === 0) return true  // 地面层总有支撑
		const cell = this.state.grid[y - 1][x]
		return cell === ELEM.PLATFORM || cell === ELEM.BUTTON || cell === ELEM.GOAL
	}

	// 寻找指定列中，玩家能站立的落点Y坐标
	// 跳跃高度2格：从原Y出发，最高能到原Y+2的位置
	private findJumpLandingY(targetX: number, fromY: number): number {
		const maxReachY = fromY + 2  // 跳跃最高能到达的Y（玩家位置）
		const platformSearchStart = maxReachY - 1  // 对应的平台Y

		// 从高往低扫描平台
		for (let py = platformSearchStart; py >= 0; py--) {
			if (this.hasSupport(targetX, py + 1)) {
				return py + 1  // 站在平台上方一格
			}
		}

		// 整列没有平台，落到虚空
		return -1
	}

	// 寻找玩家下方的支撑平台y坐标
	private findGroundY(x: number, startY: number): number {
		for (let y = startY - 1; y >= 0; y--) {
			if (this.hasSupport(x, y + 1)) {
				return y
			}
		}
		return -1  // 没有支撑
	}

	// 执行动作（Fox-Jump式物理）
	executeAction(action: string): ActionResult {
		const hero = { ...this.state.hero }
		const animations: AnimationEvent[] = []
		const logs: string[] = []
		let dead = false

		switch (action) {
			case "LEFT": {
				const oldX = hero.x
				const oldY = hero.y
				const targetX = hero.x - 1
				
				// 检查是否撞墙（目标格子是墙）
				if (this.isWall(targetX, hero.y)) {
					logs.push(`[WORLD] 向左移动失败：撞到墙(${targetX},${hero.y})`)
					break  // 移动失败，原地不动
				}
				
				// 水平移动
				hero.x = targetX
				
				// 检查新位置脚下是否有支撑
				if (!this.hasSupport(hero.x, hero.y)) {
					// 需要坠落
					const groundY = this.findGroundY(hero.x, hero.y)
					if (groundY < 0) {
						// 坠入虚空
						logs.push(`[WORLD] 向左移动后脚下没有支撑，坠入虚空！`)
						animations.push({
							type: "HERO_MOVE",
							target: "hero",
							from: { x: oldX, y: oldY },
							to: { x: hero.x, y: oldY },
							duration: 150
						})
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldY },
							to: { x: hero.x, y: -1 },
							duration: 500,
							delay: 150
						})
						hero.y = -1
						dead = true
					} else {
						// 坠落到下方平台
						hero.y = groundY + 1
						animations.push({
							type: "HERO_MOVE",
							target: "hero",
							from: { x: oldX, y: oldY },
							to: { x: hero.x, y: oldY },
							duration: 150
						})
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldY },
							to: { x: hero.x, y: hero.y },
							duration: 300,
							delay: 150
						})
						logs.push(`[WORLD] 向左移动后坠落：从y=${oldY}坠落到y=${hero.y}`)
					}
				} else {
					// 有支撑，同高度水平移动
					animations.push({
						type: "HERO_MOVE",
						target: "hero",
						from: { x: oldX, y: oldY },
						to: { x: hero.x, y: oldY },
						duration: 250
					})
				}
				break
			}

			case "RIGHT": {
				const oldX = hero.x
				const oldY = hero.y
				const targetX = hero.x + 1
				
				// 检查是否撞墙
				if (this.isWall(targetX, hero.y)) {
					logs.push(`[WORLD] 向右移动失败：撞到墙(${targetX},${hero.y})`)
					break
				}
				
				hero.x = targetX
				
				// 检查新位置脚下是否有支撑
				if (!this.hasSupport(hero.x, hero.y)) {
					const groundY = this.findGroundY(hero.x, hero.y)
					if (groundY < 0) {
						logs.push(`[WORLD] 向右移动后脚下没有支撑，坠入虚空！`)
						animations.push({
							type: "HERO_MOVE",
							target: "hero",
							from: { x: oldX, y: oldY },
							to: { x: hero.x, y: oldY },
							duration: 150
						})
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldY },
							to: { x: hero.x, y: -1 },
							duration: 500,
							delay: 150
						})
						hero.y = -1
						dead = true
					} else {
						hero.y = groundY + 1
						animations.push({
							type: "HERO_MOVE",
							target: "hero",
							from: { x: oldX, y: oldY },
							to: { x: hero.x, y: oldY },
							duration: 150
						})
						animations.push({
							type: "HERO_FALL",
							target: "hero",
							from: { x: hero.x, y: oldY },
							to: { x: hero.x, y: hero.y },
							duration: 300,
							delay: 150
						})
						logs.push(`[WORLD] 向右移动后坠落：从y=${oldY}坠落到y=${hero.y}`)
					}
				} else {
					animations.push({
						type: "HERO_MOVE",
						target: "hero",
						from: { x: oldX, y: oldY },
						to: { x: hero.x, y: oldY },
						duration: 250
					})
				}
				break
			}

			case "JUMP_LEFT": {
				const oldPos = { ...hero }
				const targetX = hero.x - 1
				
				// 检查是否撞墙（目标格子是墙）
				if (this.isWall(targetX, hero.y)) {
					logs.push(`[WORLD] 向左跳跃失败：撞到墙(${targetX},${hero.y})`)
					break
				}

				const landingY = this.findJumpLandingY(targetX, hero.y)
				logs.push(`[WORLD] 向左跳跃: 从(${hero.x},${hero.y}) → x=${targetX}, 落点y=${landingY}`)

				if (landingY < 0) {
					// 坠入虚空
					logs.push(`[WORLD] 左跳后坠入虚空！`)
					hero.x = targetX
					hero.y = -1
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { x: targetX, y: -1 },
						duration: 600
					})
					dead = true
				} else {
					// 正常落地
					hero.x = targetX
					hero.y = landingY
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { ...hero },
						duration: 500
					})
				}
				break
			}

			case "JUMP_RIGHT": {
				const oldPos = { ...hero }
				const targetX = hero.x + 1
				
				// 检查是否撞墙
				if (this.isWall(targetX, hero.y)) {
					logs.push(`[WORLD] 向右跳跃失败：撞到墙(${targetX},${hero.y})`)
					break
				}

				const landingY = this.findJumpLandingY(targetX, hero.y)
				logs.push(`[WORLD] 向右跳跃: 从(${hero.x},${hero.y}) → x=${targetX}, 落点y=${landingY}`)

				if (landingY < 0) {
					logs.push(`[WORLD] 右跳后坠入虚空！`)
					hero.x = targetX
					hero.y = -1
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { x: targetX, y: -1 },
						duration: 600
					})
					dead = true
				} else {
					hero.x = targetX
					hero.y = landingY
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { ...hero },
						duration: 500
					})
				}
				break
			}

			case "JUMP": {
				// 原地跳跃（向上找更高平台）
				const oldPos = { ...hero }
				const landingY = this.findJumpLandingY(hero.x, hero.y)

				logs.push(`[WORLD] 原地跳跃: 扫描落点=${landingY}`)

				if (landingY > hero.y) {
					// 能跳到更高处
					hero.y = landingY
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { ...hero },
						duration: 500
					})
				} else if (landingY < 0) {
					// 虚空
					logs.push(`[WORLD] 跳跃后坠入虚空！`)
					hero.y = -1
					animations.push({
						type: "HERO_JUMP",
						target: "hero",
						from: oldPos,
						to: { x: hero.x, y: -1 },
						duration: 600
					})
					dead = true
				}
				// 否则原地不动（已经是最高的了）
				break
			}
		}

		if (dead) {
			return { reachedGoal: false, dead: true, animations, logs }
		}

		// 更新英雄位置
		this.state.hero = hero

		// 检查按钮触发
		if (hero.y > 0 && this.state.grid[hero.y - 1][hero.x] === ELEM.BUTTON && !this.state.triggers[0]) {
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
			const spikeToY = 1
			
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
				killedEnemies.forEach((enemy) => {
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
		if (hero.y > 0 && this.state.grid[hero.y - 1][hero.x] === ELEM.GOAL) {
			logs.push("[WORLD] 到达终点！")
			reachedGoal = true
		}

		return { reachedGoal, dead: false, animations, logs }
	}

	reset(): void {
		this.state = this.createInitialState()
	}
}
