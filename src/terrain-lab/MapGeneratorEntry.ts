// ========== 地图生成器入口类 ==========
// 职责：用规则验证函数一步步生成 32 格合法地图
// 特点：触摸滑动、相机跟随主角、行动画

import type { AppState } from "./state.js"
import {
	NUM_LAYERS,
	ELEM_AIR, ELEM_HERO, ELEM_GROUND,
	CURRICULUM_STAGES
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import { getLabel, getActionName, getLayerPool, randElemFromPool } from "./terrain.js"
import { MapRenderer } from "./map-renderer.js"

export class MapGeneratorEntry {
	private state: AppState
	private terrainConfig: TerrainConfig = { ...CURRICULUM_STAGES[4].config }
	private mapCanvas: HTMLCanvasElement
	private renderer: MapRenderer

	// 生成状态
	private isGenerating = false
	private shouldStop = false
	private currentHeroCol = 0
	private generatedMap: number[][] | null = null
	private generationHistory: string[] = []

	constructor(state: AppState) {
		this.state = state
		this.mapCanvas = document.getElementById("generator-canvas") as HTMLCanvasElement
		this.renderer = new MapRenderer({
			canvas: this.mapCanvas,
			mapWidth: 32,
			viewportCols: 7
		})
	}

	init(): void {
		this.setupEventListeners()
		this.bindGlobalFunctions()
		this.resetDisplay()
	}

	private setupEventListeners(): void {
		const stageSelect = document.getElementById("generator-stage-select") as HTMLSelectElement
		if (stageSelect) {
			stageSelect.addEventListener("change", () => {
				const idx = Number(stageSelect.value)
				this.terrainConfig = { ...CURRICULUM_STAGES[idx].config }
			})
		}

		// ResizeObserver
		const ro = new ResizeObserver(() => {
			if (this.generatedMap) {
				this.renderer.draw(this.generatedMap, this.currentHeroCol)
			}
		})
		ro.observe(this.mapCanvas)
	}

	private bindGlobalFunctions(): void {
		;(window as any).startGeneration = () => this.startGeneration()
		;(window as any).stopGeneration = () => this.stopGeneration()
	}

	/**
	 * 开始动画生成
	 */
	async startGeneration(): Promise<void> {
		if (this.isGenerating) return

		this.isGenerating = true
		this.shouldStop = false
		this.updateButtonState(true)

		// 初始化地图
		this.generatedMap = this.createEmptyMap()
		this.currentHeroCol = 0
		this.generationHistory = []

		// 设置起点
		this.generatedMap[1][0] = ELEM_HERO
		this.generatedMap[2][0] = ELEM_GROUND

		// 生成初始视野（第1-6列）
		this.generateTerrainForRange(1, 6)

		// 初始渲染：相机跟随到起点
		this.renderer.followHero(0)
		this.renderer.draw(this.generatedMap, 0)
		this.updateHistory("起点：第0列")

		// 等待一下让用户看到起点
		await this.delay(500)

		// 一步步生成
		let success = false
		while (this.currentHeroCol < 31 && !this.shouldStop) {
			const result = await this.generateNextStep()
			if (!result) {
				break
			}
			if (result.success) {
				if (result.reachedEnd) {
					success = true
					break
				}
			}
		}

		this.isGenerating = false
		this.updateButtonState(false)

		if (success) {
			this.showResult(true, `✅ 地图生成成功！共${this.generationHistory.length}步`)
			// 最后渲染一次 - 显示包含终点的视野
			if (this.generatedMap) {
				this.renderer.setCameraPosition(25)
				this.renderer.draw(this.generatedMap, this.currentHeroCol)
			}
		} else if (this.shouldStop) {
			this.showResult(false, "⏹️ 生成已停止")
		}
	}

	stopGeneration(): void {
		this.shouldStop = true
	}

	/**
	 * 生成下一步
	 */
	private async generateNextStep(): Promise<{ success: boolean; reachedEnd: boolean } | null> {
		if (!this.generatedMap || this.shouldStop) return null

		const heroCol = this.currentHeroCol

		// 获取当前视野
		const viewport = this.getViewport(heroCol)

		// 使用规则函数获取最优动作
		let action = getLabel(viewport)
		let retryCount = 0
		const maxRetries = 100

		// 死路自动重试
		while (action === -1 && retryCount < maxRetries && !this.shouldStop) {
			retryCount++
			this.regenerateTerrainForRange(heroCol + 1, heroCol + 6)
			const newViewport = this.getViewport(heroCol)
			action = getLabel(newViewport)

			if (retryCount % 20 === 0) {
				this.updateHistory(`第${heroCol}列：重试${retryCount}次...`)
				this.renderer.draw(this.generatedMap, heroCol)
				await this.delay(50)
			}
		}

		if (this.shouldStop) return null
		if (action === -1) {
			this.updateHistory(`第${heroCol}列：无法生成合法地形`)
			return { success: false, reachedEnd: false }
		}

		// 计算目标列
		let targetCol = heroCol
		if (action === 0 || action === 3) targetCol = heroCol + 1
		else if (action === 1) targetCol = heroCol + 2
		else if (action === 2) targetCol = heroCol + 3

		// 生成目标列及前方地形
		this.generateTerrainForRange(targetCol, Math.min(targetCol + 6, 31))
		this.generatedMap[2][targetCol] = ELEM_GROUND

		// 记录步骤
		const actionName = getActionName(action)
		const retryInfo = retryCount > 0 ? `(重试${retryCount}次)` : ""
		this.updateHistory(`第${heroCol}列 ${actionName}→第${targetCol}列${retryInfo}`)

		// ========== 动画移动 ==========
		// 1. 相机先移动到能看到主角和新位置的地方
		this.renderer.followHero(heroCol)
		this.renderer.draw(this.generatedMap, heroCol)
		await this.delay(100)

		// 2. 播放行动画（狐狸在视野内移动）
		await this.renderer.playAnimation(actionName)

		// 3. 动画完成后，实际移动狐狸
		this.generatedMap[1][heroCol] = ELEM_AIR
		this.generatedMap[1][targetCol] = ELEM_HERO
		this.currentHeroCol = targetCol

		// 4. 相机跟随到新位置，渲染
		// 如果到达终点附近，让相机能看到终点
		if (this.currentHeroCol >= 25) {
			// 显示最后几列，确保能看到终点
			this.renderer.setCameraPosition(25)
		} else {
			this.renderer.followHero(this.currentHeroCol)
		}
		this.renderer.draw(this.generatedMap, this.currentHeroCol)

		// 5. 等待一下让用户看清新地形
		await this.delay(300)

		// 检查终点
		if (targetCol >= 31) {
			this.generatedMap[2][31] = ELEM_GROUND
			return { success: true, reachedEnd: true }
		}

		return { success: true, reachedEnd: false }
	}

	/**
	 * 创建空地图
	 */
	private createEmptyMap(): number[][] {
		return [
			Array(32).fill(ELEM_AIR),
			Array(32).fill(ELEM_AIR),
			Array(32).fill(ELEM_AIR)
		]
	}

	/**
	 * 生成地形
	 */
	private generateTerrainForRange(startCol: number, endCol: number): void {
		if (!this.generatedMap) return
		const pools = [
			getLayerPool(0, this.terrainConfig),
			getLayerPool(1, this.terrainConfig),
			getLayerPool(2, this.terrainConfig)
		]

		for (let col = startCol; col <= endCol && col < 32; col++) {
			if (this.generatedMap[2][col] === ELEM_AIR) {
				for (let layer = 0; layer < NUM_LAYERS; layer++) {
					if (layer === 2) {
						this.generatedMap[layer][col] = Math.random() < 0.7 ? ELEM_GROUND : ELEM_AIR
					} else {
						this.generatedMap[layer][col] = randElemFromPool(pools[layer])
					}
				}
			}
		}
	}

	/**
	 * 重新生成地形（重试用）
	 */
	private regenerateTerrainForRange(startCol: number, endCol: number): void {
		if (!this.generatedMap) return
		const pools = [
			getLayerPool(0, this.terrainConfig),
			getLayerPool(1, this.terrainConfig),
			getLayerPool(2, this.terrainConfig)
		]

		for (let col = startCol; col <= endCol && col < 32; col++) {
			if (col >= 32) break
			for (let layer = 0; layer < NUM_LAYERS; layer++) {
				if (layer === 2) {
					this.generatedMap[layer][col] = Math.random() < 0.7 ? ELEM_GROUND : ELEM_AIR
				} else {
					this.generatedMap[layer][col] = randElemFromPool(pools[layer])
				}
			}
		}
	}

	/**
	 * 获取视野
	 */
	private getViewport(heroCol: number): number[][] {
		const viewport: number[][] = [[], [], []]
		if (!this.generatedMap) {
			return [
				Array(7).fill(ELEM_AIR),
				[ELEM_HERO, ...Array(6).fill(ELEM_AIR)],
				[ELEM_GROUND, ...Array(6).fill(ELEM_AIR)]
			]
		}

		for (let layer = 0; layer < NUM_LAYERS; layer++) {
			for (let i = 0; i < 7; i++) {
				const mapCol = heroCol + i
				if (mapCol < 32) {
					viewport[layer][i] = this.generatedMap[layer][mapCol]
				} else {
					viewport[layer][i] = ELEM_AIR
				}
			}
		}

		// 确保狐狸在0列
		for (let c = 0; c < 7; c++) {
			if (viewport[1][c] === ELEM_HERO && c !== 0) {
				viewport[1][c] = ELEM_AIR
			}
		}
		viewport[1][0] = ELEM_HERO

		return viewport
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	private updateHistory(text: string): void {
		const historyEl = document.getElementById("generator-history")
		if (!historyEl) return

		this.generationHistory.push(text)
		historyEl.innerHTML = this.generationHistory
			.map(h => `<div style="padding:3px 0;border-bottom:1px solid #2c2f36;font-size:11px;">${h}</div>`)
			.join("")
		historyEl.scrollTop = historyEl.scrollHeight
	}

	private showResult(success: boolean, message: string): void {
		const resultEl = document.getElementById("generator-result")
		if (!resultEl) return

		if (success) {
			resultEl.className = "challenge-result success"
			resultEl.innerHTML = `<b>${message}</b><br><small>地图生成完成，可以手指滑动查看完整地图</small>`
		} else {
			resultEl.className = "challenge-result fail"
			resultEl.innerHTML = `<b>${message}</b>`
		}
	}

	private updateButtonState(isGenerating: boolean): void {
		const startBtn = document.getElementById("btn-generator-start") as HTMLButtonElement
		const stopBtn = document.getElementById("btn-generator-stop") as HTMLButtonElement

		if (startBtn) {
			startBtn.disabled = isGenerating
			startBtn.textContent = isGenerating ? "生成中..." : "开始生成"
		}
		if (stopBtn) {
			stopBtn.disabled = !isGenerating
		}
	}

	private resetDisplay(): void {
		this.renderer.clear()

		const ctx = this.mapCanvas.getContext("2d")
		if (ctx) {
			ctx.fillStyle = "#5f6368"
			ctx.font = "14px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText("点击「开始生成」开始生成 32 格地图", this.mapCanvas.width / 2, this.mapCanvas.height / 2)
		}

		const resultEl = document.getElementById("generator-result")
		if (resultEl) {
			resultEl.className = "challenge-result waiting"
			resultEl.innerHTML = `
				点击「开始生成」开始一步步生成地图<br>
				<small>支持手指滑动查看地图 • 相机会跟随狐狸移动 • 带行动动画</small>
			`
		}

		const historyEl = document.getElementById("generator-history")
		if (historyEl) {
			historyEl.innerHTML = '<div style="color:#5f6368;text-align:center;padding:10px;">等待生成...</div>'
		}

		this.updateButtonState(false)
	}

	onTabActivate(): void {
		if (this.generatedMap) {
			this.renderer.draw(this.generatedMap, this.currentHeroCol)
		}
	}
}
