// ========== 物理规则 ==========

import type { WorldState } from "../types/index.js"
import { Element } from "../types/index.js"

/** 物理引擎上下文 */
export interface PhysicsContext {
	width: number
	height: number
	grid: number[][]
}

/**
 * 创建物理引擎上下文
 */
export function createPhysicsContext(state: WorldState, width: number, height: number): PhysicsContext {
	return {
		width,
		height,
		grid: state.grid,
	}
}

/**
 * 检查指定格子是否是墙（有碰撞）
 * 终点不是墙，可以走进去触发胜利
 * 注：边界（x<0, x>=width 等）不算墙，走出边界会坠落虚空
 */
export function isWall(ctx: PhysicsContext, x: number, y: number): boolean {
	if (x < 0 || x >= ctx.width || y < 0 || y >= ctx.height) return false  // 边界不算墙
	if (!ctx.grid[y]) return true  // 行不存在视为墙
	const cell = ctx.grid[y][x]
	return cell === Element.PLATFORM || cell === Element.BUTTON
	// GOAL 不是墙，可以走进去
}

/**
 * 检查指定位置是否有支撑（平台/按钮）
 * 注意：终点不是支撑，玩家会穿过终点落下
 */
export function hasSupport(ctx: PhysicsContext, x: number, y: number): boolean {
	if (y < 0) return false
	if (y === 0) return true  // 地面层总有支撑
	if (y > ctx.height) return false  // 超出地图高度
	const cell = ctx.grid[y - 1][x]
	return cell === Element.PLATFORM || cell === Element.BUTTON
	// GOAL 不是支撑，玩家站在终点上会落下
}

/**
 * 寻找指定列中，玩家能站立的落点Y坐标
 * 跳跃高度2格：从原Y出发，最高能到原Y+2的位置
 * 注意：不能落在墙中（PLATFORM/BUTTON），需要继续往下找
 */
export function findJumpLandingY(
	ctx: PhysicsContext, 
	targetX: number, 
	fromY: number
): number {
	// 边界检查
	if (targetX < 0 || targetX >= ctx.width) return -1

	const maxReachY = fromY + 2  // 跳跃最高能到达的Y（玩家位置）
	const platformSearchStart = Math.min(maxReachY - 1, ctx.height - 1)  // 限制在地图范围内

	// 从高往低扫描平台
	for (let py = platformSearchStart; py >= 0; py--) {
		if (hasSupport(ctx, targetX, py + 1)) {
			const landingY = py + 1  // 候选落点
			// 检查落点本身是否是墙（不能站在墙里）
			if (!isWall(ctx, targetX, landingY)) {
				return landingY
			}
			// 是墙，继续往下找
		}
	}

	// 整列没有合适的平台，落到虚空
	return -1
}

/**
 * 寻找玩家下方的支撑平台y坐标
 */
export function findGroundY(ctx: PhysicsContext, x: number, startY: number): number {
	for (let y = startY - 1; y >= 0; y--) {
		if (hasSupport(ctx, x, y + 1)) {
			return y
		}
	}
	return -1  // 没有支撑
}

/**
 * 寻找某x列的最近平台y坐标（从上往下找，返回平台所在y）
 * 用于AI预测
 */
export function findPlatformY(grid: number[][], x: number, startY: number): number {
	// 从startY往下找（y减小），找第一个能支撑的平台
	for (let y = startY; y >= 0; y--) {
		if (grid[y][x] === Element.PLATFORM ||
		    grid[y][x] === Element.BUTTON) {
			return y  // 站在平台上（终点不是平台）
		}
	}
	return 0  // 默认回到地面
}

/**
 * 检查是否触发按钮
 * @returns 按钮索引，如果没有触发则返回 -1
 */
export function checkButtonTrigger(state: WorldState, x: number, y: number): number {
	if (y <= 0) return -1
	if (state.grid[y - 1][x] !== Element.BUTTON) return -1

	// 找到这个按钮对应的索引（按x坐标排序后匹配）
	const buttons: { x: number; y: number; idx: number }[] = []
	for (let py = 0; py < state.grid.length; py++) {
		for (let px = 0; px < state.grid[py].length; px++) {
			if (state.grid[py][px] === Element.BUTTON) {
				buttons.push({ x: px, y: py, idx: buttons.length })
			}
		}
	}
	buttons.sort((a, b) => a.x - b.x)

	// 找到当前按钮的索引
	const btn = buttons.find(b => b.x === x && b.y === y - 1)
	if (!btn) return -1

	// 检查是否已触发
	return !state.triggers[btn.idx] ? btn.idx : -1
}

/**
 * 检查是否到达终点
 * 玩家身体与终点重叠时触发（终点不是固体，玩家会穿过）
 */
export function checkGoalReached(state: WorldState, x: number, y: number): boolean {
	// 检查玩家脚下或当前位置是否是终点
	if (y > 0 && state.grid[y - 1][x] === Element.GOAL) return true
	// 玩家正在下落穿过终点时也触发
	if (y >= 0 && y < state.grid.length && state.grid[y][x] === Element.GOAL) return true
	return false
}
