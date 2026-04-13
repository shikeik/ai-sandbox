// ========== 因果链 AI Web 版 - 游戏控制器 ==========
// 基于 core 模块的谓词表示和 AI 系统

import type { Action, MapData } from "./types"
import type { State, Rule } from "../core"
import { 
	World, 
	ExperienceDB, 
	RuleDB, 
	plan,
	executeWithLearning,
	executeOnly
} from "../core"
import { WorldRenderer } from "./renderer"
import { UIManager } from "./ui-manager"
import { isMoveAction, getAgentPos, applyDirection } from "../core/utils/position"
import { PLANNER_MAX_DEPTH, EXPLORE_DEFAULT_COUNT, EXPLORE_STEP_DELAY_MS } from "../core/constants"
import { generatePlanReport } from "./plan-reporter"
import type { AgentState } from "./types"

// 游戏控制器类
export class GameController {
	private world: World | null = null
	public expDB: ExperienceDB
	public ruleDB: RuleDB
	private renderer: WorldRenderer
	private uiManager: UIManager
	
	// 当前地图
	private currentMap: MapData | null = null
	
	// 计划的动作序列
	private plannedActions: Action[] = []

	constructor(
		containerId: string,
		uiManager: UIManager
	) {
		this.expDB = new ExperienceDB()
		this.ruleDB = new RuleDB()
		this.renderer = new WorldRenderer(containerId)
		this.uiManager = uiManager
		
		// 初始状态显示
		this.updateUI()
	}

	// 加载地图
	loadMap(mapData: MapData): void {
		this.currentMap = mapData
		this.world = new World(mapData)
		this.clearPlan()
		this.render()
		this.updateUI()
		this.uiManager.addLog(`🗺️ 加载地图: ${mapData.name}`)
	}

	// 获取世界实例
	getWorld(): World | null {
		return this.world
	}

	// 获取当前地图
	getCurrentMap(): MapData | null {
		return this.currentMap
	}

	// 获取当前地图名称
	getCurrentMapName(): string {
		return this.currentMap?.name ?? "未加载"
	}

	// 执行动作
	executeAction(action: Action, record: boolean = true): boolean {
		if (!this.world) {
			this.uiManager.addLog("❌ 未加载地图")
			return false
		}

		if (record) {
			// 使用统一的执行器（自动记录经验）
			const result = executeWithLearning(
				{ world: this.world, expDB: this.expDB, ruleDB: this.ruleDB },
				action
			)

			if (result.success) {
				this.uiManager.addLog(`📸 记录: ${action} - ${result.msg}`)
			} else {
				this.uiManager.addLog(`⛔ 无效: ${action} - ${result.msg}`)
			}
			this.updateCounts()

			this.render()
			this.updateUI()
			
			if (result.terminate) {
				this.uiManager.addLog("🎉 游戏通关！")
			}

			return result.success
		} else {
			// 仅执行不记录（用于执行规划）
			const result = executeOnly(this.world, action)
			
			this.render()
			this.updateUI()
			
			if (result.terminate) {
				this.uiManager.addLog("🎉 游戏通关！")
			}

			return result.success
		}
	}

	// 重置游戏（完全重置关卡状态）
	reset(): void {
		if (this.currentMap) {
			// 1. 重置世界状态（重新创建 World 实例）
			this.world = new World(this.currentMap)
			// 2. 清空计划队列
			this.clearPlan()
			// 3. 清空所有日志
			this.uiManager.clearLog()
			this.uiManager.clearPlanLog()
			// 4. 重置视野模式为局部
			this.renderer.setViewMode("local")
			// 5. 重新渲染
			this.render()
			this.updateUI()
			// 6. 更新地图名称显示
			this.uiManager.updateMapName(this.currentMap.name)
			// 7. 添加重置日志
			this.uiManager.addLog("🔄 已重置关卡")
		}
	}

	// 清空知识
	clearKnowledge(): void {
		this.expDB.clear()
		this.ruleDB.clear()
		this.clearPlan()
		this.updateCounts()
		this.uiManager.addLog("🧹 已清空知识库")
	}

	// 随机探索
	async explore(count: number = EXPLORE_DEFAULT_COUNT): Promise<void> {
		const actions: Action[] = ["上", "下", "左", "右", "互", "等"]

		for (let i = 0; i < count; i++) {
			const action = actions[Math.floor(Math.random() * actions.length)]
			this.executeAction(action, true)
			await sleep(EXPLORE_STEP_DELAY_MS)
		}

		this.uiManager.addLog("🎲 探索完成")
	}

	// 规划到目标
	planTo(goalInput: string): void {
		if (!this.world) {
			this.uiManager.addLog("❌ 未加载地图")
			return
		}

		// 解析目标
		const goal = this.parseGoal(goalInput)
		if (!goal) {
			this.uiManager.clearPlanLog()
			this.uiManager.addPlanLog("❌ 无法解析目标")
			return
		}

		const currentState = this.world.getCurrentState()
		const rules = this.ruleDB.getAll()
		const result = plan(currentState, goal, rules, PLANNER_MAX_DEPTH)

		if (result.success && result.plan) {
			this.setPlan(result.plan)
		}

		const report = generatePlanReport({
			currentState,
			goal,
			rules,
			planResult: result,
			checkRuleApplicable: (state, rule) => this.checkRuleApplicable(state, rule)
		})

		this.uiManager.clearPlanLog()
		for (const line of report) {
			this.uiManager.addPlanLog(line)
		}
	}

	// 设置计划
	setPlan(actions: Action[]): void {
		this.plannedActions = [...actions]
	}

	// 清空计划
	clearPlan(): void {
		this.plannedActions = []
	}

	// 执行计划的下一步
	executePlannedStep(): boolean {
		const action = this.shiftPlan()
		if (!action) {
			this.uiManager.addLog("❌ 没有待执行的计划")
			return false
		}

		this.uiManager.addLog(`▶️ 执行: ${action} (剩余 ${this.getPlanLength()} 步)`)
		return this.executeAction(action, false)
	}

	// 取出计划下一步
	shiftPlan(): Action | null {
		return this.plannedActions.shift() || null
	}

	// 获取计划长度
	getPlanLength(): number {
		return this.plannedActions.length
	}

	// 获取计划快照（不修改计划）
	getPlanSnapshot(): Action[] {
		return [...this.plannedActions]
	}

	// 渲染
	private render(): void {
		if (this.world) {
			const agent = this.world.getAgentState()
			// 始终使用全局视野，相机系统会处理视野裁剪
			const view = this.world.getGlobalView()
			this.renderer.render(view, agent.pos, agent.facing)
		}
	}

	// 强制渲染（供外部调用）
	forceRender(): void {
		this.render()
	}

	// 强制更新 UI（供外部调用）
	forceUpdateUI(): void {
		this.updateUI()
	}

	// 切换视野模式
	toggleViewMode(): "local" | "global" {
		const mode = this.renderer.toggleViewMode()
		this.render()
		return mode
	}

	// 设置视野模式
	setViewMode(mode: "local" | "global"): void {
		this.renderer.setViewMode(mode)
		this.render()
	}

	// 获取当前视野模式
	getViewMode(): "local" | "global" {
		return this.renderer.getViewMode()
	}

	// 更新 UI
	private updateUI(): void {
		if (this.world) {
			const agent = this.world.getAgentState() as AgentState
			this.uiManager.updateStateDisplay(agent)
		}
	}

	// 更新计数
	private updateCounts(): void {
		this.uiManager.updateCounts(
			this.expDB.getAll().length,
			this.ruleDB.getAll().length
		)
		this.uiManager.renderExpList(this.expDB.getAll())
		this.uiManager.renderRuleList(this.ruleDB.getAll())
	}

	// 解析目标（谓词格式）
	private parseGoal(input: string): State | null {
		const predicates = new Set<string>()

		// 直接解析谓词，如 "at(agent,3,0)"
		if (input.includes("(")) {
			predicates.add(input.trim())
			return predicates
		}

		return null
	}

	// 检查规则是否可应用（用于调试输出）
	private checkRuleApplicable(state: State, rule: Rule): boolean {
		if (isMoveAction(rule.action)) {
			const pos = getAgentPos(state)
			if (!pos) return false
			const target = applyDirection(pos, rule.action)
			return state.has(`cell_empty(${target.x},${target.y})`)
		}

		for (const pre of rule.preconditions) {
			if (!state.has(pre)) {
				return false
			}
		}
		return true
	}
}

// 辅助函数：延迟
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
