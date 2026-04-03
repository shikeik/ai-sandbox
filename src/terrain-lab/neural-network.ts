import type { NetParams, ForwardResult } from "./types.js"
import { HIDDEN_DIM, OUTPUT_DIM, INPUT_DIM, LR } from "./constants.js"
import { randn, zeroVec, createMat } from "./utils.js"

// ========== 神经网络操作 ==========

export function createNet(): NetParams {
  return {
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

export function forward(net: NetParams, x: number[]): ForwardResult {
  const z1 = net.W1.map((row, i) => 
    row.reduce((s, w, j) => s + w * x[j], 0) + net.b1[i]
  )
  const h = relu(z1)
  const z2 = net.W2.map((row, i) => 
    row.reduce((s, w, j) => s + w * h[j], 0) + net.b2[i]
  )
  const o = softmax(z2)
  return { x, z1, h, z2, o }
}

export interface Gradients {
  dW1: number[][]
  db1: number[]
  dW2: number[][]
  db2: number[]
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
  
  return { dW1, db1, dW2, db2 }
}

export function updateNetwork(net: NetParams, grads: Gradients, batchSize: number): void {
  for (let i = 0; i < HIDDEN_DIM; i++) {
    for (let j = 0; j < INPUT_DIM; j++) {
      net.W1[i][j] -= LR * grads.dW1[i][j] / batchSize
    }
    net.b1[i] -= LR * grads.db1[i] / batchSize
  }
  for (let i = 0; i < OUTPUT_DIM; i++) {
    for (let j = 0; j < HIDDEN_DIM; j++) {
      net.W2[i][j] -= LR * grads.dW2[i][j] / batchSize
    }
    net.b2[i] -= LR * grads.db2[i] / batchSize
  }
}
