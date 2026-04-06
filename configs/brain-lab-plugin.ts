// ========== Brain Lab API 插件 ==========
// 职责：HTTP 路由，提供游戏操作API

import type { ViteDevServer } from 'vite'

// 游戏实例
class GameInstance {
	world: any
	brain: any
	stepCount: number = 0
	World: any
	Brain: any

	async init() {
		// 动态导入（兼容ts）
		const { World } = await import('../src/brain-lab/World.js')
		const { Brain } = await import('../src/brain-lab/Brain.js')
		this.World = World
		this.Brain = Brain
		this.reset()
	}

	reset() {
		this.world = new this.World(10, 5)
		this.brain = new this.Brain(10, 5)
		this.stepCount = 0
	}
}

const game = new GameInstance()

export const brainLabPlugin = {
	name: 'brain-lab-api',
	
	configureServer(server: ViteDevServer) {
		// 初始化游戏
		game.init()

		server.middlewares.use('/api/brain-lab', async (req, res, next) => {
			// 确保游戏已初始化
			if (!game.world) {
				await game.init()
			}

			// 设置CORS
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
				
				// 读取POST body
				let body: any = {}
				if (req.method === 'POST') {
					const chunks: Buffer[] = []
					for await (const chunk of req) {
						chunks.push(chunk)
					}
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
					default:
						res.writeHead(404)
						res.end(JSON.stringify({ error: 'Unknown endpoint', available: ['/state', '/step', '/move', '/reset', '/think', '/set-depth'] }))
						return
				}

				res.writeHead(200)
				res.end(JSON.stringify(result, null, 2))

			} catch (err: any) {
				res.writeHead(500)
				res.end(JSON.stringify({ error: err.message, stack: err.stack }))
			}
		})
	}
}

// 获取当前状态
function getState() {
	const state = game.world.getState()
	const gridSymbols = state.grid.map((row: number[]) => 
		row.map((c: number) => ['空', '狐', '台', '敌', '终', '刺', '钮'][c] || '?').join('')
	)
	
	return {
		timestamp: Date.now(),
		step: game.stepCount,
		hero: state.hero,
		enemies: state.enemies,
		triggers: state.triggers,
		gridVisual: gridSymbols,
		gridRaw: state.grid,
		legend: {
			'0': '空 (AIR)',
			'1': '狐 (HERO)',
			'2': '台 (PLATFORM)',
			'3': '敌 (ENEMY)',
			'4': '终 (GOAL)',
			'5': '刺 (SPIKE)',
			'6': '钮 (BUTTON)',
		}
	}
}

// 执行AI思考并走一步
async function doStep() {
	const state = game.world.getState()
	console.log(`[BRAIN-LAB] [STEP ${game.stepCount + 1}] AI思考中...`)
	
	const decision = game.brain.think(state)
	console.log(`[BRAIN-LAB] [STEP ${game.stepCount + 1}] 决策: ${decision.selectedAction}`)
	
	const reachedGoal = game.world.executeAction(decision.selectedAction)
	game.stepCount++

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
			newPos: game.world.getState().hero,
			enemiesRemaining: game.world.getState().enemies.length,
			reachedGoal,
			triggered: game.world.getState().triggers
		}
	}
}

// 执行指定动作
function doMove(action: string) {
	const validActions = ['LEFT', 'RIGHT', 'JUMP', 'WAIT']
	if (!validActions.includes(action)) {
		console.log(`[BRAIN-LAB] [ERROR] Invalid action: ${action}`)
		return { error: `Invalid action: ${action}. Use: ${validActions.join(', ')}` }
	}

	console.log(`[BRAIN-LAB] [MOVE] ${action}`)
	const state = game.world.getState()
	const oldPos = { ...state.hero }
	const reachedGoal = game.world.executeAction(action)
	game.stepCount++
	const newState = game.world.getState()

	return {
		type: 'MANUAL_MOVE',
		step: game.stepCount,
		action,
		from: oldPos,
		to: newState.hero,
		result: {
			enemiesRemaining: newState.enemies.length,
			triggeredButton: newState.triggers[0],
			reachedGoal
		}
	}
}

// 重置游戏
function doReset() {
	console.log('[BRAIN-LAB] [RESET] 游戏已重置')
	game.reset()
	return {
		type: 'RESET',
		step: 0,
		state: getState()
	}
}

// 只思考，不执行
function doThink() {
	const state = game.world.getState()
	console.log('[BRAIN-LAB] [THINK] AI思考中（不执行）...')
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

// 设置想象深度
function doSetDepth(depth: number) {
	if (typeof depth !== 'number' || depth < 1 || depth > 10) {
		console.log(`[BRAIN-LAB] [ERROR] Invalid depth: ${depth}`)
		return { error: 'depth must be 1-10' }
	}
	console.log(`[BRAIN-LAB] [CONFIG] 想象深度设置为: ${depth}`)
	game.brain.setImagineDepth(depth)
	return {
		type: 'SET_DEPTH',
		depth,
		ok: true
	}
}
