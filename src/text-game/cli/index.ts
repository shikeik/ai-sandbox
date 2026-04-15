import { createGameEngine } from "../core/index.ts"
import { demoAdventure } from "../core/demo-adventure.ts"
import type { ActionResult } from "../core/types.ts"
import {
	clearScreen,
	renderBanner,
	renderScene,
	renderActions,
	renderMessage,
	renderGameOver,
} from "./renderer.ts"
import { askQuestion } from "./input.ts"

// ========== CLI 入口 ==========

async function resolveAction(
	engine: ReturnType<typeof createGameEngine>,
	actionId: string
): Promise<ActionResult> {
	const result = engine.act(actionId)

	// 处理需要输入的交互
	if (result.requireInput) {
		const answer = await askQuestion(`${result.requireInput.prompt} > `)
		// 将输入值再次提交给引擎
		return engine.act(actionId, answer)
	}

	return result
}

async function main(): Promise<void> {
	const engine = createGameEngine(
		demoAdventure.scenes,
		demoAdventure.getAvailableActions,
		demoAdventure.handleAction,
		demoAdventure.initialState
	)

	while (true) {
		const state = engine.getState()
		const scene = engine.getCurrentScene()
		const actions = engine.getAvailableActions()

		clearScreen()
		renderBanner()

		// 显示上一条结果（如果有）
		const lastLog = state.log[state.log.length - 1]
		if (lastLog) {
			renderMessage(lastLog)
		}

		renderScene(scene, state)

		if (state.gameOver) {
			renderGameOver(state.win)
			const again = await askQuestion("是否重新开始？(y/n) ")
			if (again.toLowerCase() === "y" || again.toLowerCase() === "yes") {
				engine.reset()
				continue
			}
			console.log("再见！")
			process.exit(0)
		}

		renderActions(actions)

		const answer = await askQuestion("请输入选项编号 > ")
		const choice = parseInt(answer, 10)

		if (isNaN(choice) || choice < 1 || choice > actions.length) {
			renderMessage("无效输入，请重新选择。")
			await askQuestion("按 Enter 继续...")
			continue
		}

		const action = actions[choice - 1]
		await resolveAction(engine, action.id)
	}
}

main().catch(err => {
	console.error("游戏发生错误:", err)
	process.exit(1)
})
