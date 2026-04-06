// ========== 动作执行逻辑 ==========

import type { WorldState, Position, ActionResult, AnimationEvent } from "../types/index.js"
import { Element } from "../types/index.js"
import { ANIMATION_DURATION } from "../config.js"
import {
	createPhysicsContext,
	isWall,
	hasSupport,
	findJumpLandingY,
	findGroundY,
	checkButtonTrigger,
	checkGoalReached,
} from "./physics.js"


/** 动作处理器上下文 */
interface ActionContext {
	state: WorldState
	hero: Position
	animations: AnimationEvent[]
	logs: string[]
	width: number
	height: number
}

/**
 * 执行动作
 */
export function executeAction(
	state: WorldState,
	action: string,
	width: number,
	height: number
): ActionResult {
	const hero = { ...state.hero }
	const animations: AnimationEvent[] = []
	const logs: string[] = []
	const dead = false

	const ctx: ActionContext = {
		state, hero, animations, logs, width, height
	}

	switch (action) {
		case "LEFT":
			handleLeft(ctx)
			break
		case "RIGHT":
			handleRight(ctx)
			break
		case "JUMP_LEFT":
			handleJumpLeft(ctx)
			break
		case "JUMP_RIGHT":
			handleJumpRight(ctx)
			break
		case "JUMP":
			handleJump(ctx)
			break
		case "WAIT":
			// 什么都不做
			break
	}

	if (dead) {
		return { reachedGoal: false, dead: true, animations, logs }
	}

	// 更新英雄位置
	state.hero = hero

	// 计算玩家动画总时长（用于按钮触发延迟）
	let playerAnimDuration = 0
	if (animations.length > 0) {
		// 找到最后一个动画的结束时间
		playerAnimDuration = animations.reduce((maxEnd, anim) => {
			const endTime = (anim.delay || 0) + anim.duration
			return Math.max(maxEnd, endTime)
		}, 0)
	}

	// 检查按钮触发（在玩家动画结束后）
	let triggeredButton = false
	if (checkButtonTrigger(state, hero.x, hero.y)) {
		triggeredButton = true
		handleButtonTrigger(ctx, playerAnimDuration)
	}

	// 检查是否到达终点
	const reachedGoal = checkGoalReached(state, hero.x, hero.y)

	return { reachedGoal, dead: false, animations, logs, triggeredButton }
}

/** 处理左移 */
function handleLeft(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldX = hero.x
	const oldY = hero.y
	const targetX = hero.x - 1

	const physics = createPhysicsContext(state, width, height)

	// 检查是否撞墙
	if (isWall(physics, targetX, hero.y)) {
		logs.push(`[WORLD] 向左移动失败：撞到墙(${targetX},${hero.y})`)
		return
	}

	// 水平移动
	hero.x = targetX

	// 检查新位置脚下是否有支撑
	if (!hasSupport(physics, hero.x, hero.y)) {
		// 需要坠落
		const groundY = findGroundY(physics, hero.x, hero.y)
		if (groundY < 0) {
			// 坠入虚空
			logs.push("[WORLD] 向左移动后脚下没有支撑，坠入虚空！")
			animations.push({
				type: "HERO_MOVE",
				target: "hero",
				from: { x: oldX, y: oldY },
				to: { x: hero.x, y: oldY },
				duration: ANIMATION_DURATION.heroMoveFast
			})
			animations.push({
				type: "HERO_FALL",
				target: "hero",
				from: { x: hero.x, y: oldY },
				to: { x: hero.x, y: -1 },
				duration: ANIMATION_DURATION.heroFallLong,
				delay: ANIMATION_DURATION.heroMoveFast
			})
			hero.y = -1
			ctx.hero = hero
		} else {
			// 坠落到下方平台
			hero.y = groundY + 1
			animations.push({
				type: "HERO_MOVE",
				target: "hero",
				from: { x: oldX, y: oldY },
				to: { x: hero.x, y: oldY },
				duration: ANIMATION_DURATION.heroMoveFast
			})
			animations.push({
				type: "HERO_FALL",
				target: "hero",
				from: { x: hero.x, y: oldY },
				to: { x: hero.x, y: hero.y },
				duration: ANIMATION_DURATION.heroFall,
				delay: ANIMATION_DURATION.heroMoveFast
			})
			logs.push(`[WORLD] 向左移动后坠落：从y=${oldY}坠落到y=${hero.y}`)
		}
	} else {
		// 有支撑，同高度水平移动
		animations.push({
			type: "HERO_MOVE",
			target: "hero",
			from: { x: oldX, y: oldY },
			to: { x: hero.x, y: oldY },
			duration: ANIMATION_DURATION.heroMove
		})
	}
}

/** 处理右移 */
function handleRight(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldX = hero.x
	const oldY = hero.y
	const targetX = hero.x + 1

	const physics = createPhysicsContext(state, width, height)

	// 检查是否撞墙
	if (isWall(physics, targetX, hero.y)) {
		logs.push(`[WORLD] 向右移动失败：撞到墙(${targetX},${hero.y})`)
		return
	}

	hero.x = targetX

	// 检查新位置脚下是否有支撑
	if (!hasSupport(physics, hero.x, hero.y)) {
		const groundY = findGroundY(physics, hero.x, hero.y)
		if (groundY < 0) {
			// 坠入虚空
			logs.push("[WORLD] 向右移动后脚下没有支撑，坠入虚空！")
			animations.push({
				type: "HERO_MOVE",
				target: "hero",
				from: { x: oldX, y: oldY },
				to: { x: hero.x, y: oldY },
				duration: ANIMATION_DURATION.heroMoveFast
			})
			animations.push({
				type: "HERO_FALL",
				target: "hero",
				from: { x: hero.x, y: oldY },
				to: { x: hero.x, y: -1 },
				duration: ANIMATION_DURATION.heroFallLong,
				delay: ANIMATION_DURATION.heroMoveFast
			})
			hero.y = -1
			ctx.hero = hero
		} else {
			hero.y = groundY + 1
			animations.push({
				type: "HERO_MOVE",
				target: "hero",
				from: { x: oldX, y: oldY },
				to: { x: hero.x, y: oldY },
				duration: ANIMATION_DURATION.heroMoveFast
			})
			animations.push({
				type: "HERO_FALL",
				target: "hero",
				from: { x: hero.x, y: oldY },
				to: { x: hero.x, y: hero.y },
				duration: ANIMATION_DURATION.heroFall,
				delay: ANIMATION_DURATION.heroMoveFast
			})
			logs.push(`[WORLD] 向右移动后坠落：从y=${oldY}坠落到y=${hero.y}`)
		}
	} else {
		animations.push({
			type: "HERO_MOVE",
			target: "hero",
			from: { x: oldX, y: oldY },
			to: { x: hero.x, y: oldY },
			duration: ANIMATION_DURATION.heroMove
		})
	}
}

/** 处理向左跳 */
function handleJumpLeft(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldPos = { ...hero }
	const targetX = hero.x - 1

	const physics = createPhysicsContext(state, width, height)

	// 跳跃不检查撞墙（抛物线可以越过墙）
	const landingY = findJumpLandingY(physics, targetX, hero.y)
	logs.push(`[WORLD] 向左跳跃: 从(${hero.x},${hero.y}) → x=${targetX}, 落点y=${landingY}`)

	if (landingY < 0) {
		// 坠入虚空
		logs.push("[WORLD] 左跳后坠入虚空！")
		hero.x = targetX
		hero.y = -1
		animations.push({
			type: "HERO_JUMP",
			target: "hero",
			from: oldPos,
			to: { x: targetX, y: -1 },
			duration: ANIMATION_DURATION.heroJumpLong
		})
		ctx.hero = hero
	} else {
		// 正常落地
		hero.x = targetX
		hero.y = landingY
		animations.push({
			type: "HERO_JUMP",
			target: "hero",
			from: oldPos,
			to: { ...hero },
			duration: ANIMATION_DURATION.heroJump
		})
	}
}

/** 处理向右跳 */
function handleJumpRight(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldPos = { ...hero }
	const targetX = hero.x + 1

	const physics = createPhysicsContext(state, width, height)

	const landingY = findJumpLandingY(physics, targetX, hero.y)
	logs.push(`[WORLD] 向右跳跃: 从(${hero.x},${hero.y}) → x=${targetX}, 落点y=${landingY}`)

	if (landingY < 0) {
		// 坠入虚空
		logs.push("[WORLD] 右跳后坠入虚空！")
		hero.x = targetX
		hero.y = -1
		animations.push({
			type: "HERO_JUMP",
			target: "hero",
			from: oldPos,
			to: { x: targetX, y: -1 },
			duration: ANIMATION_DURATION.heroJumpLong
		})
		ctx.hero = hero
	} else {
		// 正常落地
		hero.x = targetX
		hero.y = landingY
		animations.push({
			type: "HERO_JUMP",
			target: "hero",
			from: oldPos,
			to: { ...hero },
			duration: ANIMATION_DURATION.heroJump
		})
	}
}

/** 处理原地跳 */
function handleJump(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldPos = { ...hero }

	const physics = createPhysicsContext(state, width, height)
	const landingY = findJumpLandingY(physics, hero.x, hero.y)

	logs.push(`[WORLD] 原地跳跃: 扫描落点=${landingY}`)

	if (landingY > hero.y) {
		// 能跳到更高处
		hero.y = landingY
		animations.push({
			type: "HERO_JUMP",
			target: "hero",
			from: oldPos,
			to: { ...hero },
			duration: ANIMATION_DURATION.heroJump
		})
	} else if (landingY < 0) {
		// 虚空
		logs.push("[WORLD] 跳跃后坠入虚空！")
		hero.y = -1
		animations.push({
			type: "HERO_JUMP",
			target: "hero",
			from: oldPos,
			to: { x: hero.x, y: -1 },
			duration: ANIMATION_DURATION.heroJumpLong
		})
		ctx.hero = hero
	}
	// 否则原地不动（已经是最高的了）
}

/** 处理按钮触发效果
 * @param playerAnimDuration 玩家动画时长，按钮动画应在此之后开始
 */
function handleButtonTrigger(ctx: ActionContext, playerAnimDuration: number): void {
	const { state, hero, animations, logs } = ctx

	state.triggers[0] = true
	state.spikeFalling = true

	logs.push("[WORLD] 按钮触发！尖刺开始坠落...")

	// 按钮动画在玩家动画结束后开始
	animations.push({
		type: "BUTTON_PRESS",
		target: "button",
		from: { x: hero.x, y: hero.y - 1 },
		duration: ANIMATION_DURATION.buttonPress,
		delay: playerAnimDuration
	})

	// 尖刺坠落（紧接按钮动画）
	const spikeFromY = state.spikeY ?? 4
	const spikeToY = 1
	const SPIKE_PAUSE = 300 // 尖刺砸到敌人后的停顿时间

	animations.push({
		type: "SPIKE_FALL",
		target: "spike",
		from: { x: 4, y: spikeFromY },
		to: { x: 4, y: spikeToY },
		duration: ANIMATION_DURATION.spikeFall,
		delay: playerAnimDuration + ANIMATION_DURATION.buttonPress
	})

	state.spikeY = spikeToY

	// 击杀敌人（尖刺砸到后停顿一下再死）
	const killedEnemies = state.enemies.filter(e => e.x === 4 && e.y === spikeToY)
	if (killedEnemies.length > 0) {
		logs.push(`[WORLD] 尖刺击杀 ${killedEnemies.length} 个敌人！`)
		killedEnemies.forEach((enemy) => {
			animations.push({
				type: "ENEMY_DIE",
				target: `enemy-${enemy.x}-${enemy.y}`,
				from: { ...enemy },
				duration: ANIMATION_DURATION.enemyDie,
				delay: playerAnimDuration + ANIMATION_DURATION.buttonPress + ANIMATION_DURATION.spikeFall + SPIKE_PAUSE
			})
		})
		state.enemies = state.enemies.filter(e => !(e.x === 4 && e.y === spikeToY))
	}

	// 尖刺继续坠落到底（停顿后再落下）
	animations.push({
		type: "SPIKE_FALL",
		target: "spike",
		from: { x: 4, y: spikeToY },
		to: { x: 4, y: 0 },
		duration: ANIMATION_DURATION.spikeFallFast,
		delay: playerAnimDuration + ANIMATION_DURATION.buttonPress + ANIMATION_DURATION.spikeFall + SPIKE_PAUSE
	})
	state.spikeY = 0
}
