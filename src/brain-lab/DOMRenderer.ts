// ========== DOM渲染器 - 动画版 ==========

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
	private gridElement: HTMLElement | null = null
	private heroElement: HTMLElement | null = null
	private enemyElements: Map<string, HTMLElement> = new Map()
	private spikeElement: HTMLElement | null = null
	private buttonElement: HTMLElement | null = null
	
	private cellSize: number = 36  // 格子大小（像素）
	private gap: number = 4        // 格子间隙
	private animating: boolean = false

	constructor(worldId: string, brainId: string) {
		this.worldContainer = document.getElementById(worldId)!
		this.brainContainer = document.getElementById(brainId)!
	}

	// ========== 初始化渲染 ==========
	renderWorldFromAPI(data: any): void {
		try {
			const state: WorldState = {
				grid: data.gridRaw || data.grid,
				hero: data.hero,
				enemies: data.enemies || [],
				triggers: data.triggers || [],
				spikeY: data.spikeY,
				spikeFalling: data.spikeFalling
			}

			if (!state.grid || !state.hero) {
				console.error("[DOMRenderer] 缺少grid或hero数据")
				return
			}

			// 清空容器
			this.worldContainer.innerHTML = ''
			this.enemyElements.clear()

			// 创建分层结构
			this.worldContainer.innerHTML = `
				<div class="world-layers">
					<div class="layer-grid"></div>
					<div class="layer-objects"></div>
					<div class="layer-effects"></div>
				</div>
			`

			const gridLayer = this.worldContainer.querySelector('.layer-grid') as HTMLElement
			const objectsLayer = this.worldContainer.querySelector('.layer-objects') as HTMLElement

			// 1. 渲染静态格子背景
			this.renderGrid(gridLayer, state)

			// 2. 渲染动态对象（英雄、敌人、尖刺）
			this.renderObjects(objectsLayer, state)

		} catch (err: any) {
			console.error("[DOMRenderer] 渲染错误:", err)
		}
	}

	// 渲染静态格子背景
	private renderGrid(container: HTMLElement, state: WorldState): void {
		const { grid } = state
		const height = grid.length
		const width = grid[0].length

		// 设置容器尺寸
		const totalWidth = width * (this.cellSize + this.gap) - this.gap
		const totalHeight = height * (this.cellSize + this.gap) - this.gap
		container.style.cssText = `
			width: ${totalWidth}px;
			height: ${totalHeight}px;
			position: relative;
		`

		// 从上到下渲染（y=height-1 到 y=0）
		for (let displayY = 0; displayY < height; displayY++) {
			const logicY = height - 1 - displayY  // 转换逻辑坐标
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

		// 计算位置
		const left = logicX * (this.cellSize + this.gap)
		const top = displayY * (this.cellSize + this.gap)
		el.style.cssText = `
			position: absolute;
			left: ${left}px;
			top: ${top}px;
			width: ${this.cellSize}px;
			height: ${this.cellSize}px;
		`

		// 根据类型设置样式
		switch (cellType) {
			case 0: // AIR
				el.classList.add('air')
				break
			case 2: // PLATFORM
				el.classList.add('platform')
				el.innerHTML = '<div class="platform-top"></div>'
				break
			case 4: // GOAL
				el.classList.add('goal')
				el.innerHTML = '🏁'
				break
			case 5: // SPIKE (占位，实际用动态对象)
				el.classList.add('air')
				break
			case 6: // BUTTON
				el.classList.add('button-base')
				break
		}

		return el
	}

	// 渲染动态对象
	private renderObjects(container: HTMLElement, state: WorldState): void {
		const { hero, enemies, grid, spikeY } = state
		const height = grid.length

		// 1. 渲染英雄
		this.heroElement = this.createGameObject('hero', '🦊', hero.x, height - 1 - hero.y, 30)
		container.appendChild(this.heroElement)

		// 2. 渲染敌人
		enemies.forEach((enemy, i) => {
			const key = `enemy-${enemy.x}-${enemy.y}`
			const el = this.createGameObject(key, '👿', enemy.x, height - 1 - enemy.y, 20)
			this.enemyElements.set(key, el)
			container.appendChild(el)
		})

		// 3. 渲染尖刺（初始位置在spikeY，或默认y=4）
		const initialSpikeY = spikeY !== undefined ? spikeY : 4
		this.spikeElement = this.createGameObject('spike', '🔺', 4, height - 1 - initialSpikeY, 40)
		container.appendChild(this.spikeElement)

		// 4. 渲染按钮（如果未触发）
		if (!state.triggers[0]) {
			this.buttonElement = this.createGameObject('button', '🔘', 4, height - 1 - 2, 25)
			this.buttonElement.classList.add('button-obj')
			container.appendChild(this.buttonElement)
		}
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

		// 按delay分组，按顺序执行
		const groups = this.groupByDelay(animations)
		
		for (const group of groups) {
			// 并行执行同一组的动画
			await Promise.all(group.map(anim => this.playSingleAnimation(anim)))
		}

		this.animating = false
	}

	// 按delay分组
	private groupByDelay(animations: AnimationEvent[]): AnimationEvent[][] {
		const groups: Map<number, AnimationEvent[]> = new Map()
		
		animations.forEach(anim => {
			const delay = anim.delay || 0
			if (!groups.has(delay)) groups.set(delay, [])
			groups.get(delay)!.push(anim)
		})

		// 按delay排序
		return Array.from(groups.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([_, anims]) => anims)
	}

	// 播放单个动画
	private playSingleAnimation(anim: AnimationEvent): Promise<void> {
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

	// 英雄移动动画
	private animateHeroMove(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y
		
		const left = anim.to.x * (this.cellSize + this.gap)
		const top = targetDisplayY * (this.cellSize + this.gap)

		this.heroElement.style.transition = `all ${anim.duration}ms ease-out`
		this.heroElement.style.left = `${left}px`
		this.heroElement.style.top = `${top}px`
	}

	// 英雄跳跃动画（抛物线）
	private animateHeroJump(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y
		
		const startLeft = parseFloat(this.heroElement.style.left) || 0
		const startTop = parseFloat(this.heroElement.style.top) || 0
		const targetLeft = anim.to.x * (this.cellSize + this.gap)
		const targetTop = targetDisplayY * (this.cellSize + this.gap)

		const startTime = performance.now()
		const duration = anim.duration

		const animate = (now: number) => {
			const elapsed = now - startTime
			const progress = Math.min(elapsed / duration, 1)
			
			// 水平线性移动
			const currentLeft = startLeft + (targetLeft - startLeft) * progress
			
			// 垂直抛物线（上升时减速，下降时加速）
			const jumpHeight = 30  // 跳跃高度（像素）
			const parabola = 4 * progress * (1 - progress)  // 0->1->0
			const currentTop = startLeft + (targetTop - startTop) * progress - parabola * jumpHeight

			this.heroElement!.style.left = `${currentLeft}px`
			this.heroElement!.style.top = `${currentTop}px`

			if (progress < 1) {
				requestAnimationFrame(animate)
			}
		}

		requestAnimationFrame(animate)
	}

	// 英雄坠落动画（加速）
	private animateHeroFall(anim: AnimationEvent): void {
		if (!this.heroElement || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y
		
		const targetTop = targetDisplayY * (this.cellSize + this.gap)
		
		this.heroElement.style.transition = `top ${anim.duration}ms cubic-bezier(0.5, 0, 1, 1)`
		this.heroElement.style.top = `${targetTop}px`
	}

	// 尖刺坠落动画
	private animateSpikeFall(anim: AnimationEvent): void {
		if (!this.spikeElement || !anim.to) return
		const height = this.getGridHeight()
		const targetDisplayY = height - 1 - anim.to.y
		
		const targetTop = targetDisplayY * (this.cellSize + this.gap)

		// 添加旋转效果
		this.spikeElement.style.transition = `all ${anim.duration}ms cubic-bezier(0.4, 0, 1, 1)`
		this.spikeElement.style.top = `${targetTop}px`
		this.spikeElement.style.transform = 'rotate(360deg)'

		// 撞击效果
		if (anim.to.y <= 1) {
			setTimeout(() => {
				this.createImpactEffect(4, targetDisplayY)
			}, anim.duration)
		}
	}

	// 敌人死亡动画
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

	// 按钮按下动画
	private animateButtonPress(anim: AnimationEvent): void {
		if (!this.buttonElement) return

		this.buttonElement.style.transition = `all ${anim.duration}ms ease`
		this.buttonElement.style.transform = 'scale(0.8)'
		this.buttonElement.style.filter = 'brightness(0.7)'

		// 波纹效果
		this.createRippleEffect(anim.from.x, this.getGridHeight() - 1 - anim.from.y)
	}

	// 创建撞击效果
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

	// 创建波纹效果
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
		// 从DOM获取或默认
		const stateEl = this.worldContainer.querySelector('.cell[data-y="0"]')
		if (stateEl) {
			const parent = stateEl.parentElement
			if (parent) {
				return parent.querySelectorAll('.cell').length / 10  // 假设宽度10
			}
		}
		return 6
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
