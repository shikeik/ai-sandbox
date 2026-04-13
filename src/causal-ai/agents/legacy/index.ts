// ========== Legacy Agent ==========
// 基于 d1-d8 的因果链 AI，通过 AgentAPI 与源格世界交互

import type { Action } from "../../meta-gridworld/types"
import { AgentAPI } from "../../agent-api"
import type { MapData } from "../../meta-gridworld/types"
import { ExperienceDB, RuleDB } from "../../core/ai/learner"
import { executeCommand, type CommandContext } from "../../core/ai/command-executor"

export class LegacyAgent {
	private api: AgentAPI
	public readonly expDB: ExperienceDB
	public readonly ruleDB: RuleDB
	private plannedActions: Action[] = []

	constructor(
		worldOrMapData: import("../../meta-gridworld/world-engine").MetaGridworld | MapData,
		expDB?: ExperienceDB,
		ruleDB?: RuleDB
	) {
		this.api = new AgentAPI(worldOrMapData)
		this.expDB = expDB ?? new ExperienceDB()
		this.ruleDB = ruleDB ?? new RuleDB()
	}

	/**
	 * 执行单条 CLI 风格指令
	 */
	runCommand(cmd: string, callbacks?: {
		onSwitchMap?: (mapId: string) => void
		onPlanUpdate?: (plan: Action[]) => void
	}): ReturnType<typeof executeCommand> {
		const ctx: CommandContext = {
			world: this.api,
			expDB: this.expDB,
			ruleDB: this.ruleDB,
			getPlanLength: () => this.plannedActions.length,
			getPlanSnapshot: () => [...this.plannedActions],
			setPlan: (actions) => {
				this.plannedActions = [...actions]
			},
			clearPlan: () => {
				this.plannedActions = []
			},
			shiftPlan: () => {
				return this.plannedActions.shift() ?? null
			},
			onSwitchMap: callbacks?.onSwitchMap,
			onPlanUpdate: callbacks?.onPlanUpdate
		}

		return executeCommand(ctx, cmd)
	}

	getPlanSnapshot(): Action[] {
		return [...this.plannedActions]
	}

	clearPlan(): void {
		this.plannedActions = []
	}

	reset(mapData: MapData): void {
		this.api.reset(mapData)
		this.plannedActions = []
	}

	// 暴露底层 API 以供高级场景使用
	getAPI(): AgentAPI {
		return this.api
	}
}
