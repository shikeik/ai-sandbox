// ========== 地图生成器入口类（重构版）==========
// 职责：用规则验证函数一步步生成 32 格合法地图
// 使用 GridWorldSystem 统一处理渲染、相机、动画

import type { AppState } from "@/terrain-lab/state.js"
import {
	ELEM_AIR, ELEM_HERO, ELEM_GROUND,
	CURRICULUM_STAGES, NUM_LAYERS
} from "@/terrain-lab/constants.js"
import type { TerrainConfig } from "@/terrain-lab/constants.js"
import { getLabel, getActionName, generateTerrainForAction } from "@/terrain-lab/terrain.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 引入格子世界系统 ==========

import {
	GridWorld,
	DEFAULT_ELEMENTS,
	createGridWorld,
} from "./grid-world/index.js"

export class MapGeneratorEntry {
	private state: AppState
	private terrainConfig: TerrainConfig = { ...CURRICULUM_STAGES[4].config }
	private mapCanvas: HTMLCanvasElement
	private logger: Logger

	// ========== 格子世界系统 ==========
	private gridWorld: GridWorld

	// 生成状态
	private isGenerating = false
	private shouldStop = false
	private currentHeroCol = 0
	private generatedMap: number[][] | null = null
	private generationHistory: string[] = []

	constructor(state: AppState) {
		this.state = state
		this.mapCanvas = document.getElementById("generator-canvas") as HTMLCanvasElement
		this.logger = new Logger("MAP-GENERATOR")

		console.log("MapGeneratorEntry 初始化开始")

		// 初始化格子世界（32列，7列视野，启用相机跟随）
		this.gridWorld = createGridWorld({
			width: 32,
			height: NUM_LAYERS,
			elements: DEFAULT_ELEMENTS,
			viewportWidth: 7,
		})
		console.log("格子世界初始化完成 | 32x3, viewport=7")
	}

	init(): void {
		console.log("init() 开始")
		this.setupEventListeners()
		this.bindGlobalFunctions()
		this.resetDisplay()
		console.log("init() 完成")
	}

	private setupEventListeners(): void {
		const stageSelect = document.getElementById("generator-stage-select") as HTMLSelectElement
		if (stageSelect) {
			stageSelect.addEventListener("change", () => {
				const idx = Number(stageSelect.value)
				this.terrainConfig = { ...CURRICULUM_STAGES[idx].config }
				console.log(`阶段切换 | idx=${idx}, config=${JSON.stringify(this.terrainConfig)}`)
			})
		}

		// ResizeObserver - 使用 requestAnimationFrame 避免循环
		const ro = new ResizeObserver(() => {
			requestAnimationFrame(() => {
				if (this.generatedMap) {
					console.log("画布尺寸变化，重新渲染")
					this.gridWorld.render({
						canvas: this.mapCanvas,
						showLayerLabels: true,
						showColLabels: true,
					})
				}
			})
		})
		ro.observe(this.mapCanvas)
	}

	private bindGlobalFunctions(): void {
		;(window as any).startGeneration = () => this.startGeneration()
		;(window as any).stopGeneration = () => this.stopGeneration()
		;(window as any).stepGeneration = () => this.stepGeneration()
	}

	/**
	 * 开始动画生成
	 */
	async startGeneration(): Promise<void> {
		if (this.isGenerating) {
			console.log("生成已在进行中，忽略请求")
			return
		}

		console.log("开始生成地图")
		this.isGenerating = true
		this.shouldStop = false
		this.updateButtonState(true)

		// 初始化地图
		this.generatedMap = this.createEmptyMap()
		this.currentHeroCol = 0
		this.generationHistory = []

		// 设置起点（层索引：0=天上, 1=地上, 2=地面）
		this.generatedMap[2][0] = ELEM_GROUND  // 狐狸脚下是平地
		console.log("地图初始化完成 | 起点第0列")

		// 同步到 GridWorld
		this.gridWorld.setGrid(this.generatedMap)
		this.gridWorld.setHeroCol(0)
		this.gridWorld.setCameraCol(0)

		// 初始渲染
		this.gridWorld.render({
			canvas: this.mapCanvas,
			showLayerLabels: true,
			showColLabels: true,
		})
		this.updateHistory("起点：第0列")

		// 等待一下让用户看到起点
		await this.delay(500)

		// 一步步生成
		let success = false
		while (this.currentHeroCol < 31 && !this.shouldStop) {
			const result = await this.generateNextStep()
			if (!result) {
				console.log("生成中断")
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
			console.log(`地图生成成功 | 共${this.generationHistory.length}步`)
			this.showResult(true, `✅ 地图生成成功！共${this.generationHistory.length}步`)
			// 最后渲染一次 - 显示包含终点的视野
			if (this.generatedMap) {
				this.gridWorld.setCameraCol(25)
				this.gridWorld.render({
					canvas: this.mapCanvas,
					showLayerLabels: true,
					showColLabels: true,
				})
			}
		} else if (this.shouldStop) {
			console.log("生成被用户停止")
			this.showResult(false, "⏹️ 生成已停止")
		}
	}

	stopGeneration(): void {
		console.log("用户请求停止生成")
		this.shouldStop = true
	}

	/**
	 * 单步生成（供外部调用）
	 */
	async stepGeneration(): Promise<void> {
		if (this.isGenerating) {
			console.log("正在连续生成中，忽略单步请求")
			return
		}

		if (!this.generatedMap) {
			// 首次单步，初始化
			console.log("单步模式初始化")
			this.generatedMap = this.createEmptyMap()
			this.currentHeroCol = 0
			this.generationHistory = []

			this.generatedMap[2][0] = ELEM_GROUND

			// 同步到 GridWorld
			this.gridWorld.setGrid(this.generatedMap)
			this.gridWorld.setHeroCol(0)
			this.gridWorld.setCameraCol(0)

			this.gridWorld.render({
				canvas: this.mapCanvas,
				showLayerLabels: true,
				showColLabels: true,
			})
			this.updateHistory("起点：第0列")
			return
		}

		if (this.currentHeroCol >= 31) {
			console.log("已到达终点")
			this.showResult(true, `✅ 已到达终点！共${this.generationHistory.length}步`)
			return
		}

		const result = await this.generateNextStep(true)
		if (result?.reachedEnd) {
			console.log("单步到达终点")
			this.showResult(true, `✅ 地图生成完成！共${this.generationHistory.length}步`)
		}
	}

	/**
	 * 生成下一步
	 * 新逻辑：先随机选动作，再为这个动作生成地形（零失败）
	 * 使用 existingMap 参数在同一张地图上累积生成
	 * 注意：狐狸是"幽灵行动"，不会实际影响地图（不会击杀史莱姆/金币）
	 */
	private async generateNextStep(isSingleStep = false): Promise<{ success: boolean; reachedEnd: boolean } | null> {
		if (!this.generatedMap || this.shouldStop) {
			console.log("生成条件不满足，退出")
			return null
		}

		const heroCol = this.currentHeroCol

		// 随机选一个动作（0=走, 1=跳, 2=远跳, 3=走A）
		let action = Math.floor(Math.random() * 4)
		if (action === 3 && !this.terrainConfig.slime) {
			action = 0 // 降级为走
		}
		console.log(`随机选择动作 | action=${action}`)

		// 使用 existingMap 参数在同一张地图上直接生成（minimal=true 单步模式）
		const result = generateTerrainForAction(action, heroCol, this.terrainConfig, this.generatedMap, true)
		if (!result) {
			console.error(`生成失败 | action=${action}, col=${heroCol}`)
			this.updateHistory(`第${heroCol}列：生成失败`)
			return { success: false, reachedEnd: false }
		}

		// 计算目标列
		let targetCol = heroCol
		if (action === 0 || action === 3) targetCol = heroCol + 1
		else if (action === 1) targetCol = heroCol + 2
		else if (action === 2) targetCol = heroCol + 3

		// 记录步骤
		const actionName = getActionName(action)
		this.updateHistory(`第${heroCol}列 ${actionName}→第${targetCol}列`)
		console.log(`生成步骤 | ${actionName}: ${heroCol} -> ${targetCol}`)

		// ========== 动画移动 ==========
		// 1. 渲染当前状态
		this.gridWorld.setGrid(this.generatedMap)
		this.gridWorld.setHeroCol(heroCol)
		this.gridWorld.followHero(true)
		this.gridWorld.render({
			canvas: this.mapCanvas,
			showLayerLabels: true,
			showColLabels: true,
		})
		await this.delay(isSingleStep ? 50 : 100)

		// 2. 播放行动画（狐狸在视野内移动）
		console.log(`播放行动画 | ${actionName}`)
		await this.gridWorld.playAction(actionName as import("./types.js").ActionType, {
			onFrame: (progress, slimeKilled) => {
				this.gridWorld.renderAnimation(
					{ canvas: this.mapCanvas },
					actionName as import("./types.js").ActionType,
					progress,
					slimeKilled
				)
			}
		})

		// 3. 动画完成后，更新狐狸位置（狐狸只是基于坐标的动画，不在地图上）
		this.currentHeroCol = targetCol
		this.gridWorld.setHeroCol(targetCol)

		// 4. 渲染新位置
		this.gridWorld.followHero(true)
		this.gridWorld.render({
			canvas: this.mapCanvas,
			showLayerLabels: true,
			showColLabels: true,
		})

		// 5. 等待一下让用户看清新地形
		await this.delay(isSingleStep ? 150 : 300)

		// 检查终点
		if (targetCol >= 31) {
			console.log("到达终点")
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
		const stepBtn = document.getElementById("btn-generator-step") as HTMLButtonElement
		const stopBtn = document.getElementById("btn-generator-stop") as HTMLButtonElement

		if (startBtn) {
			startBtn.disabled = isGenerating
			startBtn.textContent = isGenerating ? "生成中..." : "开始生成"
		}
		if (stepBtn) {
			stepBtn.disabled = isGenerating
		}
		if (stopBtn) {
			stopBtn.disabled = !isGenerating
		}
	}

	private resetDisplay(): void {
		console.log("重置显示")
		this.gridWorld.clear(this.mapCanvas, "点击「开始生成」开始生成 32 格地图")

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
			historyEl.innerHTML = "<div style=\"color:#5f6368;text-align:center;padding:10px;\">等待生成...</div>"
		}

		this.updateButtonState(false)
	}

	onTabActivate(): void {
		console.log("Tab 激活")
		if (this.generatedMap) {
			this.gridWorld.setGrid(this.generatedMap)
			this.gridWorld.setHeroCol(this.currentHeroCol)
			this.gridWorld.render({
				canvas: this.mapCanvas,
				showLayerLabels: true,
				showColLabels: true,
			})
		}
	}
}
