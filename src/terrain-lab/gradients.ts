// ========== 梯度缓冲区 ==========
// 统一 GradientBuffer 接口和相关工具函数

import { NUM_ELEMENTS, HIDDEN_DIM, INPUT_DIM, OUTPUT_DIM, EMBED_DIM } from "./constants.js"
import { zeroMat, zeroVec } from "./utils.js"

/**
 * 梯度缓冲区接口
 * 用于存储反向传播计算的梯度
 */
export interface GradientBuffer {
	dEmbed: number[][]
	dW1: number[][]
	db1: number[]
	dW2: number[][]
	db2: number[]
}

/**
 * 创建空的梯度缓冲区
 */
export function createGradientBuffer(): GradientBuffer {
	return {
		dEmbed: zeroMat(NUM_ELEMENTS, EMBED_DIM),
		dW1: zeroMat(HIDDEN_DIM, INPUT_DIM),
		db1: zeroVec(HIDDEN_DIM),
		dW2: zeroMat(OUTPUT_DIM, HIDDEN_DIM),
		db2: zeroVec(OUTPUT_DIM),
	}
}

/**
 * 验证梯度缓冲区是否有效
 */
export function isValidGradientBuffer(buffer: GradientBuffer): boolean {
	if (!buffer) return false
	if (!Array.isArray(buffer.dEmbed) || !Array.isArray(buffer.dW1) || !Array.isArray(buffer.dW2)) return false
	if (!Array.isArray(buffer.db1) || !Array.isArray(buffer.db2)) return false
	return true
}

/**
 * 计算梯度的总幅值（用于调试和监控）
 */
export function getTotalGradientMagnitude(buffer: GradientBuffer): number {
	let sum = 0
	for (const row of buffer.dEmbed) {
		for (const v of row) sum += v * v
	}
	for (const row of buffer.dW1) {
		for (const v of row) sum += v * v
	}
	for (const v of buffer.db1) sum += v * v
	for (const row of buffer.dW2) {
		for (const v of row) sum += v * v
	}
	for (const v of buffer.db2) sum += v * v
		return Math.sqrt(sum)
}
