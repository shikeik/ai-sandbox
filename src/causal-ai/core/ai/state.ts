// ========== 状态转换：世界 → 谓词集合 ==========

import type { State, Predicate } from "./types"
import type { LocalView } from "../world/types"
import type { Position } from "../world/types"

/**
 * 将玩家状态和局部视野转换为谓词集合
 * 
 * 示例输出:
 * - "at(agent,0,0)"          // 玩家位置（相对视野中心）
 * - "facing(右)"              // 面朝方向
 * - "holding(key)"            // 持有钥匙
 * - "cell_empty(1,0)"         // 右边是空地
 * - "cell_wall(-1,0)"         // 左边是墙
 * - "at(key,1,1)"             // 钥匙在右下
 * - "at(door,2,0)"            // 门在右边
 * - "door_open(door_1)"       // 门开着
 */
export function stateToPredicates(
	playerPos: Position,
	playerFacing: string,
	hasKey: boolean,
	view: LocalView
): State {
	const predicates: Set<Predicate> = new Set()

	// 玩家自身状态（视野中心是 0,0）
	predicates.add("at(agent,0,0)")
	predicates.add(`facing(${playerFacing})`)
	predicates.add(hasKey ? "holding(key)" : "holding(none)")

	// 视野中的每个格子
	for (const [key, cell] of view.cells) {
		const [dx, dy] = key.split(",").map(Number)
		if (isNaN(dx!) || isNaN(dy!)) continue

		// 跳过中心（玩家位置）
		if (dx === 0 && dy === 0) continue

		// 地形
		if (cell.tile.type === "wall") {
			predicates.add(`cell_wall(${dx},${dy})`)
		} else if (cell.tile.type === "floor") {
			predicates.add(`cell_empty(${dx},${dy})`)
		}

		// 对象
		for (const obj of cell.objects) {
			switch (obj.type) {
			case "钥匙":
				predicates.add(`at(key,${dx},${dy})`)
				break
			case "门":
				predicates.add(`at(door,${dx},${dy})`)
				if (obj.state?.open) {
					predicates.add(`door_open(${dx},${dy})`)
				} else {
					predicates.add(`door_closed(${dx},${dy})`)
				}
				break
			case "终点":
				predicates.add(`at(goal,${dx},${dy})`)
				break
			}
		}
	}

	return predicates
}

/**
 * 将谓词集合转换为可读的字符串
 */
export function stateToString(state: State): string {
	return Array.from(state).sort().join(", ")
}
