import { createGameEngine } from "../core/index.ts"
import { demoSurvival, getCurrentScene } from "../core/demo-survival.ts"

// ========== 智能策略模拟器：按规则优先选最优动作 ==========

function chooseSmartAction(actions: { id: string; label: string }[]): string {
	const ids = actions.map(a => a.id)
	const pick = (id: string) => id

	// 简单优先级表
	const priority: Record<string, number> = {
		// 觅食
		set_trap: 10,
		eat_berries: 5,
		skip_food: 1,
		// 夜中的呜咽
		make_fire: 10,
		hide_tent: 6,
		check_sound: 3,
		// 野兽夜袭
		play_dead: 8,
		climb_tree: 7,
		fight_bear: 2,
		// 废弃小屋
		search_hut: 8,
		leave_hut: 4,
		// 暴雨
		fix_tent: 8,
		curl_up: 5,
		collect_water: 2,
		// 直升机
		signal_fire: 100,
		shout_help: 4,
		chase_heli: 1,
		// 遇难者
		loot_body: 8,
		bury_body: 6,
		walk_away: 3,
	}

	const sorted = [...actions].sort((a, b) => (priority[b.id] ?? 0) - (priority[a.id] ?? 0))
	return sorted[0].id
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
		console.log("\n========== 新游戏开始（智能策略） ==========\n")
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

		const actionId = chooseSmartAction(actions)
		const action = actions.find(a => a.id === actionId)!
		const result = engine.act(actionId)

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
	const deathReasons: Record<string, number> = {}

	for (let i = 0; i < total; i++) {
		const result = await runGame(false)
		totalDays += result.days
		if (result.win) wins++
		else deaths++
		deathReasons[result.reason] = (deathReasons[result.reason] || 0) + 1
	}

	console.log(`\n========== 智能策略 ${total} 局模拟结果 ==========`)
	console.log(`胜率: ${wins} / ${total} (${((wins / total) * 100).toFixed(1)}%)`)
	console.log(`死亡率: ${deaths} / ${total} (${((deaths / total) * 100).toFixed(1)}%)`)
	console.log(`平均存活天数: ${(totalDays / total).toFixed(2)}`)

	console.log("\n========== 示例对局 ==========")
	await runGame(true)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
