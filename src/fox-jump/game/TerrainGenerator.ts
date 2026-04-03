import { CONFIG, TERRAIN } from "./JumpGame.js"
import { SeededRandom } from "@utils/SeededRandom.js"

/**
 * 地形元素类型
 */
export type TerrainElement = "ground" | "singlePit" | "doublePit"

/**
 * 地形权重配置
 */
export interface TerrainWeights {
	ground: number
	singlePit: number
	doublePit: number
}

/**
 * 元素开关配置
 */
export interface TerrainEnabled {
	ground: boolean
	singlePit: boolean
	doublePit: boolean
}

/**
 * 地形配置选项
 */
export interface TerrainOptions {
	seed?: number
	weights?: TerrainWeights
	enabled?: TerrainEnabled
}

/**
 * 地形统计数据
 */
export interface TerrainStats {
	ground: number
	singlePit: number
	doublePit: number
}

/**
 * 地形段（像素格式）
 */
export interface TerrainSegment {
	type: string
	start: number
	end: number
}

/**
 * 地形生成结果
 */
export interface TerrainResult {
	terrain: TerrainSegment[]
	seed: number
	stats: TerrainStats
}

/**
 * 地形生成器（种子化版本）
 * 支持可复现的随机地形生成 + 元素权重配置
 * 
 * 元素类型：
 * - ground: 平地（任意长度）
 * - singlePit: 单格坑
 * - doublePit: 双格坑
 * 
 * 配置选项：
 * - seed: 随机种子
 * - weights: { ground, singlePit, doublePit } 各元素权重
 * - lengthRanges: 各元素长度范围
 */
export class TerrainGenerator {
	// 默认权重配置
	static readonly DEFAULT_WEIGHTS: TerrainWeights = {
		ground: 50,
		singlePit: 30,
		doublePit: 20
	}

	// 元素ID常量
	static readonly ELEMENTS = {
		GROUND: "ground",
		SINGLE_PIT: "singlePit",
		DOUBLE_PIT: "doublePit"
	} as const

	/**
	 * 生成地形
	 * @param options - 配置选项
	 */
	static generate(options: TerrainOptions = {}): TerrainResult {
		const {
			seed = Date.now(),
			weights = this.DEFAULT_WEIGHTS,
			enabled = { ground: true, singlePit: true, doublePit: true }
		} = options

		const rng = new SeededRandom(seed)
		
		// 计算有效权重
		const effectiveWeights = this._calculateEffectiveWeights(weights, enabled)
		const totalWeight = Object.values(effectiveWeights).reduce((a, b) => a + b, 0)
		
		if (totalWeight === 0) {
			console.warn("TERRAIN", "所有元素权重为0，使用默认配置")
			effectiveWeights.ground = 1
		}

		console.log("TERRAIN", `开始生成地形 | 种子=${seed} 权重=`, effectiveWeights)

		const terrain: { type: string, startGrid: number, length: number }[] = []
		let currentGrid = 0
		let lastWasPit = false
		const stats: TerrainStats = { ground: 0, singlePit: 0, doublePit: 0 }

		// 起点 2 格地面
		terrain.push({ type: TERRAIN.GROUND, startGrid: 0, length: 2 })
		currentGrid = 2

		while (currentGrid < CONFIG.WORLD_LENGTH - 2) {
			if (lastWasPit) {
				// 坑后必须接地面
				const len = rng.randomInt(1, 4)
				terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: len })
				currentGrid += len
				lastWasPit = false
				stats.ground++
			} else {
				// 根据权重选择元素
				const element = this._pickElement(rng, effectiveWeights, totalWeight)
				
				switch (element) {
					case this.ELEMENTS.GROUND:
						terrain.push({ 
							type: TERRAIN.GROUND, 
							startGrid: currentGrid, 
							length: rng.randomInt(1, 4) 
						})
						currentGrid += terrain[terrain.length - 1].length
						lastWasPit = false
						stats.ground++
						break
						
					case this.ELEMENTS.SINGLE_PIT:
						terrain.push({ type: TERRAIN.PIT, startGrid: currentGrid, length: 1 })
						currentGrid += 1
						lastWasPit = true
						stats.singlePit++
						break
						
					case this.ELEMENTS.DOUBLE_PIT:
						terrain.push({ type: TERRAIN.PIT, startGrid: currentGrid, length: 2 })
						currentGrid += 2
						lastWasPit = true
						stats.doublePit++
						break
				}
			}
		}

		// 终点后延伸 5 格地面
		const finalLen = Math.max(CONFIG.WORLD_LENGTH + 5 - currentGrid, 1)
		terrain.push({ type: TERRAIN.GROUND, startGrid: currentGrid, length: finalLen })

		console.log("TERRAIN", `地形生成完成 | 种子=${seed} 统计=`, stats)

		return {
			terrain: this._toPxFormat(terrain),
			seed,
			stats
		}
	}

	/**
	 * 计算有效权重（考虑开关状态）
	 */
	private static _calculateEffectiveWeights(weights: TerrainWeights, enabled: TerrainEnabled): TerrainWeights {
		return {
			ground: enabled.ground ? (weights.ground ?? 50) : 0,
			singlePit: enabled.singlePit ? (weights.singlePit ?? 30) : 0,
			doublePit: enabled.doublePit ? (weights.doublePit ?? 20) : 0
		}
	}

	/**
	 * 根据权重随机选择元素
	 */
	private static _pickElement(rng: SeededRandom, weights: TerrainWeights, totalWeight: number): string {
		const r = rng.random() * totalWeight
		let cumulative = 0
		
		cumulative += weights.ground
		if (r < cumulative) return this.ELEMENTS.GROUND
		
		cumulative += weights.singlePit
		if (r < cumulative) return this.ELEMENTS.SINGLE_PIT
		
		return this.ELEMENTS.DOUBLE_PIT
	}

	/**
	 * 转换为像素格式
	 */
	private static _toPxFormat(terrain: { type: string, startGrid: number, length: number }[]): TerrainSegment[] {
		return terrain.map(t => ({
			type: t.type,
			start: CONFIG.toPx(t.startGrid),
			end: CONFIG.toPx(t.startGrid + t.length)
		}))
	}
}

export default TerrainGenerator
