/**
 * 狐狸动画控制器
 * 负责根据玩家物理状态切换 CSS 动画类与 WAAPI 尾巴动画
 */

import { CONFIG } from '@game/JumpGame.js'

export type FoxState = 'idle' | 'run' | 'jump-up' | 'jump-down' | 'land' | 'dead'

export interface PlayerInfo {
	x: number
	y: number
	action: string
}

export class FoxAnimator {
	private playerEl: HTMLElement
	private foxContainer: HTMLElement | null = null
	private foxTail: HTMLElement | null = null
	private _tailAnimation: Animation | null = null
	private _foxState: FoxState = 'idle'
	private _foxLastY: number = 0
	private _foxVelocity: number = 0
	private _foxOnGround: boolean = true

	constructor(playerEl: HTMLElement) {
		this.playerEl = playerEl
	}

	init(): void {
		this.foxContainer = this.playerEl.querySelector('.fox-container')
		this.foxTail = this.playerEl.querySelector('.fox-tail')
		console.log('[RENDER]', 'FoxAnimator 初始化完成')
		requestAnimationFrame(() => {
			this.startTailAnimation('idle')
		})
	}

	/**
	 * 更新狐狸动画状态（程序自动计算）
	 * @param player - 玩家位置/状态 {x, y, action}
	 * @param isMoving - 是否正在地面移动
	 * @param isJump - 是否正在跳跃
	 */
	update(player: PlayerInfo, isMoving: boolean, isJump: boolean): void {
		if (!this.foxContainer) return

		const currentY = player.y

		this._foxVelocity = currentY - this._foxLastY
		this._foxLastY = currentY

		const groundY = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
		const onGround = Math.abs(currentY - groundY) < 5

		let newState: FoxState = 'idle'

		if (player.action === 'dead') {
			newState = 'dead'
		} else if (!onGround) {
			if (this._foxVelocity > 0.5) {
				newState = 'jump-down'
			} else if (this._foxVelocity < -0.5) {
				newState = 'jump-up'
			} else {
				newState = 'jump-up'
			}
		} else if (isMoving) {
			newState = 'run'
		} else {
			newState = 'idle'
		}

		if (!this._foxOnGround && onGround && this._foxState !== 'idle') {
			newState = 'land'
			setTimeout(() => {
				if (this.foxContainer) {
					this.foxContainer.classList.remove('state-land')
					this.foxContainer.classList.add('state-idle')
					this.startTailAnimation('idle')
				}
			}, 200)
		}

		if (newState !== this._foxState) {
			console.log('[RENDER]', `狐狸动画切换 | ${this._foxState} → ${newState} | 速度=${this._foxVelocity.toFixed(2)} | 地面=${onGround}`)
			this.foxContainer.classList.remove(`state-${this._foxState}`)
			this.foxContainer.classList.add(`state-${newState}`)
			this._foxState = newState
			this.startTailAnimation(newState)
		}

		this._foxOnGround = onGround
	}

	/**
	 * 使用WAAPI启动尾巴动画（无过渡，直接切换）
	 * @param state - idle | run | jump-up | jump-down | land | dead
	 */
	startTailAnimation(state: FoxState): void {
		if (!this.foxTail) return

		if (this._tailAnimation) {
			this._tailAnimation.cancel()
			this._tailAnimation = null
		}

		let keyframes: Keyframe[]
		let options: KeyframeAnimationOptions

		switch(state) {
			case 'run':
				keyframes = [
					{ transform: 'rotate(-10deg)' },
					{ transform: 'rotate(15deg)' },
					{ transform: 'rotate(-10deg)' }
				]
				options = { duration: 300, iterations: Infinity }
				break
			case 'jump-up':
				keyframes = [
					{ transform: 'rotate(-30deg) scaleX(0.9)' }
				]
				options = { duration: 1000, fill: 'both' }
				break
			case 'jump-down':
				keyframes = [
					{ transform: 'rotate(20deg)' }
				]
				options = { duration: 1000, fill: 'both' }
				break
			case 'land':
				keyframes = [
					{ transform: 'rotate(-10deg)' }
				]
				options = { duration: 200, fill: 'forwards' }
				break
			case 'dead':
				return
			case 'idle':
			default:
				keyframes = [
					{ transform: 'rotate(-10deg)' },
					{ transform: 'rotate(5deg)' },
					{ transform: 'rotate(-10deg)' }
				]
				options = { duration: 3000, iterations: Infinity }
		}

		console.log('[RENDER]', `尾巴动画启动 | state=${state}`)
		this._tailAnimation = this.foxTail.animate(keyframes, options)
	}

	/**
	 * 强制设置状态（用于动画完成后的恢复）
	 * @param state - 目标状态
	 */
	setState(state: FoxState): void {
		if (!this.foxContainer) return
		console.log('[RENDER]', `狐狸强制设态 | → ${state}`)
		this.foxContainer.classList.remove('state-run', 'state-jump-up', 'state-jump-down', 'state-land')
		this.foxContainer.classList.add(`state-${state}`)
		this._foxState = state
		this.startTailAnimation(state)
	}

	/**
	 * 显示死亡动画
	 */
	showDeath(): void {
		if (!this.foxContainer) return
		console.log('[RENDER]', '狐狸死亡动画')
		this.foxContainer.classList.remove('state-idle', 'state-run', 'state-jump-up', 'state-jump-down', 'state-land')
		this.foxContainer.classList.add('state-dead')
		this._foxState = 'dead'
		this.startTailAnimation('dead')
	}

	/**
	 * 重置玩家状态（新一关）
	 */
	reset(): void {
		if (!this.foxContainer) return
		console.log('[RENDER]', '狐狸动画重置')
		this.foxContainer.className = 'fox-container state-idle'
		this._foxState = 'idle'
		this._foxLastY = 0
		this._foxVelocity = 0
		this._foxOnGround = true
		this.startTailAnimation('idle')
	}
}

export default FoxAnimator
