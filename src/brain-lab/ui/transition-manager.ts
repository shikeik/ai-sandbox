// ========== 转场管理器 - 死亡/胜利动画效果 ==========

import type { UIManager } from "./ui-manager.js"

/** 转场类型 */
export type TransitionType = "death" | "victory"

/**
 * 转场管理器 - 统一处理游戏状态转场动画
 * 
 * 职责：
 * - 死亡转场（骷髅头 + 渐暗）
 * - 胜利转场（奖杯 + 渐暗）
 * - 统一的淡入淡出控制
 */
export class TransitionManager {
	private uiManager: UIManager
	private isTransitioning: boolean = false

	// 动画时长配置（毫秒）
	private static readonly DURATION = {
		fadeIn: 400,      // 渐暗时间
		pause: 200,       // 停顿时间
		fadeOut: 600,     // 渐亮时间
		iconDisplay: 400, // 图标显示时间
	} as const

	constructor(uiManager: UIManager) {
		this.uiManager = uiManager
	}

	/**
	 * 执行转场动画
	 * @param type 转场类型
	 * @param onMidpoint 转场中点回调（完全暗下来时，用于重置游戏）
	 */
	async playTransition(
		type: TransitionType,
		onMidpoint?: () => Promise<void>
	): Promise<void> {
		if (this.isTransitioning) return
		this.isTransitioning = true

		try {
			// 1. 准备转场元素
			const elements = type === "death"
				? this.uiManager.createDeathOverlay()
				: this.uiManager.createVictoryTrophy()

			if (!elements) {
				this.isTransitioning = false
				return
			}

			// 2. 渐暗阶段（同时显示图标）
			await this.fadeIn(elements, type)

			// 3. 中点回调（重置游戏）
			if (onMidpoint) {
				await onMidpoint()
			}

			// 4. 渐亮阶段
			await this.fadeOut(elements, type)

		} finally {
			this.isTransitioning = false
		}
	}

	/**
	 * 渐暗阶段
	 */
	private async fadeIn(
		elements: { skull?: HTMLElement; trophy?: HTMLElement; overlay: HTMLElement },
		type: TransitionType
	): Promise<void> {
		const icon = type === "death" ? elements.skull : elements.trophy

		// 显示图标和遮罩
		if (icon) icon.style.opacity = "1"
		this.uiManager.showTransitionElements(elements, TransitionManager.DURATION.fadeIn)

		// 等待渐暗完成
		await this.delay(TransitionManager.DURATION.fadeIn + 200)
	}

	/**
	 * 渐亮阶段
	 */
	private async fadeOut(
		elements: { skull?: HTMLElement; trophy?: HTMLElement; overlay: HTMLElement },
		type: TransitionType
	): Promise<void> {
		const icon = type === "death" ? elements.skull : elements.trophy

		// 隐藏图标
		if (icon) {
			await this.uiManager.hideTransitionElement(icon, 0)
		}

		// 渐亮
		await this.uiManager.fadeOutOverlay(
			elements.overlay,
			TransitionManager.DURATION.fadeOut
		)

		// 清理奖杯元素（死亡时骷髅头保留用于下次）
		if (type === "victory" && icon) {
			setTimeout(() => icon.remove(), 100)
		}
	}

	/**
	 * 延迟辅助
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	/**
	 * 是否正在转场中
	 */
	get transitioning(): boolean {
		return this.isTransitioning
	}
}
