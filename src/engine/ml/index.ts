// ========== 通用 MLP 神经网络引擎 ==========
// 纯逻辑，与业务无关，可被任何训练任务复用

// ---------- 类型定义 ----------

export interface NetworkConfig {
	inputDim: number
	hiddenDims: number[]
	outputDim: number
	learningRate: number
	weightClip?: number
}

export interface NetworkParams {
	// 每一层的权重和偏置
	weights: number[][][]  // [layer][output][input]
	biases: number[][]     // [layer][output]
}

export interface ForwardResult {
	inputs: number[][]    // 每层的输入 [layer][input]
	activations: number[][] // 每层的激活值 [layer][output]
	rawOutputs: number[]  // 最终原始输出（softmax前）
	output: number[]      // 最终概率分布（softmax后）
}

export interface Gradients {
	dWeights: number[][][]
	dBiases: number[][]
}

// ---------- 工具函数 ----------

export function createMatrix(rows: number, cols: number, scale: number = 1): number[][] {
	return Array.from({ length: rows }, () =>
		Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
	)
}

export function createVector(size: number, fill: number = 0): number[] {
	return Array(size).fill(fill)
}

export function zerosMatrix(rows: number, cols: number): number[][] {
	return Array.from({ length: rows }, () => Array(cols).fill(0))
}

export function zerosVector(size: number): number[] {
	return Array(size).fill(0)
}

// ---------- 激活函数 ----------

export function relu(x: number[]): number[] {
	return x.map(v => Math.max(0, v))
}

export function reluDerivative(x: number[]): number[] {
	return x.map(v => v > 0 ? 1 : 0)
}

export function softmax(x: number[]): number[] {
	const max = Math.max(...x)
	const exps = x.map(v => Math.exp(v - max))
	const sum = exps.reduce((a, b) => a + b, 0)
	return exps.map(v => v / sum)
}

// ---------- 网络操作 ----------

export function createNetwork(config: NetworkConfig): NetworkParams {
	const dims = [config.inputDim, ...config.hiddenDims, config.outputDim]
	const weights: number[][][] = []
	const biases: number[][] = []

	for (let i = 0; i < dims.length - 1; i++) {
		const inDim = dims[i]
		const outDim = dims[i + 1]
		// He初始化
		const scale = Math.sqrt(2 / inDim)
		weights.push(createMatrix(outDim, inDim, scale))
		biases.push(createVector(outDim, 0))
	}

	return { weights, biases }
}

export function forward(
	net: NetworkParams,
	input: number[]
): ForwardResult {
	const inputs: number[][] = [input]
	const activations: number[][] = []

	let current = input

	// 前向传播每一层
	for (let i = 0; i < net.weights.length; i++) {
		const W = net.weights[i]
		const b = net.biases[i]

		// 线性变换: z = Wx + b
		const z = W.map((row, j) =>
			row.reduce((sum, w, k) => sum + w * current[k], 0) + b[j]
		)

		// 激活函数（最后一层用softmax，其他用relu）
		const isLastLayer = i === net.weights.length - 1
		current = isLastLayer ? softmax(z) : relu(z)

		inputs.push(z)  // 保存线性输出用于反向传播
		activations.push(current)
	}

	return {
		inputs,
		activations,
		rawOutputs: inputs[inputs.length - 1],
		output: current
	}
}

export function backward(
	net: NetworkParams,
	fp: ForwardResult,
	targetIndex: number
): Gradients {
	const numLayers = net.weights.length
	const dWeights: number[][][] = []
	const dBiases: number[][] = []

	// 输出层梯度
	const output = fp.output
	const dz = output.map((v, i) => v - (i === targetIndex ? 1 : 0))

	// 从后向前传播梯度
	let dActivations = dz

	for (let i = numLayers - 1; i >= 0; i--) {
		const layerInput = i === 0 ? fp.inputs[0] : fp.activations[i - 1]
		const z = fp.inputs[i + 1]

		// 计算权重梯度
		const dW = dActivations.map(dz_j =>
			layerInput.map(x_k => dz_j * x_k)
		)
		dWeights.unshift(dW)
		dBiases.unshift([...dActivations])

		// 如果不是第一层，继续反向传播
		if (i > 0) {
			const W = net.weights[i]
			// dL/dx = W^T @ dL/dz
			const dInput: number[] = Array(layerInput.length).fill(0)
			for (let j = 0; j < W[0].length; j++) {
				for (let k = 0; k < W.length; k++) {
					dInput[j] += W[k][j] * dActivations[k]
				}
			}
			// ReLU导数
			dActivations = dInput.map((v, idx) => v * (z[idx] > 0 ? 1 : 0))
		}
	}

	return { dWeights, dBiases }
}

export function updateNetwork(
	net: NetworkParams,
	grads: Gradients,
	config: NetworkConfig,
	batchSize: number
): void {
	const lr = config.learningRate
	const clip = config.weightClip ?? 5.0

	for (let i = 0; i < net.weights.length; i++) {
		// 更新权重
		for (let j = 0; j < net.weights[i].length; j++) {
			for (let k = 0; k < net.weights[i][j].length; k++) {
				const grad = grads.dWeights[i][j][k] / batchSize
				net.weights[i][j][k] -= lr * grad
				// 梯度裁剪
				net.weights[i][j][k] = Math.max(-clip, Math.min(clip, net.weights[i][j][k]))
			}
		}
		// 更新偏置
		for (let j = 0; j < net.biases[i].length; j++) {
			const grad = grads.dBiases[i][j] / batchSize
			net.biases[i][j] -= lr * grad
			net.biases[i][j] = Math.max(-clip, Math.min(clip, net.biases[i][j]))
		}
	}
}

export function cloneNetwork(net: NetworkParams): NetworkParams {
	return {
		weights: net.weights.map(layer =>
			layer.map(row => [...row])
		),
		biases: net.biases.map(layer => [...layer])
	}
}

// ---------- 数据集工具 ----------

export interface DatasetSample {
	input: number[]
	label: number
}

export function evaluateNetwork(
	net: NetworkParams,
	dataset: DatasetSample[]
): { accuracy: number; avgLoss: number } {
	let correct = 0
	let lossSum = 0

	for (const sample of dataset) {
		const fp = forward(net, sample.input)
		const predicted = fp.output.indexOf(Math.max(...fp.output))
		if (predicted === sample.label) correct++
		lossSum += -Math.log(Math.max(fp.output[sample.label], 1e-7))
	}

	return {
		accuracy: (correct / dataset.length) * 100,
		avgLoss: lossSum / dataset.length
	}
}

// ---------- 训练统计 ----------

export interface TrainingMetrics {
	step: number
	loss: number
	accuracy: number
	progress: number
}

export class TrainingEngine {
	private net: NetworkParams
	private config: NetworkConfig

	constructor(net: NetworkParams, config: NetworkConfig) {
		this.net = net
		this.config = config
	}

	async train(
		dataset: DatasetSample[],
		options: {
			epochs: number
			batchSize: number
			onBatch?: (metrics: TrainingMetrics) => Promise<void>
		}
	): Promise<void> {
		const { epochs, batchSize, onBatch } = options
		const stepsPerEpoch = Math.ceil(dataset.length / batchSize)
		const totalSteps = epochs * stepsPerEpoch
		let step = 0

		for (let epoch = 0; epoch < epochs; epoch++) {
			// 打乱数据集
			const shuffled = [...dataset].sort(() => Math.random() - 0.5)

			for (let i = 0; i < shuffled.length; i += batchSize) {
				const batch = shuffled.slice(i, i + batchSize)

				// 累积梯度
				const gradAcc = this.createZeroGradients()
				let batchLoss = 0
				let batchCorrect = 0

				for (const sample of batch) {
					const fp = forward(this.net, sample.input)
					const grads = backward(this.net, fp, sample.label)

					// 累积梯度
					this.accumulateGradients(gradAcc, grads)

					// 统计
					const predicted = fp.output.indexOf(Math.max(...fp.output))
					if (predicted === sample.label) batchCorrect++
					batchLoss += -Math.log(Math.max(fp.output[sample.label], 1e-7))
				}

				// 更新参数
				updateNetwork(this.net, gradAcc, this.config, batch.length)

				step++

				// 回调
				if (onBatch && step % 10 === 0) {
					await onBatch({
						step,
						loss: batchLoss / batch.length,
						accuracy: (batchCorrect / batch.length) * 100,
						progress: (step / totalSteps) * 100
					})
				}
			}
		}
	}

	private createZeroGradients(): Gradients {
		const dWeights: number[][][] = []
		const dBiases: number[][] = []

		const dims = [this.config.inputDim, ...this.config.hiddenDims, this.config.outputDim]
		for (let i = 0; i < dims.length - 1; i++) {
			dWeights.push(zerosMatrix(dims[i + 1], dims[i]))
			dBiases.push(zerosVector(dims[i + 1]))
		}

		return { dWeights, dBiases }
	}

	private accumulateGradients(acc: Gradients, grads: Gradients): void {
		for (let i = 0; i < acc.dWeights.length; i++) {
			for (let j = 0; j < acc.dWeights[i].length; j++) {
				for (let k = 0; k < acc.dWeights[i][j].length; k++) {
					acc.dWeights[i][j][k] += grads.dWeights[i][j][k]
				}
			}
			for (let j = 0; j < acc.dBiases[i].length; j++) {
				acc.dBiases[i][j] += grads.dBiases[i][j]
			}
		}
	}
}
