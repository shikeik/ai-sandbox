/**
 * 玩家最佳记录存储
 * 只记录玩家模式的最快通关时间
 */

import { formatTimeMs } from '@utils/timeUtils.js'

const PLAYER_BEST_KEY = 'ai-sandbox-player-best-ms'

export class PlayerBestStore {
	private bestTime: number

	constructor() {
		this.bestTime = this.load()
	}
	
	private load(): number {
		try {
			const stored = localStorage.getItem(PLAYER_BEST_KEY)
			if (!stored) return Infinity
			const value = parseInt(stored, 10)
			return value > 0 ? value : Infinity
		} catch (e) {
			return Infinity
		}
	}
	
	private save(time: number): void {
		try {
			localStorage.setItem(PLAYER_BEST_KEY, time.toString())
		} catch (e) {
			console.warn('[STORAGE]', 'Failed to save player best:', e)
		}
	}
	
	/**
	 * 尝试更新最佳记录
	 * @param time - 通关时间（毫秒）
	 * @returns 是否更新成功（新记录更快）
	 */
	tryUpdate(time: number): boolean {
		if (!time || time <= 0) return false
		if (time < this.bestTime) {
			this.bestTime = time
			this.save(time)
			return true
		}
		return false
	}
	
	/**
	 * 获取最佳时间（格式化）
	 * @returns mm:ss.mmm 格式，无记录返回 '--:--.---'
	 */
	getFormatted(): string {
		if (this.bestTime === Infinity || this.bestTime <= 0) return '--:--.---'
		return formatTimeMs(this.bestTime)
	}
	
	/**
	 * 获取最佳时间（毫秒）
	 */
	getRaw(): number | null {
		return this.bestTime === Infinity ? null : this.bestTime
	}
	
	reset(): void {
		this.bestTime = Infinity
		localStorage.removeItem(PLAYER_BEST_KEY)
	}
}

export default PlayerBestStore
