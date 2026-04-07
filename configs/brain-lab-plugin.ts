// ========== Brain Lab API 插件 ==========

import type { ViteDevServer } from "vite"
import type { GameWorld } from "../src/brain-lab/core/game-world.js"
import type { WorldState, AnimationEvent } from "../src/brain-lab/types/index.js"
import { setAssertLevel, setAssertStopOnFail } from "../src/engine/utils/assert.js"

// 启用断言（API 服务器端）
setAssertLevel("verbose")
setAssertStopOnFail(true)

// 游戏实例
class GameInstance {
	world: GameWorld | null = null
	stepCount: number = 0
	World: typeof GameWorld | null = null

	async init() {
		const { GameWorld } = await import("../src/brain-lab/core/index.js")
		this.World = GameWorld
		await this.reset()
	}

	async reset() {
		const { getCurrentLevel } = await import("../src/brain-lab/core/index.js")
		const level = getCurrentLevel()
		const height = level.map.length
		const width = height > 0 ? level.map[0].length : 0

		this.world = new this.World(width, height)
		this.stepCount = 0
	}
}

const game = new GameInstance()

export const brainLabPlugin = {
	name: "brain-lab-api",

	configureServer(server: ViteDevServer) {
		game.init()

		server.middlewares.use("/api/brain-lab", async (req, res, next) => {
			if (!game.world) await game.init()

			res.setHeader("Access-Control-Allow-Origin", "*")
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			res.setHeader("Access-Control-Allow-Headers", "Content-Type")
			res.setHeader("Content-Type", "application/json; charset=utf-8")

			if (req.method === "OPTIONS") {
				res.writeHead(200)
				res.end()
				return
			}

			try {
				const url = new URL(req.url || "", `http://${req.headers.host}`)
				const path = url.pathname.replace("/api/brain-lab", "") || "/state"

				let body: Record<string, unknown> = {}
				if (req.method === "POST") {
					const chunks: Buffer[] = []
					for await (const chunk of req) chunks.push(chunk)
					const data = Buffer.concat(chunks).toString()
					if (data) body = JSON.parse(data)
				}

				let result: Record<string, unknown> | null = null

				switch (path) {
					case "/state":
						result = getState()
						break
					case "/move":
						result = doMove(body.action)
						break
					case "/reset":
						result = await doReset()
						break
					case "/set-level":
						result = doSetLevel(body.level)
						break
					default:
						res.writeHead(404)
						res.end(JSON.stringify({ error: "Unknown endpoint" }))
						return
				}

				res.writeHead(200)
				res.end(JSON.stringify(result, null, 2))

			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err)
				res.writeHead(500)
				res.end(JSON.stringify({ error: message }))
			}
		})
	}
}

function getState() {
	const state = game.world.getState()

	return {
		timestamp: Date.now(),
		step: game.stepCount,
		hero: state.hero,
		enemies: state.enemies,
		triggers: state.triggers,
		spikes: state.spikes,
		gridVisual: state.grid.map((row: number[]) =>
			row.map((c: number) => ["空", "狐", "台", "敌", "终", "刺", "钮"][c] || "?").join("")
		),
		gridRaw: state.grid,
	}
}

function doMove(action: string) {
	const validActions = ["LEFT", "RIGHT", "JUMP_LEFT", "JUMP_RIGHT", "JUMP_LEFT_FAR", "JUMP_RIGHT_FAR"]

	if (!validActions.includes(action)) {
		return { error: `Invalid action: ${action}` }
	}

	game.stepCount++

	const prevState = game.world.getState()
	const actionResult = game.world.execute(action)
	const newState = game.world.getState()

	return {
		type: "MANUAL_MOVE",
		step: game.stepCount,
		action,
		from: prevState.hero,
		to: newState.hero,
		animations: actionResult.animations,
		result: {
			enemiesRemaining: newState.enemies.length,
			triggeredButton: newState.triggers[0],
			reachedGoal: actionResult.reachedGoal,
			dead: actionResult.dead
		}
	}
}

async function doReset() {
	await game.reset()
	const state = getState()
	return { type: "RESET", step: 0, state }
}

async function doSetLevel(levelName: string) {
	const { DEFAULT_LEVEL_MAP, ADVANCED_LEVEL_MAP } = await import("../src/brain-lab/config.js")
	const { setCurrentLevel } = await import("../src/brain-lab/core/index.js")

	if (levelName === "default") {
		setCurrentLevel(DEFAULT_LEVEL_MAP)
		await game.reset()
		return { type: "SET_LEVEL", level: "default", ok: true }
	} else if (levelName === "advanced") {
		setCurrentLevel(ADVANCED_LEVEL_MAP)
		await game.reset()
		return { type: "SET_LEVEL", level: "advanced", ok: true }
	} else {
		return { error: `Unknown level: ${levelName}` }
	}
}
