/**
 * 训练历史存储
 * 全量保存，支持localStorage持久化
 */

const STORAGE_KEY = 'ai-sandbox-history'

export class HistoryStore {
	constructor() {
	this.data = this.load()
	}
	
	/**
	* 加载数据
	*/
	load() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		return stored ? JSON.parse(stored) : []
	} catch (e) {
		console.warn('Failed to load history:', e)
		return []
	}
	}
	
	/**
	* 保存数据
	*/
	save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
	} catch (e) {
		console.warn('Failed to save history:', e)
	}
	}
	
	/**
	* 添加记录
	*/
	add(record) {
	this.data.push({
		timestamp: Date.now(),
		...record
	})
	this.save()
	}
	
	/**
	* 获取全部数据
	*/
	getAll() {
	return [...this.data]
	}
	
	/**
	* 获取最新N条
	*/
	getRecent(n) {
	return this.data.slice(-n)
	}
	
	/**
	* 获取统计信息
	*/
	getStats() {
	if (this.data.length === 0) return null
	
	const steps = this.data.map(d => d.steps)
	return {
		total: this.data.length,
		best: Math.max(...steps),
		average: steps.reduce((a, b) => a + b, 0) / steps.length,
		recent10: this.data.slice(-10).map(d => d.steps)
	}
	}
	
	/**
	* 清空数据
	*/
	clear() {
	this.data = []
	localStorage.removeItem(STORAGE_KEY)
	}
	
	/**
	* 导出数据（用于分析）
	*/
	export() {
	return JSON.stringify(this.data, null, 2)
	}
}

export default HistoryStore
