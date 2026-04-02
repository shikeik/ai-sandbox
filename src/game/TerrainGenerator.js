import { CONFIG, TERRAIN } from './JumpGame.js'

/**
 * 地形生成器
 * 简单随机生成地面和坑（支持1~2格双坑）
 */
export class TerrainGenerator {
	static generate() {
		const terrain = []
		let currentGrid = 0
		let lastWasPit = false

		// 起点 2 格地面
		terrain.push({ type: TERRAIN.GROUND, startGrid: 0, length: 2 })
		currentGrid = 2

		while (currentGrid < CONFIG.WORLD_LENGTH - 2) {
			if (lastWasPit) {
				// 坑后必须接地面
				const len = 1 + Math.floor(Math.random() * 3) // 1~3格地面
				terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: len })
				currentGrid += len
				lastWasPit = false
			} else {
				if (Math.random() < 0.55) {
					// 生成地面
					const len = 1 + Math.floor(Math.random() * 3) // 1~3格
					terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: len })
					currentGrid += len
					lastWasPit = false
				} else {
					// 生成坑：单坑或双坑
					const len = Math.random() < 0.6 ? 1 : 2
					terrain.push({ type: TERRAIN.PIT, startGrid: currentGrid, length: len })
					currentGrid += len
					lastWasPit = true
				}
			}
		}

		// 终点后延伸 5 格地面
		const finalLen = Math.max(CONFIG.WORLD_LENGTH + 5 - currentGrid, 1)
		terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: finalLen })

		return this._toPxFormat(terrain)
	}

	static _toPxFormat(terrain) {
		return terrain.map(t => ({
			type: t.type,
			start: CONFIG.toPx(t.startGrid),
			end: CONFIG.toPx(t.startGrid + t.length)
		}))
	}
}

export default TerrainGenerator
