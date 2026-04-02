/**
 * 伪随机数生成器（基于种子）
 * 使用 Mulberry32 算法，性能高且分布均匀
 * 
 * 特点：
 * - 相同种子产生相同随机序列
 * - 支持整数和浮点数随机
 * - 支持范围随机
 */
export class SeededRandom {
	private seed: number
	private initialSeed: number

	constructor(seed: number = Date.now()) {
		this.seed = seed
		this.initialSeed = seed
		console.log("[SEED]", `初始化随机生成器 | 种子=${seed}`)
	}

	/**
	 * 重置随机状态到初始种子
	 */
	reset(): void {
		this.seed = this.initialSeed
		console.log("[SEED]", `重置随机状态 | 种子=${this.seed}`)
	}

	/**
	 * 设置新种子
	 */
	setSeed(newSeed: number): void {
		this.seed = newSeed
		this.initialSeed = newSeed
		console.log("[SEED]", `设置新种子 | 种子=${newSeed}`)
	}

	/**
	 * 生成下一个随机整数（Mulberry32算法核心）
	 * @returns 32位无符号整数
	 */
	next(): number {
		let t = this.seed += 0x6D2B79F5
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0)
	}

	/**
	 * 生成 0~1 的随机浮点数
	 * @returns 0 <= n < 1
	 */
	random(): number {
		return this.next() / 4294967296
	}

	/**
	 * 生成指定范围的随机整数
	 * @param min - 最小值（包含）
	 * @param max - 最大值（不包含）
	 * @returns min <= n < max
	 */
	randomInt(min: number, max: number): number {
		return min + (this.next() % (max - min))
	}

	/**
	 * 生成指定范围的随机浮点数
	 * @param min - 最小值
	 * @param max - 最大值
	 * @returns min <= n < max
	 */
	randomFloat(min: number, max: number): number {
		return min + this.random() * (max - min)
	}

	/**
	 * 根据概率判断是否触发（伯努利试验）
	 * @param probability - 概率 0~1
	 * @returns 
	 */
	chance(probability: number): boolean {
		return this.random() < probability
	}

	/**
	 * 从数组中随机选择一个元素
	 * @param array 
	 * @returns
	 */
	pick<T>(array: T[]): T {
		return array[this.randomInt(0, array.length)]
	}

	/**
	 * 获取当前状态信息
	 */
	getInfo(): { seed: number, current: number, calls: number } {
		return {
			seed: this.initialSeed,
			current: this.seed,
			calls: (this.seed - this.initialSeed) / 0x6D2B79F5
		}
	}
}

export default SeededRandom
