/**
 * 玩家最佳记录存储
 * 只记录玩家模式的最快通关时间
 */

import { formatTime } from '@utils/timeUtils.js'

const PLAYER_BEST_KEY = 'ai-sandbox-player-best'

export class PlayerBestStore {
  constructor() {
    this.bestTime = this.load()
  }
  
  load() {
    try {
      const stored = localStorage.getItem(PLAYER_BEST_KEY)
      return stored ? parseInt(stored, 10) : Infinity
    } catch (e) {
      return Infinity
    }
  }
  
  save(time) {
    try {
      localStorage.setItem(PLAYER_BEST_KEY, time.toString())
    } catch (e) {
      console.warn('Failed to save player best:', e)
    }
  }
  
  /**
   * 尝试更新最佳记录
   * @param {number} time - 通关时间（毫秒）
   * @returns {boolean} 是否更新成功（新记录更快）
   */
  tryUpdate(time) {
    if (time < this.bestTime) {
      this.bestTime = time
      this.save(time)
      return true
    }
    return false
  }
  
  /**
   * 获取最佳时间（格式化）
   * @returns {string} mm:ss 格式，无记录返回 '--:--'
   */
  getFormatted() {
    if (this.bestTime === Infinity) return '--:--'
    return formatTime(this.bestTime)
  }
  
  /**
   * 获取最佳时间（毫秒）
   */
  getRaw() {
    return this.bestTime === Infinity ? null : this.bestTime
  }
  
  reset() {
    this.bestTime = Infinity
    localStorage.removeItem(PLAYER_BEST_KEY)
  }
}

export default PlayerBestStore
