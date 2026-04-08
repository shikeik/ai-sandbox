// ========== MNIST 数据集工具 ==========

export interface MNISTSample {
	input: number[]  // 784维 (28x28)
	label: number   // 0-9
}
