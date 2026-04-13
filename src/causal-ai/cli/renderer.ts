// ========== 渲染 ==========

import type { LocalView, GameObject } from "./types"

export function renderView(view: LocalView): string {
	const range = Math.floor((view.width - 1) / 2)
	let output = `\n局部视野 (${view.width}x${view.height}):\n`

	for (let dy = -range; dy <= range; dy++) {
		let row = ""
		for (let dx = -range; dx <= range; dx++) {
			const cell = view.cells.get(`${dx},${dy}`)
			const char = renderCell(cell?.tile.type, cell?.objects)
			row += char + " "
		}
		output += row + "\n"
	}

	return output
}

function renderCell(tileType?: string, objects?: GameObject[]): string {
	// 有对象时优先显示对象（玩家和其他对象重叠时，优先显示其他对象）
	if (objects && objects.length > 0) {
		// 先找非玩家的对象
		const obj = objects.find(o => o.type !== "agent") || objects[0]!
		switch (obj.type) {
		case "agent": return "＠"
		case "钥匙": return "🔑"
		case "门": return obj.state?.open ? "🚪" : "🚧"
		case "终点": return "🚩"
		default: return "？"
		}
	}

	// 显示地形
	switch (tileType) {
	case "wall": return "＃"
	case "floor": return "．"
	case "water": return "～"
	case "void": return "／"  // 虚空（地图外）
	default: return "？"
	}
}
