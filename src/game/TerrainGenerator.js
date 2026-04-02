import { CONFIG, TERRAIN } from './JumpGame.js'
import { SeededRandom } from '@utils/SeededRandom.js'

/**
 * 地形生成器（种子化版本）
 * 支持可复现的随机地形生成
 * 
 * 配置选项：
 * - seed: 随机种子（默认当前时间）
 * - pitProbability: 坑生成概率 0~1（默认0.55）
 * - doublePitProbability: 双坑概率 0~1（默认0.6）
 * - groundLengthRange: [min, max] 地面长度范围（默认[1,3]）
 */
export class TerrainGenerator {
	static generate(options = {}) {
		const {
			seed = Date.now(),
			pitProbability = 0.55,
			doublePitProbability = 0.4,
			groundLengthRange = [1, 3]
		} = options

		const rng = new SeededRandom(seed)
		console.log('[TERRAIN]', `开始生成地形 | 种子=${seed} 坑概率=${pitProbability} 双坑概率=${doublePitProbability}`)

		const terrain = []
		let currentGrid = 0
		let lastWasPit = false
		let pitCount = 0
		let doublePitCount = 0

		// 起点 2 格地面
		terrain.push({ type: TERRAIN.GROUND, startGrid: 0, length: 2 })
		currentGrid = 2

		while (currentGrid < CONFIG.WORLD_LENGTH - 2) {
			if (lastWasPit) {
				// 坑后必须接地面
				const len = rng.randomInt(groundLengthRange[0], groundLengthRange[1] + 1)
				terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: len })
				currentGrid += len
				lastWasPit = false
			} else {
				if (rng.chance(1 - pitProbability)) {
					// 生成地面
					const len = rng.randomInt(groundLengthRange[0], groundLengthRange[1] + 1)
					terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: len })
					currentGrid += len
					lastWasPit = false
				} else {
					// 生成坑：单坑或双坑
					const isDoublePit = rng.chance(doublePitProbability)
					const len = isDoublePit ? 2 : 1
					if (isDoublePit) doublePitCount++
					pitCount++
					terrain.push({ type: TERRAIN.PIT, startGrid: currentGrid, length: len })
					currentGrid += len
					lastWasPit = true
				}
			}
		}

		// 终点后延伸 5 格地面
		const finalLen = Math.max(CONFIG.WORLD_LENGTH + 5 - currentGrid, 1)
		terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: finalLen })

		console.log('[TERRAIN]', `地形生成完成 | 种子=${seed} 坑总数=${pitCount} 双坑=${doublePitCount} 地形段=${terrain.length}`)

		return {
			terrain: this._toPxFormat(terrain),
			seed,
			stats: { pitCount, doublePitCount, segments: terrain.length }
		}
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
