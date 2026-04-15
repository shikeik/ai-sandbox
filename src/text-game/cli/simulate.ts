import { createGameEngine } from "../core/index.ts"
import { demoSurvival, getCurrentScene } from "../core/demo-survival.ts"

// ========== 自动化模拟器：批量跑局统计平衡性 ==========

function sleep(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms))
}

async function runGame(showLog = false): Promise<{
	win: boolean
	days: number
	finalHealth: number
	reason: string
}> {
	const engine = createGameEngine(
		demoSurvival.scenes,
		demoSurvival.getAvailableActions,
		demoSurvival.handleAction,
		demoSurvival.initialState
	)

	if (showLog) {
		console.log("\n========== 新游戏开始 ==========\n")
	}

	while (true) {
		const state = engine.getState()
		const actions = engine.getAvailableActions()

		if (state.gameOver) {
			if (showLog) {
				console.log(state.win ? "🎉 胜利" : "💀 死亡")
				console.log(`存活天数: ${state.player.day}`)
				console.log(`最终生命: ${state.player.health}`)
			}
			return {
				win: state.win,
				days: state.player.day,
				finalHealth: state.player.health,
				reason: state.win ? "win" : "death",
			}
		}

		// 随机选择动作
		const action = actions[Math.floor(Math.random() * actions.length)]
		const result = engine.act(action.id)

		if (showLog) {
			const scene = getCurrentScene(state)
			console.log(`【第 ${state.player.day} 天】${scene.name}`)
			console.log(`选择: ${action.label}`)
			console.log(`结果: ${result.text.replace(/\n/g, " ")}`)
			const s = state.player.stats
			console.log(`状态 生命${state.player.health} 饱食${Math.round(s.hunger ?? 0)} 体力${Math.round(s.stamina ?? 0)} 精神${Math.round(s.mental ?? 0)}`)
			console.log("---")
		}
	}
}

async function main(): Promise<void> {
	const total = 200
	let wins = 0
	let deaths = 0
	let totalDays = 0
	const dayDistribution: Record<number, number> = {}

	for (let i = 0; i < total; i++) {
		const result = await runGame(false)
		totalDays += result.days
		dayDistribution[result.days] = (dayDistribution[result.days] || 0) + 1
		if (result.win) wins++
		else deaths++
	}

	console.log(`\n========== ${total} 局模拟结果 ==========`)
	console.log(`胜率: ${wins} / ${total} (${((wins / total) * 100).toFixed(1)}%)`)
	console.log(`死亡率: ${deaths} / ${total} (${((deaths / total) * 100).toFixed(1)}%)`)
	console.log(`平均存活天数: ${(totalDays / total).toFixed(2)}`)
	console.log("\n天数分布:")
	Object.entries(dayDistribution)
		.sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
		.forEach(([day, count]) => {
			console.log(`  第 ${day} 天: ${count} 局 ${"█".repeat(Math.round(count / 2))}`)
		})

	// 再跑一局带日志的，看看实际体验
	console.log("\n========== 示例对局 ==========")
	await runGame(true)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
