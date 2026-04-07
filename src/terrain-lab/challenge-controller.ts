// ========== 连续挑战控制器 ==========
// 职责：管理AI跑酷模式——32格长地图，5×3视野窗口

export { ChallengeUIManager } from "./challenge-ui.js"

import type { AppState } from "./state.js"
import type { ForwardResult, ActionType } from "./types.js"
import {
	NUM_LAYERS, ELEM_AIR, ELEM_HERO, ELEM_GROUND,
	DEFAULT_TERRAIN_CONFIG
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import { forward } from "./neural-network.js"
import {
	terrainToIndices, getActionChecks, isActionValidByChecks, getActionName,
	generateTerrainForAction
} from "./terrain.js"

// ========== 常量 ==========

const MAP_LENGTH = 32  // 地图总长度
const VIEWPORT_COLS = 5  // 视野窗口宽度

// ========== 挑战结果类型 ==========

export interface ChallengeResult {
	step: number                // 步数序号
	heroCol: number             // 狐狸当前列
	predictedAction: number    // AI预测动作
	predictedActionName: string
	isValid: boolean           // 是否合法
	probabilities: number[]    // 各动作概率
}

export type ChallengeMode = "play" | "train"

export interface ChallengeState {
	isRunning: boolean         // 是否正在挑战
	isPaused: boolean          // 是否暂停
	isStepMode: boolean        // 是否单步模式
	mode: ChallengeMode        // 挑战模式：demo=演示(冻结调参), train=训练(可学习)
	currentStep: number        // 当前步数
	heroCol: number            // 狐狸当前列
	streakCount: number        // 连胜次数（连续成功步数）
	totalSteps: number         // 总步数
	passedSteps: number        // 成功步数
	history: ChallengeResult[] // 历史记录
	fullMap: number[][] | null // 完整32格地图（3行×32列）
	currentResult: ChallengeResult | null // 当前结果
	gameOver: boolean          // 游戏是否结束
	gameWon: boolean           // 是否通关
}

export type ChallengeSpeed = 1 | 2 | 5

// ========== 控制器类 ==========

export class ChallengeController {
	private state: AppState
	private challengeState: ChallengeState
	private terrainConfig: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG }
	private speed: ChallengeSpeed = 1
	private challengeTimer: number | null = null
	private onUpdate: (state: ChallengeState) => void
	private onStepComplete: (result: ChallengeResult) => void
	private onGameOver: (won: boolean, finalCol: number) => void
	private onPlayAnimation: (action: ActionType, speed: ChallengeSpeed) => Promise<void>
	private canvas: HTMLCanvasElement | null = null

	// 动画状态
	private animId: number | null = null
	private animStartTime: number = 0
	private animAction: ActionType | null = null
	private animSlimeKilled: boolean = false
	private animResolve: (() => void) | null = null

	constructor(
		state: AppState,
		onUpdate: (state: ChallengeState) => void,
		onStepComplete: (result: ChallengeResult) => void,
		onGameOver: (won: boolean, finalCol: number) => void,
		onPlayAnimation: (action: ActionType, speed: ChallengeSpeed) => Promise<void>,
		canvas?: HTMLCanvasElement
	) {
		this.state = state
		this.onUpdate = onUpdate
		this.onStepComplete = onStepComplete
		this.onGameOver = onGameOver
		this.onPlayAnimation = onPlayAnimation
		this.canvas = canvas ?? null
		this.challengeState = this.createInitialChallengeState()
	}

	// ========== 状态管理 ==========

	private createInitialChallengeState(): ChallengeState {
		return {
			isRunning: false,
			isPaused: false,
			isStepMode: false,
			mode: "play",
			currentStep: 0,
			heroCol: 0,
			streakCount: 0,
			totalSteps: 0,
			passedSteps: 0,
			history: [],
			fullMap: null,
			currentResult: null,
			gameOver: false,
			gameWon: false,
		}
	}

	setMode(mode: ChallengeMode): void {
		this.challengeState.mode = mode
		this.onUpdate(this.challengeState)
	}

	getMode(): ChallengeMode {
		return this.challengeState.mode
	}

	getState(): ChallengeState {
		return { ...this.challengeState }
	}

	getIsRunning(): boolean {
		return this.challengeState.isRunning
	}

	getIsPaused(): boolean {
		return this.challengeState.isPaused
	}

	getHeroCol(): number {
		return this.challengeState.heroCol
	}

	// ========== 配置设置 ==========

	setTerrainConfig(config: TerrainConfig): void {
		this.terrainConfig = { ...config }
	}

	setSpeed(speed: ChallengeSpeed): void {
		this.speed = speed
	}

	getSpeed(): ChallengeSpeed {
		return this.speed
	}

	// ========== 核心挑战逻辑 ==========

	/**
	 * 开始挑战
	 */
	start(): void {
		if (this.challengeState.isRunning) return

		// 如果游戏已结束或从未开始，重置状态
		if (this.challengeState.gameOver || this.challengeState.currentStep === 0) {
			this.reset()
			this.challengeState.fullMap = this.generateChallengeMap()
		}

		this.challengeState.isRunning = true
		this.challengeState.isPaused = false
		this.challengeState.isStepMode = false
		this.onUpdate(this.challengeState)

		this.runNextStep()
	}

	/**
	 * 暂停挑战
	 */
	pause(): void {
		if (!this.challengeState.isRunning) return

		this.challengeState.isPaused = true
		if (this.challengeTimer !== null) {
			clearTimeout(this.challengeTimer)
			this.challengeTimer = null
		}
		this.onUpdate(this.challengeState)
	}

	/**
	 * 恢复挑战
	 */
	resume(): void {
		if (!this.challengeState.isRunning || !this.challengeState.isPaused) return

		this.challengeState.isPaused = false
		this.challengeState.isStepMode = false
		this.onUpdate(this.challengeState)
		this.runNextStep()
	}

	/**
	 * 单步执行
	 */
	step(): void {
		// 如果游戏已结束，先重置
		if (this.challengeState.gameOver) {
			this.reset()
			this.challengeState.fullMap = this.generateChallengeMap()
		}

		// 如果没有地图，先生成
		if (!this.challengeState.fullMap) {
			this.challengeState.fullMap = this.generateChallengeMap()
		}

		this.challengeState.isRunning = true
		this.challengeState.isPaused = false
		this.challengeState.isStepMode = true
		this.onUpdate(this.challengeState)

		this.runNextStep()
	}

	/**
	 * 重置挑战
	 */
	reset(): void {
		this.stop()
		this.challengeState = this.createInitialChallengeState()
		this.onUpdate(this.challengeState)
	}

	/**
	 * 停止挑战
	 */
	stop(): void {
		if (this.challengeTimer !== null) {
			clearTimeout(this.challengeTimer)
			this.challengeTimer = null
		}
		this.stopAnimation()
		this.challengeState.isRunning = false
		this.challengeState.isPaused = false
	}

	/**
	 * 设置画布（用于动画渲染）
	 */
	setCanvas(canvas: HTMLCanvasElement): void {
		this.canvas = canvas
	}

	/**
	 * 停止当前动画
	 */
	private stopAnimation(): void {
		if (this.animId !== null) {
			cancelAnimationFrame(this.animId)
			this.animId = null
		}
		this.animAction = null
		this.animSlimeKilled = false
		this.animResolve = null
	}

	/**
	 * 生成32格绝对合法挑战地图
	 * 使用generateTerrainForAction一步步生成，确保每格都有解
	 */
	private generateChallengeMap(): number[][] {
		// 初始化32列空地图
		const map: number[][] = [
			Array(MAP_LENGTH).fill(ELEM_AIR),
			Array(MAP_LENGTH).fill(ELEM_AIR),
			Array(MAP_LENGTH).fill(ELEM_AIR),
		]

		// 起点设置
		map[2][0] = ELEM_GROUND  // 地面

		let heroCol = 0
		let attempts = 0
		const maxAttempts = 100

		// 一步步生成合法地形，直到到达终点或超出边界
		while (heroCol < MAP_LENGTH - 1 && attempts < maxAttempts) {
			attempts++
			
			// 随机选择一个动作（0=走, 1=跳, 2=远跳）
			const action = Math.floor(Math.random() * 3)
			const step = action === 0 ? 1 : action === 1 ? 2 : 3
			
			// 检查是否会超出地图
			if (heroCol + step >= MAP_LENGTH) continue
			
			// 为该动作生成地形
			const result = generateTerrainForAction(action, heroCol, this.terrainConfig, map, true)
			
			if (result) {
				// 成功生成，移动狐狸位置
				heroCol += step
			}
		}

		// 确保终点是平地
		map[2][MAP_LENGTH - 1] = ELEM_GROUND
		
		// 清除地图上所有狐狸（狐狸由GridWorld单独管理）
		for (let c = 0; c < MAP_LENGTH; c++) {
			if (map[1][c] === ELEM_HERO) {
				map[1][c] = ELEM_AIR
			}
		}

		return map
	}

	/**
	 * 获取5×3视野窗口地形
	 */
	getViewportTerrain(heroCol: number): number[][] {
		const viewport: number[][] = [[], [], []]
		const map = this.challengeState.fullMap

		if (!map) {
			// 如果没有地图，返回默认空地图
			return [
				Array(VIEWPORT_COLS).fill(ELEM_AIR),
				[ELEM_HERO, ...Array(VIEWPORT_COLS - 1).fill(ELEM_AIR)],
				Array(VIEWPORT_COLS).fill(ELEM_GROUND),
			]
		}

		for (let layer = 0; layer < NUM_LAYERS; layer++) {
			for (let i = 0; i < VIEWPORT_COLS; i++) {
				const mapCol = heroCol + i
				if (mapCol < MAP_LENGTH) {
					viewport[layer][i] = map[layer]![mapCol]!
				} else {
					// 超出地图边界显示空气
					viewport[layer][i] = ELEM_AIR
				}
			}
		}

		// 确保视野中狐狸在0列
		for (let c = 0; c < VIEWPORT_COLS; c++) {
			if (viewport[1][c] === ELEM_HERO && c !== 0) {
				viewport[1][c] = ELEM_AIR
			}
		}
		viewport[1][0] = ELEM_HERO

		return viewport
	}

	/**
	 * 获取当前完整地图
	 */
	getFullMap(): number[][] | null {
		return this.challengeState.fullMap
	}

	/**
	 * 获取当前视野地形（用于渲染）
	 */
	getCurrentTerrain(): number[][] | null {
		if (!this.challengeState.fullMap) return null
		return this.getViewportTerrain(this.challengeState.heroCol)
	}

	/**
	 * 执行下一步
	 */
	private async runNextStep(): Promise<void> {
		if (!this.challengeState.isRunning || this.challengeState.isPaused) return
		if (this.challengeState.gameOver) return

		const heroCol = this.challengeState.heroCol

		// 检查是否已到达终点
		if (heroCol >= MAP_LENGTH - 1) {
			this.challengeState.gameOver = true
			this.challengeState.gameWon = true
			this.challengeState.isRunning = false
			this.onUpdate(this.challengeState)
			this.onGameOver(true, heroCol)
			return
		}

		// 获取当前视野并执行预测
		const viewport = this.getViewportTerrain(heroCol)
		const result = this.executePrediction(viewport, heroCol)
		this.challengeState.currentResult = result

		// 更新统计
		this.challengeState.currentStep++
		this.challengeState.totalSteps++

		// 计算目标列
		let targetCol = heroCol
		if (result.predictedAction === 0) targetCol = heroCol + 1  // 走
		else if (result.predictedAction === 1) targetCol = heroCol + 2  // 跳
		else if (result.predictedAction === 2) targetCol = heroCol + 3  // 远跳
		else if (result.predictedAction === 3) targetCol = heroCol + 1  // 走A

		// 检查动作是否合法
		if (result.isValid) {
			this.challengeState.passedSteps++
			this.challengeState.streakCount++
		} else {
			this.challengeState.streakCount = 0
		}

		// 添加到历史记录（最多保留10条）
		this.challengeState.history.unshift(result)
		if (this.challengeState.history.length > 10) {
			this.challengeState.history.pop()
		}

		// 通知更新
		this.onUpdate(this.challengeState)
		this.onStepComplete(result)

		// 播放动作动画
		const actionName = result.predictedActionName as ActionType
		await this.playStepAnimation(actionName)

		// 动画完成后，更新狐狸位置并检查游戏状态
		if (result.isValid) {
			// 移动狐狸到目标列
			this.moveHero(heroCol, targetCol)
			this.challengeState.heroCol = targetCol

			// 检查新位置是否安全（落地位置必须是平地）
			const map = this.challengeState.fullMap
			if (map && targetCol < MAP_LENGTH) {
				const landingGround = map[2][targetCol]
				if (landingGround !== ELEM_GROUND) {
					// 掉坑了！游戏结束
					this.challengeState.gameOver = true
					this.challengeState.gameWon = false
					this.challengeState.isRunning = false
					this.onUpdate(this.challengeState)
					this.onGameOver(false, targetCol)
					return
				}
			}

			// 检查是否通关
			if (targetCol >= MAP_LENGTH - 1) {
				this.challengeState.gameOver = true
				this.challengeState.gameWon = true
				this.challengeState.isRunning = false
				this.onUpdate(this.challengeState)
				this.onGameOver(true, targetCol)
				return
			}
		} else {
			// 非法动作，游戏结束
			this.challengeState.gameOver = true
			this.challengeState.gameWon = false
			this.challengeState.isRunning = false
			this.onUpdate(this.challengeState)
			this.onGameOver(false, heroCol)
			return
		}

		// 如果不是单步模式，继续下一步
		if (!this.challengeState.isStepMode) {
			const delay = this.calculateDelay()
			this.challengeTimer = window.setTimeout(() => {
				this.runNextStep()
			}, delay)
		} else {
			// 单步模式：暂停
			this.challengeState.isPaused = true
			this.challengeState.isRunning = false
			this.onUpdate(this.challengeState)
		}
	}

	/**
	 * 移动狐狸在地图中的位置
	 */
	private moveHero(fromCol: number, toCol: number): void {
		const map = this.challengeState.fullMap
		if (!map) return

		// 从原位置移除狐狸
		if (map[1]) {
			map[1][fromCol] = ELEM_AIR
		}

		// 在新位置放置狐狸（如果在地图范围内）
		if (toCol < MAP_LENGTH && map[1]) {
			map[1][toCol] = ELEM_HERO
		}
	}

	/**
	 * 播放步骤动画
	 */
	private playStepAnimation(action: ActionType): Promise<void> {
		return this.onPlayAnimation(action, this.speed)
	}

	/**
	 * 执行预测
	 */
	private executePrediction(viewport: number[][], heroCol: number): ChallengeResult {
		const indices = terrainToIndices(viewport)
		const fp = forward(this.state.net, indices)
		const pred = fp.o.indexOf(Math.max(...fp.o))
		const checks = getActionChecks(viewport, 0)  // 视野中狐狸始终在0列

		const isValid = isActionValidByChecks(checks, pred)

		return {
			step: this.challengeState.currentStep + 1,
			heroCol,
			predictedAction: pred,
			predictedActionName: getActionName(pred),
			isValid,
			probabilities: [...fp.o],
		}
	}

	/**
	 * 计算步骤间隔延迟
	 */
	private calculateDelay(): number {
		const baseDelay = 500
		return baseDelay / this.speed
	}

	/**
	 * 获取成功率
	 */
	getSuccessRate(): number {
		if (this.challengeState.totalSteps === 0) return 0
		return Math.round((this.challengeState.passedSteps / this.challengeState.totalSteps) * 100)
	}

	/**
	 * 获取当前前向传播结果（用于渲染MLP）
	 */
	getCurrentForwardResult(): ForwardResult | null {
		const terrain = this.getCurrentTerrain()
		if (!terrain) return null
		const indices = terrainToIndices(terrain)
		return forward(this.state.net, indices)
	}
}
