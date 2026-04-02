/**
 * 转场管理器
 * 处理死亡/胜利后的渐暗渐亮效果
 */

const TIMING = {
	SHOW_RESULT: 800,
	FADE_DURATION: 400,
	PAUSE: 100
} as const

export class TransitionManager {
	private container: HTMLElement
	private overlay: HTMLElement | null = null
	private isTransitioning: boolean = false

	constructor(containerId: string) {
		const el = document.getElementById(containerId)
		if (!el) {
			throw new Error(`TransitionManager: 找不到元素 #${containerId}`)
		}
		this.container = el
		this.init()
	}

	private init(): void {
		this.overlay = document.createElement('div')
		this.overlay.className = 'transition-overlay'
		this.overlay.style.cssText = `
			position: absolute;
			inset: 0;
			background: #000;
			opacity: 0;
			pointer-events: none;
			z-index: 1600;
			transition: opacity 0.4s ease-in-out;
		`
		this.container.appendChild(this.overlay)
	}

	/**
	 * 执行重生转场
	 * @param onMidPoint - 渐暗完成时的回调（执行重生逻辑）
	 * @param onComplete - 转场完成时的回调
	 */
	async playRespawnTransition(onMidPoint?: () => void, onComplete?: () => void): Promise<void> {
		if (this.isTransitioning || !this.overlay) return
		this.isTransitioning = true

		await this._delay(TIMING.SHOW_RESULT)

		this.overlay.style.opacity = '1'
		await this._delay(TIMING.FADE_DURATION)

		if (onMidPoint) {
			onMidPoint()
		}

		await this._delay(TIMING.PAUSE)

		this.overlay.style.opacity = '0'
		await this._delay(TIMING.FADE_DURATION)

		this.isTransitioning = false

		if (onComplete) {
			onComplete()
		}
	}

	private _delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	destroy(): void {
		if (this.overlay) {
			this.overlay.remove()
			this.overlay = null
		}
	}
}

export default TransitionManager
