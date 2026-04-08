// ========== 输入预处理：仅居中平移（保持 1:1 像素保真） ==========

import { MNIST_CONFIG } from "./config.js"

/**
 * 预处理用户输入的图像
 * 1. 找边界框
 * 2. 计算质心
 * 3. 平移到画布中心（不缩放，保持 1:1 像素）
 */
export function preprocessInput(pixels: number[]): number[] {
	const size = MNIST_CONFIG.IMAGE_SIZE

	// 找边界框
	const { minX, maxX, minY, maxY } = findBoundingBox(pixels, size)

	// 如果全是空白，返回原图
	if (minX > maxX || minY > maxY) {
		return pixels.slice()  // 返回副本
	}

	// 仅居中平移（不缩放）
	return centerOnly(pixels, size, minX, maxX, minY, maxY)
}

/** 找数字的边界框 */
function findBoundingBox(pixels: number[], size: number) {
	let minX = size, maxX = 0, minY = size, maxY = 0

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			if (pixels[y * size + x] > 0) {  // 任何非零像素
				minX = Math.min(minX, x)
				maxX = Math.max(maxX, x)
				minY = Math.min(minY, y)
				maxY = Math.max(maxY, y)
			}
		}
	}

	return { minX, maxX, minY, maxY }
}

/** 仅居中平移（1:1 像素保真） */
function centerOnly(
	pixels: number[],
	size: number,
	minX: number,
	maxX: number,
	minY: number,
	maxY: number
): number[] {
	// 计算当前质心
	const centerX = (minX + maxX) / 2
	const centerY = (minY + maxY) / 2

	// 计算画布中心
	const targetCenterX = (size - 1) / 2
	const targetCenterY = (size - 1) / 2

	// 计算平移量
	const shiftX = Math.round(targetCenterX - centerX)
	const shiftY = Math.round(targetCenterY - centerY)

	// 创建输出图像
	const output = new Array(size * size).fill(0)

	// 平移像素
	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const value = pixels[y * size + x]
			if (value > 0) {
				const newX = x + shiftX
				const newY = y + shiftY
				if (newX >= 0 && newX < size && newY >= 0 && newY < size) {
					output[newY * size + newX] = value
				}
			}
		}
	}

	return output
}
