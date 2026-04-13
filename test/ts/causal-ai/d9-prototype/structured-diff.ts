// ========== 结构化差异提取器（原型）==========

import type { Action, LocalView, Tile, GameObject } from "../../../../src/causal-ai/meta-gridworld/types"
import type { Observation } from "../../../../src/causal-ai/agent-api/types"
import { getDirectionDelta } from "../../../../src/causal-ai/core/utils/position"

export interface CellSnapshot {
	tileType: string
	objects: { type: string; state?: Record<string, unknown> }[]
}

export interface StructuredTransition {
	action: Action
	agentMoved: boolean
	agentDelta: { dx: number; dy: number }
	inventoryChanged: boolean
	inventoryDelta: { added: string[]; removed: string[] }
	// 以世界坐标为 key 的变化映射
	worldChanges: Map<string, { before: CellSnapshot; after: CellSnapshot }>
	// 针对移动类动作，提取的关键上下文（以 agent 为原点的相对坐标）
	actionContext?: {
		targetCell: { relX: number; relY: number; walkable: boolean }
	}
}

function snapshotCell(tile: Tile, objects: GameObject[]): CellSnapshot {
	return {
		tileType: tile.type,
		objects: objects.map(o => ({ type: o.type, state: o.state }))
	}
}

function viewToWorldMap(view: LocalView, agentPos: { x: number; y: number }): Map<string, CellSnapshot> {
	const map = new Map<string, CellSnapshot>()
	for (const [key, cell] of view.cells) {
		const [dx, dy] = key.split(",").map(Number)
		const wx = agentPos.x + dx
		const wy = agentPos.y + dy
		map.set(`${wx},${wy}`, snapshotCell(cell.tile, cell.objects))
	}
	return map
}

function diffInventory(a: string[], b: string[]): { added: string[]; removed: string[] } {
	const added = b.filter(i => !a.includes(i))
	const removed = a.filter(i => !b.includes(i))
	return { added, removed }
}

function diffSnapshots(a: CellSnapshot, b: CellSnapshot): boolean {
	if (a.tileType !== b.tileType) return true
	if (a.objects.length !== b.objects.length) return true
	for (let i = 0; i < a.objects.length; i++) {
		if (a.objects[i]!.type !== b.objects[i]!.type) return true
		// 简化：只比较 state 的 open 属性（门）
		if (a.objects[i]!.state?.open !== b.objects[i]!.state?.open) return true
	}
	return false
}

export function extractStructuredDiff(
	before: Observation,
	after: Observation,
	action: Action
): StructuredTransition {
	const agentDelta = {
		dx: after.agent.pos.x - before.agent.pos.x,
		dy: after.agent.pos.y - before.agent.pos.y
	}

	const inventoryDelta = diffInventory(before.agent.inventory, after.agent.inventory)

	// 对齐到世界坐标比较
	const beforeMap = viewToWorldMap(before.localView, before.agent.pos)
	const afterMap = viewToWorldMap(after.localView, after.agent.pos)

	const worldChanges = new Map<string, { before: CellSnapshot; after: CellSnapshot }>()
	const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()])
	for (const key of allKeys) {
		const b = beforeMap.get(key) || { tileType: "void", objects: [] }
		const a = afterMap.get(key) || { tileType: "void", objects: [] }
		if (diffSnapshots(b, a)) {
			worldChanges.set(key, { before: b, after: a })
		}
	}

	// 提取移动类动作的上下文
	let actionContext: StructuredTransition["actionContext"] | undefined
	const moveActions = ["上", "下", "左", "右"] as const
	if (moveActions.includes(action as typeof moveActions[number])) {
		const [dx, dy] = getDirectionDelta(action)
		const targetKey = `${before.agent.pos.x + dx},${before.agent.pos.y + dy}`
		const targetBefore = beforeMap.get(targetKey)
		actionContext = {
			targetCell: {
				relX: dx,
				relY: dy,
				walkable: targetBefore ? targetBefore.tileType !== "wall" : false
			}
		}
	}

	return {
		action,
		agentMoved: agentDelta.dx !== 0 || agentDelta.dy !== 0,
		agentDelta,
		inventoryChanged: inventoryDelta.added.length > 0 || inventoryDelta.removed.length > 0,
		inventoryDelta,
		worldChanges,
		actionContext
	}
}
