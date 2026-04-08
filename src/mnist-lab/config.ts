// ========== MNIST Lab 全局配置 ==========
// 修改这里即可调整所有参数

export const MNIST_CONFIG = {
	// === 图像尺寸配置 ===
	// 可选: 14 或 28
	IMAGE_SIZE: 28 as 14 | 28,
	
	// === 数据源配置 ===
	// 是否从 28x28 降采样到目标尺寸
	DOWNSAMPLE_FROM_28: true,

	// === 预处理配置 ===
	PREPROCESS: {
		// 是否启用居中对齐
		CENTER: true,
		// 是否启用缩放归一化
		SCALE: true,
		// 数字占画布比例 (MNIST标准是20x20在28x28中，约70%)
		FILL_RATIO: 0.70,
		// 边界留白 (像素，在目标尺寸上)
		PADDING: 2,
	},

	// === 网络结构配置 ===
	HIDDEN_DIMS: [128, 64] as number[],
	NUM_CLASSES: 10,

	// === 训练配置 ===
	BATCH_SIZE: 32,
	LEARNING_RATE: 0.1,
	WEIGHT_CLIP: 5.0,

	// === 数据集配置 ===
	// 最终筛选后每个数字的目标数量
	TARGET_SAMPLES_PER_DIGIT: 100,
	TRAIN_RATIO: 0.8,

	// === 显示配置 ===
	CANVAS_DISPLAY_SIZE: 280,
}

// === 派生配置（自动计算）===
export const DERIVED_CONFIG = {
	get INPUT_DIM(): number {
		return MNIST_CONFIG.IMAGE_SIZE * MNIST_CONFIG.IMAGE_SIZE
	},

	get TOTAL_SAMPLES(): number {
		return MNIST_CONFIG.TARGET_SAMPLES_PER_DIGIT * 10
	},

	get PIXEL_SCALE(): number {
		return MNIST_CONFIG.CANVAS_DISPLAY_SIZE / MNIST_CONFIG.IMAGE_SIZE
	}
}

// === 网络配置生成器 ===
export function createNetworkConfig() {
	return {
		inputDim: DERIVED_CONFIG.INPUT_DIM,
		hiddenDims: MNIST_CONFIG.HIDDEN_DIMS,
		outputDim: MNIST_CONFIG.NUM_CLASSES,
		learningRate: MNIST_CONFIG.LEARNING_RATE,
		weightClip: MNIST_CONFIG.WEIGHT_CLIP
	}
}
