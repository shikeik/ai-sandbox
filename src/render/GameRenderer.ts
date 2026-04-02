/**
 * 游戏渲染器
 * 负责将游戏状态渲染到 DOM，处理补间动画
 */

import { CONFIG, TERRAIN, PlayerState, CameraState, TerrainSegment } from '@game/JumpGame.js'
import { FoxAnimator } from './FoxAnimator.js'

export interface TweenOptions {
	fromX: number
	fromY: number
	toX: number
	toY: number
	duration: number
	isJump: boolean
	onUpdate?: (x: number, y: number) => void
	onComplete?: () => void
}

export interface Position {
	x: number
	y: number
}

/**
 * 补间动画类
 * 支持打断和连续补间
 */
class Tween {
	private fromX: number
	private fromY: number
	private toX: number
	private toY: number
	private duration: number
	private isJump: boolean
	private onUpdate?: (x: number, y: number) => void
	private onComplete?: () => void
	private startTime: number = 0
	private animationId: number | null = null
	private isRunning: boolean = false

	constructor({ fromX, fromY, toX, toY, duration, isJump, onUpdate, onComplete }: TweenOptions) {
		this.fromX = fromX
		this.fromY = fromY
		this.toX = toX
		this.toY = toY
		this.duration = duration
		this.isJump = isJump
		this.onUpdate = onUpdate
		this.onComplete = onComplete
	}
	
	start(): this {
		this.isRunning = true
		this.startTime = performance.now()
		this._tick()
		return this
	}
	
	stop(): this {
		this.isRunning = false
		if (this.animationId) {
			cancelAnimationFrame(this.animationId)
			this.animationId = null
		}
		return this
	}
	
	private _tick(): void {
		if (!this.isRunning) return
	
		const elapsed = performance.now() - this.startTime
		const progress = Math.min(elapsed / this.duration, 1)
	
		const t = progress < 0.5 
			? 2 * progress * progress 
			: -1 + (4 - 2 * progress) * progress
	
		const currentX = this.fromX + (this.toX - this.fromX) * t
		let currentY: number
	
		if (this.isJump) {
			const baseY = this.fromY + (this.toY - this.fromY) * progress
			const jumpHeight = Math.sin(progress * Math.PI) * CONFIG.toPx(CONFIG.JUMP_HEIGHT)
			currentY = baseY + jumpHeight
		} else {
			currentY = this.fromY + (this.toY - this.fromY) * t
		}
	
		if (this.onUpdate) {
			this.onUpdate(currentX, currentY)
		}
	
		if (progress < 1) {
			this.animationId = requestAnimationFrame(() => this._tick())
		} else {
			this.isRunning = false
			if (this.onComplete) {
				this.onComplete()
			}
		}
	}
}

interface GameLike {
	_updateCamera(x: number): void
	camera: CameraState
	notifyVisualComplete(): void
}

export class GameRenderer {
	private container: HTMLElement
	private worldEl: HTMLElement | null = null
	private playerEl: HTMLElement | null = null
	private currentTween: Tween | null = null
	private visual: Position = { x: 0, y: CONFIG.toPx(CONFIG.GROUND_HEIGHT) }
	private posDisplay: HTMLElement | null
	private genDisplay: HTMLElement | null
	private statusText: HTMLElement | null
	private game: GameLike | null = null
	private foxAnimator!: FoxAnimator

	constructor(containerId: string) {
		const el = document.getElementById(containerId)
		if (!el) {
			throw new Error(`GameRenderer: 找不到元素 #${containerId}`)
		}
		this.container = el
		this.posDisplay = document.getElementById('pos-display')
		this.genDisplay = document.getElementById('gen-display')
		this.statusText = document.getElementById('status-text')
	}
	
	setGame(game: GameLike): void {
		this.game = game
	}

	/**
	 * 初始化世界渲染
	 */
	initWorld(terrain: TerrainSegment[]): void {
		this.container.innerHTML = ''
	
		this.worldEl = document.createElement('div')
		this.worldEl.className = 'world-content'
	
		this._renderGridLines()
	
		terrain.forEach(t => {
			if (t.type === TERRAIN.GROUND) {
				this._createGround(t.start, t.end - t.start)
			} else {
				this._createPit(t.start)
			}
		})
	
		this._createGoal()
		this._createPlayer()
	
		this.container.appendChild(this.worldEl)
	
		this._createClouds()
	
		if (this.currentTween) {
			this.currentTween.stop()
			this.currentTween = null
		}
	}
	
	/**
	 * 创建云朵装饰
	 */
	private _createClouds(): void {
		const cloudPositions = [
			{ className: 'cloud cloud-1', delay: '0s' },
			{ className: 'cloud cloud-2', delay: '-8s' },
			{ className: 'cloud cloud-3', delay: '-15s' }
		]
	
		cloudPositions.forEach((cloud, index) => {
			const el = document.createElement('div')
			el.className = cloud.className
			el.style.left = `${-100 - index * 50}px`
			this.container.appendChild(el)
		})
	}
	
	/**
	 * 开始动作补间动画
	 */
	startActionTween(from: Position, to: Position, isJump: boolean, duration: number): void {
		if (this.currentTween) {
			this.currentTween.stop()
		}
	
		const startX = this.visual.x
		const startY = this.visual.y
	
		this.currentTween = new Tween({
			fromX: startX,
			fromY: startY,
			toX: to.x,
			toY: to.y,
			duration,
			isJump,
			onUpdate: (x, y) => {
				this.visual.x = x
				this.visual.y = y
				this._updatePlayerVisual(x, y)
				this.foxAnimator.update({ x, y, action: 'moving' }, !isJump, isJump)
				if (this.game) {
					this.game._updateCamera(x)
					this.updateCamera(this.game.camera)
				}
			},
			onComplete: () => {
				this.currentTween = null
				console.log('[RENDER]', 'Tween完成: 狐狸恢复待机')
				this.foxAnimator.setState('idle')
				if (this.game) {
					this.game.notifyVisualComplete()
				}
			}
		}).start()
	}
	
	/**
	 * 更新相机位置
	 */
	updateCamera(camera: CameraState): void {
		if (this.worldEl) {
			this.worldEl.style.transform = `translateX(${-camera.x}px)`
		}
	}
	
	/**
	 * 同步视觉位置到逻辑位置
	 */
	syncVisualToLogical(player: PlayerState): void {
		this.visual.x = player.x
		this.visual.y = player.y
		this._updatePlayerVisual(player.x, player.y)
	
		if (this.posDisplay) {
			this.posDisplay.textContent = String(player.grid)
		}
	}
	
	/**
	 * 设置视觉位置
	 */
	setVisualPosition(x: number, y: number): void {
		this.visual.x = x
		this.visual.y = y
		this._updatePlayerVisual(x, y)
	}
	
	/**
	 * 更新世代显示
	 */
	updateGeneration(gen: number): void {
		if (this.genDisplay) {
			this.genDisplay.textContent = String(gen)
		}
	}
	
	/**
	 * 显示死亡动画
	 */
	showDeath(): void {
		this.foxAnimator.showDeath()
		this._showStatus('💀', 'dead')
	}
	
	/**
	 * 显示胜利动画
	 */
	showWin(): void {
		this._showStatus('🏆', 'win')
	}
	
	/**
	 * 重置玩家状态
	 */
	resetPlayer(): void {
		this.foxAnimator.reset()
		this._hideStatus()
	
		if (this.currentTween) {
			this.currentTween.stop()
			this.currentTween = null
		}
	}

	// ========== 私有方法 ==========
	
	private _updatePlayerVisual(x: number, y: number): void {
		if (this.playerEl) {
			this.playerEl.style.left = `${x}px`
			this.playerEl.style.bottom = `${y}px`
		}
	}
	
	private _renderGridLines(): void {
		if (!this.worldEl) return
		const gridOverlay = document.createElement('div')
		gridOverlay.className = 'world-grid'
	
		for (let i = 0; i <= CONFIG.WORLD_LENGTH; i++) {
			const x = CONFIG.toPx(i)
		
			const line = document.createElement('div')
			line.className = 'grid-vline'
			line.style.left = `${x}px`
			gridOverlay.appendChild(line)
		
			if (i % 5 === 0) {
				const label = document.createElement('div')
				label.className = 'grid-label'
				label.style.left = `${x}px`
				label.style.bottom = `${CONFIG.toPx(CONFIG.GROUND_HEIGHT + 1)}px`
				label.textContent = String(i)
				gridOverlay.appendChild(label)
			}
		}
	
		this.worldEl.appendChild(gridOverlay)
	}
	
	private _createGround(startX: number, width: number): void {
		if (!this.worldEl) return
		const el = document.createElement('div')
		el.className = 'ground'
		el.style.left = `${startX}px`
		el.style.width = `${width}px`
		el.style.height = `${CONFIG.toPx(CONFIG.GROUND_HEIGHT)}px`
		this.worldEl.appendChild(el)
	}
	
	private _createPit(startX: number): void {
		if (!this.worldEl) return
		const el = document.createElement('div')
		el.className = 'pit-zone'
		el.style.left = `${startX}px`
		el.style.width = `${CONFIG.GRID_SIZE}px`
		el.style.height = `${CONFIG.toPx(0.2)}px`
		this.worldEl.appendChild(el)
	}
	
	private _createGoal(): void {
		if (!this.worldEl) return
		const el = document.createElement('div')
		el.className = 'goal'
		el.style.left = `${CONFIG.toPx(CONFIG.WORLD_LENGTH - 1)}px`
		el.style.bottom = `${CONFIG.toPx(CONFIG.GROUND_HEIGHT)}px`
		const goalWidth = CONFIG.toPx(CONFIG.GOAL_SIZE)
		const goalHeight = CONFIG.toPx(CONFIG.GOAL_SIZE * 1.4)
		el.style.width = `${goalWidth}px`
		el.style.height = `${goalHeight}px`
	
		const poleWidth = Math.max(3, Math.floor(goalWidth * 0.08))
		const poleHeight = goalHeight
		const flagWidth = Math.floor(goalWidth * 0.7)
		const flagHeight = Math.floor(goalHeight * 0.35)
	
		el.innerHTML = `
			<div class="goal-pole" style="
				position: absolute;
				left: ${Math.floor(goalWidth * 0.15)}px;
				bottom: 0;
				width: ${poleWidth}px;
				height: ${poleHeight}px;
				background: linear-gradient(90deg, #888 0%, #eee 50%, #888 100%);
				border-radius: 2px;
			"></div>
			<div class="goal-flag" style="
				position: absolute;
				left: ${Math.floor(goalWidth * 0.15) + poleWidth}px;
				top: ${Math.floor(goalHeight * 0.08)}px;
				width: ${flagWidth}px;
				height: ${flagHeight}px;
				background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
				clip-path: polygon(0 0, 100% 50%, 0 100%);
				animation: wave 2s ease-in-out infinite;
				filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
			"></div>
		`
		this.worldEl.appendChild(el)
	}
	
	private _createPlayer(): void {
		if (!this.worldEl) return
		this.playerEl = document.createElement('div')
		this.playerEl.id = 'player'
		const playerSize = CONFIG.toPx(CONFIG.PLAYER_SIZE)
		this.playerEl.style.width = `${playerSize}px`
		this.playerEl.style.height = `${playerSize}px`
	
		this.playerEl.innerHTML = `
			<div class="fox-container state-idle" data-state="idle">
				<div class="fox-tail"></div>
				<div class="fox-leg-back-far"></div>
				<div class="fox-body"></div>
				<div class="fox-leg-back-near"></div>
				<div class="fox-leg-front-far"></div>
				<div class="fox-head">
					<div class="fox-ear-far"></div>
					<div class="fox-ear-near"></div>
					<div class="fox-eye"></div>
					<div class="fox-nose"></div>
				</div>
				<div class="fox-leg-front-near"></div>
			</div>
		`
		this.worldEl.appendChild(this.playerEl)
	
		this.foxAnimator = new FoxAnimator(this.playerEl)
		this.foxAnimator.init()
		console.log('[RENDER]', 'GameRenderer: 世界与玩家初始化完成')
	}
	
	private _showStatus(emoji: string, type: string): void {
		if (this.statusText) {
			this.statusText.textContent = emoji
			this.statusText.className = `show ${type}`
		}
	}
	
	private _hideStatus(): void {
		if (this.statusText) {
			this.statusText.className = ''
		}
	}
}

export default GameRenderer
