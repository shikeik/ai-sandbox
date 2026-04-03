// ========== 无监督学习逻辑验证测试（独立运行）==========
// 运行方式: npx tsx src/terrain-lab/__tests__/unsupervised-test.ts

import {
	createGradientBuffer,
	calculateReward,
	accumulateGradients,
	isValidGradientBuffer,
	getTotalGradientMagnitude,
	type UnsupervisedRewardConfig,
	type ActionEvaluation,
} from "../unsupervised.js"
import { createNet } from "../neural-network.js"

// 测试配置
const TEST_CONFIG: UnsupervisedRewardConfig = {
	rewardOptimal: 0.05,
	rewardValid: 0.02,
	rewardInvalid: -0.05,
}

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
console.log("\n========== 无监督学习单元测试 ==========\n")

// 测试 1: 奖励计算
console.log("--- 测试: calculateReward ---")
const invalidReward = calculateReward(0, false, false, TEST_CONFIG)
assertEqual(invalidReward.reward, -0.05, "非法动作应返回负奖励")
assertEqual(invalidReward.isValid, false, "非法动作 isValid 应为 false")

const validReward = calculateReward(1, true, false, TEST_CONFIG)
assertEqual(validReward.reward, 0.02, "合法非最优应返回 0.02")
assertEqual(validReward.isOptimal, false, "合法非最优 isOptimal 应为 false")

const optimalReward = calculateReward(2, true, true, TEST_CONFIG)
assertEqual(optimalReward.reward, 0.05, "最优动作应返回 0.05")
assertEqual(optimalReward.isOptimal, true, "最优动作 isOptimal 应为 true")

// 测试 2: 梯度缓冲区
console.log("\n--- 测试: createGradientBuffer ---")
const buf = createGradientBuffer()
assertTrue(isValidGradientBuffer(buf), "应创建有效的梯度缓冲区")
assertEqual(getTotalGradientMagnitude(buf), 0, "初始梯度幅值应为 0")

// 测试 3: 正向奖励累积梯度
console.log("\n--- 测试: accumulateGradients (正向) ---")
const net = createNet()
const buffer = createGradientBuffer()
const indices = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2]

const posEval: ActionEvaluation = {
	action: 0,
	isValid: true,
	isOptimal: true,
	reward: 0.05,
}

accumulateGradients(buffer, net, indices, posEval, 1)
assertTrue(isValidGradientBuffer(buffer), "正向奖励后缓冲区应有效")
assertTrue(getTotalGradientMagnitude(buffer) > 0, "正向奖励应产生非零梯度")

// 测试 4: 负向奖励累积梯度
console.log("\n--- 测试: accumulateGradients (负向) ---")
const buffer2 = createGradientBuffer()
const negEval: ActionEvaluation = {
	action: 1,
	isValid: false,
	isOptimal: false,
	reward: -0.05,
}

accumulateGradients(buffer2, net, indices, negEval, 1)
assertTrue(isValidGradientBuffer(buffer2), "负向奖励后缓冲区应有效")
assertTrue(getTotalGradientMagnitude(buffer2) > 0, "负向奖励应产生非零梯度")

// 测试 5: 梯度稳定性
console.log("\n--- 测试: 梯度稳定性 (100次随机更新) ---")
const stabilityBuffer = createGradientBuffer()
for (let i = 0; i < 100; i++) {
	const isValid = Math.random() > 0.5
	const isOptimal = isValid && Math.random() > 0.5
	const reward = isOptimal ? 0.05 : isValid ? 0.02 : -0.05
	const action = Math.floor(Math.random() * 4)

	const evaluation: ActionEvaluation = {
		action,
		isValid,
		isOptimal,
		reward,
	}
	accumulateGradients(stabilityBuffer, net, indices, evaluation, 32)
}

assertTrue(isValidGradientBuffer(stabilityBuffer), "100次更新后不应有 NaN")
const totalMag = getTotalGradientMagnitude(stabilityBuffer)
assertTrue(totalMag < 1000, `梯度幅值不应过大 (实际: ${totalMag.toFixed(2)})`)

// 测试 6: batchSize 缩放
console.log("\n--- 测试: batchSize 缩放 ---")
const buf1 = createGradientBuffer()
const buf32 = createGradientBuffer()
const evalAction: ActionEvaluation = {
	action: 0,
	isValid: true,
	isOptimal: true,
	reward: 0.05,
}

accumulateGradients(buf1, net, indices, evalAction, 1)
accumulateGradients(buf32, net, indices, evalAction, 32)

const mag1 = getTotalGradientMagnitude(buf1)
const mag32 = getTotalGradientMagnitude(buf32)
assertClose(mag32, mag1 / 32, 0.0001, "batchSize=32 的梯度应为 batchSize=1 的 1/32")

console.log("\n========== 所有测试通过! ==========\n")
