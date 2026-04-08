// 将现有的 28×28 数据集降采样到 14×14
import { readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))

// 读取现有数据集
const datasetPath = join(__dirname, "../src/mnist-lab/real-dataset.ts")
const content = readFileSync(datasetPath, "utf-8")

// 提取 Base64 数据
const trainMatches = [...content.matchAll(/\["([^"]+)",(\d+)\]/g)]

console.log(`找到 ${trainMatches.length} 条记录`)

// 去重：按 base64 分组
const samples = []
const seen = new Set()

for (const match of trainMatches) {
	const b64 = match[1]
	const label = parseInt(match[2])
	if (!seen.has(b64)) {
		seen.add(b64)
		samples.push({ b64, label })
	}
}

console.log(`去重后: ${samples.length} 条`)

// 打乱
for (let i = samples.length - 1; i > 0; i--) {
	const j = Math.floor(Math.random() * (i + 1));
	[samples[i], samples[j]] = [samples[j], samples[i]]
}

// 分割训练集/测试集
const trainSize = Math.floor(samples.length * 0.8)
const trainSamples = samples.slice(0, trainSize)
const testSamples = samples.slice(trainSize)

console.log(`训练集: ${trainSamples.length}, 测试集: ${testSamples.length}`)

// 降采样函数 - Nearest Neighbor（取左上角像素，无噪声）
function downsample28to14(b64) {
	const binary = Buffer.from(b64, "base64")
	const input28 = new Array(784)
	for (let i = 0; i < 784; i++) {
		input28[i] = binary[i]
	}
	
	// Nearest Neighbor: 直接取 2×2 区域的左上角像素
	const output14 = new Array(196)
	for (let y = 0; y < 14; y++) {
		for (let x = 0; x < 14; x++) {
			// 取左上角像素 (y*2, x*2)
			output14[y * 14 + x] = input28[(y * 2) * 28 + (x * 2)]
		}
	}
	return Buffer.from(output14).toString("base64")
}

// 生成新文件
let output = `// ========== MNIST 精选数据集 (14×14) ==========
// 从 28×28 降采样生成
// 训练集: ${trainSamples.length} 张 | 测试集: ${testSamples.length} 张

export interface MNISTSample {
  input: number[]  // 196维 (14×14), 值 0-1
  label: number   // 0-9
}

export const MNIST_STATS = {
  trainSize: ${trainSamples.length},
  testSize: ${testSamples.length},
  imageSize: 14,
  inputDim: 196,
  numClasses: 10
}

function parseBase64(base64: string): number[] {
  const binary = atob(base64)
  const result: number[] = new Array(196)
  for (let i = 0; i < 196; i++) {
    result[i] = binary.charCodeAt(i) / 255
  }
  return result
}

const TRAIN_BASE64: [string, number][] = [
`

for (const s of trainSamples) {
	const b64_14 = downsample28to14(s.b64)
	output += `  ["${b64_14}",${s.label}],\n`
}

output += `]

const TEST_BASE64: [string, number][] = [
`

for (const s of testSamples) {
	const b64_14 = downsample28to14(s.b64)
	output += `  ["${b64_14}",${s.label}],\n`
}

output += `]

export function getTrainData(): MNISTSample[] {
  return TRAIN_BASE64.map(([b64, label]) => ({ input: parseBase64(b64), label }))
}

export function getTestData(): MNISTSample[] {
  return TEST_BASE64.map(([b64, label]) => ({ input: parseBase64(b64), label }))
}
`

writeFileSync(datasetPath, output)
console.log(`✅ 已保存 14×14 数据集: ${datasetPath}`)
console.log(`文件大小: ${(output.length / 1024).toFixed(1)} KB`)
