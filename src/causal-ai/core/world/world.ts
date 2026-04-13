// ========== 游戏世界（兼容层）==========
// 在 MetaGridworld 基础上添加 AI 层所需的 getCurrentState 方法

import { MetaGridworld } from "../../meta-gridworld/world-engine"
import { stateToPredicates } from "../ai/state"
import type { State } from "../ai/types"

export class World extends MetaGridworld {
	getCurrentState(): State {
		const agent = this.getAgentState()
		return stateToPredicates(
			agent.pos,
			agent.facing,
			agent.inventory.includes("钥匙"),
			this.getLocalView()
		)
	}
}
