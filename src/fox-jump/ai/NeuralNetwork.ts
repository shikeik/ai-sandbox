/**
 * 可配置神经网络
 * 支持动态层结构，未来可扩展隐藏层
 */

export type ExploreMode = "none" | "fixed" | "dynamic"

export interface NeuralNetworkConfig {
	layerSizes?: number[]
	learningRate?: number
	weightClip?: number
	exploreMode?: ExploreMode
	fixedEpsilon?: number
	epsilon?: number
}

export interface ForwardResult {
	scores: number[]
	action: number
}

export interface WeightSnapshot {
	weights: number[][][]
}

export interface NetworkStructure {
	layerSizes: number[]
	totalWeights: number
}

export interface PreviewTrainResult {
	changes: number[][][] | null
	newWeights: number[][] | null
}

export class NeuralNetwork {
	layerSizes: number[]
	learningRate: number
	weightClip: number
	exploreMode: ExploreMode
	fixedEpsilon: number
	epsilon: number
	isExploring: boolean = false
	weights: number[][][] = []
	biases: number[][] = []
	lastState: number[] | null = null
	lastAction: number | null = null
	lastScores: number[] | null = null
	lastWeightChanges: number[][][] | null = null

	constructor(config: NeuralNetworkConfig = {}) {
		this.layerSizes = config.layerSizes || [4, 3]
		this.learningRate = config.learningRate || 0.2
		this.weightClip = config.weightClip || 5
		this.exploreMode = config.exploreMode || "none"
		this.fixedEpsilon = config.fixedEpsilon || 0.5
		this.epsilon = config.epsilon || 0.3

		for (let i = 0; i < this.layerSizes.length - 1; i++) {
			const inputSize = this.layerSizes[i]
			const outputSize = this.layerSizes[i + 1]
		
			this.weights.push(
				Array(outputSize).fill(null).map(() => 
					Array(inputSize).fill(0)
				)
			)
		
			this.biases.push(Array(outputSize).fill(0))
		}
	}
	
	/**
	 * 前向传播
	 * @param inputs - 输入数组
	 * @returns { scores, action }
	 */
	forward(inputs: number[]): ForwardResult {
		let current: number[] = inputs
	
		for (let i = 0; i < this.weights.length; i++) {
			const weights = this.weights[i]
			const biases = this.biases[i]
		
			current = weights.map((wRow, idx) => {
				let sum = biases[idx]
				for (let j = 0; j < wRow.length; j++) {
					sum += wRow[j] * current[j]
				}
				return sum
			})
		}
	
		const scores = current
	
		let maxIdx = 0
		for (let i = 1; i < scores.length; i++) {
			if (scores[i] > scores[maxIdx]) maxIdx = i
		}
		const action = maxIdx
	
		return { scores, action }
	}
	
	/**
	 * 决策（对外接口）
	 * @param inputs - 输入数组
	 * @returns 动作索引 (0=移动, 1=跳跃, 2=远跳)
	 */
	decide(inputs: number[]): number {
		const result = this.forward(inputs)
	
		this.lastState = [...inputs]
		this.lastAction = result.action
		this.lastScores = result.scores
		
		const epsilon = this.getEpsilon()
		if (Math.random() < epsilon) {
			this.isExploring = true
			this.lastAction = Math.floor(Math.random() * this.layerSizes[this.layerSizes.length - 1])
		} else {
			this.isExploring = false
			this.lastAction = result.action
		}
	
		if (this.isExploring && this.lastAction !== result.action) {
			// 探索模式下选择了非最优动作
		}
		return this.lastAction
	}

	/**
	 * 获取当前探索率（统一入口）
	 * @returns 当前探索率 0~1
	 */
	getEpsilon(): number {
		switch (this.exploreMode) {
			case "none":
				return 0
			case "fixed":
				return this.fixedEpsilon
			case "dynamic":
				return this.epsilon
			default:
				return 0
		}
	}
	
	/**
	 * 预览训练结果（不实际应用，仅计算变化量）
	 * @param reward - 奖励
	 * @param action - 动作索引
	 * @param state - 输入状态（默认使用 lastState）
	 * @returns { changes, newWeights } - 变化量和预测的新权重
	 */
	previewTrain(reward: number, action: number, state: number[] | null = null): PreviewTrainResult {
		const inputState = state || this.lastState
		if (!inputState) {
			return { changes: null, newWeights: null }
		}

		const layerIdx = this.weights.length - 1
		const weights = this.weights[layerIdx]
		
		const oldWeights = weights.map(row => [...row])
		const newWeights = weights.map(row => [...row])
		
		if (reward > 0) {
			for (let i = 0; i < inputState.length; i++) {
				newWeights[action][i] += this.learningRate * inputState[i]
			}
		} else if (reward < 0) {
			for (let i = 0; i < inputState.length; i++) {
				newWeights[action][i] -= this.learningRate * inputState[i]
			}
			const otherReward = this.learningRate / 2
			for (let a = 0; a < newWeights.length; a++) {
				if (a !== action) {
					for (let i = 0; i < inputState.length; i++) {
						newWeights[a][i] += otherReward * inputState[i]
					}
				}
			}
		}
		
		for (const row of newWeights) {
			for (let i = 0; i < row.length; i++) {
				row[i] = Math.max(-this.weightClip, Math.min(this.weightClip, row[i]))
			}
		}
		
		const layerChanges: number[][] = []
		for (let j = 0; j < newWeights.length; j++) {
			const row: number[] = []
			for (let i = 0; i < newWeights[j].length; i++) {
				row.push(newWeights[j][i] - oldWeights[j][i])
			}
			layerChanges.push(row)
		}
		
		// 计算总权重变化量（可用于监控训练进度）
		const _totalChange = layerChanges.flat().reduce((a, b) => a + Math.abs(b), 0)
		
		return { 
			changes: [layerChanges], 
			newWeights 
		}
	}

	/**
	 * 训练更新（每步调用）- 复用 previewTrain
	 * @param reward - 奖励（存活+0.02，死亡-1，胜利+1）
	 * @param action - 实际执行的动作
	 */
	train(reward: number, action: number): void {
		if (!this.lastState || this.lastAction === null) return
		
		const { changes, newWeights } = this.previewTrain(reward, action)
		if (!changes) return
		
		const layerIdx = this.weights.length - 1
		this.weights[layerIdx] = newWeights as number[][]
		this.lastWeightChanges = changes
		
		// 权重已更新
		const _layerChanges = changes[0]
	}
	
	/**
	 * 获取权重快照（用于记录）
	 */
	getWeightsSnapshot(): number[][][] {
		return this.weights.map(layer => 
			layer.map(row => [...row])
		)
	}
	
	/**
	 * 获取网络结构描述
	 */
	getStructure(): NetworkStructure {
		return {
			layerSizes: [...this.layerSizes],
			totalWeights: this.weights.reduce((sum, layer) => 
				sum + layer.reduce((s, row) => s + row.length, 0), 0
			)
		}
	}
}

export default NeuralNetwork
