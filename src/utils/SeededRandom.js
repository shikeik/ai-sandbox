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
	constructor(seed = Date.now()) {
		this.seed = seed
		this.initialSeed = seed
		console.log('[SEED]', `初始化随机生成器 | 种子=${seed}`)
	}

	/**
	 * 重置随机状态到初始种子
	 */
	reset() {
		this.seed = this.initialSeed
		console.log('[SEED]', `重置随机状态 | 种子=${this.seed}`)
	}

	/**
	 * 设置新种子
	 */
	setSeed(newSeed) {
		this.seed = newSeed
		this.initialSeed = newSeed
		console.log('[SEED]', `设置新种子 | 种子=${newSeed}`)
	}

	/**
	 * 生成下一个随机整数（Mulberry32算法核心）
	 * @returns {number} 32位无符号整数
	 */
	next() {
		let t = this.seed += 0x6D2B79F5
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0)
	}

	/**
	 * 生成 0~1 的随机浮点数
	 * @returns {number} 0 <= n < 1
	 */
	random() {
		return this.next() / 4294967296
	}

	/**
	 * 生成指定范围的随机整数
	 * @param {number} min - 最小值（包含）
	 * @param {number} max - 最大值（不包含）
	 * @returns {number} min <= n < max
	 */
	randomInt(min, max) {
		return min + (this.next() % (max - min))
	}

	/**
	 * 生成指定范围的随机浮点数
	 * @param {number} min - 最小值
	 * @param {number} max - 最大值
	 * @returns {number} min <= n < max
	 */
	randomFloat(min, max) {
		return min + this.random() * (max - min)
	}

	/**
	 * 根据概率判断是否触发（伯努利试验）
	 * @param {number} probability - 概率 0~1
	 * @returns {boolean} 
	 */
	chance(probability) {
		return this.random() < probability
	}

	/**
	 * 从数组中随机选择一个元素
	 * @param {Array} array 
	 * @returns {any}
	 */
	pick(array) {
		return array[this.randomInt(0, array.length)]
	}

	/**
	 * 获取当前状态信息
	 */
	getInfo() {
		return {
			seed: this.initialSeed,
			current: this.seed,
			calls: (this.seed - this.initialSeed) / 0x6D2B79F5
		}
	}
}

export default SeededRandom
