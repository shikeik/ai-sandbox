// ========== 格子世界系统 - 动画管理器 ==========
// 职责：统一的动作动画系统（走/跳/远跳/走A）

import type { ActionType } from "../types.js"
import type { AnimationConfig, AnimationState } from "./types.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 动画配置常量 ==========

const ANIMATION_CONFIGS: Record<ActionType, AnimationConfig> = {
	"走": { duration: 400, jumpHeight: 0 },
	"走A": { duration: 400, jumpHeight: 0 },
	"跳": { duration: 600, jumpHeight: 44 },  // 约1格高度
	"远跳": { duration: 900, jumpHeight: 66 }, // 约1.5格高度
}

// ========== 缓动函数 ==========

function easeOutQuad(t: number): number {
	return t * (2 - t)
}

function easeLinear(t: number): number {
	return t
}

// ========== 动画管理器 ==========

export class GridWorldAnimator {
	private state: AnimationState
	private frameId: number | null = null
	private onFrame: ((progress: number, slimeKilled: boolean) => void) | null = null
	private onComplete: (() => void) | null = null
	private logger: Logger

	constructor() {
		this.state = {
			isPlaying: false,
			startTime: 0,
			progress: 0,
			action: null,
			slimeKilled: false,
		}
		this.logger = new Logger("GRID-ANIMATOR")
	}

	// ========== 核心动画方法 ==========

	/**
	 * 播放动作动画
	 * @param action 动作类型
	 * @param onFrame 每帧回调 (progress, slimeKilled) => void
	 * @returns Promise 动画完成时 resolve
	 */
	async play(action: ActionType, onFrame?: (progress: number, slimeKilled: boolean) => void): Promise<void> {
		
		// 停止当前动画
		this.stop()

		const config = ANIMATION_CONFIGS[action]
		if (!config) {
			throw new Error(`未知的动作类型: ${action}`)
		}

		this.state.action = action
		this.state.startTime = performance.now()
		this.state.isPlaying = true
		this.state.progress = 0
		this.state.slimeKilled = false
		this.onFrame = onFrame ?? null

		return new Promise((resolve) => {
			this.onComplete = resolve
			this.frameId = requestAnimationFrame((now) => this.step(now))
		})
	}

	/**
	 * 动画帧回调
	 */
	private step(now: number): void {
		if (!this.state.isPlaying) {
			return
		}

		const config = ANIMATION_CONFIGS[this.state.action!]
		const elapsed = now - this.state.startTime
		const progress = Math.min(1, elapsed / config.duration)
		this.state.progress = progress

		// 走A：50% 进度时击杀史莱姆
		if (this.state.action === "走A" && progress > 0.5 && !this.state.slimeKilled) {
			this.state.slimeKilled = true
		}

		// 回调通知
		if (this.onFrame) {
			this.onFrame(progress, this.state.slimeKilled)
		}

		// 检查动画完成
		if (progress >= 1) {
			this.complete()
		} else {
			this.frameId = requestAnimationFrame((t) => this.step(t))
		}
	}

	/**
	 * 完成动画
	 */
	private complete(): void {
		this.state.isPlaying = false
		this.frameId = null
		
		if (this.onComplete) {
			const resolve = this.onComplete
			this.onComplete = null
			resolve()
		}
	}

	/**
	 * 停止动画
	 */
	stop(): void {
		if (this.frameId !== null) {
			cancelAnimationFrame(this.frameId)
			this.frameId = null
		}
		this.state.isPlaying = false
		this.state.progress = 0
		this.onComplete = null
	}

	// ========== 状态查询 ==========

	getState(): AnimationState {
		return { ...this.state }
	}

	isPlaying(): boolean {
		return this.state.isPlaying
	}

	/**
	 * 计算动画中的位置
	 */
	calculatePosition(
		action: ActionType,
		progress: number,
		startX: number,
		startY: number,
		targetX: number,
		cellH: number
	): { x: number; y: number } {
		const config = ANIMATION_CONFIGS[action]
		
		let x: number
		let y: number

		if (config.jumpHeight === 0) {
			// 走/走A：缓动
			x = startX + (targetX - startX) * easeOutQuad(progress)
			y = startY
		} else {
			// 跳/远跳：抛物线
			x = startX + (targetX - startX) * easeLinear(progress)
			const parabola = 4 * progress * (1 - progress)
			y = startY - parabola * (cellH + (config.jumpHeight ?? 0))
		}

		return { x, y }
	}

	/**
	 * 获取动作的持续时间
	 */
	getDuration(action: ActionType): number {
		return ANIMATION_CONFIGS[action]?.duration ?? 400
	}

	/**
	 * 获取动作的目标列偏移
	 */
	getTargetColOffset(action: ActionType): number {
		switch (action) {
			case "走":
			case "走A":
				return 1
			case "跳":
				return 2
			case "远跳":
				return 3
			default:
				return 1
		}
	}

	/**
	 * 检查是否是跳跃动作
	 */
	isJump(action: ActionType): boolean {
		return action === "跳" || action === "远跳"
	}

	/**
	 * 销毁
	 */
	destroy(): void {
		this.stop()
	}
}
