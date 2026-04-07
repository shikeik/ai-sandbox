// ========== Brain Lab API 插件 ==========

import type { ViteDevServer } from "vite"
import type { GameWorld } from "../src/brain-lab/core/game-world.js"
import type { Brain } from "../src/brain-lab/ai/brain.js"
import type { WorldState, Position, Imagination, AnimationEvent } from "../src/brain-lab/types/index.js"
import { setAssertLevel, setAssertStopOnFail } from "../src/engine/utils/assert.js"

// 启用断言（API 服务器端）
setAssertLevel("verbose")
setAssertStopOnFail(true)

// 游戏实例
class GameInstance {
	world: GameWorld | null = null
	brain: Brain | null = null
	stepCount: number = 0
	World: typeof GameWorld | null = null
	Brain: typeof Brain | null = null
	logs: Array<{time: string, tag: string, msg: string}> = []

	async init() {
		const { GameWorld } = await import("../src/brain-lab/core/index.js")
		const { Brain } = await import("../src/brain-lab/ai/index.js")
		this.World = GameWorld
		this.Brain = Brain
		await this.reset()
		this.log("SYSTEM", "游戏实例初始化完成")
	}

	async reset() {
		const { getCurrentLevel } = await import("../src/brain-lab/core/index.js")
		const level = getCurrentLevel()
		const height = level.map.length
		const width = height > 0 ? level.map[0].length : 0

		this.world = new this.World(width, height)
		this.brain = new this.Brain(width, height)
		this.stepCount = 0
		const state = this.world.getState()

		this.log("RESET", "========================================")
		this.log("RESET", "游戏已重置")
		this.log("RESET", `初始位置: (${state.hero.x}, ${state.hero.y})`)
		this.log("RESET", `敌人位置: [${state.enemies.map((e: Position) => `(${e.x},${e.y})`).join(", ")}]`)
		this.log("RESET", `尖刺位置: (${4}, ${state.spikeY})`)
		this.log("RESET", `地图尺寸: ${width}x${height}`)
	}

	log(tag: string, msg: string) {
		const time = new Date().toLocaleTimeString()
		this.logs.push({ time, tag, msg })
		if (this.logs.length > 200) this.logs.shift()
		console.log(`[BRAIN-LAB] [${tag}] ${msg}`)
	}

	getLogs() {
		return this.logs
	}

	clearLogs() {
		this.logs = []
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
						game.log("API", `GET /state - Step ${game.stepCount}`)
						result = getState()
						break
					case "/step":
						result = await doStep()
						break
					case "/move":
						result = doMove(body.action)
						break
					case "/reset":
						result = await doReset()
						break
					case "/think":
						result = doThink()
						break
					case "/set-depth":
						result = doSetDepth(body.depth)
						break
					case "/set-level":
						result = doSetLevel(body.level)
						break
					case "/logs":
						result = { logs: game.getLogs() }
						break
					case "/clear-logs":
						game.clearLogs()
						result = { cleared: true }
						break
					default:
						game.log("ERROR", `Unknown endpoint: ${path}`)
						res.writeHead(404)
						res.end(JSON.stringify({ error: "Unknown endpoint" }))
						return
				}

				res.writeHead(200)
				res.end(JSON.stringify(result, null, 2))

			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err)
				game.log("ERROR", `API Error: ${message}`)
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

async function doStep() {
	const prevState = game.world.getState()
	game.stepCount++

	console.log("\n[STEP] ========================================")
	console.log(`[STEP] Step ${game.stepCount} 开始`)

	game.log("STEP", "========================================")
	game.log("STEP", `Step ${game.stepCount} 开始`)
	game.log("STEP", `当前位置: (${prevState.hero.x}, ${prevState.hero.y})`)
	game.log("STEP", `当前敌人: ${prevState.enemies.length}个`)

	game.log("BRAIN", "AI开始思考...")
	const decision = game.brain.think(prevState)

	game.log("BRAIN", `决策结果: ${decision.selectedAction}`)
	game.log("BRAIN", `决策理由: ${decision.reasoning}`)

	// 记录所有想象的选项
	decision.imaginations.forEach((img: Imagination, idx: number) => {
		const killed = img.predictedState.enemies.length < prevState.enemies.length
		game.log("BRAIN", `  [${idx + 1}] ${img.action}: 位置(${img.predictedState.hero.x},${img.predictedState.hero.y}) 奖励${Math.round(img.predictedReward * 10) / 10}${killed ? " [击杀]" : ""}`)
	})

	game.log("ACTION", `执行动作: ${decision.selectedAction}`)
	const actionResult = game.world.execute(decision.selectedAction)

	const newState = game.world.getState()

	const dx = newState.hero.x - prevState.hero.x
	const dy = newState.hero.y - prevState.hero.y

	game.log("RESULT", "执行完成")
	game.log("RESULT", `  新位置: (${newState.hero.x}, ${newState.hero.y}) [Δx=${dx}, Δy=${dy}]`)
	game.log("RESULT", `  剩余敌人: ${newState.enemies.length}个`)
	game.log("RESULT", `  按钮触发: ${newState.triggers[0]}`)
	game.log("RESULT", `  尖刺位置: y=${newState.spikeY}`)
	game.log("RESULT", `  到达终点: ${actionResult.reachedGoal}`)

	if (actionResult.animations.length > 0) {
		game.log("ANIM", `动画序列 (${actionResult.animations.length}个):`)
		actionResult.animations.forEach((anim: AnimationEvent, idx: number) => {
			game.log("ANIM", `  [${idx + 1}] ${anim.type} ${anim.target} ${anim.from.x},${anim.from.y}->${anim.to?.x || "-" },${anim.to?.y || "-"} ${anim.duration}ms${anim.delay ? ` (delay ${anim.delay}ms)` : ""}`)
		})
	}

	actionResult.logs.forEach((log: string) => game.log("WORLD", log))

	return {
		type: "AI_STEP",
		step: game.stepCount,
		decision: {
			action: decision.selectedAction,
			reasoning: decision.reasoning,
			imaginations: decision.imaginations.map((img: Imagination) => ({
				action: img.action,
				predictedPos: img.predictedState.hero,
				predictedReward: Math.round(img.predictedReward * 10) / 10,
				killedEnemy: img.predictedState.enemies.length < prevState.enemies.length
			}))
		},
		animations: actionResult.animations,
		result: {
			newPos: newState.hero,
			enemiesRemaining: newState.enemies.length,
			reachedGoal: actionResult.reachedGoal,
			triggered: newState.triggers,
			dead: actionResult.dead
		}
	}
}

function doMove(action: string) {
	// 移动动作
	const moveActions = ["LEFT", "RIGHT", "JUMP_LEFT", "JUMP_RIGHT", "JUMP_LEFT_FAR", "JUMP_RIGHT_FAR"]
	// 查询动作（不移动，只返回信息）
	const queryActions = ["VIEWPORT"]
	const validActions = [...moveActions, ...queryActions]

	if (!validActions.includes(action)) {
		game.log("ERROR", `Invalid action: ${action}`)
		return { error: `Invalid action: ${action}` }
	}

	// VIEWPORT: 返回当前视野信息，不移动
	if (action === "VIEWPORT") {
		return doViewport()
	}

	game.stepCount++
	game.log("MANUAL", "========================================")
	game.log("MANUAL", `手动移动 Step ${game.stepCount}`)
	game.log("MANUAL", `动作: ${action}`)

	const prevState = game.world.getState()
	game.log("MANUAL", `移动前: (${prevState.hero.x}, ${prevState.hero.y})`)

	const actionResult = game.world.execute(action)
	const newState = game.world.getState()

	const dx = newState.hero.x - prevState.hero.x
	const dy = newState.hero.y - prevState.hero.y

	game.log("MANUAL", `移动后: (${newState.hero.x}, ${newState.hero.y}) [Δx=${dx}, Δy=${dy}]`)
	game.log("MANUAL", `剩余敌人: ${newState.enemies.length}, 按钮触发: ${newState.triggers[0]}, 到达终点: ${actionResult.reachedGoal}`)

	if (actionResult.animations.length > 0) {
		game.log("ANIM", `动画序列 (${actionResult.animations.length}个)`)
	}

	actionResult.logs.forEach((log: string) => game.log("WORLD", log))

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
	game.log("API", "POST /reset - 游戏已重置")
	return { type: "RESET", step: 0, state }
}

function doThink() {
	const state = game.world.getState()
	game.log("THINK", "========================================")
	game.log("THINK", "思考模式（不执行）")
	game.log("THINK", `当前位置: (${state.hero.x}, ${state.hero.y})`)

	const decision = game.brain.think(state)
	game.log("BRAIN", `决策: ${decision.selectedAction}`)
	game.log("BRAIN", `理由: ${decision.reasoning}`)

	return {
		type: "THINK_ONLY",
		currentPos: state.hero,
		decision: {
			selected: decision.selectedAction,
			reasoning: decision.reasoning,
			allOptions: decision.imaginations
				.map((img: Imagination) => ({
					action: img.action,
					predictedPos: img.predictedState.hero,
					predictedReward: Math.round(img.predictedReward * 10) / 10,
					killedEnemy: img.predictedState.enemies.length < state.enemies.length
				}))
				.sort((a: { predictedReward: number }, b: { predictedReward: number }) => b.predictedReward - a.predictedReward)
		}
	}
}

function doSetDepth(depth: number) {
	if (typeof depth !== "number" || depth < 1 || depth > 10) {
		game.log("ERROR", `无效深度: ${depth}`)
		return { error: "depth must be 1-10" }
	}
	game.brain.setImagineDepth(depth)
	game.log("CONFIG", `想象深度设置为: ${depth}`)
	return { type: "SET_DEPTH", depth, ok: true }
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

function doViewport() {
	const state = game.world.getState()
	game.log("VIEWPORT", `查看视野: 玩家(${state.hero.x}, ${state.hero.y})`)
	
	// 计算视野范围（以玩家为中心，左右各3格，上下各2格）
	const viewWidth = 7
	const viewHeight = 5
	const halfW = Math.floor(viewWidth / 2)
	const halfH = Math.floor(viewHeight / 2)
	
	const viewport = {
		x: Math.max(0, state.hero.x - halfW),
		y: Math.max(0, state.hero.y - halfH),
		width: viewWidth,
		height: viewHeight,
	}
	
	// 提取视野内的格子
	const grid: string[][] = []
	for (let dy = 0; dy < viewHeight; dy++) {
		const row: string[] = []
		for (let dx = 0; dx < viewWidth; dx++) {
			const gx = viewport.x + dx
			const gy = viewport.y + dy
			if (gy < state.grid.length && gx < state.grid[0].length) {
				const cell = state.grid[gy][gx]
				const chars = ["空", "狐", "台", "敌", "终", "刺", "钮"]
				row.push(chars[cell] || "?")
			} else {
				row.push("边")
			}
		}
		grid.push(row)
	}
	
	return {
		type: "VIEWPORT",
		hero: state.hero,
		enemies: state.enemies,
		viewport: {
			...viewport,
			grid
		}
	}
}
