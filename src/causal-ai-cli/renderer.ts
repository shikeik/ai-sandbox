// ========== 渲染 ==========

import type { LocalView } from "./types"

export function renderView(view: LocalView): string {
	let output = "\n局部视野 (5x5):\n"

	for (let dy = -2; dy <= 2; dy++) {
		let row = ""
		for (let dx = -2; dx <= 2; dx++) {
			const cell = view.cells.get(`${dx},${dy}`)
			let char = cell?.terrain || "？"

			if (cell?.objects.length) {
				const obj = cell.objects[0]
				switch (obj.type) {
				case "agent": char = "＠"; break
				case "钥匙": char = "🔑"; break
				case "门": char = obj.state?.open ? "🚪" : "🚧"; break
				case "终点": char = "🚩"; break
				}
			}

			if (dx === 0 && dy === 0) {
				row += char + " "
			} else {
				row += char + " "
			}
		}
		output += row + "\n"
	}

	return output
}
