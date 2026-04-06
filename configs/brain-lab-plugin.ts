// ========== Brain Lab API 插件 - 完整日志+断言版 ==========

import type { ViteDevServer } from 'vite'
import { 
	assert, 
	assertEq, 
	assertValidPosition, 
	assertInRange,
	assertExists,
	setAssertLevel,
	setAssertStopOnFail
} from '../src/brain-lab/Assert.js'

// 设置断言模式（开发时verbose，生产时error-only）
setAssertLevel('verbose')
setAssertStopOnFail(false)  // 失败不停止，继续运行但报错

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
		this.world = new this.World(10, 6)
		this.brain = new this.Brain(10, 6)
		this.stepCount = 0
		const state = this.world.getState()
		
		// 断言验证初始状态
		assertEq(state.hero.x, 1, "初始英雄X位置")
		assertEq(state.hero.y, 1, "初始英雄Y位置")
		assertEq(state.enemies.length, 1, "初始敌人数量")
		assertEq(state.enemies[0].x, 4, "初始敌人X位置")
		assertEq(state.enemies[0].y, 1, "初始敌人Y位置")
		assertEq(state.spikeY, 4, "初始尖刺Y位置")
		assertEq(state.triggers[0], false, "初始按钮未触发")
		
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
	
	// 断言验证状态
	assertValidPosition(state.hero.x, state.hero.y, 10, 6, "英雄位置")
	assertInRange(state.spikeY ?? 4, 0, 5, "尖刺Y位置")
	
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
	
	// 断言：步数递增
	assert(game.stepCount > 0, "步数应大于0", { stepCount: game.stepCount })
	
	game.log("STEP", `========================================`)
	game.log("STEP", `Step ${game.stepCount} 开始`)
	game.log("STEP", `当前位置: (${prevState.hero.x}, ${prevState.hero.y})`)
	game.log("STEP", `当前敌人: ${prevState.enemies.length}个`)
	
	// 断言：前一状态有效
	assertValidPosition(prevState.hero.x, prevState.hero.y, 10, 6, "Step开始前英雄位置")
	
	game.log("BRAIN", `AI开始思考...`)
	const decision = game.brain.think(prevState)
	
	// 断言：决策结果有效
	assertExists(decision.selectedAction, "决策动作")
	assert(['LEFT', 'RIGHT', 'JUMP', 'WAIT'].includes(decision.selectedAction), "决策动作应是有效值", { action: decision.selectedAction })
	
	game.log("BRAIN", `决策结果: ${decision.selectedAction}`)
	game.log("BRAIN", `决策理由: ${decision.reasoning}`)
	
	// 记录所有想象的选项
	decision.imaginations.forEach((img: any, idx: number) => {
		const killed = img.predictedState.enemies.length < prevState.enemies.length
		game.log("BRAIN", `  [${idx + 1}] ${img.action}: 位置(${img.predictedState.hero.x},${img.predictedState.hero.y}) 奖励${Math.round(img.predictedReward * 10) / 10}${killed ? ' [击杀]' : ''}`)
	})
	
	game.log("ACTION", `执行动作: ${decision.selectedAction}`)
	const actionResult = game.world.executeAction(decision.selectedAction)
	
	const newState = game.world.getState()
	
	// 断言：新位置有效
	assertValidPosition(newState.hero.x, newState.hero.y, 10, 6, "Step结束后英雄位置")
	
	// 断言：位置变化合理（根据动作类型）
	const dx = newState.hero.x - prevState.hero.x
	const dy = newState.hero.y - prevState.hero.y
	
	if (decision.selectedAction === 'LEFT') {
		assert(dx <= 0, "LEFT动作X应不增加", { dx, dy })
	} else if (decision.selectedAction === 'RIGHT') {
		assert(dx >= 0, "RIGHT动作X应不减少", { dx, dy })
	} else if (decision.selectedAction === 'JUMP') {
		assert(dx >= 0, "JUMP动作X应不减少", { dx, dy })
	}
	
	game.log("RESULT", `执行完成`)
	game.log("RESULT", `  新位置: (${newState.hero.x}, ${newState.hero.y}) [Δx=${dx}, Δy=${dy}]`)
	game.log("RESULT", `  剩余敌人: ${newState.enemies.length}个`)
	game.log("RESULT", `  按钮触发: ${newState.triggers[0]}`)
	game.log("RESULT", `  尖刺位置: y=${newState.spikeY}`)
	game.log("RESULT", `  到达终点: ${actionResult.reachedGoal}`)

	// 动画断言
	if (actionResult.animations.length > 0) {
		game.log("ANIM", `动画序列 (${actionResult.animations.length}个):`)
		actionResult.animations.forEach((anim: any, idx: number) => {
			game.log("ANIM", `  [${idx + 1}] ${anim.type} ${anim.target} ${anim.from.x},${anim.from.y}->${anim.to?.x || '-' },${anim.to?.y || '-'} ${anim.duration}ms${anim.delay ? ` (delay ${anim.delay}ms)` : ''}`)
			// 断言：动画参数有效
			assertExists(anim.type, `动画[${idx}]类型`)
			assertExists(anim.target, `动画[${idx}]目标`)
			assertInRange(anim.duration, 0, 5000, `动画[${idx}]时长`)
		})
	}

	// 添加世界内部日志
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
			triggered: newState.triggers
		}
	}
}

function doMove(action: string) {
	const validActions = ['LEFT', 'RIGHT', 'JUMP', 'WAIT']
	
	// 断言：动作有效
	assert(validActions.includes(action), `动作 ${action} 应是有效值`, { validActions, action })
	
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
	
	// 断言：移动前状态有效
	assertValidPosition(prevState.hero.x, prevState.hero.y, 10, 6, "手动移动前英雄位置")
	
	const actionResult = game.world.executeAction(action)
	const newState = game.world.getState()
	
	// 断言：移动后状态有效
	assertValidPosition(newState.hero.x, newState.hero.y, 10, 6, "手动移动后英雄位置")
	
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
			reachedGoal: actionResult.reachedGoal
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
	// 断言：深度有效
	assert(typeof depth === 'number' && depth >= 1 && depth <= 10, "深度应在1-10之间", { depth })
	
	if (typeof depth !== 'number' || depth < 1 || depth > 10) {
		game.log("ERROR", `无效深度: ${depth}`)
		return { error: 'depth must be 1-10' }
	}
	game.brain.setImagineDepth(depth)
	game.log("CONFIG", `想象深度设置为: ${depth}`)
	return { type: 'SET_DEPTH', depth, ok: true }
}
