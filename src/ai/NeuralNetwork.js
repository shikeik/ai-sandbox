/**
 * 可配置神经网络
 * 支持动态层结构，未来可扩展隐藏层
 */

export class NeuralNetwork {
	constructor(config = {}) {
	// 默认：4输入 → 3输出（单层）
		this.layerSizes = config.layerSizes || [4, 3]
		this.learningRate = config.learningRate || 0.2
		this.weightClip = config.weightClip || 5
	
		// --- 探索率相关属性 ---
		this.epsilon = 0         // 初始探索率 0（封存好奇心，纯利用模式）
		this.autoAdjustEpsilon = false  // 自动调节关闭，手动可控观察
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
		this.lastWeightChanges = null
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
		let maxIdx = 0
			for (let i = 1; i < scores.length; i++) {
				if (scores[i] > scores[maxIdx]) maxIdx = i
			}
			const action = maxIdx
	
		return { scores, action }
	}
	
	/**
	* 决策（对外接口）
	* @param {number[]} inputs - 输入数组
	* @returns {number} 动作索引 (0=移动, 1=跳跃, 2=远跳)
	*/
	decide(inputs) {
		const result = this.forward(inputs)
	
		// 记录状态用于后续训练
		this.lastState = [...inputs]
		this.lastAction = result.action
		this.lastScores = result.scores
		
		// ε-贪心策略逻辑
		// 注：当前阶段 epsilon 固定为 0，需要可控观察，暂不启用探索机制，保持纯利用模式
		if (Math.random() < this.epsilon) {
		// 【探索】：不看分数，随机选一个
			this.isExploring = true
			this.lastAction = Math.floor(Math.random() * this.layerSizes[this.layerSizes.length - 1])
		} else {
		// 【利用】：看分数，选最高分
			this.isExploring = false
			this.lastAction = result.action
		}
	
		// 【调试日志】验证决策一致性：若探索则 lastAction 与 result.action 可能不同
		if (this.isExploring && this.lastAction !== result.action) {
			console.log('[AI]', `探索冲突修复 | 贪心=${result.action} → 随机=${this.lastAction} | 输入=[${inputs.join(',')}]`)
		}
		console.log('[AI]', `决策 | 输入=[${inputs.join(',')}] 得分=[${result.scores.map(s => s.toFixed(2)).join(',')}] 动作=${this.lastAction} 探索=${this.isExploring}`)
		return this.lastAction
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
	
		// 记录训练前的权重
		const oldWeights = weights.map(row => [...row])
	
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
	
		// 计算并记录权重变化量（保持与 weights 相同的三维结构：[layer][output][input]）
		const layerChanges = []
		for (let j = 0; j < weights.length; j++) {
			const row = []
			for (let i = 0; i < weights[j].length; i++) {
				row.push(weights[j][i] - oldWeights[j][i])
			}
			layerChanges.push(row)
		}
		this.lastWeightChanges = [layerChanges]
		
		console.log('[AI]', `训练 | 奖励=${reward.toFixed(3)} 动作=${action} 权重变化=[${layerChanges.map(r => r.map(v => v.toFixed(2)).join(',')).join(' | ')}]`)
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