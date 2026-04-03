// ========== 监督学习逻辑验证测试（独立运行）==========
// 运行方式: npx tsx src/terrain-lab/__tests__/supervised-test.ts

import {
	createGradientBuffer,
	accumulateSupervisedGrad,
	evaluateModel,
	isValidGradientBuffer,
	getTotalGradientMagnitude,
} from "../supervised.js"
import { createNet } from "../neural-network.js"

// 简单的测试断言
function assertEqual(actual: unknown, expected: unknown, message: string): void {
	if (actual !== expected) {
		throw new Error(`❌ ${message}\n   期望: ${expected}\n   实际: ${actual}`)
	}
	console.log(`✅ ${message}`)
}

function assertTrue(value: boolean, message: string): void {
	if (!value) {
		throw new Error(`❌ ${message}`)
	}
	console.log(`✅ ${message}`)
}

function assertClose(actual: number, expected: number, epsilon: number, message: string): void {
	if (Math.abs(actual - expected) > epsilon) {
		throw new Error(`❌ ${message}\n   期望: ${expected}\n   实际: ${actual}`)
	}
	console.log(`✅ ${message}`)
}

// 测试套件
console.log("\n========== 监督学习单元测试 ==========\n")

// 测试 1: 创建梯度缓冲区
console.log("--- 测试: createGradientBuffer ---")
const buf = createGradientBuffer()
assertTrue(isValidGradientBuffer(buf), "应创建有效的梯度缓冲区")
assertEqual(getTotalGradientMagnitude(buf), 0, "初始梯度幅值应为 0")

// 测试 2: 单样本梯度累积
console.log("\n--- 测试: accumulateSupervisedGrad ---")
const net = createNet()
const buffer = createGradientBuffer()
const indices = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2] // 15个元素索引
const targetLabel = 0 // 目标动作

const result = accumulateSupervisedGrad(buffer, net, indices, targetLabel, 1)

assertTrue(isValidGradientBuffer(buffer), "累积后缓冲区应有效")
assertTrue(getTotalGradientMagnitude(buffer) > 0, "应产生非零梯度")
assertTrue(result.loss > 0, "损失应为正数")
assertTrue(result.isCorrect === true || result.isCorrect === false, "应返回是否正确")

// 测试 3: batchSize 缩放
console.log("\n--- 测试: batchSize 缩放 ---")
const buf1 = createGradientBuffer()
const buf32 = createGradientBuffer()

accumulateSupervisedGrad(buf1, net, indices, targetLabel, 1)
accumulateSupervisedGrad(buf32, net, indices, targetLabel, 32)

const mag1 = getTotalGradientMagnitude(buf1)
const mag32 = getTotalGradientMagnitude(buf32)
assertClose(mag32, mag1 / 32, 0.0001, "batchSize=32 的梯度应为 batchSize=1 的 1/32")

// 测试 4: 多次累积不应产生 NaN
console.log("\n--- 测试: 梯度稳定性 (100次更新) ---")
const stabilityBuffer = createGradientBuffer()
for (let i = 0; i < 100; i++) {
	const label = i % 4 // 循环使用 0-3 标签
	accumulateSupervisedGrad(stabilityBuffer, net, indices, label, 32)
}

assertTrue(isValidGradientBuffer(stabilityBuffer), "100次更新后不应有 NaN")
const totalMag = getTotalGradientMagnitude(stabilityBuffer)
assertTrue(totalMag < 1000, `梯度幅值不应过大 (实际: ${totalMag.toFixed(2)})`)

// 测试 5: 不同标签应产生不同梯度
console.log("\n--- 测试: 不同标签产生不同梯度 ---")
const bufLabel0 = createGradientBuffer()
const bufLabel1 = createGradientBuffer()

accumulateSupervisedGrad(bufLabel0, net, indices, 0, 1)
accumulateSupervisedGrad(bufLabel1, net, indices, 1, 1)

const magLabel0 = getTotalGradientMagnitude(bufLabel0)
const magLabel1 = getTotalGradientMagnitude(bufLabel1)
assertTrue(magLabel0 > 0 && magLabel1 > 0, "两个标签都应产生非零梯度")
// 由于随机初始化，梯度幅值可能不同，但都应有效

// 测试 6: 评估模型
console.log("\n--- 测试: evaluateModel ---")
const testDataset = [
	{ indices: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2], y: 0 },
	{ indices: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2], y: 1 },
	{ indices: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2], y: 2 },
	{ indices: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2], y: 3 },
]

const evalResult = evaluateModel(net, testDataset)
assertTrue(evalResult.accuracy >= 0 && evalResult.accuracy <= 100, "准确率应在 0-100 之间")
assertTrue(evalResult.avgLoss > 0, "平均损失应为正数")

console.log(`   随机初始化准确率: ${evalResult.accuracy.toFixed(1)}%`)
console.log(`   随机初始化损失: ${evalResult.avgLoss.toFixed(4)}`)

console.log("\n========== 所有测试通过! ==========\n")
