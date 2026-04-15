import type { Scene, GameState, Action } from "../core/types.ts"

// ========== 生存模式控制台渲染器 ==========

export function clearScreen(): void {
	console.clear()
}

export function renderBanner(): void {
	console.log("╔══════════════════════════════════════╗")
	console.log("║      🏕️  荒野求生 · Roguelike        ║")
	console.log("╚══════════════════════════════════════╝")
	console.log("")
}

function bar(value: number, max = 100, width = 20): string {
	const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)))
	const empty = width - filled
	return "█".repeat(filled) + "░".repeat(empty)
}

export function renderScene(scene: Scene, state: GameState): void {
	console.log(`【${scene.name}】`)
	console.log("")
	console.log(scene.description)
	console.log("")

	const s = state.player.stats
	const hunger = Math.round(s.hunger ?? 0)
	const stamina = Math.round(s.stamina ?? 0)
	const mental = Math.round(s.mental ?? 0)
	const health = state.player.health

	console.log(`─ 状态 ────────────────────────────────`)
	console.log(`  生命 ${bar(health, 100)} ${health}/100`)
	console.log(`  饱食 ${bar(hunger, 100)} ${hunger}/100`)
	console.log(`  体力 ${bar(stamina, 100)} ${stamina}/100`)
	console.log(`  精神 ${bar(mental, 100)} ${mental}/100`)
	console.log("")
}

export function renderActions(actions: Action[]): void {
	if (actions.length === 0) return

	console.log("你选择：")
	actions.forEach((a, idx) => {
		console.log(`  ${idx + 1}. ${a.label}`)
	})
	console.log("")
}

export function renderMessage(text: string): void {
	console.log(`▸ ${text}`)
	console.log("")
}

export function renderGameOver(win: boolean): void {
	console.log("")
	if (win) {
		console.log("🎉 你活下来了！救援已至！")
	}
	else {
		console.log("💀 你倒在了荒野中……")
	}
	console.log("")
}
