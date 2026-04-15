import { createGameEngine } from "../core/index.ts"
import { demoSurvival, getCurrentScene } from "../core/demo-survival.ts"

const engine = createGameEngine(
	demoSurvival.scenes,
	demoSurvival.getAvailableActions,
	demoSurvival.handleAction,
	{ ...demoSurvival.initialState, worldFlags: { event_id: "beast_attack" } }
)

const stateBefore = engine.getState()
console.log("stateBefore ref:", stateBefore === engine.getState())
console.log("statsBefore:", stateBefore.player.stats)

const result = engine.act("play_dead")

const stateAfter = engine.getState()
console.log("stateAfter ref same as before?", stateAfter === stateBefore)
console.log("statsAfter:", stateAfter.player.stats)
console.log("statsBefore (old ref):", stateBefore.player.stats)
console.log("result text:", result.text)
