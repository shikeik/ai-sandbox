// ========== 连续挑战控制器 ==========
// 职责：管理AI连续闯关多个随机地形的逻辑

import type { AppState } from "./state.js"
import type { ForwardResult, ActionType } from "./types.js"
import {
	NUM_COLS, NUM_LAYERS, ELEMENTS, ELEM_AIR, ELEM_HERO, ELEM_GROUND,
	ACTIONS, CURRICULUM_STAGES, DEFAULT_TERRAIN_CONFIG
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import { forward } from "./neural-network.js"
import {
	terrainToIndices, findHeroCol, getActionChecks, getLabel, getActionName,
	isActionValidByChecks, generateRandomTerrain, isValidTerrain
} from "./terrain.js"

// ========== 挑战结果类型 ==========

export interface ChallengeResult {
	level: number              // 关卡序号
	terrain: number[][]        // 地形
	predictedAction: number    // AI预测动作
	predictedActionName: string
	correctAction: number      // 正确答案
	correctActionName: string
	isValid: boolean           // 是否合法
	isOptimal: boolean         // 是否最优
	probabilities: number[]    // 各动作概率
}

export interface ChallengeState {
	isRunning: boolean         // 是否正在挑战
	isPaused: boolean          // 是否暂停
	currentLevel: number       // 当前关卡
	streakCount: number        // 连胜次数
	totalCount: number         // 总挑战次数
	passedCount: number        // 通过关卡数
	history: ChallengeResult[] // 历史记录
	currentTerrain: number[][] | null // 当前地形
	currentResult: ChallengeResult | null // 当前结果
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
	private onLevelComplete: (result: ChallengeResult) => void

	constructor(
		state: AppState,
		onUpdate: (state: ChallengeState) => void,
		onLevelComplete: (result: ChallengeResult) => void
	) {
		this.state = state
		this.onUpdate = onUpdate
		this.onLevelComplete = onLevelComplete
		this.challengeState = this.createInitialChallengeState()
	}

	// ========== 状态管理 ==========

	private createInitialChallengeState(): ChallengeState {
		return {
			isRunning: false,
			isPaused: false,
			currentLevel: 0,
			streakCount: 0,
			totalCount: 0,
			passedCount: 0,
			history: [],
			currentTerrain: null,
			currentResult: null,
		}
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

		this.challengeState.isRunning = true
		this.challengeState.isPaused = false
		this.onUpdate(this.challengeState)

		this.runNextLevel()
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
		this.onUpdate(this.challengeState)
		this.runNextLevel()
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
		this.challengeState.isRunning = false
		this.challengeState.isPaused = false
	}

	/**
	 * 执行下一关
	 */
	private runNextLevel(): void {
		if (!this.challengeState.isRunning || this.challengeState.isPaused) return

		// 生成新地形
		const terrain = this.generateChallengeTerrain()
		this.challengeState.currentTerrain = terrain
		this.challengeState.currentLevel++

		// 执行预测
		const result = this.executePrediction(terrain)
		this.challengeState.currentResult = result

		// 更新统计
		this.challengeState.totalCount++
		if (result.isValid) {
			this.challengeState.passedCount++
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
		this.onLevelComplete(result)

		// 延迟进入下一关
		const delay = this.calculateDelay()
		this.challengeTimer = window.setTimeout(() => {
			this.runNextLevel()
		}, delay)
	}

	/**
	 * 生成挑战地形
	 */
	private generateChallengeTerrain(): number[][] {
		return generateRandomTerrain(this.terrainConfig)
	}

	/**
	 * 执行预测
	 */
	private executePrediction(terrain: number[][]): ChallengeResult {
		const indices = terrainToIndices(terrain)
		const fp = forward(this.state.net, indices)
		const pred = fp.o.indexOf(Math.max(...fp.o))
		const heroCol = findHeroCol(terrain)
		const checks = getActionChecks(terrain, heroCol)
		const correct = getLabel(terrain)

		const isValid = isActionValidByChecks(checks, pred)
		const isOptimal = pred === correct && correct !== -1

		return {
			level: this.challengeState.currentLevel + 1,
			terrain: terrain.map(row => [...row]),
			predictedAction: pred,
			predictedActionName: getActionName(pred),
			correctAction: correct,
			correctActionName: correct === -1 ? "无解" : getActionName(correct),
			isValid,
			isOptimal,
			probabilities: [...fp.o],
		}
	}

	/**
	 * 计算关卡间隔延迟
	 */
	private calculateDelay(): number {
		const baseDelay = 1500  // 基础延迟 1.5秒
		return baseDelay / this.speed
	}

	/**
	 * 获取成功率
	 */
	getSuccessRate(): number {
		if (this.challengeState.totalCount === 0) return 0
		return Math.round((this.challengeState.passedCount / this.challengeState.totalCount) * 100)
	}

	/**
	 * 获取当前关卡的地形（用于渲染）
	 */
	getCurrentTerrain(): number[][] | null {
		return this.challengeState.currentTerrain
	}

	/**
	 * 获取当前前向传播结果（用于渲染MLP）
	 */
	getCurrentForwardResult(): ForwardResult | null {
		if (!this.challengeState.currentTerrain) return null
		const indices = terrainToIndices(this.challengeState.currentTerrain)
		return forward(this.state.net, indices)
	}
}
