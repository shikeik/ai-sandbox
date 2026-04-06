// ========== Brain Lab API 插件 ==========

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
		const { GameWorld } = await import('../src/brain-lab/core/index.js')
		const { Brain } = await import('../src/brain-lab/ai/index.js')
		this.World = GameWorld
		this.Brain = Brain
		this.reset()
		this.log("SYSTEM", "游戏实例初始化完成")
	}

	reset() {
		this.world = new this.World(10, 6)
		this.brain = new this.Brain(10, 6)
		this.stepCount = 0
		const state = this.world.getState()

		this.log("RESET", "========================================")
		this.log("RESET", "游戏已重置")
		this.log("RESET", `初始位置: (${state.hero.x}, ${state.hero.y})`)
		this.log("RESET", `敌人位置: [${state.enemies.map((e: any) => `(${e.x},${e.y})`).join(', ')}]`)
		this.log("RESET", `尖刺位置: (${4}, ${state.spikeY})`)
		this.log("RESET", `地图尺寸: 10x6`)
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
						game.log("API", `GET /state - Step ${game.stepCount}`)
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
						game.log("ERROR", `Unknown endpoint: ${path}`)
						res.writeHead(404)
						res.end(JSON.stringify({ error: 'Unknown endpoint' }))
						return
				}

				res.writeHead(200)
				res.end(JSON.stringify(result, null, 2))

			} catch (err: any) {
				game.log("ERROR", `API Error: ${err.message}`)
				res.writeHead(500)
				res.end(JSON.stringify({ error: err.message }))
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
		spikeY: state.spikeY,
		spikeFalling: state.spikeFalling,
		gridVisual: state.grid.map((row: number[]) =>
			row.map((c: number) => ['空', '狐', '台', '敌', '终', '刺', '钮'][c] || '?').join('')
		),
		gridRaw: state.grid,
	}
}

async function doStep() {
	const prevState = game.world.getState()
	game.stepCount++

	console.log(`\n[STEP] ========================================`)
	console.log(`[STEP] Step ${game.stepCount} 开始`)

	game.log("STEP", `========================================`)
	game.log("STEP", `Step ${game.stepCount} 开始`)
	game.log("STEP", `当前位置: (${prevState.hero.x}, ${prevState.hero.y})`)
	game.log("STEP", `当前敌人: ${prevState.enemies.length}个`)

	game.log("BRAIN", `AI开始思考...`)
	const decision = game.brain.think(prevState)

	game.log("BRAIN", `决策结果: ${decision.selectedAction}`)
	game.log("BRAIN", `决策理由: ${decision.reasoning}`)

	// 记录所有想象的选项
	decision.imaginations.forEach((img: any, idx: number) => {
		const killed = img.predictedState.enemies.length < prevState.enemies.length
		game.log("BRAIN", `  [${idx + 1}] ${img.action}: 位置(${img.predictedState.hero.x},${img.predictedState.hero.y}) 奖励${Math.round(img.predictedReward * 10) / 10}${killed ? ' [击杀]' : ''}`)
	})

	game.log("ACTION", `执行动作: ${decision.selectedAction}`)
	const actionResult = game.world.execute(decision.selectedAction)

	const newState = game.world.getState()

	const dx = newState.hero.x - prevState.hero.x
	const dy = newState.hero.y - prevState.hero.y

	game.log("RESULT", `执行完成`)
	game.log("RESULT", `  新位置: (${newState.hero.x}, ${newState.hero.y}) [Δx=${dx}, Δy=${dy}]`)
	game.log("RESULT", `  剩余敌人: ${newState.enemies.length}个`)
	game.log("RESULT", `  按钮触发: ${newState.triggers[0]}`)
	game.log("RESULT", `  尖刺位置: y=${newState.spikeY}`)
	game.log("RESULT", `  到达终点: ${actionResult.reachedGoal}`)

	if (actionResult.animations.length > 0) {
		game.log("ANIM", `动画序列 (${actionResult.animations.length}个):`)
		actionResult.animations.forEach((anim: any, idx: number) => {
			game.log("ANIM", `  [${idx + 1}] ${anim.type} ${anim.target} ${anim.from.x},${anim.from.y}->${anim.to?.x || '-' },${anim.to?.y || '-'} ${anim.duration}ms${anim.delay ? ` (delay ${anim.delay}ms)` : ''}`)
		})
	}

	actionResult.logs.forEach((log: string) => game.log("WORLD", log))

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
	const validActions = ['LEFT', 'RIGHT', 'JUMP', 'JUMP_LEFT', 'JUMP_RIGHT', 'JUMP_LEFT_FAR', 'JUMP_RIGHT_FAR', 'WAIT']

	if (!validActions.includes(action)) {
		game.log("ERROR", `Invalid action: ${action}`)
		return { error: `Invalid action: ${action}` }
	}

	game.stepCount++
	game.log("MANUAL", `========================================`)
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
		type: 'MANUAL_MOVE',
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

function doReset() {
	game.reset()
	const state = getState()
	game.log("API", "POST /reset - 游戏已重置")
	return { type: 'RESET', step: 0, state }
}

function doThink() {
	const state = game.world.getState()
	game.log("THINK", `========================================`)
	game.log("THINK", `思考模式（不执行）`)
	game.log("THINK", `当前位置: (${state.hero.x}, ${state.hero.y})`)

	const decision = game.brain.think(state)
	game.log("BRAIN", `决策: ${decision.selectedAction}`)
	game.log("BRAIN", `理由: ${decision.reasoning}`)

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
		game.log("ERROR", `无效深度: ${depth}`)
		return { error: 'depth must be 1-10' }
	}
	game.brain.setImagineDepth(depth)
	game.log("CONFIG", `想象深度设置为: ${depth}`)
	return { type: 'SET_DEPTH', depth, ok: true }
}
