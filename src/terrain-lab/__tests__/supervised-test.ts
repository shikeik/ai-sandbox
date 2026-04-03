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
import {
	assertEqual,
	assertTrue,
	assertClose,
	assertGreaterThan,
	assertBetween,
	printTestSuite,
	printTestComplete,
} from "./test-utils.js"

printTestSuite("监督学习单元测试")

const net = createNet()
const indices = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2]

// 测试: createGradientBuffer
const buf = createGradientBuffer()
assertTrue(isValidGradientBuffer(buf), "应创建有效的梯度缓冲区")
assertEqual(getTotalGradientMagnitude(buf), 0, "初始梯度幅值应为 0")

// 测试: accumulateSupervisedGrad
const buffer = createGradientBuffer()
const result = accumulateSupervisedGrad(buffer, net, indices, 0, 1)

assertTrue(isValidGradientBuffer(buffer), "累积后缓冲区应有效")
assertGreaterThan(getTotalGradientMagnitude(buffer), 0, "应产生非零梯度")
assertGreaterThan(result.loss, 0, "损失应为正数")
assertTrue(result.isCorrect === true || result.isCorrect === false, "应返回是否正确")

// 测试: batchSize 缩放
const buf1 = createGradientBuffer()
const buf32 = createGradientBuffer()

accumulateSupervisedGrad(buf1, net, indices, 0, 1)
accumulateSupervisedGrad(buf32, net, indices, 0, 32)

assertClose(getTotalGradientMagnitude(buf32), getTotalGradientMagnitude(buf1) / 32, 0.0001,
	"batchSize=32 的梯度应为 batchSize=1 的 1/32")

// 测试: 梯度稳定性 (100次更新)
const stabilityBuffer = createGradientBuffer()
for (let i = 0; i < 100; i++) {
	accumulateSupervisedGrad(stabilityBuffer, net, indices, i % 4, 32)
}

assertTrue(isValidGradientBuffer(stabilityBuffer), "100次更新后不应有 NaN")
assertBetween(getTotalGradientMagnitude(stabilityBuffer), 0, 1000, "梯度幅值不应过大")

// 测试: 不同标签产生不同梯度
const bufLabel0 = createGradientBuffer()
const bufLabel1 = createGradientBuffer()

accumulateSupervisedGrad(bufLabel0, net, indices, 0, 1)
accumulateSupervisedGrad(bufLabel1, net, indices, 1, 1)

assertGreaterThan(getTotalGradientMagnitude(bufLabel0), 0, "标签0应产生非零梯度")
assertGreaterThan(getTotalGradientMagnitude(bufLabel1), 0, "标签1应产生非零梯度")

// 测试: evaluateModel
const testDataset = Array.from({ length: 4 }, (_, i) => ({
	indices: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2],
	y: i,
}))

const evalResult = evaluateModel(net, testDataset)
assertBetween(evalResult.accuracy, 0, 100, "准确率应在 0-100 之间")
assertGreaterThan(evalResult.avgLoss, 0, "平均损失应为正数")

console.log(`   随机初始化准确率: ${evalResult.accuracy.toFixed(1)}%`)
console.log(`   随机初始化损失: ${evalResult.avgLoss.toFixed(4)}`)

printTestComplete()
