/**
 * 跳跃游戏核心逻辑
 * 
 * 【游戏机制】
 * - 32格横版世界，地面有平地(可站)和坑(掉落死亡)
 * - 玩家只能：右移(x+1) 或 跳跃(x+2，抛物线) 或 远跳(x+3)
 * - 跳跃落点坑上 → 死亡
 * - 移动中踩坑 → 死亡
 * - 到达终点(x30) → 胜利
 * 
 * 【使用方式】
 * const game = new JumpGame()
 * game.init()                    // 初始化世界
 * game.execute('right')          // 执行动作（立即完成逻辑）
 * game.execute('jump')
 * 
 * 【获取AI输入】
 * game.getStateForAI() -> { playerGrid, terrainAhead[], isMoving }
 */

import { formatTime as formatTimeUtil } from "@utils/timeUtils.js"
import { TerrainGenerator, TerrainWeights, TerrainEnabled } from "./TerrainGenerator.js"

// ========== 游戏常量 ==========
export const CONFIG = {
	WORLD_LENGTH: 32,
	VIEWPORT_GRID_W: 7,
	VIEWPORT_GRID_H: 4,
	GRID_SIZE: 100,
	GROUND_HEIGHT: 0.8,
	PLAYER_SIZE: 0.45,
	GOAL_SIZE: 0.8,
	JUMP_HEIGHT: 1.0,
	PLAYER_START_X: 0.275,
	MOVE_DURATION: 400,
	JUMP_DURATION: 600,
	CAMERA_OFFSET_RATIO: 0.3,
	PIT_PROBABILITY: 0.6,
	toPx(units: number): number { return Math.floor(units * this.GRID_SIZE) },
	toUnits(px: number): number { return px / this.GRID_SIZE }
}

// 动作类型
export const ACTION = {
	RIGHT: "right",
	JUMP: "jump",
	LONG_JUMP: "longJump"
} as const

export type ActionType = typeof ACTION[keyof typeof ACTION]

// 游戏生命周期状态
export const GAME_STATUS = {
	READY: "ready",
	RUNNING: "running",
	TRANSITIONING: "transitioning",
	FINISHED: "finished"
} as const

export type GameStatusType = typeof GAME_STATUS[keyof typeof GAME_STATUS]

// 人物动作状态
export const PLAYER_ACTION = {
	IDLE: "idle",
	MOVING: "moving",
	JUMPING: "jumping"
} as const

export type PlayerActionType = typeof PLAYER_ACTION[keyof typeof PLAYER_ACTION]

// 兼容旧代码
export const STATUS = {
	READY: GAME_STATUS.READY,
	RUNNING: GAME_STATUS.RUNNING,
	TRANSITIONING: GAME_STATUS.TRANSITIONING,
	IDLE: PLAYER_ACTION.IDLE,
	MOVING: PLAYER_ACTION.MOVING,
	DEAD: "dead",
	WON: "won"
} as const

// 地形类型
export const TERRAIN = {
	GROUND: "ground",
	PIT: "pit"
} as const

export type TerrainType = typeof TERRAIN[keyof typeof TERRAIN]

// 地形段
export interface TerrainSegment {
	type: string
	start: number
	end: number
}

// 玩家状态
export interface PlayerState {
	x: number
	y: number
	grid: number
	action: PlayerActionType
	isJump: boolean
	direction: number
}

// 相机状态
export interface CameraState {
	x: number
}

// 地形配置
export interface TerrainConfig {
	seed: number | null
	isSeedLocked: boolean
	weights: TerrainWeights
	enabled: TerrainEnabled
}

// 游戏状态
export interface GameState {
	player: PlayerState
	camera: CameraState
	terrain: TerrainSegment[]
	generation: number
	gameStatus: GameStatusType
}

// AI 输入状态
export interface AIState {
	playerGrid: number
	isMoving: boolean
	terrainAhead: TerrainType[]
}

// 动作结果
export interface ActionResult {
	action: ActionType
	fromX: number
	fromY: number
	targetX: number
	isJump: boolean
}

// 动作结束结果
export interface ActionEndResult {
	success: boolean
	grid: number
}

/**
 * 游戏核心类
 * 逻辑层：动作立即执行，无等待
 * 视觉层：由渲染器处理补间动画
 */
export class JumpGame {
	terrain: TerrainSegment[] = []
	gameStatus: GameStatusType = GAME_STATUS.READY
	player: PlayerState = {
		x: 0,
		y: 0,
		grid: 0,
		action: PLAYER_ACTION.IDLE,
		isJump: false,
		direction: 0
	}
	camera: CameraState = { x: 0 }
	generation: number = 1
	viewportWidth: number = 0
	viewportHeight: number = 0
	terrainConfig: TerrainConfig = {
		seed: null,
		isSeedLocked: false,
		weights: { ground: 50, singlePit: 30, doublePit: 20 },
		enabled: { ground: true, singlePit: true, doublePit: true }
	}
	lastTerrainSeed: number | null = null
	startTime: number | null = null
	currentRunTime: number = 0

	// 事件回调
	onStateChange: ((player: PlayerState, camera: CameraState) => void) | null = null
	onActionStart: ((action: ActionType, from: { x: number, y: number }, to: { x: number, y: number }, isJump: boolean, result: string) => void) | null = null
	onActionEnd: ((result: ActionEndResult) => void) | null = null
	onDeath: (() => void) | null = null
	onWin: (() => void) | null = null
	onGenerationChange: ((gen: number) => void) | null = null
	onTransitionStart: ((onMid: () => void, onEnd: () => void) => void) | null = null
	onTransitionEnd: (() => void) | null = null
	onTerrainSeedChange: ((seed: number, stats: { ground: number, singlePit: number, doublePit: number }) => void) | null = null

	// 内部状态
	private _pendingDeath: boolean = false
	private _pendingWin: boolean = false
	private _inputLocked: boolean = false

	// ========== 初始化 ==========
	
	init(): this {
		this._pendingDeath = false
		this._pendingWin = false
		this._inputLocked = true
		this._generateTerrain()
		this._resetPlayer()
		this._notifyStateChange()
		this.gameStatus = GAME_STATUS.READY
		this.startTime = null
		this.currentRunTime = 0
		return this
	}
	
	startTimer(): void {
		this.startTime = Date.now()
	}
	
	getElapsedTime(): number {
		if (!this.startTime) return 0
		return Date.now() - this.startTime
	}
	
	formatTime(ms: number): string {
		return formatTimeUtil(ms)
	}
	
	startGame(): void {
		if (this.gameStatus === GAME_STATUS.READY || 
			this.gameStatus === GAME_STATUS.TRANSITIONING) {
			this.gameStatus = GAME_STATUS.RUNNING
			this._inputLocked = false
			this.player.action = PLAYER_ACTION.IDLE
			this.startTimer()
		}
	}
	
	setViewportSize(width: number): void {
		CONFIG.GRID_SIZE = Math.floor(width / CONFIG.VIEWPORT_GRID_W)
		this.viewportWidth = width
		this.viewportHeight = CONFIG.toPx(CONFIG.VIEWPORT_GRID_H)
		this.updateCamera()
	}

	// ========== 核心操作 ==========
	
	execute(action: ActionType): ActionResult | null {
		if (this._inputLocked) return null
		if (this.gameStatus !== GAME_STATUS.RUNNING) return null

		const fromX = this.player.x
		const fromY = this.player.y
		const isJump = action === ACTION.JUMP || action === ACTION.LONG_JUMP
		console.log("[GAME]", `execute debug | action=${action} isJump=${isJump}`)

		let targetX: number
		if (action === ACTION.RIGHT) {
			targetX = fromX + CONFIG.toPx(1)
		} else if (action === ACTION.JUMP) {
			targetX = fromX + CONFIG.toPx(2)
		} else if (action === ACTION.LONG_JUMP) {
			targetX = fromX + CONFIG.toPx(3)
		} else {
			console.log("[GAME]", `execute rejected | unknown action=${action}`)
			return null
		}
		console.log("[GAME]", `execute target | targetX=${targetX} fromX=${fromX}`)

		this.player.x = targetX
		this.player.y = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
		this.player.grid = Math.floor(targetX / CONFIG.GRID_SIZE)
		this.player.action = isJump ? PLAYER_ACTION.JUMPING : PLAYER_ACTION.MOVING
		this.player.isJump = isJump
		this.player.direction = action === ACTION.RIGHT ? 1 : (action === ACTION.JUMP ? 2 : 3)

		this.updateCamera()
		this._notifyStateChange()
		this._checkResult(targetX)

		if (this.onActionStart) {
			const result = this._pendingDeath ? "death" : (this._pendingWin ? "win" : "alive")
			this.onActionStart(action, { x: fromX, y: fromY }, { x: targetX, y: CONFIG.toPx(CONFIG.GROUND_HEIGHT) }, isJump, result)
		}

		return { action, fromX, fromY, targetX, isJump }
	}
	
	notifyVisualComplete(): void {
		if (this._pendingDeath) {
			this.triggerDeath()
			return
		}
		if (this._pendingWin) {
			this.triggerWin()
			return
		}

		if (this.player.action === PLAYER_ACTION.MOVING || 
			this.player.action === PLAYER_ACTION.JUMPING) {
			this.player.action = PLAYER_ACTION.IDLE
			this._notifyStateChange()
		
			if (this.onActionEnd) {
				this.onActionEnd({ success: true, grid: this.player.grid })
			}
		}
	}
	
	getStateForAI(): AIState {
		const grid = this.player.grid
		return {
			playerGrid: grid,
			isMoving: this.player.action === PLAYER_ACTION.MOVING || this.player.action === PLAYER_ACTION.JUMPING,
			terrainAhead: [
				this._getTerrainAt(grid + 1),
				this._getTerrainAt(grid + 2),
				this._getTerrainAt(grid + 3)
			]
		}
	}
	
	getState(): GameState {
		return {
			player: { ...this.player },
			camera: { ...this.camera },
			terrain: this.terrain,
			generation: this.generation,
			gameStatus: this.gameStatus
		}
	}

	// ========== 结果判定 ==========
	
	private _checkResult(finalX: number): void {
		if (this._isInPit(finalX)) {
			this.gameStatus = GAME_STATUS.FINISHED
			this.player.action = PLAYER_ACTION.IDLE
			this._pendingDeath = true
			this._inputLocked = true
		} else if (this.player.grid >= CONFIG.WORLD_LENGTH - 1) {
			this.gameStatus = GAME_STATUS.FINISHED
			this.player.action = PLAYER_ACTION.IDLE
			this._pendingWin = true
			this._inputLocked = true
		}
	}
	
	private _triggerFinish(type: "death" | "win", onEvent: (() => void) | null): void {
		const pendingKey = type === "death" ? "_pendingDeath" : "_pendingWin"
		const self = this as unknown as Record<string, boolean>
		if (!self[pendingKey]) return
		console.log("[GAME]", `触发结束 | type=${type} | 格子=${this.player.grid}`)
		self[pendingKey] = false

		this.gameStatus = GAME_STATUS.FINISHED
		this._inputLocked = true

		if (onEvent) onEvent()

		if (this.onTransitionStart) {
			this.onTransitionStart(() => {
				this._executeRespawn()
			}, () => {
				this._onRespawnComplete()
			})
		} else {
			setTimeout(() => this._nextGeneration(), 1500)
		}
	}

	triggerDeath(): void {
		this._triggerFinish("death", this.onDeath)
	}

	triggerWin(): void {
		this._triggerFinish("win", this.onWin)
	}

	private _executeRespawn(): void {
		this.generation++
		console.log("[GAME]", `转场中点: 重生 | 新世代=${this.generation}`)
		this.init()
		this.gameStatus = GAME_STATUS.TRANSITIONING

		if (this.onGenerationChange) {
			this.onGenerationChange(this.generation)
		}
	}

	private _onRespawnComplete(): void {
		console.log("[GAME]", "转场结束: 开始新一局")
		if (this.onTransitionEnd) {
			this.onTransitionEnd()
		}
	}

	private _nextGeneration(): void {
		this.generation++
		this.init()
		if (this.onGenerationChange) {
			this.onGenerationChange(this.generation)
		}
	}

	// ========== 地形生成 ==========
	
	private _generateTerrain(): void {
		const seed = this.terrainConfig.isSeedLocked 
			? this.terrainConfig.seed 
			: Date.now()
		
		const result = TerrainGenerator.generate({
			seed: seed ?? undefined,
			weights: this.terrainConfig.weights,
			enabled: this.terrainConfig.enabled
		})
		
		this.terrain = result.terrain
		this.lastTerrainSeed = result.seed
		
		if (this.onTerrainSeedChange) {
			this.onTerrainSeedChange(result.seed, result.stats)
		}
	}

	setTerrainConfig(config: Partial<TerrainConfig>): void {
		Object.assign(this.terrainConfig, config)
		console.log("[GAME]", `地形配置更新 | 锁定=${this.terrainConfig.isSeedLocked} 种子=${this.terrainConfig.seed}`)
	}

	randomizeSeed(): void {
		this.terrainConfig.seed = Date.now()
		console.log("[GAME]", `随机生成种子 | ${this.terrainConfig.seed}`)
	}

	// ========== 碰撞检测 ==========
	
	private _isInPit(x: number): boolean {
		return this.terrain.some(t => 
			t.type === TERRAIN.PIT && x >= t.start && x < t.end
		)
	}
	
	private _getTerrainAt(grid: number): TerrainType {
		const x = CONFIG.toPx(grid) + CONFIG.toPx(0.5)
		if (this._isInPit(x)) return TERRAIN.PIT
		return TERRAIN.GROUND
	}

	// ========== 玩家与相机 ==========
	
	private _resetPlayer(): void {
		this.player.x = CONFIG.toPx(CONFIG.PLAYER_START_X)
		this.player.y = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
		this.player.grid = 0
		this.player.action = PLAYER_ACTION.IDLE
		this.player.isJump = false
		this.player.direction = 0
		this.updateCamera()
	}
	
	updateCamera(playerX: number = this.player.x): void {
		if (this.viewportWidth <= 0) return
		const targetX = playerX - this.viewportWidth * CONFIG.CAMERA_OFFSET_RATIO
		const maxX = CONFIG.toPx(CONFIG.WORLD_LENGTH) - this.viewportWidth
		this.camera.x = Math.max(0, Math.min(targetX, maxX))
	}

	// ========== 事件通知 ==========
	
	private _notifyStateChange(): void {
		if (this.onStateChange) {
			this.onStateChange({ ...this.player }, { ...this.camera })
		}
	}
}

export default JumpGame
