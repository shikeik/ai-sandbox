// ========== DOM渲染器 ==========

import type { WorldState, AnimationEvent, BrainDecision, Position, SpikeState } from "../types/index.js"
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
	private spikeElements: Map<string, HTMLElement> = new Map()

	private config: RendererConfig
	private animating: boolean = false
	private currentGridHeight: number = 5
	private currentGridWidth: number = 10

	// 相机系统
	private cameraX: number = 0
	private cameraY: number = 0
	private worldWidth: number = 0
	private worldHeight: number = 0
	private isCinematicMode: boolean = false  // 演出镜头模式

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
				spikes: data.spikes || [],
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
		const { grid, hero, enemies, triggers, spikes } = state
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
		this.currentGridWidth = width
		this.currentGridHeight = height

		// 计算初始相机位置
		this.updateCamera(hero.x, hero.y, height)

		// 创建视口结构
		this.worldContainer.innerHTML = `
			<div class="world-viewport" style="
				width: 100%;
				height: 100%;
				overflow: hidden;
				position: relative;
				background: #0a0a14;
				border-radius: 12px;
				border: 1px solid #2a2a3e;
			">
				<!-- 位置显示（中上部） -->
				<div class="position-hud" style="
					position: absolute;
					top: 6px;
					left: 50%;
					transform: translateX(-50%);
					background: rgba(0, 0, 0, 0.7);
					backdrop-filter: blur(4px);
					padding: 3px 10px;
					border-radius: 12px;
					border: 1px solid rgba(255, 255, 255, 0.1);
					font-size: 10px;
					font-weight: 500;
					color: #fff;
					z-index: 100;
					text-shadow: 0 1px 2px rgba(0,0,0,0.5);
				">
					(${hero.x}, ${hero.y})
				</div>
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
		this.renderObjects(objectsLayer, hero, enemies, spikes, height)
	}

	/**
	 * 增量更新世界对象（避免相机跳变）
	 */
	private updateWorldObjects(state: WorldState): void {
		const { grid, hero, enemies, triggers, spikes } = state
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

		// 更新尖刺位置（跳过正在下落的尖刺，让CSS动画控制位置）
		spikes.forEach((spike, idx) => {
			const spikeEl = this.spikeElements.get(`spike-${idx}`)
			if (spikeEl && !spike.falling) {
				const spikeDisplayY = height - 1 - spike.currentY
				const targetTop = spikeDisplayY * (this.config.cellSize + this.config.gap)
				spikeEl.style.top = `${targetTop}px`
			}
		})

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

		// 重置所有终点旗子的样式（清除可能残留的发光效果）
		const goalCells = this.worldContainer.querySelectorAll(".cell.goal")
		goalCells.forEach((cell) => {
			const el = cell as HTMLElement
			el.style.transform = ""
			el.style.filter = ""
			el.style.transition = ""
		})

		// 平滑移动相机到新位置（使用 transition）
		this.smoothCameraTo(hero.x, Math.max(0, hero.y))
	}

	/**
	 * 更新相机位置 - 实时跟随玩家，不限制边界
	 */
	private updateCamera(heroX: number, heroY: number, height: number): void {
		const heroPixelX = heroX * (this.config.cellSize + this.config.gap)
		const heroPixelY = (height - 1 - heroY) * (this.config.cellSize + this.config.gap)

		// 获取实际视口尺寸
		const viewportWidth = this.viewportElement?.clientWidth || this.config.viewportWidth
		const viewportHeight = this.viewportElement?.clientHeight || this.config.viewportHeight

		// 目标相机位置（让英雄在中央），不限制边界
		this.cameraX = heroPixelX - viewportWidth / 2 + this.config.cellSize / 2
		this.cameraY = heroPixelY - viewportHeight / 2 + this.config.cellSize / 2
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
		// 演出镜头模式下不跟随玩家
		if (this.isCinematicMode) return

		const height = this.getGridHeight()
		// 确保 viewportElement 已设置
		if (!this.viewportElement) {
			this.viewportElement = this.worldContainer.querySelector(".world-viewport") as HTMLElement
		}
		this.updateCamera(heroX, heroY, height)
		this.applyCamera()
	}

	/**
	 * 演出镜头：移动到指定位置
	 * @param targetX 目标X坐标（像素）
	 * @param targetY 目标Y坐标（像素）
	 * @param duration 动画时长（毫秒）
	 * @returns Promise，动画完成后 resolve
	 */
	async cinematicMoveTo(targetX: number, targetY: number, duration: number = 800): Promise<void> {
		this.isCinematicMode = true

		const viewportWidth = this.viewportElement?.clientWidth || this.config.viewportWidth
		const viewportHeight = this.viewportElement?.clientHeight || this.config.viewportHeight

		// 目标相机位置（让目标点在视口中央）
		const targetCameraX = targetX - viewportWidth / 2 + this.config.cellSize / 2
		const targetCameraY = targetY - viewportHeight / 2 + this.config.cellSize / 2

		const startCameraX = this.cameraX
		const startCameraY = this.cameraY

		// 使用 CSS transition 实现平滑移动
		if (this.worldContentElement) {
			this.worldContentElement.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
		}

		this.cameraX = targetCameraX
		this.cameraY = targetCameraY
		this.applyCamera()

		// 等待动画完成
		await new Promise(resolve => setTimeout(resolve, duration))
	}

	/**
	 * 演出镜头：缓动回当前相机位置（结束演出模式）
	 * @param duration 动画时长（毫秒）
	 * @returns Promise，动画完成后 resolve
	 */
	async endCinematic(duration: number = 600): Promise<void> {
		// 结束演出模式，相机将自动跟随玩家
		this.isCinematicMode = false
		if (this.worldContentElement) {
			this.worldContentElement.style.transition = `transform ${duration}ms ease-out`
		}
		// 等待过渡完成
		await new Promise(resolve => setTimeout(resolve, duration))
	}

	/**
	 * 获取尖刺当前旋转角度
	 */
	private getSpikeRotation(spikeEl: HTMLElement): number {
		const transform = spikeEl.style.transform
		const match = transform.match(/rotate\(([-\d.]+)deg\)/)
		return match ? parseFloat(match[1]) : 0
	}

	/**
	 * 演出镜头：实时跟随尖刺下落（读取计算样式获取实时位置）
	 * @param spikeEl 尖刺元素
	 * @param duration 跟随时长（毫秒）
	 * @returns Promise，跟随完成后 resolve
	 */
	async cinematicFollowSpike(spikeEl: HTMLElement, duration: number): Promise<void> {
		const startTime = performance.now()
		const viewportWidth = this.viewportElement?.clientWidth || this.config.viewportWidth
		const viewportHeight = this.viewportElement?.clientHeight || this.config.viewportHeight

		// 使用 requestAnimationFrame 实时更新相机
		return new Promise((resolve) => {
			const frame = () => {
				const elapsed = performance.now() - startTime

				// 使用 getComputedStyle 获取计算后的实时位置（包含 CSS transition）
				const computedStyle = window.getComputedStyle(spikeEl)
				const spikePixelX = parseFloat(computedStyle.left) + this.config.cellSize / 2
				const spikePixelY = parseFloat(computedStyle.top) + this.config.cellSize / 2

				// 相机目标位置（让尖刺在视口中央）
				this.cameraX = spikePixelX - viewportWidth / 2
				this.cameraY = spikePixelY - viewportHeight / 2

				// 直接应用相机（不使用 transition，实现实时跟随）
				if (this.worldContentElement) {
					this.worldContentElement.style.transition = "none"
					this.worldContentElement.style.transform = 
						`translate(${-this.cameraX}px, ${-this.cameraY}px)`
				}

				if (elapsed < duration) {
					requestAnimationFrame(frame)
				} else {
					resolve()
				}
			}
			requestAnimationFrame(frame)
		})
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
		spikes: SpikeState[],
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

		// 3. 多个尖刺
		this.spikeElements.clear()
		spikes.forEach((spike, idx) => {
			const spikeDisplayY = height - 1 - spike.currentY
			const key = `spike-${idx}`
			const el = this.createGameObject(key, "🔻", spike.x, spikeDisplayY, 40)
			this.spikeElements.set(key, el)
			container.appendChild(el)
		})
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
			font-size: 18px;
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

			// 过滤掉已被演出模式处理的动画
			const filteredGroup = group.filter(a => !a._cinematicHandled && !a._cinematicPlayed)

			// 检查是否有演出镜头动画（按钮触发）
			const cinematicAnim = filteredGroup.find(a => 
				a.type === "BUTTON_PRESS" && a.payload?.cinematic
			)

			if (cinematicAnim) {
				// 新演出模式：缓动到尖刺 -> 实时跟随下落 -> 缓动回玩家
				const { spikeIdx, spikeStartY, spikeTargetY, cinematicDuration, followDuration, waitDuration } = cinematicAnim.payload
				const height = this.getGridHeight()
				const cellSize = this.config.cellSize + this.config.gap

				// 获取尖刺元素和位置
				const spikeEl = this.spikeElements.get(`spike-${spikeIdx}`)
				const spikeX = spikeEl ? parseFloat(spikeEl.style.left || "0") / cellSize : 0

				// 计算尖刺像素位置（X固定，Y变化）
				const spikePixelX = spikeX * cellSize
				const spikeStartPixelY = (height - 1 - spikeStartY) * cellSize

				// 获取所有尖刺动画（区分两个阶段）
				const allSpikeAnims = animations.filter(a => 
					a.type === "SPIKE_FALL" && a.target === `spike-${spikeIdx}`
				)
				
				// 第一阶段：目标 y >= 0（敌人位置），第二阶段：目标 y < 0（虚空）
				const spikeAnim1 = allSpikeAnims.find(a => (a.to?.y ?? -1) >= 0)
				const spikeAnim2 = allSpikeAnims.find(a => (a.to?.y ?? 0) < 0)

				// 获取敌人死亡动画
				const enemyDieAnim = animations.find(a => a.type === "ENEMY_DIE")

				// 标记这些动画为已处理（跳过自动分组播放）
				if (spikeAnim1) spikeAnim1._cinematicHandled = true
				if (spikeAnim2) spikeAnim2._cinematicHandled = true
				if (enemyDieAnim) enemyDieAnim._cinematicHandled = true

				// 播放按钮动画
				await Promise.all(filteredGroup.map(anim => this.playSingleAnimation(anim)))

				// 1. 缓动到尖刺起始位置
				await this.cinematicMoveTo(spikePixelX, spikeStartPixelY, cinematicDuration)

				// 2. 开始第一阶段尖刺下落动画（落到敌人位置）
				if (spikeAnim1) {
					this.playSingleAnimation(spikeAnim1)
				}

				// 3. 实时跟随尖刺下落（600ms）
				if (spikeEl) {
					await this.cinematicFollowSpike(spikeEl, followDuration)
				} else {
					await new Promise(resolve => setTimeout(resolve, followDuration))
				}

				// 4. 停顿期间（300ms）：尖刺停在恶魔位置，播放敌人死亡动画
				
				// 强制固定尖刺在第一阶段目标位置（只改top，保留transform旋转）
				if (spikeEl && spikeAnim1?.to) {
					const height = this.getGridHeight()
					const targetDisplayY = height - 1 - spikeAnim1.to.y
					const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)
					spikeEl.style.transition = "top 0s"  // 只冻结top，保留transform
					spikeEl.style.top = `${targetTop}px`
				}
				
				if (enemyDieAnim) {
					this.playSingleAnimation(enemyDieAnim)
				}
				
				// 停顿等待
				await new Promise(resolve => setTimeout(resolve, waitDuration))
				
				// 停顿结束后，开始第二阶段尖刺下落
				if (spikeAnim2) {
					this.playSingleAnimation(spikeAnim2)
				}
				
				// 继续跟随尖刺第二阶段下落到虚空
				if (spikeEl && spikeAnim2) {
					await this.cinematicFollowSpike(spikeEl, spikeAnim2.duration)
				}

				// 5. 结束演出模式，缓动回玩家位置
				await this.endCinematic(600)

				// 更新最后结束时间
				lastGroupEndTime = groupDelay + cinematicDuration + followDuration + waitDuration + 600
			} else {
				// 普通模式：直接执行动画（跳过已被演出模式处理的）
				await Promise.all(filteredGroup.map(anim => this.playSingleAnimation(anim)))

				// 更新最后结束时间
				const groupMaxDuration = Math.max(...filteredGroup.map(a => a.duration))
				lastGroupEndTime = groupDelay + groupMaxDuration
			}
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
			case "GOAL_REACHED":
				this.animateGoalReached(anim)
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

			// 相机跟随：基于当前显示位置计算逻辑坐标，不限制范围
			const currentLogicX = currentLeft / (this.config.cellSize + this.config.gap)
			const currentLogicY = height - 1 - currentTop / (this.config.cellSize + this.config.gap)
			this.smoothCameraTo(currentLogicX, currentLogicY)

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
		const spikeEl = this.spikeElements.get(anim.target)
		if (!spikeEl || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y

		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		// 计算旋转：累积旋转角度
		const currentRotation = this.getSpikeRotation(spikeEl)
		const targetRotation = currentRotation + 360

		spikeEl.style.transition = `all ${anim.duration}ms cubic-bezier(0.4, 0, 1, 1)`
		spikeEl.style.top = `${targetTop}px`
		spikeEl.style.transform = `rotate(${targetRotation}deg)`

		// 只在落到地面/敌人位置时触发粒子效果（y >= 0 且不是落入虚空）
		// 第二阶段落到虚空（y = -1）不触发粒子
		if (anim.to && anim.to.y >= 0) {
			setTimeout(() => {
				// 使用动画中的 x 坐标
				const spikeX = anim.to!.x
				this.createImpactEffect(spikeX, targetDisplayY)
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
	 * 终点到达动画 - 旗子欢呼效果
	 */
	private animateGoalReached(anim: AnimationEvent): void {
		const height = this.getGridHeight()
		const displayY = height - 1 - anim.from.y
		const selector = `.cell[data-x="${anim.from.x}"][data-y="${displayY}"]`
		const goalCell = this.worldContainer.querySelector(selector) as HTMLElement

		if (goalCell) {
			// 旗子弹跳缩放+发光效果
			goalCell.style.transition = `all ${anim.duration}ms ease-out`
			goalCell.style.transform = "scale(1.3)"
			goalCell.style.filter = "drop-shadow(0 0 20px #f1c40f) brightness(1.3)"

			// 创建庆祝粒子效果
			this.createConfettiEffect(anim.from.x, displayY)

			// 动画结束后完全恢复正常（不保留发光）
			setTimeout(() => {
				goalCell.style.transition = "all 300ms ease-out"
				goalCell.style.transform = "scale(1)"
				goalCell.style.filter = ""  // 清除发光效果
			}, anim.duration)
		}
	}

	/**
	 * 创建庆祝彩纸效果
	 */
	private createConfettiEffect(logicX: number, displayY: number): void {
		const effectsLayer = this.worldContainer.querySelector(".layer-effects") as HTMLElement
		if (!effectsLayer) return

		const left = logicX * (this.config.cellSize + this.config.gap) + this.config.cellSize / 2
		const top = displayY * (this.config.cellSize + this.config.gap) + this.config.cellSize / 2

		// 彩纸颜色
		const colors = ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"]

		for (let i = 0; i < 12; i++) {
			const particle = document.createElement("div")
			particle.className = "confetti-particle"
			particle.style.cssText = `
				position: absolute;
				left: ${left}px;
				top: ${top}px;
				width: 8px;
				height: 8px;
				background: ${colors[i % colors.length]};
				border-radius: 50%;
				z-index: 100;
			`
			effectsLayer.appendChild(particle)

			const angle = (i / 12) * Math.PI * 2
			const distance = 40 + Math.random() * 30
			const duration = 600 + Math.random() * 200

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
		return this.currentGridHeight
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
