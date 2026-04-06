// ========== DOM渲染器 ==========

import type { WorldState, AnimationEvent, BrainDecision, Position } from "../types/index.js"
import { Element } from "../types/index.js"
import { RENDER_CONFIG, ANIMATION_DURATION } from "../config.js"

/** 渲染器配置 */
interface RendererConfig {
	cellSize: number
	gap: number
	viewportWidth: number
	viewportHeight: number
}

/**
 * DOM 渲染器 - 负责将世界状态渲染为 DOM
 */
export class DOMRenderer {
	private worldContainer: HTMLElement
	private brainContainer: HTMLElement
	private viewportElement: HTMLElement | null = null
	private worldContentElement: HTMLElement | null = null
	private heroElement: HTMLElement | null = null
	private enemyElements: Map<string, HTMLElement> = new Map()
	private spikeElement: HTMLElement | null = null

	private config: RendererConfig
	private animating: boolean = false

	// 相机系统
	private cameraX: number = 0
	private cameraY: number = 0
	private worldWidth: number = 0
	private worldHeight: number = 0

	constructor(worldId: string, brainId: string) {
		this.worldContainer = document.getElementById(worldId)!
		this.brainContainer = document.getElementById(brainId)!
		this.config = this.createConfig()
		window.addEventListener("resize", () => {
			this.config = this.createConfig()
		})
	}

	/**
	 * 创建渲染配置
	 */
	private createConfig(): RendererConfig {
		const containerWidth = this.worldContainer.parentElement?.clientWidth || window.innerWidth
		return {
			...RENDER_CONFIG,
			viewportWidth: Math.max(
				RENDER_CONFIG.minViewportWidth,
				Math.min(containerWidth - 32, RENDER_CONFIG.viewportWidth)
			),
		}
	}

	/**
	 * 从 API 数据渲染世界
	 */
	renderWorldFromAPI(data: any): void {
		try {
			const state: WorldState = {
				grid: data.gridRaw || data.grid,
				hero: data.hero,
				enemies: data.enemies || [],
				triggers: data.triggers || [],
				spikeY: data.spikeY,
				spikeFalling: data.spikeFalling,
			}

			if (!state.grid || !state.hero) {
				return
			}

			this.renderWorld(state)
		} catch {
			// 静默处理渲染错误
		}
	}

	/**
	 * 渲染世界
	 */
	private renderWorld(state: WorldState): void {
		const { grid, hero, enemies, triggers, spikeY } = state
		const height = grid.length
		const width = grid[0].length

		// 检查是否已存在世界（增量更新模式）
		const existingWorld = this.worldContainer.querySelector(".world-viewport")
		if (existingWorld) {
			// 增量更新：只更新动态对象位置，避免相机跳变
			this.updateWorldObjects(state)
			return
		}

		// 全新渲染模式
		this.worldContainer.innerHTML = ""
		this.enemyElements.clear()

		// 计算世界尺寸
		this.worldWidth = width * (this.config.cellSize + this.config.gap) - this.config.gap
		this.worldHeight = height * (this.config.cellSize + this.config.gap) - this.config.gap

		// 计算初始相机位置
		this.updateCamera(hero.x, hero.y, height)

		// 创建视口结构
		this.worldContainer.innerHTML = `
			<div class="world-viewport" style="
				width: ${this.config.viewportWidth}px;
				height: ${this.config.viewportHeight}px;
				overflow: hidden;
				position: relative;
				margin: 0 auto;
				background: #0a0a14;
				border-radius: 12px;
				border: 2px solid #2a2a3e;
			">
				<div class="world-content" style="
					position: absolute;
					width: ${this.worldWidth}px;
					height: ${this.worldHeight}px;
					transform: translate(${-this.cameraX}px, ${-this.cameraY}px);
					transition: transform 0.3s ease-out;
				">
					<div class="layer-grid"></div>
					<div class="layer-objects"></div>
					<div class="layer-effects"></div>
				</div>
			</div>
		`

		this.viewportElement = this.worldContainer.querySelector(".world-viewport") as HTMLElement
		this.worldContentElement = this.worldContainer.querySelector(".world-content") as HTMLElement

		const gridLayer = this.worldContainer.querySelector(".layer-grid") as HTMLElement
		const objectsLayer = this.worldContainer.querySelector(".layer-objects") as HTMLElement

		// 渲染静态格子背景
		this.renderGrid(gridLayer, grid, triggers, height, width)

		// 渲染动态对象
		this.renderObjects(objectsLayer, hero, enemies, spikeY, height)
	}

	/**
	 * 增量更新世界对象（避免相机跳变）
	 */
	private updateWorldObjects(state: WorldState): void {
		const { grid, hero, enemies, triggers, spikeY } = state
		const height = grid.length

		// 更新英雄位置
		if (this.heroElement) {
			const heroDisplayY = height - 1 - hero.y
			const targetLeft = hero.x * (this.config.cellSize + this.config.gap)
			const targetTop = heroDisplayY * (this.config.cellSize + this.config.gap)
			this.heroElement.style.left = `${targetLeft}px`
			this.heroElement.style.top = `${targetTop}px`
		}

		// 更新敌人（简单的实现：清空重新渲染敌人层）
		const objectsLayer = this.worldContainer.querySelector(".layer-objects") as HTMLElement
		if (objectsLayer) {
			// 保留英雄和尖刺，移除旧敌人
			this.enemyElements.forEach((el) => el.remove())
			this.enemyElements.clear()

			// 重新渲染敌人
			enemies.forEach((enemy) => {
				const enemyDisplayY = height - 1 - enemy.y
				const key = `enemy-${enemy.x}-${enemy.y}`
				const el = this.createGameObject(key, "👿", enemy.x, enemyDisplayY, 20)
				this.enemyElements.set(key, el)
				objectsLayer.appendChild(el)
			})
		}

		// 更新尖刺位置
		if (this.spikeElement && spikeY !== undefined) {
			const spikeDisplayY = height - 1 - spikeY
			const targetTop = spikeDisplayY * (this.config.cellSize + this.config.gap)
			this.spikeElement.style.top = `${targetTop}px`
		}

		// 更新按钮状态
		const buttonBase = this.worldContainer.querySelector(".cell.button-base") as HTMLElement
		if (buttonBase) {
			const buttonIcon = buttonBase.querySelector(".button-icon")
			if (triggers[0]) {
				// 已触发：移除图标
				if (buttonIcon) {
					buttonIcon.remove()
				}
			} else {
				// 未触发：添加图标（如果不存在）
				if (!buttonIcon) {
					buttonBase.innerHTML = "<div class=\"button-icon\">🔘</div>"
				}
			}
		}

		// 平滑移动相机到新位置（使用 transition）
		this.smoothCameraTo(hero.x, Math.max(0, hero.y))
	}

	/**
	 * 更新相机位置
	 */
	private updateCamera(heroX: number, heroY: number, height: number): void {
		const heroPixelX = heroX * (this.config.cellSize + this.config.gap)
		const heroPixelY = (height - 1 - heroY) * (this.config.cellSize + this.config.gap)

		// 目标相机位置（让英雄在中央）
		let targetCameraX = heroPixelX - this.config.viewportWidth / 2 + this.config.cellSize / 2
		let targetCameraY = heroPixelY - this.config.viewportHeight / 2 + this.config.cellSize / 2

		// 边界限制
		const maxCameraX = Math.max(0, this.worldWidth - this.config.viewportWidth)
		const maxCameraY = Math.max(0, this.worldHeight - this.config.viewportHeight)
		targetCameraX = Math.max(0, Math.min(targetCameraX, maxCameraX))
		targetCameraY = Math.max(0, Math.min(targetCameraY, maxCameraY))

		this.cameraX = targetCameraX
		this.cameraY = targetCameraY
	}

	/**
	 * 应用相机变换
	 */
	private applyCamera(): void {
		if (this.worldContentElement) {
			this.worldContentElement.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`
		}
	}

	/**
	 * 平滑移动相机
	 */
	private smoothCameraTo(heroX: number, heroY: number): void {
		const height = this.getGridHeight()
		this.updateCamera(heroX, heroY, height)
		this.applyCamera()
	}

	/**
	 * 渲染静态格子背景
	 */
	private renderGrid(
		container: HTMLElement,
		grid: number[][],
		triggers: boolean[],
		height: number,
		width: number
	): void {
		container.style.cssText = `
			width: ${this.worldWidth}px;
			height: ${this.worldHeight}px;
			position: relative;
		`

		for (let displayY = 0; displayY < height; displayY++) {
			const logicY = height - 1 - displayY
			for (let logicX = 0; logicX < width; logicX++) {
				const cell = grid[logicY][logicX]
				const isTriggeredButton = cell === Element.BUTTON && triggers[0]
				const cellEl = this.createCell(cell, logicX, displayY, isTriggeredButton)
				container.appendChild(cellEl)
			}
		}
	}

	/**
	 * 创建单个格子
	 */
	private createCell(
		cellType: number,
		logicX: number,
		displayY: number,
		isTriggeredButton: boolean = false
	): HTMLElement {
		const el = document.createElement("div")
		el.className = "cell"
		el.dataset.x = String(logicX)
		el.dataset.y = String(displayY)

		const left = logicX * (this.config.cellSize + this.config.gap)
		const top = displayY * (this.config.cellSize + this.config.gap)
		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.config.cellSize}px;
			height: ${this.config.cellSize}px;
		`

		switch (cellType) {
			case Element.AIR:
				el.classList.add("air")
				break
			case Element.PLATFORM:
				el.classList.add("platform")
				break
			case Element.GOAL:
				el.classList.add("goal")
				el.innerHTML = "🏁"
				break
			case Element.SPIKE:
				el.classList.add("air")
				break
			case Element.BUTTON:
				el.classList.add("button-base")
				if (!isTriggeredButton) {
					el.innerHTML = "<div class=\"button-icon\">🔘</div>"
				}
				break
		}

		return el
	}

	/**
	 * 渲染动态对象
	 */
	private renderObjects(
		container: HTMLElement,
		hero: Position,
		enemies: Position[],
		spikeY: number | undefined,
		height: number
	): void {
		container.style.cssText = `
			width: ${this.worldWidth}px;
			height: ${this.worldHeight}px;
			position: absolute;
			top: 0;
			left: 0;
		`

		// 1. 英雄
		const heroDisplayY = height - 1 - hero.y
		this.heroElement = this.createGameObject("hero", "🦊", hero.x, heroDisplayY, 30)
		container.appendChild(this.heroElement)

		// 2. 敌人
		enemies.forEach((enemy) => {
			const enemyDisplayY = height - 1 - enemy.y
			const key = `enemy-${enemy.x}-${enemy.y}`
			const el = this.createGameObject(key, "👿", enemy.x, enemyDisplayY, 20)
			this.enemyElements.set(key, el)
			container.appendChild(el)
		})

		// 3. 尖刺
		const initialSpikeY = spikeY !== undefined ? spikeY : 4
		const spikeDisplayY = height - 1 - initialSpikeY
		this.spikeElement = this.createGameObject("spike", "🔺", 4, spikeDisplayY, 40)
		container.appendChild(this.spikeElement)
	}

	/**
	 * 创建游戏对象
	 */
	private createGameObject(
		id: string,
		content: string,
		logicX: number,
		displayY: number,
		zIndex: number
	): HTMLElement {
		const el = document.createElement("div")
		el.className = `game-object ${id}`
		el.dataset.id = id
		el.innerHTML = content

		const left = logicX * (this.config.cellSize + this.config.gap)
		const top = displayY * (this.config.cellSize + this.config.gap)

		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.config.cellSize}px;
			height: ${this.config.cellSize}px;
			z-index: ${zIndex};
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 24px;
			transition: none;
		`

		return el
	}

	/**
	 * 播放动画序列
	 */
	async playAnimations(animations: AnimationEvent[]): Promise<void> {
		if (this.animating || !animations.length) return
		this.animating = true

		const groups = this.groupByDelay(animations)
		let lastGroupEndTime = 0

		// 找出玩家动画的最大结束时间（用于TEMP日志）
		const playerAnimations = animations.filter(a => 
			a.type === "HERO_MOVE" || a.type === "HERO_JUMP" || a.type === "HERO_FALL"
		)
		const playerMaxEndTime = playerAnimations.length > 0 
			? Math.max(...playerAnimations.map(a => (a.delay || 0) + a.duration))
			: 0

		// 找出按钮动画的开始时间（用于TEMP日志）
		const buttonAnim = animations.find(a => a.type === "BUTTON_PRESS")
		const buttonStartTime = buttonAnim ? (buttonAnim.delay || 0) : -1

		for (let i = 0; i < groups.length; i++) {
			const group = groups[i]
			const groupDelay = group[0].delay || 0

			// 等待到该组应该开始的时间
			const waitTime = groupDelay - lastGroupEndTime
			if (waitTime > 0) {
				await new Promise(resolve => setTimeout(resolve, waitTime))
			}

			// TEMP日志：玩家动画结束
			if (groupDelay === playerMaxEndTime && playerMaxEndTime > 0) {
				console.log(`[TEMP] 玩家动画结束 (时间: ${Date.now()})`)
			}

			// TEMP日志：按钮动画开始
			if (groupDelay === buttonStartTime && buttonStartTime > 0) {
				console.log(`[TEMP] 按钮动画开始 (时间: ${Date.now()})`)
			}

			// 执行该组所有动画
			await Promise.all(group.map(anim => this.playSingleAnimation(anim)))

			// 更新最后结束时间
			const groupMaxDuration = Math.max(...group.map(a => a.duration))
			lastGroupEndTime = groupDelay + groupMaxDuration
		}

		this.animating = false
	}

	/**
	 * 按 delay 分组
	 */
	private groupByDelay(animations: AnimationEvent[]): AnimationEvent[][] {
		const groups: Map<number, AnimationEvent[]> = new Map()

		animations.forEach(anim => {
			const delay = anim.delay || 0
			if (!groups.has(delay)) groups.set(delay, [])
			groups.get(delay)!.push(anim)
		})

		return Array.from(groups.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([_, anims]) => anims)
	}

	/**
	 * 播放单个动画（注意：delay 已由外层分组处理，这里不再重复等待）
	 */
	private playSingleAnimation(anim: AnimationEvent): Promise<void> {
		// 立即执行动画（CSS transition 会处理视觉变化）
		switch (anim.type) {
			case "HERO_MOVE":
				this.animateHeroMove(anim)
				break
			case "HERO_JUMP":
				this.animateHeroJump(anim)
				break
			case "HERO_FALL":
				this.animateHeroFall(anim)
				break
			case "SPIKE_FALL":
				this.animateSpikeFall(anim)
				break
			case "ENEMY_DIE":
				this.animateEnemyDie(anim)
				break
			case "BUTTON_PRESS":
				this.animateButtonPress(anim)
				break
		}
		// 等待动画实际持续时间
		return new Promise(resolve => setTimeout(resolve, anim.duration))
	}

	/**
	 * 英雄移动动画
	 */
	private animateHeroMove(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return

		const height = this.getGridHeight()
		const targetPos = anim.to
		let targetDisplayY: number
		if (targetPos.y < 0) {
			targetDisplayY = height + 2
		} else {
			targetDisplayY = height - 1 - targetPos.y
		}

		const targetLeft = targetPos.x * (this.config.cellSize + this.config.gap)
		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		// 设置 CSS transition
		if (anim.from.y !== targetPos.y) {
			this.heroElement.style.transition = `all ${anim.duration}ms ease-out`
			this.heroElement.style.left = `${targetLeft}px`
			this.heroElement.style.top = `${targetTop}px`
		} else {
			this.heroElement.style.transition = `left ${anim.duration}ms ease-out`
			this.heroElement.style.left = `${targetLeft}px`
		}

		// 相机跟随
		this.smoothCameraTo(targetPos.x, Math.max(0, targetPos.y))

		// 动画结束后确保精确位置
		setTimeout(() => {
			if (this.heroElement) {
				this.heroElement.style.transition = "none"
				this.heroElement.style.left = `${targetLeft}px`
				if (anim.from.y !== targetPos.y) {
					this.heroElement.style.top = `${targetTop}px`
				}
			}
		}, anim.duration)
	}

	/**
	 * 英雄跳跃动画 - 抛物线
	 */
	private animateHeroJump(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()

		// 保存目标位置到局部变量，避免闭包中的 undefined 检查问题
		const targetPos = anim.to
		let targetDisplayY: number
		if (targetPos.y < 0) {
			targetDisplayY = height + Math.abs(targetPos.y)
		} else {
			targetDisplayY = height - 1 - targetPos.y
		}

		const startLeft = parseFloat(this.heroElement.style.left) || 0
		const startTop = parseFloat(this.heroElement.style.top) || 0
		const targetLeft = targetPos.x * (this.config.cellSize + this.config.gap)
		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		const startTime = performance.now()
		const duration = anim.duration
		const jumpHeight = 40

		const animate = (now: number) => {
			const elapsed = now - startTime
			const progress = Math.min(elapsed / duration, 1)

			// 水平线性插值
			const currentLeft = startLeft + (targetLeft - startLeft) * progress

			// 抛物线垂直运动
			const parabola = 4 * progress * (1 - progress)
			const verticalOffset = parabola * jumpHeight
			const currentTop = startTop + (targetTop - startTop) * progress - verticalOffset

			this.heroElement!.style.left = `${currentLeft}px`
			this.heroElement!.style.top = `${currentTop}px`

			// 相机跟随：基于当前显示位置计算逻辑坐标
			const currentLogicX = currentLeft / (this.config.cellSize + this.config.gap)
			const currentLogicY = height - 1 - currentTop / (this.config.cellSize + this.config.gap)
			this.smoothCameraTo(currentLogicX, Math.max(0, currentLogicY))

			if (progress < 1) {
				requestAnimationFrame(animate)
			} else {
				// 动画结束：精确对齐到目标位置，避免浮点误差
				this.heroElement!.style.left = `${targetLeft}px`
				this.heroElement!.style.top = `${targetTop}px`
				// 最终相机位置精确对齐
				this.smoothCameraTo(targetPos.x, Math.max(0, targetPos.y))
			}
		}

		requestAnimationFrame(animate)
	}

	/**
	 * 英雄坠落动画
	 */
	private animateHeroFall(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()

		const targetPos = anim.to
		let targetDisplayY: number
		if (targetPos.y < 0) {
			targetDisplayY = height + 2
		} else {
			targetDisplayY = height - 1 - targetPos.y
		}

		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		// 使用 CSS transition 实现坠落动画
		this.heroElement.style.transition = `top ${anim.duration}ms cubic-bezier(0.5, 0, 1, 1)`
		this.heroElement.style.top = `${targetTop}px`

		// 相机跟随到目标位置
		this.smoothCameraTo(targetPos.x, Math.max(0, targetPos.y))

		// 动画结束后确保精确位置（transition 可能有精度误差）
		setTimeout(() => {
			if (this.heroElement) {
				this.heroElement.style.transition = "none"
				this.heroElement.style.top = `${targetTop}px`
				// 强制相机精确对齐
				this.updateCamera(targetPos.x, Math.max(0, targetPos.y), height)
				this.applyCamera()
			}
		}, anim.duration)
	}

	/**
	 * 尖刺坠落动画
	 */
	private animateSpikeFall(anim: AnimationEvent): void {
		if (!this.spikeElement || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y

		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		this.spikeElement.style.transition = `all ${anim.duration}ms cubic-bezier(0.4, 0, 1, 1)`
		this.spikeElement.style.top = `${targetTop}px`
		this.spikeElement.style.transform = "rotate(360deg)"

		if (anim.to.y <= 1) {
			setTimeout(() => {
				this.createImpactEffect(4, targetDisplayY)
			}, anim.duration)
		}
	}

	/**
	 * 敌人死亡动画
	 */
	private animateEnemyDie(anim: AnimationEvent): void {
		const key = anim.target
		const el = this.enemyElements.get(key)
		if (!el) return

		el.style.transition = `all ${anim.duration}ms ease-out`
		el.style.transform = "scale(1.5) rotate(180deg)"
		el.style.opacity = "0"

		setTimeout(() => {
			el.remove()
			this.enemyElements.delete(key)
		}, anim.duration)
	}

	/**
	 * 按钮按下动画
	 */
	private animateButtonPress(anim: AnimationEvent): void {
		const height = this.getGridHeight()
		const displayY = height - 1 - anim.from.y
		const selector = `.cell[data-x="${anim.from.x}"][data-y="${displayY}"] .button-icon`
		const buttonIcon = this.worldContainer.querySelector(selector) as HTMLElement

		if (buttonIcon) {
			// 第一阶段：按下缩小
			buttonIcon.style.transition = `all ${anim.duration}ms ease`
			buttonIcon.style.transform = "scale(0.8)"
			buttonIcon.style.filter = "brightness(0.7)"

			// 第二阶段：淡出消失（更平滑）
			setTimeout(() => {
				buttonIcon.style.transition = "opacity 300ms ease-out"
				buttonIcon.style.opacity = "0"
				// 完全消失后移除元素
				setTimeout(() => buttonIcon.remove(), 300)
			}, anim.duration)
		}

		this.createRippleEffect(anim.from.x, displayY)
	}

	/**
	 * 创建撞击效果
	 */
	private createImpactEffect(logicX: number, displayY: number): void {
		const effectsLayer = this.worldContainer.querySelector(".layer-effects") as HTMLElement
		if (!effectsLayer) return

		const left = logicX * (this.config.cellSize + this.config.gap) + this.config.cellSize / 2
		const top = displayY * (this.config.cellSize + this.config.gap) + this.config.cellSize / 2

		for (let i = 0; i < 6; i++) {
			const particle = document.createElement("div")
			particle.className = "particle"
			particle.style.cssText = `
				position: absolute;
				left: ${left}px;
				top: ${top}px;
				width: 6px;
				height: 6px;
				background: #e74c3c;
				border-radius: 50%;
				z-index: 50;
			`
			effectsLayer.appendChild(particle)

			const angle = (i / 6) * Math.PI * 2
			const distance = 30 + Math.random() * 20
			const duration = 400 + Math.random() * 200

			particle.animate([
				{ transform: "translate(0,0) scale(1)", opacity: 1 },
				{ transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`, opacity: 0 }
			], {
				duration,
				easing: "ease-out"
			}).onfinish = () => particle.remove()
		}
	}

	/**
	 * 创建涟漪效果
	 */
	private createRippleEffect(logicX: number, displayY: number): void {
		const effectsLayer = this.worldContainer.querySelector(".layer-effects") as HTMLElement
		if (!effectsLayer) return

		const left = logicX * (this.config.cellSize + this.config.gap) + this.config.cellSize / 2
		const top = displayY * (this.config.cellSize + this.config.gap) + this.config.cellSize / 2

		const ripple = document.createElement("div")
		ripple.className = "ripple"
		ripple.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: 0;
			height: 0;
			border: 3px solid #9b59b6;
			border-radius: 50%;
			z-index: 45;
			transform: translate(-50%, -50%);
		`
		effectsLayer.appendChild(ripple)

		ripple.animate([
			{ width: "0px", height: "0px", opacity: 1 },
			{ width: "60px", height: "60px", opacity: 0 }
		], {
			duration: 600,
			easing: "ease-out"
		}).onfinish = () => ripple.remove()
	}

	/**
	 * 获取地图高度
	 */
	private getGridHeight(): number {
		const grid = this.worldContainer.querySelector(".layer-grid")
		if (!grid) return 6
		const childCount = grid.children.length
		return childCount ? Math.ceil(childCount / 10) : 6
	}

	/**
	 * 渲染大脑思考
	 */
	renderImaginationFromAPI(data: any): void {
		if (!data.decision) return

		const decision = data.decision as BrainDecision

		const html = `
			<div class="brain-reasoning">
				<div class="reason-title">💭 决策理由</div>
				<div class="reason-text">${decision.reasoning || "AI思考中..."}</div>
			</div>
			<div class="brain-cards">
				<div class="cards-title">🎲 想象的${decision.imaginations?.length || 0}种可能</div>
				<div class="cards-grid">
					${(decision.imaginations || []).map((img) => `
						<div class="imagination-card ${img.action === decision.selectedAction ? "selected" : ""}">
							<div class="card-action">${this.getActionDisplayName(img.action)}</div>
							<div class="card-pos">预测位置: (${img.predictedState.hero.x}, ${img.predictedState.hero.y})</div>
							<div class="card-reward">奖励: ${img.predictedReward > 0 ? "+" : ""}${img.predictedReward}</div>
							${img.killedEnemy ? "<div class=\"card-bonus\">✨ 击杀敌人!</div>" : ""}
						</div>
					`).join("")}
				</div>
			</div>
		`

		this.brainContainer.innerHTML = html
	}

	/**
	 * 获取动作显示名称
	 */
	private getActionDisplayName(action: string): string {
		const names: Record<string, string> = {
			LEFT: "⬅️ 左移",
			RIGHT: "➡️ 右移",
			JUMP: "⬆️ 跳跃",
			WAIT: "⏸️ 等待",
		}
		return names[action] || action
	}

	/**
	 * 清空大脑面板
	 */
	clearBrainPanel(): void {
		this.brainContainer.innerHTML = `
			<div class="brain-placeholder">
				点击「单步」按钮<br>
				观察AI如何想象未来并决策
			</div>
		`
	}
}
