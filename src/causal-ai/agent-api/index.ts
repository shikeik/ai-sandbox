// ========== Agent API ==========
// AI 与源格世界的标准交互接口

import { MetaGridworld } from "../meta-gridworld/world-engine"
import type { Action, MapData } from "../meta-gridworld/types"
import { stateToPredicates } from "../core/ai/state"
import type { State } from "../core/ai/types"
import type { Observation, WorldLike } from "./types"

export class AgentAPI implements WorldLike {
	private world: MetaGridworld
	private stepCount = 0

	constructor(worldOrMapData: MetaGridworld | MapData) {
		if (worldOrMapData instanceof MetaGridworld) {
			this.world = worldOrMapData
		} else {
			this.world = new MetaGridworld(worldOrMapData)
		}
	}

	execute(action: Action): { result: import("../meta-gridworld/types").ActionResult; view: import("../meta-gridworld/types").LocalView } {
		return this.world.execute(action)
	}

	step(action: Action): Observation {
		const { result, view } = this.world.execute(action)
		this.stepCount++
		return {
			agent: this.world.getAgentState(),
			localView: view,
			lastResult: result,
			stepCount: this.stepCount
		}
	}

	observe(): Observation {
		return {
			agent: this.world.getAgentState(),
			localView: this.world.getLocalView(),
			lastResult: { success: true, msg: "观察", reward: 0 },
			stepCount: this.stepCount
		}
	}

	reset(mapData: MapData): Observation {
		this.world = new MetaGridworld(mapData)
		this.stepCount = 0
		return this.observe()
	}

	getCurrentState(): State {
		const agent = this.world.getAgentState()
		return stateToPredicates(
			agent.pos,
			agent.facing,
			agent.inventory.includes("钥匙"),
			this.world.getLocalView()
		)
	}

	getAgentState() {
		return this.world.getAgentState()
	}

	getLocalView(range?: number) {
		return this.world.getLocalView(range)
	}

	isTerminated() {
		return this.world.isTerminated()
	}

	// 以下方法仅对需要直接操作世界的高级 Agent 开放
	getWorld() {
		return this.world
	}
}

export type { Observation, WorldLike }
