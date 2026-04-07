// ========== Kimi 挑战入口（GridWorld 版）==========
// 职责：通过 HTTP API 与 Kimi 进行回合制交互
// 使用 GridWorld 统一渲染，复用 ChallengeController 的地图生成逻辑

import type { AppState } from "./state.js"
import {
	NUM_LAYERS, ELEM_AIR, ELEM_HERO, ELEM_GROUND, DEFAULT_TERRAIN_CONFIG
} from "./constants.js"
import type { TerrainConfig } from "./constants.js"
import { generateTerrainForAction, terrainToIndices } from "./terrain.js"
import { forward } from "./neural-network.js"

// ========== 引入格子世界系统 ==========
import {
	GridWorld,
	DEFAULT_ELEMENTS,
	createGridWorld,
} from "./grid-world/index.js"

// ========== 常量 ==========
const MAP_LENGTH = 32  // 地图总长度
const VIEWPORT_COLS = 11  // 视野窗口宽度（显示更多内容）

// 动作类型
const ACTIONS = ["走", "跳", "远跳", "走A"] as const
type ActionType = typeof ACTIONS[number]

// 动作到列偏移的映射
const ACTION_TO_COL_DELTA: Record<ActionType, number> = {
	"走": 1,
	"跳": 2,
	"远跳": 3,
	"走A": 1,
}

// 动作序号映射（与 Kimi API 对应）
const ACTION_INDEX: Record<ActionType, number> = {
	"走": 0,
	"跳": 1,
	"远跳": 2,
	"走A": 3,
}

export class KimiEntry {
	private state: AppState
	private container: HTMLElement | null = null

	// 格子世界
	private gridWorld: GridWorld

	// 游戏状态
	private fullMap: number[][] | null = null
	private heroCol = 0
	private terrainConfig: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG }
	private isPlaying = false
	private gameLog: Array<{ step: number; action: ActionType; valid: boolean; reason?: string }> = []

	constructor(state: AppState) {
		this.state = state

		// 初始化 GridWorld（32列，宽视野，整体缩小0.7倍）
		this.gridWorld = createGridWorld({
			width: 32,
			height: NUM_LAYERS,
			elements: DEFAULT_ELEMENTS,
			viewportWidth: VIEWPORT_COLS,
			scale: 0.6,
		})
	}

	init(): void {
		this.container = document.getElementById("tab-kimi")
		if (!this.container) return

		// 替换内容为游戏界面
		this.renderLayout()

		// 绑定按钮事件
		this.bindEvents()

		// 初始化游戏
		this.resetGame()

	}

	onTabActivate(): void {
		if (this.fullMap) {
			this.renderViewport()
		}
	}

	// ========== 布局渲染 ==========

	private renderLayout(): void {
		if (!this.container) return

		this.container.innerHTML = `
			<div class="challenge-layout">
				<div class="panel" style="grid-column: 1 / -1;">
					<div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
						<span>🤖 Kimi 挑战 - ${VIEWPORT_COLS}×3 宽视野</span>
						<div style="display:flex;gap:10px;align-items:center;">
							<span style="font-size:11px;color:#9aa0a6;">位置: <span id="kimi-hero-pos">0/31</span></span>
							<span style="font-size:11px;color:#9aa0a6;">步数: <span id="kimi-step-count">0</span></span>
							<button class="btn-primary" id="btn-kimi-reset">重置地图</button>
							<button class="btn-accent" id="btn-kimi-step" disabled>Kimi 决策</button>
							<button class="btn-secondary" id="btn-kimi-auto" disabled>自动运行</button>
						</div>
					</div>

					<!-- ${VIEWPORT_COLS}×3 宽视野画布 -->
					<canvas id="kimi-canvas" style="width:100%;max-width:800px;height:280px;background:#0b0c0f;border-radius:8px;display:block;margin:0 auto;"></canvas>

					<!-- 状态信息 -->
					<div class="challenge-result waiting" id="kimi-status" style="margin-top:10px;">
						点击「重置地图」生成合法 traversable 地图
					</div>

					<!-- 操作日志 -->
					<div id="kimi-log" style="margin-top:10px;max-height:150px;overflow-y:auto;font-family:monospace;font-size:11px;background:#0b0c0f;padding:10px;border-radius:8px;color:#bdc1c6;">
						<div style="color:#5f6368;">等待游戏开始...</div>
					</div>
				</div>
			</div>
		`
	}

	private bindEvents(): void {
		document.getElementById("btn-kimi-reset")?.addEventListener("click", () => this.resetGame())
		document.getElementById("btn-kimi-step")?.addEventListener("click", () => this.kimiStep())
		document.getElementById("btn-kimi-auto")?.addEventListener("click", () => this.toggleAuto())
	}

	// ========== 游戏逻辑 ==========

	/**
	 * 重置游戏 - 生成新地图
	 */
	private resetGame(): void {
		this.heroCol = 0
		this.gameLog = []
		this.isPlaying = false
		this.fullMap = this.generateTraversableMap()

		// 同步到 GridWorld
		this.syncMapToGridWorld()
		this.gridWorld.setHeroCol(0)
		this.gridWorld.followHero(true, 3)  // offset=3，狐狸位于11列视野的左侧1/3处

		this.updateUI()
		this.renderViewport()
		this.updateStatus("地图已生成，点击「Kimi 决策」开始")
		this.updateLog("地图生成完成，狐狸在起点 (0, 中层)", "success")

		// 启用按钮
		const btnStep = document.getElementById("btn-kimi-step") as HTMLButtonElement
		const btnAuto = document.getElementById("btn-kimi-auto") as HTMLButtonElement
		if (btnStep) btnStep.disabled = false
		if (btnAuto) btnAuto.disabled = false
	}

	/**
	 * 生成可通行的 32×3 地图（最佳实践：使用 action-based 生成）
	 */
	private generateTraversableMap(): number[][] {
		// 初始化空地图
		const map: number[][] = [
			Array(MAP_LENGTH).fill(ELEM_AIR),
			Array(MAP_LENGTH).fill(ELEM_AIR),
			Array(MAP_LENGTH).fill(ELEM_AIR),
		]

		// 起点地面
		map[2][0] = ELEM_GROUND

		let heroCol = 0
		const maxAttempts = 100

		while (heroCol < MAP_LENGTH - 1) {
			// 随机选择动作
			const actionIdx = Math.floor(Math.random() * 3) // 0=走, 1=跳, 2=远跳
			
			// 检查是否超出边界
			const delta = actionIdx === 0 ? 1 : actionIdx === 1 ? 2 : 3
			if (heroCol + delta >= MAP_LENGTH) {
				// 超出边界，尝试走路
				if (heroCol + 1 < MAP_LENGTH) {
					// 强制生成走路的地形
					generateTerrainForAction(0, heroCol, this.terrainConfig, map, true)
					heroCol += 1
				} else {
					break
				}
				continue
			}

			// 尝试生成该动作的地形
			let attempts = 0
			let generated: number[][] | null = null
			while (attempts < maxAttempts && !generated) {
				generated = generateTerrainForAction(actionIdx, heroCol, this.terrainConfig, map, true)
				attempts++
			}

			if (generated) {
				heroCol += delta
			} else {
				// 生成失败，尝试走路
				const walkGenerated = generateTerrainForAction(0, heroCol, this.terrainConfig, map, true)
				if (walkGenerated) {
					heroCol += 1
				} else {
					break
				}
			}
		}

		// 确保终点是平地
		map[2][MAP_LENGTH - 1] = ELEM_GROUND

		return map
	}

	/**
	 * 同步地图到 GridWorld（地图不包含狐狸）
	 */
	private syncMapToGridWorld(): void {
		if (!this.fullMap) return

		// 创建副本，移除狐狸（GridWorld 单独管理狐狸位置）
		const gridOnly = this.fullMap.map(row => [...row])
		for (let c = 0; c < MAP_LENGTH; c++) {
			if (gridOnly[1][c] === ELEM_HERO) {
				gridOnly[1][c] = ELEM_AIR
			}
		}

		this.gridWorld.setGrid(gridOnly)
	}

	/**
	 * Kimi 单步决策
	 */
	private async kimiStep(): Promise<void> {
		if (!this.fullMap || this.heroCol >= MAP_LENGTH - 1) {
			this.updateStatus("游戏已结束")
			return
		}

		// 获取当前视野
		const viewport = this.getViewportForKimi()

		// TODO: 调用 Kimi API 获取决策
		// 现在用本地 MLP 网络模拟
		const action = await this.getKimiAction(viewport)

		// 执行动作
		await this.executeAction(action)
	}

	/**
	 * 获取 Kimi 的决策（TODO: 替换为真实 API 调用）
	 */
	private async getKimiAction(viewport: number[][]): Promise<ActionType> {
		// 临时：使用本地网络预测
		if (!this.state.net) {
			// 随机选择合法动作
			const validActions = this.getValidActions()
			if (validActions.length === 0) return "走"
			return validActions[Math.floor(Math.random() * validActions.length)]
		}

		// 使用训练好的网络预测
		const indices = terrainToIndices(viewport)
		const result = forward(this.state.net, indices)
		
		// 找到最大概率的动作
		let maxIdx = 0
		let maxProb = result.o[0]
		for (let i = 1; i < result.o.length; i++) {
			if (result.o[i] > maxProb) {
				maxProb = result.o[i]
				maxIdx = i
			}
		}
		
		return ACTIONS[maxIdx] ?? "走"
	}

	/**
	 * 获取当前合法的 actions
	 */
	private getValidActions(): ActionType[] {
		const valid: ActionType[] = []
		for (const action of ACTIONS) {
			const check = this.gridWorld.checkAction(action as ActionType)
			if (check.ok) {
				valid.push(action)
			}
		}
		return valid
	}

	/**
	 * 执行动作
	 */
	private async executeAction(action: ActionType): Promise<void> {
		const canvas = document.getElementById("kimi-canvas") as HTMLCanvasElement
		if (!canvas) return

		// 检查动作合法性
		const check = this.gridWorld.checkAction(action)

		if (!check.ok) {
			// 非法动作
			this.gameLog.push({
				step: this.gameLog.length + 1,
				action,
				valid: false,
				reason: check.reasons.join("; ")
			})
			this.updateLog(`[非法] ${action}: ${check.reasons.join("; ")}`, "error")
			this.updateStatus(`Kimi 选择了非法动作: ${action}`)
			this.updateUI()
			return
		}

		// 播放动画
		await this.gridWorld.playAction(action, {
			speed: 2,
			onFrame: (progress, slimeKilled) => {
				this.gridWorld.renderAnimation(
					{ canvas },
					action,
					progress,
					slimeKilled
				)
			}
		})

		// 更新位置
		this.heroCol = this.gridWorld.getHeroCol()
		this.gridWorld.followHero(true, 3)  // offset=3，狐狸位于11列视野的左侧1/3处

		// 记录日志
		this.gameLog.push({
			step: this.gameLog.length + 1,
			action,
			valid: true
		})
		this.updateLog(`[成功] ${action} -> 位置 ${this.heroCol}`, "success")

		// 检查是否到达终点
		if (this.heroCol >= MAP_LENGTH - 1) {
			this.updateStatus("🎉 Kimi 成功到达终点！")
			this.updateLog("🎉 游戏胜利！", "success")
			this.isPlaying = false
		} else {
			this.updateStatus(`Kimi 执行了「${action}」，当前位置 ${this.heroCol}`)
		}

		this.updateUI()
		this.renderViewport()
	}

	/**
	 * 获取视野给 Kimi（5×3 网格）
	 */
	private getViewportForKimi(): number[][] {
		return this.gridWorld.getViewport(this.heroCol, VIEWPORT_COLS)
	}

	/**
	 * 自动运行
	 */
	private async toggleAuto(): Promise<void> {
		if (this.isPlaying) {
			this.isPlaying = false
			return
		}

		this.isPlaying = true
		const btnAuto = document.getElementById("btn-kimi-auto") as HTMLButtonElement
		if (btnAuto) btnAuto.textContent = "停止"

		while (this.isPlaying && this.heroCol < MAP_LENGTH - 1) {
			await this.kimiStep()
			await new Promise(r => setTimeout(r, 500))
		}

		this.isPlaying = false
		if (btnAuto) btnAuto.textContent = "自动运行"
	}

	// ========== 渲染 ==========

	private renderViewport(): void {
		const canvas = document.getElementById("kimi-canvas") as HTMLCanvasElement
		if (!canvas) return

		this.gridWorld.render({ canvas })
	}

	// ========== UI 更新 ==========

	private updateUI(): void {
		const posEl = document.getElementById("kimi-hero-pos")
		const stepEl = document.getElementById("kimi-step-count")

		if (posEl) posEl.textContent = `${this.heroCol}/31`
		if (stepEl) stepEl.textContent = String(this.gameLog.length)
	}

	private updateStatus(msg: string): void {
		const el = document.getElementById("kimi-status")
		if (el) el.innerHTML = msg
	}

	private updateLog(msg: string, type: "success" | "error" | "info" = "info") {
		const logEl = document.getElementById("kimi-log")
		if (!logEl) return

		const color = type === "success" ? "#34a853" : type === "error" ? "#ea4335" : "#9aa0a6"
		const entry = document.createElement("div")
		entry.style.color = color
		entry.textContent = `[${this.gameLog.length}] ${msg}`
		logEl.appendChild(entry)
		logEl.scrollTop = logEl.scrollHeight
	}
}
