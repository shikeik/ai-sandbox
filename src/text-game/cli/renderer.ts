import type { Scene, GameState, Action } from "../core/types.ts"

// ========== 控制台渲染器 ==========

export function clearScreen(): void {
	console.clear()
}

export function renderBanner(): void {
	console.log("╔══════════════════════════════════════╗")
	console.log("║        🧩 文字解谜游戏 v0.1          ║")
	console.log("╚══════════════════════════════════════╝")
	console.log("")
}

export function renderScene(scene: Scene, state: GameState): void {
	console.log(`【${scene.name}】`)
	console.log("")
	console.log(scene.description)
	console.log("")

	// 玩家状态栏
	const items = state.player.items.length > 0 ? state.player.items.join(", ") : "无"
	console.log(`─ 生命 ${state.player.health}/${state.player.maxHealth} │ 物品 [${items}] ─`)

	// 笔记栏
	if (state.player.notes.length > 0) {
		console.log(`─ 笔记 ─`)
		state.player.notes.forEach(note => {
			console.log(`  • ${note}`)
		})
	}
	console.log("")
}

export function renderActions(actions: Action[]): void {
	if (actions.length === 0) return

	console.log("你可以：")
	actions.forEach((a, idx) => {
		const hint = a.hint ? ` — ${a.hint}` : ""
		console.log(`  ${idx + 1}. ${a.label}${hint}`)
	})
	console.log("")
}

export function renderMessage(text: string): void {
	console.log(`> ${text}`)
	console.log("")
}

export function renderGameOver(win: boolean): void {
	console.log("")
	if (win) {
		console.log("🎉 恭喜通关！")
	}
	else {
		console.log("💀 游戏结束。")
	}
	console.log("")
}
