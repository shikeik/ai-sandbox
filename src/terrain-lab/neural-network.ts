import type { NetParams, ForwardResult, Gradients } from "./types.js"
import { HIDDEN_DIM, OUTPUT_DIM, INPUT_DIM, LR, NUM_ELEMENTS, EMBED_DIM } from "./constants.js"
import { zeroVec, createMat, zeroMat } from "./utils.js"

// ========== 神经网络操作 ==========

export function createNet(): NetParams {
	return {
		embed: createMat(NUM_ELEMENTS, EMBED_DIM, 0.5),
		W1: createMat(HIDDEN_DIM, INPUT_DIM, Math.sqrt(2 / INPUT_DIM)),
		b1: zeroVec(HIDDEN_DIM),
		W2: createMat(OUTPUT_DIM, HIDDEN_DIM, Math.sqrt(2 / HIDDEN_DIM)),
		b2: zeroVec(OUTPUT_DIM),
	}
}

export function relu(x: number[]): number[] {
	return x.map(v => Math.max(0, v))
}

export function softmax(z: number[]): number[] {
	const max = Math.max(...z)
	const exps = z.map(v => Math.exp(v - max))
	const sum = exps.reduce((a, b) => a + b, 0)
	return exps.map(v => v / sum)
}

function embedLookup(embed: number[][], indices: number[]): number[] {
	const x: number[] = []
	for (let i = 0; i < indices.length; i++) {
		const e = indices[i]
		for (let d = 0; d < EMBED_DIM; d++) {
			x.push(embed[e][d])
		}
	}
	return x
}

export function forward(net: NetParams, indices: number[]): ForwardResult {
	const x = embedLookup(net.embed, indices)
	const z1 = net.W1.map((row, i) =>
		row.reduce((s, w, j) => s + w * x[j], 0) + net.b1[i]
	)
	const h = relu(z1)
	const z2 = net.W2.map((row, i) =>
		row.reduce((s, w, j) => s + w * h[j], 0) + net.b2[i]
	)
	const o = softmax(z2)
	return { indices, x, z1, h, z2, o }
}

export function backward(net: NetParams, fp: ForwardResult, target: number): Gradients {
	const dz2 = fp.o.map((v, i) => v - (i === target ? 1 : 0))
	const dW2 = dz2.map(dz => fp.h.map(v => dz * v))
	const db2 = dz2.slice()

	const dh = Array(HIDDEN_DIM).fill(0)
	for (let j = 0; j < HIDDEN_DIM; j++) {
		for (let i = 0; i < OUTPUT_DIM; i++) dh[j] += dz2[i] * net.W2[i][j]
	}
	const dz1 = dh.map((v, i) => (fp.z1[i] > 0 ? v : 0))
	const dW1 = dz1.map(dz => fp.x.map(v => dz * v))
	const db1 = dz1.slice()

	// 计算输入层梯度 dx，并映射回 dEmbed
	const dx = Array(INPUT_DIM).fill(0)
	for (let j = 0; j < INPUT_DIM; j++) {
		for (let h = 0; h < HIDDEN_DIM; h++) {
			dx[j] += dz1[h] * net.W1[h][j]
		}
	}
	const dEmbed = zeroMat(NUM_ELEMENTS, EMBED_DIM)
	for (let i = 0; i < fp.indices.length; i++) {
		const e = fp.indices[i]
		for (let d = 0; d < EMBED_DIM; d++) {
			dEmbed[e][d] += dx[i * EMBED_DIM + d]
		}
	}

	return { dEmbed, dW1, db1, dW2, db2 }
}

const WEIGHT_CLIP = 5.0  // 权重裁剪，防止梯度爆炸

export function updateNetwork(net: NetParams, grads: Gradients, batchSize: number): void {
	for (let e = 0; e < NUM_ELEMENTS; e++) {
		for (let d = 0; d < EMBED_DIM; d++) {
			net.embed[e][d] -= LR * grads.dEmbed[e][d] / batchSize
			// 权重裁剪
			net.embed[e][d] = Math.max(-WEIGHT_CLIP, Math.min(WEIGHT_CLIP, net.embed[e][d]))
		}
	}
	for (let i = 0; i < HIDDEN_DIM; i++) {
		for (let j = 0; j < INPUT_DIM; j++) {
			net.W1[i][j] -= LR * grads.dW1[i][j] / batchSize
			net.W1[i][j] = Math.max(-WEIGHT_CLIP, Math.min(WEIGHT_CLIP, net.W1[i][j]))
		}
		net.b1[i] -= LR * grads.db1[i] / batchSize
		net.b1[i] = Math.max(-WEIGHT_CLIP, Math.min(WEIGHT_CLIP, net.b1[i]))
	}
	for (let i = 0; i < OUTPUT_DIM; i++) {
		for (let j = 0; j < HIDDEN_DIM; j++) {
			net.W2[i][j] -= LR * grads.dW2[i][j] / batchSize
			net.W2[i][j] = Math.max(-WEIGHT_CLIP, Math.min(WEIGHT_CLIP, net.W2[i][j]))
		}
		net.b2[i] -= LR * grads.db2[i] / batchSize
		net.b2[i] = Math.max(-WEIGHT_CLIP, Math.min(WEIGHT_CLIP, net.b2[i]))
	}
}

export function cloneNet(net: NetParams): NetParams {
	return {
		embed: net.embed.map(row => row.slice()),
		W1: net.W1.map(row => row.slice()),
		b1: net.b1.slice(),
		W2: net.W2.map(row => row.slice()),
		b2: net.b2.slice(),
	}
}
