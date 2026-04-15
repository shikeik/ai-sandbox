import type { GameState, Scene, SceneId, ActionResult, Action, ActionProvider, ActionHandler } from "./types.ts"

// ========== 游戏核心逻辑 ==========

export interface GameEngine {
	getState(): GameState
	getCurrentScene(): Scene
	getAvailableActions(): Action[]
	act(actionId: string, inputValue?: string): ActionResult
	reset(): void
}

export function createGameEngine(
	scenes: Map<SceneId, Scene>,
	actionProvider: ActionProvider,
	actionHandler: ActionHandler,
	initialState: GameState
): GameEngine {
	let state: GameState = structuredClone(initialState)

	function getCurrentScene(): Scene {
		const scene = scenes.get(state.currentSceneId)
		if (!scene) {
			throw new Error(`Scene not found: ${state.currentSceneId}`)
		}
		return scene
	}

	function getAvailableActions(): Action[] {
		return actionProvider(state)
	}

	function act(actionId: string, inputValue?: string): ActionResult {
		if (state.gameOver) {
			return { text: "游戏已结束，请重新开始。" }
		}

		const result = actionHandler(state, actionId, inputValue)

		// 应用玩家状态变更
		if (result.playerChange) {
			state = {
				...state,
				player: { ...state.player, ...result.playerChange },
			}
		}

		// 应用世界标记变更
		if (result.worldFlagsChange) {
			state = {
				...state,
				worldFlags: { ...state.worldFlags, ...result.worldFlagsChange },
			}
		}

		// 跳转场景
		if (result.nextSceneId) {
			state.currentSceneId = result.nextSceneId
		}

		// 游戏结束
		if (result.gameOver !== undefined) {
			state.gameOver = result.gameOver
		}
		if (result.win !== undefined) {
			state.win = result.win
		}

		// 记录日志
		state.log.push(result.text)

		return result
	}

	function reset(): void {
		state = structuredClone(initialState)
	}

	function getState(): GameState {
		return state
	}

	return { getState, getCurrentScene, getAvailableActions, act, reset }
}
