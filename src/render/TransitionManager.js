/**
 * 转场管理器
 * 处理死亡/胜利后的渐暗渐亮效果
 */
export class TransitionManager {
	constructor(containerId) {
		this.container = document.getElementById(containerId)
		this.overlay = null
		this.isTransitioning = false
		this.init()
	}

	init() {
	// 创建转场遮罩层
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
	* @param {Function} onMidPoint - 渐暗完成时的回调（执行重生逻辑）
	* @param {Function} onComplete - 转场完成时的回调
	*/
	async playRespawnTransition(onMidPoint, onComplete) {
		if (this.isTransitioning) return
		this.isTransitioning = true

		// 等待缓冲时间（死亡/胜利动画展示）
		await this._delay(800)

		// 渐暗
		this.overlay.style.opacity = '1'
		await this._delay(400)  // 等待渐暗完成

		// 执行重生逻辑（在暗屏时）
		if (onMidPoint) {
			onMidPoint()
		}

		// 短暂停顿（确保重生完成）
		await this._delay(100)

		// 渐亮
		this.overlay.style.opacity = '0'
		await this._delay(400)  // 等待渐亮完成

		this.isTransitioning = false

		if (onComplete) {
			onComplete()
		}
	}

	_delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	destroy() {
		if (this.overlay) {
			this.overlay.remove()
			this.overlay = null
		}
	}
}

export default TransitionManager
