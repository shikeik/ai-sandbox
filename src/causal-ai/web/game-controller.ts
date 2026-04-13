// ========== 因果链 AI Web 版 - 游戏控制器 ==========
// 基于 core 模块的谓词表示和 AI 系统

import type { ActionType, MapData } from "./types"
import type { State, Rule } from "../core"
import { 
	World, 
	ExperienceDB, 
	RuleDB, 
	plan,
	stateToPredicates,
	stateToString,
	executeWithLearning,
	executeOnly
} from "../core"
import { WorldRenderer } from "./renderer"
import { UIManager } from "./ui-manager"

// 游戏控制器类
export class GameController {
	private world: World | null = null
	public expDB: ExperienceDB
	public ruleDB: RuleDB
	private renderer: WorldRenderer
	private uiManager: UIManager
	
	// 当前地图
	private currentMap: MapData | null = null
	
	// 计划的动作序列（公开给指令执行器使用）
	public plannedActions: ActionType[] = []

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
		this.plannedActions = []
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
	executeAction(action: ActionType, record: boolean = true): boolean {
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
			this.plannedActions = []
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
		this.plannedActions = []
		this.updateCounts()
		this.uiManager.addLog("🧹 已清空知识库")
	}

	// 随机探索
	async explore(count: number = 10): Promise<void> {
		const actions: ActionType[] = ["上", "下", "左", "右", "互", "等"]

		for (let i = 0; i < count; i++) {
			const action = actions[Math.floor(Math.random() * actions.length)]
			this.executeAction(action, true)
			await sleep(100)
		}

		this.uiManager.addLog("🎲 探索完成")
	}

	// 规划到目标
	planTo(goalInput: string): void {
		if (!this.world) {
			this.uiManager.addLog("❌ 未加载地图")
			return
		}

		this.uiManager.clearPlanLog()
		this.uiManager.addPlanLog("=== 规划开始 ===")

		// 解析目标
		const goal = this.parseGoal(goalInput)
		if (!goal) {
			this.uiManager.addPlanLog("❌ 无法解析目标")
			return
		}

		// 获取当前状态
		const agent = this.world.getAgentState()
		const view = this.world.getLocalView()
		const currentState = stateToPredicates(agent.pos, agent.facing, agent.inventory.includes("钥匙"), view)

		// 输出当前状态详情
		this.uiManager.addPlanLog("")
		this.uiManager.addPlanLog("【当前状态】")
		for (const pred of Array.from(currentState).sort()) {
			this.uiManager.addPlanLog(`  ${pred}`)
		}

		// 输出目标
		this.uiManager.addPlanLog("")
		this.uiManager.addPlanLog("【目标状态】")
		for (const pred of Array.from(goal).sort()) {
			this.uiManager.addPlanLog(`  ${pred}`)
		}

		// 获取规则
		const rules = this.ruleDB.getAll()
		this.uiManager.addPlanLog("")
		this.uiManager.addPlanLog(`【知识库】 ${rules.length} 条规则`)
		
		if (rules.length === 0) {
			this.uiManager.addPlanLog("❌ 规则库为空")
			this.uiManager.addPlanLog("💡 请先执行 '学 上/下/左/右/互' 积累经验和规则")
			return
		}

		// 输出每条规则的适用性检查
		this.uiManager.addPlanLog("")
		this.uiManager.addPlanLog("【规则检查】")
		let applicableCount = 0
		for (const rule of rules) {
			const canApply = this.checkRuleApplicable(currentState, rule)
			const status = canApply ? "✅" : "⛔"
			const preStr = Array.from(rule.preconditions).join(", ") || "无前提"
			const addStr = Array.from(rule.effects.add).join(", ") || "无添加"
			this.uiManager.addPlanLog(`  ${status} ${rule.action}: ${preStr} → ${addStr}`)
			if (canApply) applicableCount++
		}
		this.uiManager.addPlanLog(`  当前可应用: ${applicableCount}/${rules.length} 条`)

		// 执行规划
		this.uiManager.addPlanLog("")
		this.uiManager.addPlanLog("【规划搜索】")
		const result = plan(currentState, goal, rules, 100)

		if (result.success && result.plan) {
			this.plannedActions = result.plan
			this.uiManager.addPlanLog(`✅ ${result.msg}`)
			this.uiManager.addPlanLog("")
			this.uiManager.addPlanLog("【执行计划】")
			for (let i = 0; i < result.plan.length; i++) {
				this.uiManager.addPlanLog(`  ${i + 1}. ${result.plan[i]}`)
			}
			this.uiManager.addPlanLog("")
			this.uiManager.addPlanLog("💡 输入 '执' 执行下一步")
		} else {
			this.plannedActions = []
			this.uiManager.addPlanLog(`❌ ${result.msg}`)
			this.uiManager.addPlanLog("")
			this.uiManager.addPlanLog("【失败分析】")
			this.uiManager.addPlanLog("可能原因:")
			this.uiManager.addPlanLog("  1. 缺少到达目标位置的经验")
			this.uiManager.addPlanLog("  2. 路径被阻挡（门未开/有墙）")
			this.uiManager.addPlanLog("  3. 需要先获取钥匙才能通过门")
			this.uiManager.addPlanLog("")
			this.uiManager.addPlanLog("💡 尝试执行 '学 右' 移动到目标位置，再规划回来")
		}
	}

	// 执行计划的下一步
	executePlannedStep(): boolean {
		if (this.plannedActions.length === 0) {
			this.uiManager.addLog("❌ 没有待执行的计划")
			return false
		}

		const action = this.plannedActions.shift()!
		this.uiManager.addLog(`▶️ 执行: ${action} (剩余 ${this.plannedActions.length} 步)`)
		return this.executeAction(action, false)
	}

	// 获取计划长度
	getPlanLength(): number {
		return this.plannedActions.length
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
			const agent = this.world.getAgentState() as import("./types").AgentState
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
		const moveActions = ["上", "下", "左", "右"]
		
		if (moveActions.includes(rule.action)) {
			let currentPos: string | null = null
			for (const p of state) {
				if (p.startsWith("at(agent,")) {
					currentPos = p
					break
				}
			}
			if (!currentPos) return false
			
			const match = currentPos.match(/at\(agent,(-?\d+),(-?\d+)\)/)
			if (!match) return false
			const [_, x, y] = match
			const cx = Number(x), cy = Number(y)
			
			let tx = cx, ty = cy
			switch (rule.action) {
			case "上": ty = cy - 1; break
			case "下": ty = cy + 1; break
			case "左": tx = cx - 1; break
			case "右": tx = cx + 1; break
			}
			
			return state.has(`cell_empty(${tx},${ty})`)
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
