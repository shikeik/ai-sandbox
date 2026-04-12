// ========== 对象规则定义 ==========
// 游戏规则与地图数据解耦

import type { ObjectRule, RuleContext, ActionResult } from "./types"

// ========== 辅助函数 ==========

function hasItem(ctx: RuleContext, item: string): boolean {
	return ctx.agent.inventory.includes(item)
}

function addItem(ctx: RuleContext, item: string): void {
	ctx.agent.inventory.push(item)
}

function removeItem(ctx: RuleContext, item: string): void {
	ctx.agent.inventory = ctx.agent.inventory.filter(i => i !== item)
}

// ========== 规则定义 ==========

export const OBJECT_RULES: Record<string, ObjectRule> = {
	// 玩家（主要用于渲染标识）
	"agent": {
		blocksMovement: false
	},

	// 钥匙
	"钥匙": {
		blocksMovement: false,
		onInteract: (ctx) => ({
			success: true,
			msg: "拾取钥匙",
			reward: 1,
			sideEffect: () => {
				addItem(ctx, "钥匙")
				ctx.world.removeObject(ctx.obj.id)
			}
		})
	},

	// 门
	"门": {
		blocksMovement: (state) => !state?.open,
		onInteract: (ctx) => {
			if (ctx.obj.state?.open) {
				return { success: false, msg: "门已经开了", reward: 0 }
			}
			if (!hasItem(ctx, "钥匙")) {
				return { success: false, msg: "需要钥匙", reward: -0.1 }
			}
			return {
				success: true,
				msg: "开门（消耗钥匙）",
				reward: 1,
				sideEffect: () => {
					ctx.world.setObjectState(ctx.obj.id, "open", true)
					removeItem(ctx, "钥匙")
				}
			}
		}
	},

	// 终点
	"终点": {
		blocksMovement: false,
		onEnter: () => ({
			success: true,
			msg: "🎉 到达终点！",
			reward: 10,
			terminate: true
		})
	}
}

// ========== 规则查询 ==========

export function getRule(type: string): ObjectRule | undefined {
	return OBJECT_RULES[type]
}
