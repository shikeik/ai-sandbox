// ========== DOM渲染器 - 相机跟随+断言版 ==========

import { 
	assert, 
	assertEq, 
	assertExists, 
	assertInRange,
	assertValidCamera,
	assertValidPosition,
	assertCoordinateConversion,
	setAssertLevel,
	setAssertStopOnFail
} from './Assert.js'

// 设置断言级别（开发时verbose，生产时error-only）
setAssertLevel('verbose')
setAssertStopOnFail(false)

interface AnimationEvent {
	type: "HERO_MOVE" | "HERO_JUMP" | "HERO_FALL" | "SPIKE_FALL" | "ENEMY_DIE" | "BUTTON_PRESS"
	target: string
	from: { x: number; y: number }
	to?: { x: number; y: number }
	duration: number
	delay?: number
	payload?: any
}

interface WorldState {
	grid: number[][]
	hero: { x: number; y: number }
	enemies: { x: number; y: number }[]
	triggers: boolean[]
	spikeY?: number
	spikeFalling?: boolean
}

export class DOMRenderer {
	private worldContainer: HTMLElement
	private brainContainer: HTMLElement
	private viewportElement: HTMLElement | null = null
	private worldContentElement: HTMLElement | null = null
	private heroElement: HTMLElement | null = null
	private enemyElements: Map<string, HTMLElement> = new Map()
	private spikeElement: HTMLElement | null = null
	private buttonElement: HTMLElement | null = null
	
	private cellSize: number = 36
	private gap: number = 4
	private animating: boolean = false
	
	// 相机系统
	private cameraX: number = 0
	private cameraY: number = 0
	private viewportWidth: number = 0
	private viewportHeight: number = 0
	private worldWidth: number = 0
	private worldHeight: number = 0

	constructor(worldId: string, brainId: string) {
		this.worldContainer = document.getElementById(worldId)!
		this.brainContainer = document.getElementById(brainId)!
		this.updateViewportSize()
		window.addEventListener('resize', () => this.updateViewportSize())
	}

	private updateViewportSize(): void {
		// 获取容器可用宽度（减去padding）
		const containerWidth = this.worldContainer.parentElement?.clientWidth || window.innerWidth
		// 确保最小宽度，避免负数
		this.viewportWidth = Math.max(320, Math.min(containerWidth - 32, 400)) // 最小320px，最大400px
		this.viewportHeight = 220 // 视口高度
		console.log(`[VIEWPORT] 更新视口尺寸: ${this.viewportWidth}x${this.viewportHeight}`)
	}

	// ========== 初始化渲染 ==========
	renderWorldFromAPI(data: any): void {
		try {
			console.log("[RENDER] ========================================")
			console.log("[RENDER] 开始渲染世界")
			
			const state: WorldState = {
				grid: data.gridRaw || data.grid,
				hero: data.hero,
				enemies: data.enemies || [],
				triggers: data.triggers || [],
				spikeY: data.spikeY,
				spikeFalling: data.spikeFalling
			}

			// 断言：必要数据存在
			assertExists(state.grid, "grid数据")
			assertExists(state.hero, "hero数据")

			if (!state.grid || !state.hero) {
				console.error("[RENDER] 错误: 缺少grid或hero数据")
				return
			}

			const { grid } = state
			const height = grid.length
			const width = grid[0].length
			
			console.log(`[RENDER] 地图尺寸: ${width}x${height}`)
			console.log(`[RENDER] 玩家逻辑位置: (${state.hero.x}, ${state.hero.y})`)
			console.log(`[RENDER] 玩家数量: ${state.enemies.length}`)
			console.log(`[RENDER] 尖刺Y位置: ${state.spikeY}`)
			console.log(`[RENDER] 按钮触发: ${state.triggers[0]}`)
			console.log(`[RENDER] 视口尺寸: ${this.viewportWidth}x${this.viewportHeight}px`)

			// 断言：地图尺寸正确
			assertEq(width, 10, "地图宽度")
			assertEq(height, 6, "地图高度")
			
			// 断言：英雄位置有效
			assertValidPosition(state.hero.x, state.hero.y, width, height, "API返回英雄位置")

			// 清空容器
			this.worldContainer.innerHTML = ''
			this.enemyElements.clear()

			// 计算世界尺寸
			this.worldWidth = width * (this.cellSize + this.gap) - this.gap
			this.worldHeight = height * (this.cellSize + this.gap) - this.gap
			console.log(`[RENDER] 世界像素尺寸: ${this.worldWidth}x${this.worldHeight}px`)

			// 计算初始相机位置（聚焦英雄）- 传入已知高度
			this.updateCameraWithHeight(state.hero.x, state.hero.y, height)
			console.log(`[RENDER] 相机位置: (${this.cameraX.toFixed(1)}, ${this.cameraY.toFixed(1)})`)
			
			// 断言：相机位置有效
			assertValidCamera(this.cameraX, this.cameraY, this.worldWidth, this.worldHeight, this.viewportWidth, this.viewportHeight)

			// 创建视口结构
			this.worldContainer.innerHTML = `
				<div class="world-viewport" style="
					width: ${this.viewportWidth}px;
					height: ${this.viewportHeight}px;
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

			this.viewportElement = this.worldContainer.querySelector('.world-viewport') as HTMLElement
			this.worldContentElement = this.worldContainer.querySelector('.world-content') as HTMLElement

			const gridLayer = this.worldContainer.querySelector('.layer-grid') as HTMLElement
			const objectsLayer = this.worldContainer.querySelector('.layer-objects') as HTMLElement

			// 1. 渲染静态格子背景
			this.renderGrid(gridLayer, state)

			// 2. 渲染动态对象
			this.renderObjects(objectsLayer, state)

		} catch (err: any) {
			console.error("[DOMRenderer] 渲染错误:", err)
		}
	}

	// 更新相机位置（让英雄保持在视口中央）
	private updateCamera(heroX: number, heroY: number): void {
		const height = this.getGridHeight()
		this.updateCameraWithHeight(heroX, heroY, height)
	}

	// 使用已知高度更新相机（避免DOM查询）
	private updateCameraWithHeight(heroX: number, heroY: number, height: number): void {
		// 断言：输入参数有效
		assertInRange(heroX, 0, 9, "updateCamera heroX")
		assertInRange(heroY, 0, 5, "updateCamera heroY")
		assertEq(height, 6, "updateCamera gridHeight")
		
		const heroPixelX = heroX * (this.cellSize + this.gap)
		const heroPixelY = (height - 1 - heroY) * (this.cellSize + this.gap)
		
		console.log(`[CAMERA] 英雄像素位置: (${heroPixelX}, ${heroPixelY})`)

		// 目标相机位置（让英雄在中央）
		let targetCameraX = heroPixelX - this.viewportWidth / 2 + this.cellSize / 2
		let targetCameraY = heroPixelY - this.viewportHeight / 2 + this.cellSize / 2
		console.log(`[CAMERA] 目标相机位置(未限制): (${targetCameraX.toFixed(1)}, ${targetCameraY.toFixed(1)})`)

		// 边界限制（不能看到世界外面）
		const maxCameraX = Math.max(0, this.worldWidth - this.viewportWidth)
		const maxCameraY = Math.max(0, this.worldHeight - this.viewportHeight)
		targetCameraX = Math.max(0, Math.min(targetCameraX, maxCameraX))
		targetCameraY = Math.max(0, Math.min(targetCameraY, maxCameraY))
		console.log(`[CAMERA] 最大相机位置: (${maxCameraX.toFixed(1)}, ${maxCameraY.toFixed(1)})`)

		this.cameraX = targetCameraX
		this.cameraY = targetCameraY
		
		// 断言：相机位置在有效范围内
		assertInRange(this.cameraX, 0, maxCameraX + 0.1, "最终cameraX")
		assertInRange(this.cameraY, 0, maxCameraY + 0.1, "最终cameraY")
	}

	// 应用相机变换
	private applyCamera(): void {
		if (this.worldContentElement) {
			this.worldContentElement.style.transform = `translate(${-this.cameraX}px, ${-this.cameraY}px)`
		}
	}

	// 平滑移动相机到目标位置
	private smoothCameraTo(heroX: number, heroY: number): void {
		this.updateCamera(heroX, heroY)
		this.applyCamera()
	}

	// 渲染静态格子背景
	private renderGrid(container: HTMLElement, state: WorldState): void {
		const { grid } = state
		const height = grid.length
		const width = grid[0].length

		container.style.cssText = `
			width: ${this.worldWidth}px;
			height: ${this.worldHeight}px;
			position: relative;
		`

		for (let displayY = 0; displayY < height; displayY++) {
			const logicY = height - 1 - displayY
			for (let logicX = 0; logicX < width; logicX++) {
				const cell = grid[logicY][logicX]
				const cellEl = this.createCell(cell, logicX, displayY)
				container.appendChild(cellEl)
			}
		}
	}

	// 创建单个格子
	private createCell(cellType: number, logicX: number, displayY: number): HTMLElement {
		const el = document.createElement('div')
		el.className = 'cell'
		el.dataset.x = String(logicX)
		el.dataset.y = String(displayY)

		const left = logicX * (this.cellSize + this.gap)
		const top = displayY * (this.cellSize + this.gap)
		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.cellSize}px;
			height: ${this.cellSize}px;
		`

		switch (cellType) {
			case 0:
				el.classList.add('air')
				break
			case 2:
				el.classList.add('platform')
				break
			case 4:
				el.classList.add('goal')
				el.innerHTML = '🏁'
				break
			case 5:
				el.classList.add('air')
				break
			case 6:
				el.classList.add('button-base')
				break
		}

		return el
	}

	// 渲染动态对象
	private renderObjects(container: HTMLElement, state: WorldState): void {
		const { hero, enemies, grid, spikeY } = state
		const height = grid.length
		
		console.log(`[RENDER] 渲染动态对象...`)

		container.style.cssText = `
			width: ${this.worldWidth}px;
			height: ${this.worldHeight}px;
			position: absolute;
			top: 0;
			left: 0;
		`

		// 1. 英雄
		const heroDisplayY = height - 1 - hero.y
		this.heroElement = this.createGameObject('hero', '🦊', hero.x, heroDisplayY, 30)
		container.appendChild(this.heroElement)
		console.log(`[RENDER]   英雄: 逻辑(${hero.x},${hero.y}) -> 显示(${hero.x},${heroDisplayY})`)

		// 2. 敌人
		enemies.forEach((enemy, i) => {
			const enemyDisplayY = height - 1 - enemy.y
			const key = `enemy-${enemy.x}-${enemy.y}`
			const el = this.createGameObject(key, '👿', enemy.x, enemyDisplayY, 20)
			this.enemyElements.set(key, el)
			container.appendChild(el)
			console.log(`[RENDER]   敌人[${i}]: 逻辑(${enemy.x},${enemy.y}) -> 显示(${enemy.x},${enemyDisplayY})`)
		})

		// 3. 尖刺
		const initialSpikeY = spikeY !== undefined ? spikeY : 4
		const spikeDisplayY = height - 1 - initialSpikeY
		this.spikeElement = this.createGameObject('spike', '🔺', 4, spikeDisplayY, 40)
		container.appendChild(this.spikeElement)
		console.log(`[RENDER]   尖刺: 逻辑(${4},${initialSpikeY}) -> 显示(${4},${spikeDisplayY})`)

		// 4. 按钮
		if (!state.triggers[0]) {
			const buttonDisplayY = height - 1 - 2
			this.buttonElement = this.createGameObject('button', '🔘', 4, buttonDisplayY, 25)
			this.buttonElement.classList.add('button-obj')
			container.appendChild(this.buttonElement)
			console.log(`[RENDER]   按钮: 逻辑(${4},${2}) -> 显示(${4},${buttonDisplayY})`)
		} else {
			this.buttonElement = null
			console.log(`[RENDER]   按钮: 已触发，不渲染`)
		}
		
		console.log(`[RENDER] 动态对象渲染完成`)
	}

	// 创建游戏对象
	private createGameObject(id: string, content: string, logicX: number, displayY: number, zIndex: number): HTMLElement {
		const el = document.createElement('div')
		el.className = `game-object ${id}`
		el.dataset.id = id
		el.innerHTML = content

		const left = logicX * (this.cellSize + this.gap)
		const top = displayY * (this.cellSize + this.gap)

		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.cellSize}px;
			height: ${this.cellSize}px;
			z-index: ${zIndex};
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 24px;
			transition: none;
		`

		return el
	}

	// ========== 动画执行 ==========
	async playAnimations(animations: AnimationEvent[]): Promise<void> {
		if (this.animating || !animations.length) return
		this.animating = true

		console.log(`[ANIM] ========================================`)
		console.log(`[ANIM] 开始播放动画序列，共${animations.length}个动画`)
		
		const groups = this.groupByDelay(animations)
		console.log(`[ANIM] 按delay分组: ${groups.length}组`)
		
		for (let i = 0; i < groups.length; i++) {
			const group = groups[i]
			const delay = group[0].delay || 0
			console.log(`[ANIM] 组[${i + 1}/${groups.length}]: ${group.length}个动画, delay=${delay}ms`)
			await Promise.all(group.map(anim => this.playSingleAnimation(anim)))
		}

		console.log(`[ANIM] 动画序列播放完成`)
		this.animating = false
	}

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

	private playSingleAnimation(anim: AnimationEvent): Promise<void> {
		console.log(`[ANIM]   播放动画: ${anim.type} [${anim.target}] ${anim.from.x},${anim.from.y} -> ${anim.to?.x ?? '-' },${anim.to?.y ?? '-'} (${anim.duration}ms)`)
		return new Promise((resolve) => {
			setTimeout(() => {
				switch (anim.type) {
					case 'HERO_MOVE':
						this.animateHeroMove(anim)
						break
					case 'HERO_JUMP':
						this.animateHeroJump(anim)
						break
					case 'HERO_FALL':
						this.animateHeroFall(anim)
						break
					case 'SPIKE_FALL':
						this.animateSpikeFall(anim)
						break
					case 'ENEMY_DIE':
						this.animateEnemyDie(anim)
						break
					case 'BUTTON_PRESS':
						this.animateButtonPress(anim)
						break
				}
				setTimeout(resolve, anim.duration)
			}, anim.delay || 0)
		})
	}

	// 英雄移动动画（带相机跟随）- 水平平移
	private animateHeroMove(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		
		const height = this.getGridHeight()
		
		// 处理虚空（y=-1）：渲染在屏幕下方
		let targetDisplayY: number
		if (anim.to.y < 0) {
			targetDisplayY = height + 2
		} else {
			targetDisplayY = height - 1 - anim.to.y
		}
		
		const left = anim.to.x * (this.cellSize + this.gap)
		const top = targetDisplayY * (this.cellSize + this.gap)
		
		console.log(`[ANIM]     HERO_MOVE: 逻辑(${anim.to.x},${anim.to.y}) -> 像素(${left},${top})`)

		// 水平平移使用 ease-out
		this.heroElement.style.transition = `left ${anim.duration}ms ease-out`
		this.heroElement.style.left = `${left}px`
		
		// 如果Y也变化，同时更新top
		if (anim.from.y !== anim.to.y) {
			this.heroElement.style.transition = `all ${anim.duration}ms ease-out`
			this.heroElement.style.top = `${top}px`
		}

		// 相机跟随
		this.smoothCameraTo(anim.to.x, Math.max(0, anim.to.y))
	}

	// 英雄跳跃动画 - Fox-Jump同款抛物线
	private animateHeroJump(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()
		
		// 处理虚空坠落（y=-1）：渲染在屏幕下方
		let targetDisplayY: number
		if (anim.to.y < 0) {
			targetDisplayY = height + Math.abs(anim.to.y)  // 虚空：渲染在地图下方
		} else {
			targetDisplayY = height - 1 - anim.to.y
		}
		
		const startLeft = parseFloat(this.heroElement.style.left) || 0
		const startTop = parseFloat(this.heroElement.style.top) || 0
		const targetLeft = anim.to.x * (this.cellSize + this.gap)
		const targetTop = targetDisplayY * (this.cellSize + this.gap)

		const startTime = performance.now()
		const duration = anim.duration
		const jumpHeight = 40  // 抛物线最高点偏移量

		console.log(`[ANIM]     HERO_JUMP: (${anim.from.x},${anim.from.y}) → (${anim.to.x},${anim.to.y}), 抛物线高=${jumpHeight}px`)

		const animate = (now: number) => {
			const elapsed = now - startTime
			const progress = Math.min(elapsed / duration, 1)
			
			// 线性水平移动
			const currentLeft = startLeft + (targetLeft - startLeft) * progress
			
			// 抛物线垂直运动：4 * p * (1-p) 在 p=0.5 时达到最大值1
			const parabola = 4 * progress * (1 - progress)
			const verticalOffset = parabola * jumpHeight
			
			// 当前高度 = 起点到终点的线性插值 + 抛物线偏移
			const currentTop = startTop + (targetTop - startTop) * progress - verticalOffset

			this.heroElement!.style.left = `${currentLeft}px`
			this.heroElement!.style.top = `${currentTop}px`

			// 相机跟随（基于逻辑坐标）
			const currentLogicX = currentLeft / (this.cellSize + this.gap)
			const currentLogicY = height - 1 - (currentTop + verticalOffset) / (this.cellSize + this.gap)
			this.smoothCameraTo(currentLogicX, currentLogicY)

			if (progress < 1) {
				requestAnimationFrame(animate)
			} else {
				console.log(`[ANIM]     HERO_JUMP 完成`)
			}
		}

		requestAnimationFrame(animate)
	}

	// 英雄坠落动画（带相机跟随）- 直线坠落
	private animateHeroFall(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()
		
		// 处理虚空坠落（y=-1）：渲染在屏幕下方
		let targetDisplayY: number
		if (anim.to.y < 0) {
			targetDisplayY = height + 2  // 虚空：渲染在地图下方2格处
		} else {
			targetDisplayY = height - 1 - anim.to.y
		}
		
		const targetTop = targetDisplayY * (this.cellSize + this.gap)
		
		console.log(`[ANIM]     HERO_FALL: → (${anim.to.x},${anim.to.y}), 显示Y=${targetDisplayY}`)

		// 使用CSS transition实现直线加速坠落
		this.heroElement.style.transition = `top ${anim.duration}ms cubic-bezier(0.5, 0, 1, 1)`
		this.heroElement.style.top = `${targetTop}px`

		// 相机跟随
		this.smoothCameraTo(anim.to.x, Math.max(0, anim.to.y))
	}

	private animateSpikeFall(anim: AnimationEvent): void {
		if (!this.spikeElement || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y
		
		const targetTop = targetDisplayY * (this.cellSize + this.gap)

		this.spikeElement.style.transition = `all ${anim.duration}ms cubic-bezier(0.4, 0, 1, 1)`
		this.spikeElement.style.top = `${targetTop}px`
		this.spikeElement.style.transform = 'rotate(360deg)'

		if (anim.to.y <= 1) {
			setTimeout(() => {
				this.createImpactEffect(4, targetDisplayY)
			}, anim.duration)
		}
	}

	private animateEnemyDie(anim: AnimationEvent): void {
		const key = anim.target
		const el = this.enemyElements.get(key)
		if (!el) return

		el.style.transition = `all ${anim.duration}ms ease-out`
		el.style.transform = 'scale(1.5) rotate(180deg)'
		el.style.opacity = '0'

		setTimeout(() => {
			el.remove()
			this.enemyElements.delete(key)
		}, anim.duration)
	}

	private animateButtonPress(anim: AnimationEvent): void {
		if (!this.buttonElement) return

		this.buttonElement.style.transition = `all ${anim.duration}ms ease`
		this.buttonElement.style.transform = 'scale(0.8)'
		this.buttonElement.style.filter = 'brightness(0.7)'

		this.createRippleEffect(anim.from.x, this.getGridHeight() - 1 - anim.from.y)
	}

	private createImpactEffect(logicX: number, displayY: number): void {
		const effectsLayer = this.worldContainer.querySelector('.layer-effects') as HTMLElement
		if (!effectsLayer) return

		const left = logicX * (this.cellSize + this.gap) + this.cellSize / 2
		const top = displayY * (this.cellSize + this.gap) + this.cellSize / 2

		for (let i = 0; i < 6; i++) {
			const particle = document.createElement('div')
			particle.className = 'particle'
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
				{ transform: 'translate(0,0) scale(1)', opacity: 1 },
				{ transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`, opacity: 0 }
			], {
				duration,
				easing: 'ease-out'
			}).onfinish = () => particle.remove()
		}
	}

	private createRippleEffect(logicX: number, displayY: number): void {
		const effectsLayer = this.worldContainer.querySelector('.layer-effects') as HTMLElement
		if (!effectsLayer) return

		const left = logicX * (this.cellSize + this.gap) + this.cellSize / 2
		const top = displayY * (this.cellSize + this.gap) + this.cellSize / 2

		const ripple = document.createElement('div')
		ripple.className = 'ripple'
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
			{ width: '0px', height: '0px', opacity: 1 },
			{ width: '60px', height: '60px', opacity: 0 }
		], {
			duration: 600,
			easing: 'ease-out'
		}).onfinish = () => ripple.remove()
	}

	private getGridHeight(): number {
		return this.worldContainer.querySelector('.layer-grid')?.children.length 
			? Math.ceil(this.worldContainer.querySelector('.layer-grid')!.children.length / 10)
			: 6
	}

	// ========== 大脑思考渲染 ==========
	renderImaginationFromAPI(data: any): void {
		if (!data.decision) return

		const actionNames: Record<string, string> = {
			LEFT: '⬅️ 左移',
			RIGHT: '➡️ 右移',
			JUMP: '⬆️ 跳跃',
			WAIT: '⏸️ 等待',
		}

		const decision = data.decision
		
		let html = `
			<div class="brain-reasoning">
				<div class="reason-title">💭 决策理由</div>
				<div class="reason-text">${decision.reasoning || 'AI思考中...'}</div>
			</div>
			<div class="brain-cards">
				<div class="cards-title">🎲 想象的${decision.imaginations?.length || 0}种可能</div>
				<div class="cards-grid">
					${(decision.imaginations || []).map((img: any) => `
						<div class="imagination-card ${img.action === decision.action ? 'selected' : ''}">
							<div class="card-action">${actionNames[img.action] || img.action}</div>
							<div class="card-pos">预测位置: (${img.predictedPos?.x}, ${img.predictedPos?.y})</div>
							<div class="card-reward">奖励: ${img.predictedReward > 0 ? '+' : ''}${img.predictedReward}</div>
							${img.killedEnemy ? '<div class="card-bonus">✨ 击杀敌人!</div>' : ''}
						</div>
					`).join('')}
				</div>
			</div>
		`

		this.brainContainer.innerHTML = html
	}

	clearBrainPanel(): void {
		this.brainContainer.innerHTML = `
			<div class="brain-placeholder">
				点击「单步」按钮<br>
				观察AI如何想象未来并决策
			</div>
		`
	}

	showMessage(msg: string): void {
		const el = document.getElementById('message')!
		el.textContent = msg
		el.classList.add('show')
		setTimeout(() => el.classList.remove('show'), 2000)
	}
}
