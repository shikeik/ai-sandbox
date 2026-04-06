// ========== Brain Lab HTTP API ==========
// 模仿 api-bridge，提供外部控制接口

import { World } from "./World.js"
import { Brain } from "./Brain.js"

export class BrainLabAPI {
	private world: World
	private brain: Brain
	private stepCount: number = 0

	constructor() {
		this.world = new World(10, 5)
		this.brain = new Brain(10, 5)
	}

	// 处理 HTTP 请求
	async handleRequest(req: Request): Promise<Response> {
		const url = new URL(req.url)
		const path = url.pathname

		// 设置 CORS
		const headers = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Content-Type": "application/json",
		}

		if (req.method === "OPTIONS") {
			return new Response(null, { headers })
		}

		try {
			switch (path) {
				case "/api/brain-lab/state":
					return this.getState(headers)

				case "/api/brain-lab/step":
					return await this.step(headers)

				case "/api/brain-lab/reset":
					return this.reset(headers)

				case "/api/brain-lab/set-depth":
					const body = await req.json()
					return this.setDepth(body.depth, headers)

				default:
					return new Response(
						JSON.stringify({ error: "Unknown endpoint" }),
						{ status: 404, headers }
					)
			}
		} catch (err) {
			return new Response(
				JSON.stringify({ error: err.message }),
				{ status: 500, headers }
			)
		}
	}

	private getState(headers: Record<string, string>): Response {
		const state = this.world.getState()
		return new Response(
			JSON.stringify({
				step: this.stepCount,
				hero: state.hero,
				enemies: state.enemies,
				triggers: state.triggers,
				grid: state.grid,
			}, null, 2),
			{ headers }
		)
	}

	private async step(headers: Record<string, string>): Promise<Response> {
		const state = this.world.getState()
		console.log(`\n[STEP ${++this.stepCount}] ==========`)
		console.log("当前状态:", JSON.stringify({
			hero: state.hero,
			enemies: state.enemies,
		}))

		// 大脑思考
		console.log("[BRAIN] 开始思考...")
		const decision = this.brain.think(state)
		console.log("[BRAIN] 决策:", decision.selectedAction)
		console.log("[BRAIN] 理由:", decision.reasoning)
		console.log("[BRAIN] 想象结果:")
		decision.imaginations.forEach(img => {
			console.log(`  ${img.action}: 到(${img.predictedState.hero.x},${img.predictedState.hero.y}) 奖励:${img.predictedReward}`)
		})

		// 执行动作
		const action = decision.selectedAction
		console.log("[WORLD] 执行动作:", action)
		const reachedGoal = this.world.executeAction(action)
		console.log("[WORLD] 执行结果:", this.world.getState().hero, "到达终点:", reachedGoal)

		const newState = this.world.getState()

		return new Response(
			JSON.stringify({
				step: this.stepCount,
				action,
				reasoning: decision.reasoning,
				imaginations: decision.imaginations.map(img => ({
					action: img.action,
					predictedPos: img.predictedState.hero,
					predictedReward: img.predictedReward,
					killedEnemy: img.predictedState.enemies.length < state.enemies.length,
				})),
				result: {
					hero: newState.hero,
					enemies: newState.enemies,
					reachedGoal,
				},
			}, null, 2),
			{ headers }
		)
	}

	private reset(headers: Record<string, string>): Response {
		this.world.reset()
		this.stepCount = 0
		console.log("[API] 重置世界")
		return new Response(
			JSON.stringify({ success: true, message: "World reset" }),
			{ headers }
		)
	}

	private setDepth(depth: number, headers: Record<string, string>): Response {
		this.brain.setImagineDepth(depth)
		console.log("[API] 设置想象深度:", depth)
		return new Response(
			JSON.stringify({ success: true, depth }),
			{ headers }
		)
	}
}

// 创建全局实例
export const brainLabAPI = new BrainLabAPI()
