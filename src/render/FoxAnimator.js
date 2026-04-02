/**
 * 狐狸动画控制器
 * 负责根据玩家物理状态切换 CSS 动画类与 WAAPI 尾巴动画
 */

import { CONFIG } from '@game/JumpGame.js'

export class FoxAnimator {
	constructor(playerEl) {
		this.playerEl = playerEl
		this.foxContainer = null
		this.foxTail = null
		this._tailAnimation = null
		this._foxState = 'idle'
		this._foxLastY = 0
		this._foxVelocity = 0
		this._foxOnGround = true
	}

	init() {
		this.foxContainer = this.playerEl.querySelector('.fox-container')
		this.foxTail = this.playerEl.querySelector('.fox-tail')
		console.log('[RENDER]', 'FoxAnimator 初始化完成')
		requestAnimationFrame(() => {
			this.startTailAnimation('idle')
		})
	}

	/**
	* 更新狐狸动画状态（程序自动计算）
	* @param {Object} player - 玩家位置/状态 {x, y, action}
	* @param {boolean} isMoving - 是否正在地面移动
	* @param {boolean} isJump - 是否正在跳跃
	*/
	update(player, isMoving, isJump) {
		if (!this.foxContainer) return

		const currentY = player.y
		const currentX = player.x

		// 计算垂直速度
		this._foxVelocity = currentY - this._foxLastY
		this._foxLastY = currentY

		// 判断是否在地面上
		const groundY = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
		const onGround = Math.abs(currentY - groundY) < 5

		// 计算新状态
		let newState = 'idle'

		if (player.action === 'dead') {
			newState = 'dead'
		} else if (!onGround) {
			// 在空中
			if (this._foxVelocity > 0.5) {
				newState = 'jump-down'  // 下降
			} else if (this._foxVelocity < -0.5) {
				newState = 'jump-up'    // 上升
			} else {
				newState = 'jump-up'    // 最高点附近，保持上升姿态
			}
		} else if (isMoving) {
			newState = 'run'  // 地面移动
		} else {
			newState = 'idle' // 待机
		}

		// 落地检测（从空中到地面）
		if (!this._foxOnGround && onGround && this._foxState !== 'idle') {
			newState = 'land'
			// 0.2秒后恢复待机
			setTimeout(() => {
				if (this.foxContainer) {
					this.foxContainer.classList.remove('state-land')
					this.foxContainer.classList.add('state-idle')
					// 同步更新尾巴动画为待机
					this.startTailAnimation('idle')
				}
			}, 200)
		}

		// 应用新状态
		if (newState !== this._foxState) {
			console.log('[RENDER]', `狐狸动画切换 | ${this._foxState} → ${newState} | 速度=${this._foxVelocity.toFixed(2)} | 地面=${onGround}`)
			this.foxContainer.classList.remove(`state-${this._foxState}`)
			this.foxContainer.classList.add(`state-${newState}`)
			this._foxState = newState

			// 使用WAAPI更新尾巴动画（平滑混合）
			this.startTailAnimation(newState)
		}

		this._foxOnGround = onGround
	}

	/**
	* 使用WAAPI启动尾巴动画（无过渡，直接切换）
	* @param {string} state - idle | run | jump-up | jump-down | land | dead
	*/
	startTailAnimation(state) {
		if (!this.foxTail) return

		// 停止当前动画
		if (this._tailAnimation) {
			this._tailAnimation.cancel()
			this._tailAnimation = null
		}

		// 根据状态定义动画（直接切换，无过渡）
		let keyframes, options

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
				// 死亡时停止尾巴动画
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

		// 使用WAAPI启动动画
		console.log('[RENDER]', `尾巴动画启动 | state=${state}`)
		this._tailAnimation = this.foxTail.animate(keyframes, options)
	}

	/**
	* 强制设置状态（用于动画完成后的恢复）
	* @param {string} state
	*/
	setState(state) {
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
	showDeath() {
		if (!this.foxContainer) return
		console.log('[RENDER]', '狐狸死亡动画')
		this.foxContainer.classList.remove('state-idle', 'state-run', 'state-jump-up', 'state-jump-down', 'state-land')
		this.foxContainer.classList.add('state-dead')
		this._foxState = 'dead'
		// 停止尾巴动画
		this.startTailAnimation('dead')
	}

	/**
	* 重置玩家状态（新一关）
	*/
	reset() {
		if (!this.foxContainer) return
		console.log('[RENDER]', '狐狸动画重置')
		this.foxContainer.className = 'fox-container state-idle'
		this._foxState = 'idle'
		this._foxLastY = 0
		this._foxVelocity = 0
		this._foxOnGround = true
		// 重置尾巴动画
		this.startTailAnimation('idle')
	}
}

export default FoxAnimator
