// ========== 动作执行逻辑 ==========

import type { WorldState, Position, ActionResult, AnimationEvent } from "../types/index.js"
import { ANIMATION_DURATION } from "../config.js"
import { assertEq } from "../../engine/utils/assert.js"
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
		case "JUMP_LEFT_FAR":
			handleJumpLeftFar(ctx)
			break
		case "JUMP_RIGHT_FAR":
			handleJumpRightFar(ctx)
			break
	}

	// 检查是否坠入虚空（死亡）
	if (hero.y < 0) {
		logs.push("[WORLD] 玩家坠入虚空，游戏结束！")
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
	const buttonIdx = checkButtonTrigger(state, hero.x, hero.y)
	if (buttonIdx >= 0) {
		triggeredButton = true
		handleButtonTrigger(ctx, playerAnimDuration, buttonIdx)
	}

	// 检查是否到达终点
	const reachedGoal = checkGoalReached(state, hero.x, hero.y)
	if (reachedGoal) {
		// 终点旗子动画
		animations.push({
			type: "GOAL_REACHED",
			target: "goal",
			from: { x: hero.x, y: hero.y },
			duration: 600,
			delay: playerAnimDuration
		})
	}

	return { reachedGoal, dead: false, animations, logs, triggeredButton }
}

/** 处理左移 */
function handleLeft(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldX = hero.x
	const oldY = hero.y
	const targetX = hero.x - 1

	const physics = createPhysicsContext(state, width, height)

	// 检查是否越界（走出边界会坠落虚空）
	if (targetX < 0) {
		logs.push("[WORLD] 向左走出边界，坠入虚空！")
		hero.x = targetX
		hero.y = -1
		animations.push({
			type: "HERO_MOVE",
			target: "hero",
			from: { x: oldX, y: oldY },
			to: { x: targetX, y: oldY },
			duration: ANIMATION_DURATION.heroMoveFast
		})
		animations.push({
			type: "HERO_FALL",
			target: "hero",
			from: { x: targetX, y: oldY },
			to: { x: targetX, y: -1 },
			duration: ANIMATION_DURATION.heroFallLong,
			delay: ANIMATION_DURATION.heroMoveFast
		})
		ctx.hero = hero
		return
	}

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

	// 检查是否越界（走出边界会坠落虚空）
	if (targetX >= width) {
		logs.push("[WORLD] 向右走出边界，坠入虚空！")
		hero.x = targetX
		hero.y = -1
		animations.push({
			type: "HERO_MOVE",
			target: "hero",
			from: { x: oldX, y: oldY },
			to: { x: targetX, y: oldY },
			duration: ANIMATION_DURATION.heroMoveFast
		})
		animations.push({
			type: "HERO_FALL",
			target: "hero",
			from: { x: targetX, y: oldY },
			to: { x: targetX, y: -1 },
			duration: ANIMATION_DURATION.heroFallLong,
			delay: ANIMATION_DURATION.heroMoveFast
		})
		ctx.hero = hero
		return
	}

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

/** 处理向左远跳（x-2） */
function handleJumpLeftFar(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldPos = { ...hero }
	const targetX = hero.x - 2

	const physics = createPhysicsContext(state, width, height)

	const landingY = findJumpLandingY(physics, targetX, hero.y)
	logs.push(`[WORLD] 向左远跳: 从(${hero.x},${hero.y}) → x=${targetX}, 落点y=${landingY}`)

	if (landingY < 0) {
		// 坠入虚空
		logs.push("[WORLD] 左远跳后坠入虚空！")
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

/** 处理向右远跳（x+2） */
function handleJumpRightFar(ctx: ActionContext): void {
	const { hero, animations, logs, state, width, height } = ctx
	const oldPos = { ...hero }
	const targetX = hero.x + 2

	const physics = createPhysicsContext(state, width, height)

	const landingY = findJumpLandingY(physics, targetX, hero.y)
	logs.push(`[WORLD] 向右远跳: 从(${hero.x},${hero.y}) → x=${targetX}, 落点y=${landingY}`)

	if (landingY < 0) {
		// 坠入虚空
		logs.push("[WORLD] 右远跳后坠入虚空！")
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


/** 处理按钮触发效果
 * @param playerAnimDuration 玩家动画时长，按钮动画应在此之后开始
 * @param buttonIdx 按钮索引，对应控制第几个尖刺
 */
function handleButtonTrigger(ctx: ActionContext, playerAnimDuration: number, buttonIdx: number): void {
	const { state, hero, animations, logs } = ctx

	// 标记按钮已触发
	state.triggers[buttonIdx] = true

	// 断言：按钮触发后状态必须为 true
	assertEq(state.triggers[buttonIdx], true, `按钮${buttonIdx}触发后状态断言`, {
		buttonIdx,
		triggers: state.triggers
	})

	// 获取对应的尖刺
	const spike = state.spikes[buttonIdx]
	if (!spike || spike.triggered) return

	spike.triggered = true
	spike.falling = true

	logs.push(`[WORLD] 按钮${buttonIdx + 1}触发！对应尖刺(x=${spike.x})开始坠落...`)

	// 查找尖刺下方的敌人（动态检测）
	const enemyBelow = state.enemies.find(e => e.x === spike.x && e.y < spike.currentY)
	const spikeToY = enemyBelow ? enemyBelow.y : -1  // 有敌人就砸到敌人位置，否则直接落入虚空
	const SPIKE_PAUSE = 300 // 尖刺砸到敌人后的停顿时间

	// 按钮动画在玩家动画结束后开始（包含演出镜头信息）
	// 相机会：1.缓动到尖刺位置 -> 2.实时跟随尖刺下落 -> 3.缓动回玩家位置
	animations.push({
		type: "BUTTON_PRESS",
		target: `button-${buttonIdx}`,
		from: { x: hero.x, y: hero.y - 1 },
		duration: ANIMATION_DURATION.buttonPress,
		delay: playerAnimDuration,
		payload: {
			cinematic: true,
			spikeIdx: buttonIdx,           // 要跟踪的尖刺索引
			spikeStartY: spike.currentY,   // 尖刺起始Y位置
			spikeTargetY: spikeToY,        // 尖刺目标Y位置
			cinematicDuration: 500,        // 镜头移动到尖刺位置的时间
			followDuration: ANIMATION_DURATION.spikeFall,  // 跟随尖刺下落的时间
			waitDuration: SPIKE_PAUSE      // 停顿时间
		}
	})

	// 尖刺第一阶段：坠落到敌人位置（或虚空）
	animations.push({
		type: "SPIKE_FALL",
		target: `spike-${buttonIdx}`,
		from: { x: spike.x, y: spike.currentY },
		to: { x: spike.x, y: spikeToY },
		duration: ANIMATION_DURATION.spikeFall,
		delay: playerAnimDuration + ANIMATION_DURATION.buttonPress
	})

	// 击杀敌人（如果有）
	if (enemyBelow) {
		logs.push(`[WORLD] 尖刺击杀敌人(${enemyBelow.x}, ${enemyBelow.y})！`)
		animations.push({
			type: "ENEMY_DIE",
			target: `enemy-${enemyBelow.x}-${enemyBelow.y}`,
			from: { ...enemyBelow },
			duration: ANIMATION_DURATION.enemyDie,
			delay: playerAnimDuration + ANIMATION_DURATION.buttonPress + ANIMATION_DURATION.spikeFall + SPIKE_PAUSE
		})
		state.enemies = state.enemies.filter(e => !(e.x === enemyBelow.x && e.y === enemyBelow.y))
	}

	// 尖刺第二阶段：有敌人时才需要停顿后继续坠落，无敌人直接落入虚空（已在第一阶段完成）
	if (enemyBelow) {
		animations.push({
			type: "SPIKE_FALL",
			target: `spike-${buttonIdx}`,
			from: { x: spike.x, y: spikeToY },
			to: { x: spike.x, y: -1 },  // 落入虚空
			duration: ANIMATION_DURATION.spikeFallFast,
			delay: playerAnimDuration + ANIMATION_DURATION.buttonPress + ANIMATION_DURATION.spikeFall + SPIKE_PAUSE
		})
	}

	// 注意：spike.currentY 不应该在这里更新，因为动画还没开始
	// 动画完成后会在渲染层更新位置
}
