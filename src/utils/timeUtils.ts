/**
 * 时间格式化工具函数
 * @module timeUtils
 */

/**
 * 将毫秒格式化为 mm:ss 格式
 * @param ms - 时间（毫秒）
 * @returns 格式化后的时间字符串，如 "01:23"
 */
export function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

/**
 * 将毫秒格式化为 mm:ss.mmm 格式（带毫秒精度）
 * @param ms - 时间（毫秒）
 * @returns 格式化后的时间字符串，如 "01:23.456"
 */
export function formatTimeMs(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	const milliseconds = ms % 1000
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`
}
