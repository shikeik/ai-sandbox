// ========== 收敛性测试 ==========
// 运行方式: npx tsx src/terrain-lab/__tests__/convergence-test.ts

import { createNet, forward, updateNetwork, cloneNet } from "../neural-network.js"
import { createGradientBuffer, accumulateSupervisedGrad, evaluateModel } from "../supervised.js"
import { createGradientBuffer as createUnsupervisedBuffer, accumulateGradients, calculateReward } from "../unsupervised.js"
import { UNSUPERVISED_CONFIG } from "../constants.js"
import { generateTerrainData } from "../terrain.js"
import { assertGreaterThan, printTestSuite, printTestComplete } from "./test-utils.js"

// 生成小数据集用于快速测试
function createTestDataset(size: number) {
	// 简单的地形：只有平地，狐狸在x0
	return Array.from({ length: size }, (_, i) => {
		// 地形: 天上全空气，地上狐狸在x0，地面全平地
		const t = [
			Array(5).fill(0), // 天上: 全空气
			[1, 0, 0, 0, 0],  // 地上: 狐狸在x0
			Array(5).fill(2), // 地面: 全平地
		]
		// 所有样本都是"走"最优
		return {
			t,
			indices: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 2, 2, 2, 2], // 展平的地形
			y: 0, // 最优动作是"走"
		}
	})
}

printTestSuite("收敛性测试")

const DATASET_SIZE = 100
const TRAIN_STEPS = 500
const BATCH_SIZE = 16
const CONVERGENCE_THRESHOLD = 60 // 收敛阈值：60%准确率/合法率

const dataset = createTestDataset(DATASET_SIZE)
const indices = dataset[0].indices // 所有样本相同

// ========== 监督学习收敛测试 ==========
console.log("\n--- 监督学习收敛测试 ---")
{
	const net = createNet()
	const initialResult = evaluateModel(net, dataset)
	console.log(`初始状态: 准确率 ${initialResult.accuracy.toFixed(1)}%, 损失 ${initialResult.avgLoss.toFixed(4)}`)

	// 训练
	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createGradientBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			accumulateSupervisedGrad(buffer, net, sample.indices, sample.y, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
	}

	const finalResult = evaluateModel(net, dataset)
	console.log(`训练后: 准确率 ${finalResult.accuracy.toFixed(1)}%, 损失 ${finalResult.avgLoss.toFixed(4)}`)
	
	assertGreaterThan(finalResult.accuracy, CONVERGENCE_THRESHOLD, 
		`监督学习应收敛到 ${CONVERGENCE_THRESHOLD}% 以上准确率`)
}

// ========== 无监督学习收敛测试 ==========
console.log("\n--- 无监督学习收敛测试 ---")
{
	const net = createNet()
	
	// 评估初始合法率
	let initialValid = 0
	for (const sample of dataset) {
		const fp = forward(net, sample.indices)
		const action = fp.o.indexOf(Math.max(...fp.o))
		// 在这个简单地形中，只有"走"是合法的
		initialValid += (action === 0) ? 1 : 0
	}
	const initialValidRate = (initialValid / dataset.length) * 100
	console.log(`初始状态: 合法率 ${initialValidRate.toFixed(1)}%`)

	// 训练（无监督）
	for (let step = 0; step < TRAIN_STEPS; step++) {
		const buffer = createUnsupervisedBuffer()
		
		for (let b = 0; b < BATCH_SIZE; b++) {
			const sample = dataset[Math.floor(Math.random() * dataset.length)]
			const fp = forward(net, sample.indices)
			const action = fp.o.indexOf(Math.max(...fp.o))
			
			// 评估动作
			const isValid = (action === 0) // 只有"走"合法
			const isOptimal = isValid
			
			const evaluation = calculateReward(action, isValid, isOptimal, UNSUPERVISED_CONFIG)
			accumulateGradients(buffer, net, sample.indices, evaluation, BATCH_SIZE)
		}
		
		updateNetwork(net, buffer, 1)
	}

	// 评估最终合法率
	let finalValid = 0
	for (const sample of dataset) {
		const fp = forward(net, sample.indices)
		const action = fp.o.indexOf(Math.max(...fp.o))
		finalValid += (action === 0) ? 1 : 0
	}
	const finalValidRate = (finalValid / dataset.length) * 100
	console.log(`训练后: 合法率 ${finalValidRate.toFixed(1)}%`)

	// 这个测试可能会失败，用来暴露问题
	try {
		assertGreaterThan(finalValidRate, CONVERGENCE_THRESHOLD,
			`无监督学习应收敛到 ${CONVERGENCE_THRESHOLD}% 以上合法率`)
		console.log("✅ 无监督学习收敛测试通过")
	} catch (e) {
		console.error("❌ 无监督学习未能收敛！")
		console.error(`   期望: > ${CONVERGENCE_THRESHOLD}%`)
		console.error(`   实际: ${finalValidRate.toFixed(1)}%`)
		console.error("\n可能的原因:")
		console.error("1. 奖励信号太弱")
		console.error("2. 探索率衰减过快")
		console.error("3. 概率重新分配逻辑有问题")
		console.error("4. 需要更多训练步数")
		throw new Error("无监督学习收敛测试失败")
	}
}

printTestComplete()
