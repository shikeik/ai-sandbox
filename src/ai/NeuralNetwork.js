/**
 * 可配置神经网络
 * 支持动态层结构，未来可扩展隐藏层
 */

export class NeuralNetwork {
	constructor(config = {}) {
	// 默认：3输入 → 2输出（单层）
		this.layerSizes = config.layerSizes || [3, 2]
		this.learningRate = config.learningRate || 0.2
		this.weightClip = config.weightClip || 5
	
		// --- 探索率相关属性 ---
		this.epsilon = 0.3       // 初始探索率 (30%)
		this.autoAdjustEpsilon = true   // 是否自动调节开关，默认开启
		this.isExploring = false  // 记录当前动作是否为“探索”产生的
	
		// 初始化权重和偏置
		this.weights = []
		this.biases =[]
	
		for (let i = 0; i < this.layerSizes.length - 1; i++) {
			const inputSize = this.layerSizes[i]
			const outputSize = this.layerSizes[i + 1]
		
			// 权重矩阵：outputSize × inputSize
			this.weights.push(
				Array(outputSize).fill(null).map(() => 
					Array(inputSize).fill(0)
				)
			)
		
			// 偏置（暂不使用，但预留）
			this.biases.push(Array(outputSize).fill(0))
		}
	
		// 最后一步记录（用于训练）
		this.lastState = null
		this.lastAction = null
		this.lastScores = null
	}
	
	/**
	* 前向传播
	* @param {number[]} inputs - 输入数组
	* @returns {object} {scores, action}
	*/
	forward(inputs) {
		let current = inputs
	
		// 逐层计算
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
	
		// 输出层（当前只有一层输出）
		const scores = current
	
		// 纯贪心决策：不使用概率或Softmax，直接比较得分选高的
		const action = scores[1] > scores[0] ? 1 : 0
	
		return { scores, action }
	}
	
	/**
	* 决策（对外接口）
	* @param {number[]} inputs - 输入数组
	* @returns {number} 动作索引 (0=移动, 1=跳跃)
	*/
	decide(inputs) {
		const result = this.forward(inputs)
	
		// 记录状态用于后续训练
		this.lastState = [...inputs]
		this.lastAction = result.action
		this.lastScores = result.scores
		
		// ε-贪心策略逻辑
		if (Math.random() < this.epsilon) {
		// 【探索】：不看分数，50% 几率随机选一个
			this.isExploring = true
			this.lastAction = Math.random() < 0.5 ? 0 : 1
		} else {
		// 【利用】：看分数，选最高分
			this.isExploring = false
			this.lastAction = result.action
		}
	
		return result.action
	}
	
	/**
	* 训练更新（每步调用）
	* 标准做法：权重更新值 = 学习率 × 输入值
	* @param {number} reward - 奖励（存活+0.02，死亡-1，胜利+1）
	* @param {number} action - 实际执行的动作
	*/
	train(reward, action) {
		if (!this.lastState || this.lastAction === null) return
	
		const layerIdx = this.weights.length - 1 // 输出层索引
		const weights = this.weights[layerIdx]
	
		if (reward > 0) {
		// 正确：增强选中的动作，必须乘以输入值 (this.lastState[i])
			for (let i = 0; i < this.lastState.length; i++) {
				weights[action][i] += this.learningRate * this.lastState[i]
			}
		} else if (reward < 0) {
		// 错误：惩罚选中的动作，必须乘以输入值
			for (let i = 0; i < this.lastState.length; i++) {
				weights[action][i] -= this.learningRate * this.lastState[i]
			}
			// 奖励其他动作（惩罚值的一半），同样乘以输入值
			const otherReward = this.learningRate / 2
			for (let a = 0; a < weights.length; a++) {
				if (a !== action) {
					for (let i = 0; i < this.lastState.length; i++) {
						weights[a][i] += otherReward * this.lastState[i]
					}
				}
			}
		}
	
		// 权重裁剪限制范围
		for (const row of weights) {
			for (let i = 0; i < row.length; i++) {
				row[i] = Math.max(-this.weightClip, Math.min(this.weightClip, row[i]))
			}
		}
	}
	
	/**
	* 获取权重快照（用于记录）
	*/
	getWeightsSnapshot() {
		return this.weights.map(layer => 
			layer.map(row => [...row])
		)
	}
	
	/**
	* 获取网络结构描述
	*/
	getStructure() {
		return {
			layerSizes: [...this.layerSizes],
			totalWeights: this.weights.reduce((sum, layer) => 
				sum + layer.reduce((s, row) => s + row.length, 0), 0
			)
		}
	}
}

export default NeuralNetwork