// ========== 输入预处理：居中 + 缩放归一化 ==========

import { MNIST_CONFIG } from "./config.js"

/**
 * 预处理用户输入的图像
 * 1. 找边界框（切除空白）
 * 2. 计算质心（居中）
 * 3. 缩放归一化（填满 FILL_RATIO 区域，保持比例）
 */
export function preprocessInput(pixels: number[]): number[] {
	const size = MNIST_CONFIG.IMAGE_SIZE  // 14
	
	// 步骤 1: 找边界框
	const { minX, maxX, minY, maxY } = findBoundingBox(pixels, size)
	
	// 如果全是空白，返回空图像
	if (minX > maxX || minY > maxY) {
		return new Array(size * size).fill(0)
	}
	
	// 步骤 2 & 3: 提取并居中缩放
	return centerAndScale(pixels, size, minX, maxX, minY, maxY)
}

/** 找数字的边界框 */
function findBoundingBox(pixels: number[], size: number) {
	let minX = size, maxX = 0, minY = size, maxY = 0
	
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			if (pixels[y * size + x] > 0.1) {  // 阈值 0.1
				minX = Math.min(minX, x)
				maxX = Math.max(maxX, x)
				minY = Math.min(minY, y)
				maxY = Math.max(maxY, y)
			}
		}
	}
	
	return { minX, maxX, minY, maxY }
}

/** 居中并缩放 */
function centerAndScale(
	pixels: number[],
	size: number,
	minX: number,
	maxX: number,
	minY: number,
	maxY: number
): number[] {
	// 提取数字区域
	const width = maxX - minX + 1
	const height = maxY - minY + 1
	
	// 保持比例的缩放
	const fillRatio = MNIST_CONFIG.PREPROCESS.FILL_RATIO  // 0.70
	const padding = MNIST_CONFIG.PREPROCESS.PADDING       // 2
	const availableSize = size - padding * 2
	
	// 计算缩放比例（保持长宽比）
	const scale = Math.min(
		availableSize / width,
		availableSize / height
	) * fillRatio
	
	const newWidth = width * scale
	const newHeight = height * scale
	
	// 居中偏移
	const offsetX = (size - newWidth) / 2
	const offsetY = (size - newHeight) / 2
	
	// 创建输出图像
	const output = new Array(size * size).fill(0)
	
	// 双线性插值映射
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			// 反向映射到源图像
			const srcX = (x - offsetX) / scale + minX
			const srcY = (y - offsetY) / scale + minY
			
			if (srcX >= minX && srcX <= maxX && srcY >= minY && srcY <= maxY) {
				output[y * size + x] = bilinearInterpolate(pixels, size, srcX, srcY)
			}
		}
	}
	
	return output
}

/** 双线性插值 */
function bilinearInterpolate(
	pixels: number[],
	size: number,
	x: number,
	y: number
): number {
	const x0 = Math.floor(x)
	const x1 = Math.min(x0 + 1, size - 1)
	const y0 = Math.floor(y)
	const y1 = Math.min(y0 + 1, size - 1)
	
	const fx = x - x0
	const fy = y - y0
	
	const v00 = pixels[y0 * size + x0]
	const v01 = pixels[y0 * size + x1]
	const v10 = pixels[y1 * size + x0]
	const v11 = pixels[y1 * size + x1]
	
	return v00 * (1 - fx) * (1 - fy) +
	       v01 * fx * (1 - fy) +
	       v10 * (1 - fx) * fy +
	       v11 * fx * fy
}

/** 简单的最近邻降采样（用于预览显示） */
export function downsample28to14(pixels28: number[]): number[] {
	const output = new Array(196)
	for (let y = 0; y < 14; y++) {
		for (let x = 0; x < 14; x++) {
			let sum = 0
			for (let dy = 0; dy < 2; dy++) {
				for (let dx = 0; dx < 2; dx++) {
					sum += pixels28[(y * 2 + dy) * 28 + (x * 2 + dx)]
				}
			}
			output[y * 14 + x] = sum / 4
		}
	}
	return output
}
