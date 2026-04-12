// ========== 因果链 AI - 游戏控制器 ==========

import type { ActionType } from "./types"
import { StateManager } from "./state"
import { applyAction } from "./actions"
import { KnowledgeManager } from "./knowledge"
import { Planner } from "./planner"
import { WorldRenderer } from "./renderer"
import { UIManager } from "./ui-manager"
import { WORLD_CONFIG, EXPLORE_CONFIG, PLANNER_CONFIG } from "./config"

// 游戏控制器类
export class GameController {
	private stateManager: StateManager
	private knowledgeManager: KnowledgeManager
	private planner: Planner
	private renderer: WorldRenderer
	private uiManager: UIManager

	constructor(
		canvas: HTMLCanvasElement,
		stateManager: StateManager,
		uiManager: UIManager
	) {
		this.stateManager = stateManager
		this.knowledgeManager = new KnowledgeManager()
		this.planner = new Planner()
		this.renderer = new WorldRenderer(canvas)
		this.uiManager = uiManager

		// 订阅状态变化
		this.stateManager.subscribe(() => this.onStateChanged())

		// 初始渲染
		this.render()
	}

	// 状态变化回调
	private onStateChanged(): void {
		this.render()
		this.updateUI()
	}

	// 执行动作
	executeAction(action: ActionType, record: boolean = true): boolean {
		const before = this.stateManager.getState()
		const after = applyAction(before, action)

		// 检查状态是否变化
		const changed = JSON.stringify(before) !== JSON.stringify(after)

		// 更新状态
		this.stateManager.setState(after)

		if (record) {
			if (changed) {
				this.knowledgeManager.addExperience({ before, action, after })
				this.uiManager.addLog(`📸 记录: ${action}`)
			} else {
				this.uiManager.addLog(`⛔ 无效: ${action}`)
			}
			this.updateCounts()
		}

		return changed
	}

	// 重置游戏
	reset(): void {
		this.stateManager.reset()
		this.uiManager.addLog("🔄 重置")
	}

	// 清空知识
	clearKnowledge(): void {
		this.knowledgeManager.clearAll()
		this.updateCounts()
		this.uiManager.addLog("🧹 已清空")
		this.uiManager.clearPlanLog()
	}

	// 随机探索
	async explore(count: number = EXPLORE_CONFIG.steps): Promise<void> {
		const actions: ActionType[] = [
			"move_up",
			"move_down",
			"move_left",
			"move_right",
			"pickup"
		]

		for (let i = 0; i < count; i++) {
			const action = actions[Math.floor(Math.random() * actions.length)]
			this.executeAction(action, true)
			await sleep(EXPLORE_CONFIG.intervalMs)
		}

		this.uiManager.addLog("🎲 探索完成")
	}

	// 泛化规则
	generalize(): void {
		this.uiManager.clearPlanLog()
		this.uiManager.addPlanLog("🧠 开始泛化 (基于动作语义模板)")

		const rules = this.knowledgeManager.generalize()

		this.uiManager.addPlanLog(`✅ 生成 ${rules.length} 条规则 (基于经验)`)
		this.updateCounts()
	}

	// 规划并执行
	async planAndExecute(): Promise<void> {
		this.uiManager.clearPlanLog()
		this.uiManager.addPlanLog("=== 后向规划开始 ===")

		const startState = this.stateManager.getState()
		this.uiManager.addPlanLog(
			`当前: (${startState.agent.x},${startState.agent.y}) 手持:${startState.holding ?? "无"} 门:${startState.doorOpen ? "开" : "关"}`
		)
		this.uiManager.addPlanLog(`目标: 到达 (${WORLD_CONFIG.flagPos.x},${WORLD_CONFIG.flagPos.y})`)

		const plan = this.planner.plan(startState)

		if (plan.length > 0) {
			this.uiManager.addPlanLog(`✅ ${this.planner.getPlanInfo(startState, plan)}`)
			await this.executePlan(plan)
		} else {
			this.uiManager.addPlanLog("❌ 规划失败。可能经验不足，请多探索并再次泛化。")
		}
	}

	// 执行规划
	private async executePlan(plan: ActionType[]): Promise<void> {
		for (const action of plan) {
			const success = this.executeAction(action, false)
			if (!success) {
				this.uiManager.addLog(`⚠️ 中断: ${action}`)
				break
			}
			await sleep(PLANNER_CONFIG.executionDelayMs)
		}
		this.uiManager.addLog("✅ 执行完毕")
	}

	// 渲染
	private render(): void {
		this.renderer.render(this.stateManager.getState())
	}

	// 更新 UI
	private updateUI(): void {
		this.uiManager.updateStateDisplay(this.stateManager.getState())
	}

	// 更新计数
	private updateCounts(): void {
		this.uiManager.updateCounts(
			this.knowledgeManager.getExperienceCount(),
			this.knowledgeManager.getRuleCount()
		)
		this.uiManager.renderExpList(this.knowledgeManager.getExperiences())
		this.uiManager.renderRuleList(this.knowledgeManager.getRules())
	}
}

// 辅助函数：延迟
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
