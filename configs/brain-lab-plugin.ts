// ========== Brain Lab API 插件 ==========
// 职责：HTTP 路由，提供游戏操作API + 控制台日志

import type { ViteDevServer } from 'vite'

// 游戏实例
class GameInstance {
	world: any
	brain: any
	stepCount: number = 0
	World: any
	Brain: any
	logs: Array<{time: string, tag: string, msg: string}> = []

	async init() {
		const { World } = await import('../src/brain-lab/World.js')
		const { Brain } = await import('../src/brain-lab/Brain.js')
		this.World = World
		this.Brain = Brain
		this.reset()
		this.log("SYSTEM", "游戏实例初始化完成")
	}

	reset() {
		this.world = new this.World(10, 5)
		this.brain = new this.Brain(10, 5)
		this.stepCount = 0
		this.log("SYSTEM", "游戏已重置")
	}

	log(tag: string, msg: string) {
		const time = new Date().toLocaleTimeString()
		this.logs.push({ time, tag, msg })
		// 只保留最近100条
		if (this.logs.length > 100) this.logs.shift()
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
	name: 'brain-lab-api',
	
	configureServer(server: ViteDevServer) {
		game.init()

		server.middlewares.use('/api/brain-lab', async (req, res, next) => {
			if (!game.world) await game.init()

			res.setHeader('Access-Control-Allow-Origin', '*')
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
			res.setHeader('Content-Type', 'application/json; charset=utf-8')

			if (req.method === 'OPTIONS') {
				res.writeHead(200)
				res.end()
				return
			}

			try {
				const url = new URL(req.url || '', `http://${req.headers.host}`)
				const path = url.pathname.replace('/api/brain-lab', '') || '/state'
				
				let body: any = {}
				if (req.method === 'POST') {
					const chunks: Buffer[] = []
					for await (const chunk of req) chunks.push(chunk)
					const data = Buffer.concat(chunks).toString()
					if (data) body = JSON.parse(data)
				}

				let result: any

				switch (path) {
					case '/state':
						result = getState()
						break
					case '/step':
						result = await doStep()
						break
					case '/move':
						result = doMove(body.action)
						break
					case '/reset':
						result = doReset()
						break
					case '/think':
						result = doThink()
						break
					case '/set-depth':
						result = doSetDepth(body.depth)
						break
					case '/logs':
						result = { logs: game.getLogs() }
						break
					case '/clear-logs':
						game.clearLogs()
						result = { cleared: true }
						break
					default:
						res.writeHead(404)
						res.end(JSON.stringify({ error: 'Unknown endpoint' }))
						return
				}

				res.writeHead(200)
				res.end(JSON.stringify(result, null, 2))

			} catch (err: any) {
				res.writeHead(500)
				res.end(JSON.stringify({ error: err.message }))
			}
		})
	}
}

function getState() {
	const state = game.world.getState()
	game.log("API", "获取状态")
	return {
		timestamp: Date.now(),
		step: game.stepCount,
		hero: state.hero,
		enemies: state.enemies,
		triggers: state.triggers,
		gridVisual: state.grid.map((row: number[]) => 
			row.map((c: number) => ['空', '狐', '台', '敌', '终', '刺', '钮'][c] || '?').join('')
		),
		gridRaw: state.grid,
	}
}

async function doStep() {
	const state = game.world.getState()
	game.log("BRAIN", `Step ${game.stepCount + 1}: AI思考中...`)
	
	const decision = game.brain.think(state)
	game.log("BRAIN", `决策: ${decision.selectedAction}`)
	
	const reachedGoal = game.world.executeAction(decision.selectedAction)
	game.stepCount++
	
	const newState = game.world.getState()
	game.log("GAME", `执行后位置: (${newState.hero.x}, ${newState.hero.y}), 敌人: ${newState.enemies.length}`)

	return {
		type: 'AI_STEP',
		step: game.stepCount,
		decision: {
			action: decision.selectedAction,
			reasoning: decision.reasoning,
			imaginations: decision.imaginations.map((img: any) => ({
				action: img.action,
				predictedPos: img.predictedState.hero,
				predictedReward: Math.round(img.predictedReward * 10) / 10,
				killedEnemy: img.predictedState.enemies.length < state.enemies.length
			}))
		},
		result: {
			newPos: newState.hero,
			enemiesRemaining: newState.enemies.length,
			reachedGoal,
			triggered: newState.triggers
		}
	}
}

function doMove(action: string) {
	const validActions = ['LEFT', 'RIGHT', 'JUMP', 'WAIT']
	if (!validActions.includes(action)) {
		game.log("ERROR", `Invalid action: ${action}`)
		return { error: `Invalid action: ${action}` }
	}

	game.log("GAME", `手动移动: ${action}`)
	const state = game.world.getState()
	const reachedGoal = game.world.executeAction(action)
	game.stepCount++
	const newState = game.world.getState()

	return {
		type: 'MANUAL_MOVE',
		step: game.stepCount,
		action,
		from: state.hero,
		to: newState.hero,
		result: {
			enemiesRemaining: newState.enemies.length,
			triggeredButton: newState.triggers[0],
			reachedGoal
		}
	}
}

function doReset() {
	game.reset()
	return { type: 'RESET', step: 0, state: getState() }
}

function doThink() {
	const state = game.world.getState()
	game.log("BRAIN", "思考模式（不执行）")
	const decision = game.brain.think(state)

	return {
		type: 'THINK_ONLY',
		currentPos: state.hero,
		decision: {
			selected: decision.selectedAction,
			reasoning: decision.reasoning,
			allOptions: decision.imaginations
				.map((img: any) => ({
					action: img.action,
					predictedPos: img.predictedState.hero,
					predictedReward: Math.round(img.predictedReward * 10) / 10,
					killedEnemy: img.predictedState.enemies.length < state.enemies.length
				}))
				.sort((a: any, b: any) => b.predictedReward - a.predictedReward)
		}
	}
}

function doSetDepth(depth: number) {
	if (typeof depth !== 'number' || depth < 1 || depth > 10) {
		return { error: 'depth must be 1-10' }
	}
	game.brain.setImagineDepth(depth)
	game.log("CONFIG", `想象深度: ${depth}`)
	return { type: 'SET_DEPTH', depth, ok: true }
}
