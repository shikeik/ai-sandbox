// ========== Brain Lab HTTP API ==========
// 独立的HTTP接口，可通过curl操作

import type { IncomingMessage, ServerResponse } from "http"
import { World } from "./World.js"
import { Brain } from "./Brain.js"

// 游戏实例（全局单例）
class GameInstance {
	world: World
	brain: Brain
	stepCount: number = 0

	constructor() {
		this.world = new World(10, 5)
		this.brain = new Brain(10, 5)
	}

	reset() {
		this.world = new World(10, 5)
		this.brain = new Brain(10, 5)
		this.stepCount = 0
	}
}

const game = new GameInstance()

// API处理器
export async function handleAPIRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
	const url = new URL(req.url || "", `http://${req.headers.host}`)
	
	if (!url.pathname.startsWith("/api/brain-lab")) {
		return false // 不是我们的API
	}

	// 设置CORS和JSON响应
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	res.setHeader("Access-Control-Allow-Headers", "Content-Type")
	res.setHeader("Content-Type", "application/json; charset=utf-8")

	if (req.method === "OPTIONS") {
		res.writeHead(200)
		res.end()
		return true
	}

	try {
		const path = url.pathname.replace("/api/brain-lab", "") || "/state"
		let body: any = {}
		
		// 读取POST body
		if (req.method === "POST") {
			const chunks: Buffer[] = []
			for await (const chunk of req) {
				chunks.push(chunk)
			}
			const data = Buffer.concat(chunks).toString()
			if (data) {
				body = JSON.parse(data)
			}
		}

		let result: any

		switch (path) {
			case "/state":
				result = getState()
				break
			case "/step":
				result = await doStep()
				break
			case "/move":
				result = doMove(body.action)
				break
			case "/reset":
				result = doReset()
				break
			case "/think":
				result = doThink()
				break
			case "/set-depth":
				result = doSetDepth(body.depth)
				break
			default:
				res.writeHead(404)
				res.end(JSON.stringify({ error: "Unknown endpoint", path }))
				return true
			}

		res.writeHead(200)
		res.end(JSON.stringify(result, null, 2))
		return true

	} catch (err: any) {
		res.writeHead(500)
		res.end(JSON.stringify({ error: err.message }))
		return true
	}
}

// 获取当前状态
function getState() {
	const state = game.world.getState()
	return {
		timestamp: Date.now(),
		step: game.stepCount,
		hero: state.hero,
		enemies: state.enemies,
		triggers: state.triggers,
		grid: state.grid.map(row => 
			row.map(c => ["空", "狐", "台", "敌", "终", "刺", "钮"][c] || "?")
		),
		legend: {
			"0": "空 (AIR)",
			"1": "狐 (HERO)",
			"2": "台 (PLATFORM)",
			"3": "敌 (ENEMY)",
			"4": "终 (GOAL)",
			"5": "刺 (SPIKE)",
			"6": "钮 (BUTTON)",
		}
	}
}

// 执行AI思考并走一步
async function doStep() {
	const state = game.world.getState()
	const decision = game.brain.think(state)
	const reachedGoal = game.world.executeAction(decision.selectedAction)
	game.stepCount++

	return {
		type: "AI_STEP",
		step: game.stepCount,
		decision: {
			action: decision.selectedAction,
			reasoning: decision.reasoning,
			imaginations: decision.imaginations.map(img => ({
				action: img.action,
				predictedPos: img.predictedState.hero,
				predictedReward: img.predictedReward,
				killedEnemy: img.predictedState.enemies.length < state.enemies.length
			}))
		},
		result: {
			newPos: game.world.getState().hero,
			enemiesRemaining: game.world.getState().enemies.length,
			reachedGoal,
			triggered: game.world.getState().triggers
		}
	}
}

// 执行指定动作
function doMove(action: string) {
	const validActions = ["LEFT", "RIGHT", "JUMP", "WAIT"]
	if (!validActions.includes(action)) {
		return { error: `Invalid action: ${action}. Use: ${validActions.join(", ")}` }
	}

	const state = game.world.getState()
	const reachedGoal = game.world.executeAction(action)
	game.stepCount++

	return {
		type: "MANUAL_MOVE",
		step: game.stepCount,
		action,
		result: {
			newPos: game.world.getState().hero,
			enemiesRemaining: game.world.getState().enemies.length,
			reachedGoal,
			triggered: game.world.getState().triggers
		}
	}
}

// 重置游戏
function doReset() {
	game.reset()
	return {
		type: "RESET",
		step: 0,
		state: getState()
	}
}

// 只思考，不执行
function doThink() {
	const state = game.world.getState()
	const decision = game.brain.think(state)

	return {
		type: "THINK_ONLY",
		currentPos: state.hero,
		decision: {
			selected: decision.selectedAction,
			reasoning: decision.reasoning,
			imaginations: decision.imaginations.map(img => ({
				action: img.action,
				predictedPos: img.predictedState.hero,
				predictedReward: img.predictedReward,
				killedEnemy: img.predictedState.enemies.length < state.enemies.length
			})).sort((a, b) => b.predictedReward - a.predictedReward)
		}
	}
}

// 设置想象深度
function doSetDepth(depth: number) {
	if (typeof depth !== "number" || depth < 1 || depth > 10) {
		return { error: "depth must be 1-10" }
	}
	game.brain.setImagineDepth(depth)
	return {
		type: "SET_DEPTH",
		depth,
		ok: true
	}
}

// 导出游戏实例供UI使用
export { game }
