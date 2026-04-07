// ========== DOM渲染器 ==========

import type { WorldState, AnimationEvent, Position, SpikeState } from "../types/index.js"
import type { APIStateResponse } from "../types/api.js"
import { Element } from "../types/index.js"
import { RENDER_CONFIG, ANIMATION_DURATION, getColorByPosition } from "../config.js"

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
	private isCinematicMode: boolean = false

	constructor(worldId: string) {
		this.worldContainer = document.getElementById(worldId)!
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
	renderWorldFromAPI(data: APIStateResponse): void {
		try {
			const state: WorldState = {
				grid: data.gridRaw || [],
				hero: data.hero,
				enemies: data.enemies || [],
				triggers: data.triggers || [],
				spikes: data.spikes || [],
			}

			if (!state.grid.length || !state.hero) {
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
		this.spikeElements.clear()

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
		this.renderGrid(gridLayer, grid, triggers, spikes, height, width)

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
				objectsLayer.appendChild(el)
				this.enemyElements.set(key, el)
			})
		}

		// 更新尖刺位置（动画中可能已经移动）
		spikes.forEach((spike) => {
			const key = `spike-${spike.x}-${spike.initialY}`
			const spikeEl = this.spikeElements.get(key)
			if (spikeEl) {
				const spikeDisplayY = height - 1 - spike.currentY
				const targetTop = spikeDisplayY * (this.config.cellSize + this.config.gap)
				const targetLeft = spike.x * (this.config.cellSize + this.config.gap)
				spikeEl.style.top = `${targetTop}px`
				spikeEl.style.left = `${targetLeft}px`
			}
		})

		// 更新按钮状态（视觉变化）
		triggers.forEach((triggered, idx) => {
			if (triggered) {
				const buttonEl = this.worldContainer.querySelector(`.button-${idx}`)
				if (buttonEl) {
					buttonEl.classList.add("pressed")
				}
			}
		})

		// 更新相机位置
		this.updateCamera(hero.x, hero.y, height)
		if (this.worldContentElement && !this.isCinematicMode) {
			this.worldContentElement.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`
		}

		// 更新位置显示
		const hud = this.worldContainer.querySelector(".position-hud")
		if (hud) {
			hud.textContent = `(${hero.x}, ${hero.y})`
		}
	}

	/**
	 * 更新相机位置
	 */
	private updateCamera(heroX: number, heroY: number, gridHeight: number): void {
		// 英雄的像素位置
		const heroPixelX = heroX * (this.config.cellSize + this.config.gap)
		const heroDisplayY = gridHeight - 1 - heroY
		const heroPixelY = heroDisplayY * (this.config.cellSize + this.config.gap)

		// 视口中心
		const viewportCenterX = this.config.viewportWidth / 2
		const viewportCenterY = (gridHeight * (this.config.cellSize + this.config.gap)) / 2

		// 计算相机位置（让英雄保持在中心）
		const targetCameraX = heroPixelX - viewportCenterX + this.config.cellSize / 2
		const targetCameraY = heroPixelY - viewportCenterY + this.config.cellSize / 2

		// 边界限制
		const maxCameraX = Math.max(0, this.worldWidth - this.config.viewportWidth)
		const maxCameraY = Math.max(0, this.worldHeight - this.config.viewportHeight)

		this.cameraX = Math.max(0, Math.min(targetCameraX, maxCameraX))
		this.cameraY = Math.max(0, Math.min(targetCameraY, maxCameraY))
	}

	/**
	 * 渲染静态格子背景
	 */
	private renderGrid(
		container: HTMLElement,
		grid: number[][],
		triggers: boolean[],
		spikes: SpikeState[],
		height: number,
		width: number
	): void {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const cellType = grid[y][x]
				const displayY = height - 1 - y

				const cell = document.createElement("div")
				cell.className = "cell"
				cell.style.cssText = `
					position: absolute;
					left: ${x * (this.config.cellSize + this.config.gap)}px;
					top: ${displayY * (this.config.cellSize + this.config.gap)}px;
					width: ${this.config.cellSize}px;
					height: ${this.config.cellSize}px;
				`

				this.renderCellContent(cell, cellType, x, y, triggers, spikes)
				container.appendChild(cell)
			}
		}
	}

	/**
	 * 渲染单个格子的内容
	 */
	private renderCellContent(
		cell: HTMLElement,
		cellType: number,
		x: number,
		y: number,
		triggers: boolean[],
		spikes: SpikeState[]
	): void {
		switch (cellType) {
			case Element.AIR:
				cell.classList.add("air")
				break
			case Element.PLATFORM:
				cell.classList.add("platform")
				break
			case Element.BUTTON:
				// 找到对应的按钮索引
				const buttonIdx = triggers.length > 1
					? spikes.findIndex((s) => s.buttonX === x && s.buttonY === y)
					: 0
				const buttonNum = buttonIdx >= 0 ? buttonIdx + 1 : 1
				const isPressed = triggers[buttonIdx] || false

				cell.className = `cell button-base ${isPressed ? "pressed" : ""} button-${buttonIdx}`
				cell.innerHTML = `
					<div class="button-icon" style="
						width: 18px;
						height: 18px;
						background: radial-gradient(circle, ${isPressed ? "#888" : "#64b5f6"} 0%, ${isPressed ? "#666" : "#3498db"} 70%);
						border-radius: 50%;
						box-shadow: 0 2px 4px rgba(0,0,0,0.3);
						display: flex;
						align-items: center;
						justify-content: center;
						font-size: 10px;
						color: white;
						transition: all 0.3s;
					">${buttonNum}</div>
				`
				break
			case Element.GOAL:
				cell.classList.add("goal")
				cell.innerHTML = "<span style=\"font-size: 18px;\">🏁</span>"
				break
			case Element.SPIKE:
				// 尖刺作为动态对象单独渲染
				cell.classList.add("air")
				break
			default:
				cell.classList.add("air")
			}
		}

	/**
	 * 渲染动态对象
	 */
	private renderObjects(
		container: HTMLElement,
		hero: Position,
		enemies: Position[],
		spikes: SpikeState[],
		gridHeight: number
	): void {
		// 渲染英雄
		const heroDisplayY = gridHeight - 1 - hero.y
		this.heroElement = this.createGameObject("hero", "🦊", hero.x, heroDisplayY, 22)
		this.heroElement.classList.add("hero")
		container.appendChild(this.heroElement)

		// 渲染敌人
		enemies.forEach((enemy) => {
			const enemyDisplayY = gridHeight - 1 - enemy.y
			const key = `enemy-${enemy.x}-${enemy.y}`
			const el = this.createGameObject(key, "👿", enemy.x, enemyDisplayY, 20)
			container.appendChild(el)
			this.enemyElements.set(key, el)
		})

		// 渲染尖刺
		spikes.forEach((spike) => {
			const spikeDisplayY = gridHeight - 1 - spike.currentY
			const key = `spike-${spike.x}-${spike.initialY}`
			const el = this.createGameObject(key, "🔺", spike.x, spikeDisplayY, 20)
			el.style.color = "#e74c3c"
			el.style.filter = "drop-shadow(0 2px 4px rgba(231, 76, 60, 0.5))"
			container.appendChild(el)
			this.spikeElements.set(key, el)
		})
	}

	/**
	 * 创建游戏对象元素
	 */
	private createGameObject(
		id: string,
		emoji: string,
		gridX: number,
		gridY: number,
		fontSize: number
	): HTMLElement {
		const el = document.createElement("div")
		el.id = id
		el.className = "game-object"
		el.style.cssText = `
			position: absolute;
			left: ${gridX * (this.config.cellSize + this.config.gap)}px;
			top: ${gridY * (this.config.cellSize + this.config.gap)}px;
			width: ${this.config.cellSize}px;
			height: ${this.config.cellSize}px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: ${fontSize}px;
			z-index: 10;
		`
		el.textContent = emoji
		return el
	}

	/**
	 * 播放动画序列
	 */
	async playAnimations(animations: AnimationEvent[]): Promise<void> {
		if (this.animating) return
		this.animating = true

		// 按 delay 分组
		const groups = this.groupAnimationsByDelay(animations)
		const sortedDelays = Array.from(groups.keys()).sort((a, b) => a - b)

		// 用于跟踪最后一个动画组的结束时间
		let lastGroupEndTime = 0

		for (const delay of sortedDelays) {
			const group = groups.get(delay)!

			// 等待到该组动画的触发时间
			const waitTime = delay - lastGroupEndTime
			if (waitTime > 0) {
				await new Promise((resolve) => setTimeout(resolve, waitTime))
			}

			// 检查是否有演出镜头动画
			const cinematicAnim = group.find((a) => 
				a.type === "BUTTON_PRESS" && 
				a.payload && typeof a.payload === "object" && 
				"cinematic" in a.payload
			)

			if (cinematicAnim && cinematicAnim.payload && typeof cinematicAnim.payload === "object") {
				// 演出镜头模式：播放玩家动画 + 镜头移动
				const filteredGroup = group.filter((a) => a.type !== "BUTTON_PRESS")
				await Promise.all(filteredGroup.map((anim) => this.playSingleAnimation(anim)))

				// 镜头移动
				const payload = cinematicAnim.payload as Record<string, number>
				const { spikeIdx, spikeStartY, spikeTargetY, cinematicDuration, followDuration, waitDuration } = payload
				const spikeEl = this.spikeElements.get(`spike-${spikeIdx}`)

				if (spikeEl) {
					// 计算尖刺的像素坐标
					const cellSize = this.config.cellSize + this.config.gap
					const spikePixelX = parseInt(spikeEl.style.left)
					const spikeStartPixelY = (this.currentGridHeight - 1 - spikeStartY) * cellSize
					const spikeTargetPixelY = (this.currentGridHeight - 1 - spikeTargetY) * cellSize

					// 镜头移动到尖刺位置
					await this.cinematicMoveTo(spikePixelX, spikeStartPixelY, cinematicDuration)

					// 镜头跟随尖刺下落
					await this.cinematicFollowSpike(spikeEl, followDuration)
					await new Promise((resolve) => setTimeout(resolve, followDuration))

					// 停顿等待
					if (waitDuration > 0) {
						await new Promise((resolve) => setTimeout(resolve, waitDuration))
					}

					// 找到第二阶段尖刺动画并播放
					const spikeAnim2 = animations.find((a) => a.type === "SPIKE_FALL" && a.delay === delay + cinematicDuration + followDuration)
					if (spikeAnim2) {
						await this.cinematicFollowSpike(spikeEl, spikeAnim2.duration)
						await new Promise((resolve) => setTimeout(resolve, spikeAnim2.duration))
					}

					// 镜头回到玩家位置
					await this.endCinematic(600)
				}

				// 计算该组动画的实际结束时间
				const groupMaxDuration = Math.max(...group.map((a) => a.duration + (a.delay || 0)))
				lastGroupEndTime = groupMaxDuration
			} else {
				// 普通模式：同时播放该组所有动画
				await Promise.all(group.map((anim) => this.playSingleAnimation(anim)))

				// 计算该组动画的结束时间
				const groupMaxDuration = Math.max(...group.map((a) => a.duration + (a.delay || 0)))
				lastGroupEndTime = groupMaxDuration
			}
		}

		this.animating = false
	}

	/**
	 * 按 delay 分组动画
	 */
	private groupAnimationsByDelay(animations: AnimationEvent[]): Map<number, AnimationEvent[]> {
		const groups = new Map<number, AnimationEvent[]>()

		for (const anim of animations) {
			const delay = anim.delay || 0
			if (!groups.has(delay)) {
				groups.set(delay, [])
			}
			groups.get(delay)!.push(anim)
		}

		return groups
	}

	/**
	 * 播放单个动画
	 */
	private async playSingleAnimation(anim: AnimationEvent): Promise<void> {
		switch (anim.type) {
			case "HERO_MOVE":
				await this.animateHeroMove(anim)
				break
			case "HERO_JUMP":
				await this.animateHeroJump(anim)
				break
			case "HERO_FALL":
				await this.animateHeroFall(anim)
				break
			case "BUTTON_PRESS":
				await this.animateButtonPress(anim)
				break
			case "SPIKE_FALL":
				await this.animateSpikeFall(anim)
				break
			case "ENEMY_DIE":
				await this.animateEnemyDie(anim)
				break
			case "GOAL_REACHED":
				await this.animateGoalReached(anim)
				break
		}
	}

	/**
	 * 英雄移动动画
	 */
	private async animateHeroMove(anim: AnimationEvent): Promise<void> {
		if (!this.heroElement || !anim.to) return

		const { to, duration } = anim
		const targetDisplayY = this.currentGridHeight - 1 - to.y
		const targetLeft = to.x * (this.config.cellSize + this.config.gap)
		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		this.heroElement.style.transition = `all ${duration}ms ease-out`
		this.heroElement.style.left = `${targetLeft}px`
		this.heroElement.style.top = `${targetTop}px`

		await new Promise((resolve) => setTimeout(resolve, duration))
		this.heroElement.style.transition = ""
	}

	/**
	 * 英雄跳跃动画
	 */
	private async animateHeroJump(anim: AnimationEvent): Promise<void> {
		if (!this.heroElement || !anim.to) return

		const { to, duration } = anim
		const targetDisplayY = to.y < 0 ? -1 : this.currentGridHeight - 1 - to.y
		const targetLeft = to.x * (this.config.cellSize + this.config.gap)
		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		this.heroElement.style.transition = `all ${duration}ms ease-out`
		this.heroElement.style.left = `${targetLeft}px`
		this.heroElement.style.top = `${targetTop}px`

		await new Promise((resolve) => setTimeout(resolve, duration))
		this.heroElement.style.transition = ""
	}

	/**
	 * 英雄坠落动画
	 */
	private async animateHeroFall(anim: AnimationEvent): Promise<void> {
		if (!this.heroElement || !anim.to) return

		const { to, duration } = anim
		const targetDisplayY = to.y < 0 ? -1 : this.currentGridHeight - 1 - to.y
		const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

		this.heroElement.style.transition = `top ${duration}ms ease-in`
		this.heroElement.style.top = `${targetTop}px`

		await new Promise((resolve) => setTimeout(resolve, duration))
		this.heroElement.style.transition = ""
	}

	/**
	 * 按钮按下动画
	 */
	private async animateButtonPress(anim: AnimationEvent): Promise<void> {
		const { target, duration } = anim
		const buttonIdx = target?.split("-")[1] || "0"
		const selector = `.button-${buttonIdx} .button-icon`
		const buttonIcon = this.worldContainer.querySelector(selector) as HTMLElement

		if (buttonIcon) {
			buttonIcon.style.transform = "scale(0.8)"
			buttonIcon.style.background = "radial-gradient(circle, #888 0%, #666 70%)"

			await new Promise((resolve) => setTimeout(resolve, duration))
		}
	}

	/**
	 * 尖刺坠落动画
	 */
	private async animateSpikeFall(anim: AnimationEvent): Promise<void> {
		const { target, to, duration } = anim
		const spikeIdx = target?.split("-")[1] || "0"

		// 找到对应的尖刺元素
		const spikeEl = Array.from(this.spikeElements.values())[parseInt(spikeIdx)]
		if (spikeEl && to) {
			const targetDisplayY = this.currentGridHeight - 1 - to.y
			const targetTop = targetDisplayY * (this.config.cellSize + this.config.gap)

			spikeEl.style.transition = `top ${duration}ms ease-in`
			spikeEl.style.top = `${targetTop}px`

			await new Promise((resolve) => setTimeout(resolve, duration))
			spikeEl.style.transition = ""
		}
	}

	/**
	 * 敌人死亡动画
	 */
	private async animateEnemyDie(anim: AnimationEvent): Promise<void> {
		const { target, duration } = anim
		const enemyKey = target?.replace("enemy-", "")
		const enemyEl = this.enemyElements.get(enemyKey || "")

		if (enemyEl) {
			enemyEl.style.transition = `all ${duration}ms ease-out`
			enemyEl.style.transform = "scale(1.5) rotate(45deg)"
			enemyEl.style.opacity = "0"

			await new Promise((resolve) => setTimeout(resolve, duration))
			enemyEl.remove()
			this.enemyElements.delete(enemyKey || "")
		}
	}

	/**
	 * 到达终点动画
	 */
	private async animateGoalReached(anim: AnimationEvent): Promise<void> {
		// 旗帜飘动效果
		const { from, duration } = anim
		const goalCell = this.worldContainer.querySelector(".cell.goal") as HTMLElement

		if (goalCell) {
			goalCell.style.animation = "pulse 0.5s ease-in-out 3"
			await new Promise((resolve) => setTimeout(resolve, duration))
			goalCell.style.animation = ""
		}
	}

	/**
	 * 演出镜头：移动到指定位置
	 */
	private async cinematicMoveTo(targetX: number, targetY: number, duration: number): Promise<void> {
		if (!this.worldContentElement) return

		this.isCinematicMode = true

		const viewportCenterX = this.config.viewportWidth / 2
		const viewportCenterY = (this.currentGridHeight * (this.config.cellSize + this.config.gap)) / 2

		const targetCameraX = targetX - viewportCenterX + this.config.cellSize / 2
		const targetCameraY = targetY - viewportCenterY + this.config.cellSize / 2

		this.worldContentElement.style.transition = `transform ${duration}ms ease-in-out`
		this.worldContentElement.style.transform = `translate(${-targetCameraX}px, ${-targetCameraY}px)`

		await new Promise((resolve) => setTimeout(resolve, duration))
	}

	/**
	 * 演出镜头：跟随尖刺下落
	 */
	private async cinematicFollowSpike(spikeEl: HTMLElement, duration: number): Promise<void> {
		if (!this.worldContentElement) return

		const startTime = Date.now()
		const startY = parseInt(this.worldContentElement.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/)?.[2] || "0")

		return new Promise((resolve) => {
			const follow = () => {
				const elapsed = Date.now() - startTime
				const progress = Math.min(elapsed / duration, 1)

				// 计算当前应该对准的尖刺位置
				const spikeTop = parseInt(spikeEl.style.top)
				const viewportCenterY = (this.currentGridHeight * (this.config.cellSize + this.config.gap)) / 2
				const targetCameraY = spikeTop - viewportCenterY + this.config.cellSize / 2

				// 缓动插值
				const currentCameraY = startY + (targetCameraY - startY) * progress
				const currentX = this.worldContentElement!.style.transform.match(/translate\(([^,]+)px/)?.[1] || "0"
				this.worldContentElement!.style.transform = `translate(${currentX}px, ${-currentCameraY}px)`

				if (progress < 1) {
					requestAnimationFrame(follow)
				} else {
					resolve()
				}
			}
			requestAnimationFrame(follow)
		})
	}

	/**
	 * 结束演出镜头，回到玩家视角
	 */
	private async endCinematic(duration: number): Promise<void> {
		if (!this.worldContentElement) return

		this.worldContentElement.style.transition = `transform ${duration}ms ease-in-out`
		this.worldContentElement.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`

		await new Promise((resolve) => setTimeout(resolve, duration))

		this.isCinematicMode = false
		this.worldContentElement.style.transition = ""
	}

	/**
	 * 获取地图高度
	 */
	private getGridHeight(): number {
		return this.currentGridHeight
	}
}
