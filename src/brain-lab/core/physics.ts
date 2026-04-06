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
 */
export function isWall(ctx: PhysicsContext, x: number, y: number): boolean {
	if (x < 0 || x >= ctx.width || y < 0 || y >= ctx.height) return true  // 边界也是墙
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
	const cell = ctx.grid[y - 1][x]
	return cell === Element.PLATFORM || cell === Element.BUTTON
	// GOAL 不是支撑，玩家站在终点上会落下
}

/**
 * 寻找指定列中，玩家能站立的落点Y坐标
 * 跳跃高度2格：从原Y出发，最高能到原Y+2的位置
 */
export function findJumpLandingY(
	ctx: PhysicsContext, 
	targetX: number, 
	fromY: number
): number {
	const maxReachY = fromY + 2  // 跳跃最高能到达的Y（玩家位置）
	const platformSearchStart = maxReachY - 1  // 对应的平台Y

	// 从高往低扫描平台
	for (let py = platformSearchStart; py >= 0; py--) {
		if (hasSupport(ctx, targetX, py + 1)) {
			return py + 1  // 站在平台上方一格
		}
	}

	// 整列没有平台，落到虚空
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
 */
export function checkButtonTrigger(state: WorldState, x: number, y: number): boolean {
	return y > 0 && state.grid[y - 1][x] === Element.BUTTON && !state.triggers[0]
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
