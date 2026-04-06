// ========== DOM渲染器 ==========

export class DOMRenderer {
	private worldContainer: HTMLElement
	private brainContainer: HTMLElement

	constructor(worldId: string, brainId: string) {
		this.worldContainer = document.getElementById(worldId)!
		this.brainContainer = document.getElementById(brainId)!
	}

	// 从API数据渲染世界
	renderWorldFromAPI(data: any): void {
		try {
			console.log("[DOMRenderer] renderWorldFromAPI 开始", data)
			
			const grid = data.gridRaw || data.grid
			if (!grid) {
				console.error("[DOMRenderer] 错误: 没有grid数据")
				this.worldContainer.innerHTML = '<div style="color:red">错误: 没有grid数据</div>'
				return
			}
			
			const hero = data.hero
			if (!hero) {
				console.error("[DOMRenderer] 错误: 没有hero数据")
				this.worldContainer.innerHTML = '<div style="color:red">错误: 没有hero数据</div>'
				return
			}
			
			const enemies = data.enemies || []
			const height = grid.length
			const width = grid[0].length
			
			console.log(`[DOMRenderer] 渲染 ${width}x${height} 网格, hero=(${hero.x},${hero.y})`)

			let html = '<div class="grid">'
			
			// 从上到下渲染（y=height-1 到 y=0）
			for (let y = height - 1; y >= 0; y--) {
				html += '<div class="row">'
				for (let x = 0; x < width; x++) {
					const cell = grid[y][x]
					const heroHere = hero.x === x && hero.y === y
					const enemyHere = enemies.some((e: any) => e.x === x && e.y === y)
					html += this.renderCell(cell, heroHere, enemyHere)
				}
				html += '</div>'
			}
			
			html += '</div>'
			this.worldContainer.innerHTML = html
			console.log("[DOMRenderer] 渲染完成")
			
		} catch (err: any) {
			console.error("[DOMRenderer] 渲染错误:", err)
			this.worldContainer.innerHTML = `<div style="color:red">渲染错误: ${err.message}</div>`
		}
	}

	private renderCell(cellType: number, hero: boolean, enemy: boolean): string {
		const classes = ['cell']
		let content = ''

		switch (cellType) {
			case 0: // AIR
				classes.push('air')
				break
			case 1: // HERO (不应该在grid里)
				classes.push('air')
				break
			case 2: // PLATFORM
				classes.push('platform')
				break
			case 3: // ENEMY
				classes.push('platform')
				break
			case 4: // GOAL
				classes.push('goal')
				content = '🏁'
				break
			case 5: // SPIKE
				classes.push('spike')
				content = '🔺'
				break
			case 6: // BUTTON
				classes.push('button')
				content = '🔘'
				break
		}

		if (enemy) {
			content = '👿'
			classes.push('has-enemy')
		}

		if (hero) {
			content = '🦊'
			classes.push('has-hero')
		}

		return `<div class="${classes.join(' ')}">${content}</div>`
	}

	// 从API数据渲染大脑思考
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

	// 清空大脑面板
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
