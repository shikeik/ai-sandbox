// ========== MNIST Lab - 手写数字识别训练沙盒 ==========

import type { NetworkParams, TrainingMetrics } from "@/engine/ml/index.js"
import {
	createNetwork,
	forward,
	TrainingEngine,
	evaluateNetwork
} from "@/engine/ml/index.js"
import { type MNISTSample } from "./dataset.js"
import { MNIST_CONFIG, createNetworkConfig } from "./config.js"
import { getTrainData, getTestData } from "./real-dataset.js"
import { preprocessInput } from "./preprocess.js"
import {
	createDrawingCanvas,
	clearCanvas,
	renderPixelPreview,
	renderProbabilities
} from "./canvas-draw.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 配置 ==========

const NETWORK_CONFIG = createNetworkConfig()
const IMAGE_SIZE = MNIST_CONFIG.IMAGE_SIZE
const DISPLAY_SIZE = MNIST_CONFIG.CANVAS_DISPLAY_SIZE

// ========== 状态 ==========

interface AppState {
	net: NetworkParams
	dataset: { train: MNISTSample[]; test: MNISTSample[] }
	isTraining: boolean
	cumulativeSteps: number  // 累计训练步数（从网络创建开始）
	currentStep: number      // 当前训练进度
	totalSteps: number       // 当前训练总步数
	bestAccuracy: number
}

const state: AppState = {
	net: createNetwork(NETWORK_CONFIG),
	dataset: { train: [], test: [] },
	isTraining: false,
	cumulativeSteps: 0,
	currentStep: 0,
	totalSteps: 0,
	bestAccuracy: 0
}

const logger = new Logger("MNIST-LAB")

// ========== DOM 元素引用 ==========

let drawingCanvas: ReturnType<typeof createDrawingCanvas> | null = null
let previewCanvas: HTMLCanvasElement | null = null
let probCanvas: HTMLCanvasElement | null = null
let networkCanvas: HTMLCanvasElement | null = null

// ========== 初始化 ==========

export function init(): void {
	logger.log("MNIST-LAB", `初始化 MNIST Lab (${IMAGE_SIZE}×${IMAGE_SIZE})`)

	// 初始化画布
	drawingCanvas = createDrawingCanvas("draw-canvas", IMAGE_SIZE, DISPLAY_SIZE, onDrawingEnd)
	previewCanvas = document.getElementById("preview-canvas") as HTMLCanvasElement
	probCanvas = document.getElementById("prob-canvas") as HTMLCanvasElement
	networkCanvas = document.getElementById("network-canvas") as HTMLCanvasElement

	if (previewCanvas) {
		previewCanvas.width = 140
		previewCanvas.height = 140
	}
	if (probCanvas) {
		probCanvas.width = 300
		probCanvas.height = 150
	}
	if (networkCanvas) {
		networkCanvas.width = 400
		networkCanvas.height = 300
	}

	// 加载数据集
	state.dataset = { train: getTrainData(), test: getTestData() }
	updateDataInfo()

	// 绘制初始网络
	drawNetwork()

	// 绑定按钮事件
	bindEvents()

	logger.log("MNIST-LAB", "MNIST Lab 初始化完成")
}

function bindEvents(): void {
	// 训练按钮
	const btnTrain = document.getElementById("btn-train")
	btnTrain?.addEventListener("click", () => train(1))

	const btnTrain10 = document.getElementById("btn-train-10")
	btnTrain10?.addEventListener("click", () => train(10))

	const btnTrain50 = document.getElementById("btn-train-50")
	btnTrain50?.addEventListener("click", () => train(50))

	// 清除按钮
	const btnClear = document.getElementById("btn-clear")
	btnClear?.addEventListener("click", () => {
		if (drawingCanvas) {
			clearCanvas(drawingCanvas)
			clearResults()
		}
	})

	// 重置网络
	const btnReset = document.getElementById("btn-reset")
	btnReset?.addEventListener("click", resetNetwork)

	// 测试随机样本
	const btnTestRandom = document.getElementById("btn-test-random")
	btnTestRandom?.addEventListener("click", testRandomSample)
}

// ========== 训练逻辑 ==========

async function train(epochs: number): Promise<void> {
	if (state.isTraining) return

	state.isTraining = true
	updateButtonStates()

	// 计算总步数
	const batchSize = 32
	const stepsPerEpoch = Math.ceil(state.dataset.train.length / batchSize)
	state.totalSteps = epochs * stepsPerEpoch

	const engine = new TrainingEngine(state.net, NETWORK_CONFIG)
	const startTime = performance.now()
	let lastEvalStep = 0

	await engine.train(state.dataset.train, {
		epochs,
		batchSize,
		onBatch: async (metrics: TrainingMetrics) => {
			state.currentStep = metrics.step
			state.cumulativeSteps++
			updateTrainingProgress(metrics)

			// 每100步评估一次（减少评估频率，提高速度）
			if (metrics.step - lastEvalStep >= 100) {
				lastEvalStep = metrics.step
				const evalResult = evaluateNetwork(state.net, state.dataset.test)
				if (evalResult.accuracy > state.bestAccuracy) {
					state.bestAccuracy = evalResult.accuracy
				}
				updateEvalResult(evalResult)
				drawNetwork()
			}

			// 每10步让出一次时间片，避免UI卡死
			if (metrics.step % 10 === 0) {
				await new Promise(r => setTimeout(r, 0))
			}
		}
	})

	const duration = ((performance.now() - startTime) / 1000).toFixed(1)
	logger.log("MNIST-LAB", `训练完成，耗时 ${duration} 秒`)

	// 最终评估
	const finalResult = evaluateNetwork(state.net, state.dataset.test)
	updateEvalResult(finalResult)
	state.bestAccuracy = Math.max(state.bestAccuracy, finalResult.accuracy)
	updateBestAccuracy()

	state.isTraining = false
	state.currentStep = 0
	state.totalSteps = 0
	updateButtonStates()
}

// ========== 预测逻辑 ==========

function onDrawingEnd(): void {
	if (!drawingCanvas) return

	// 获取原始输入
	const inputRaw = drawingCanvas.pixels

	// 预处理（居中 + 缩放）
	let inputProcessed: number[]
	if (MNIST_CONFIG.PREPROCESS.CENTER || MNIST_CONFIG.PREPROCESS.SCALE) {
		inputProcessed = preprocessInput(inputRaw)
	} else {
		inputProcessed = inputRaw
	}

	// 显示预览
	if (previewCanvas) {
		renderPixelPreview(previewCanvas, inputProcessed)
	}

	// 预测
	predict(inputProcessed)
}

function predict(input: number[]): void {
	const fp = forward(state.net, input)

	// 显示概率
	if (probCanvas) {
		renderProbabilities(probCanvas, fp.output)
	}

	// 显示结果
	const predicted = fp.output.indexOf(Math.max(...fp.output))
	const confidence = fp.output[predicted]
	updatePredictionResult(predicted, confidence)
}

function testRandomSample(): void {
	const sample = state.dataset.test[Math.floor(Math.random() * state.dataset.test.length)]

	if (drawingCanvas && previewCanvas) {
		clearCanvas(drawingCanvas)

		// 将 14×14 绘制到画布（放大显示）
		const ctx = drawingCanvas.ctx
		const pixelScale = DISPLAY_SIZE / IMAGE_SIZE

		for (let y = 0; y < IMAGE_SIZE; y++) {
			for (let x = 0; x < IMAGE_SIZE; x++) {
				const value = sample.input[y * IMAGE_SIZE + x]
				if (value > 0.05) {
					ctx.fillStyle = `rgba(255,255,255,${value})`
					ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale)
				}
			}
		}

		// 更新像素数据
		for (let i = 0; i < IMAGE_SIZE * IMAGE_SIZE; i++) {
			drawingCanvas.pixels[i] = sample.input[i]
		}

		// 显示预览和预测
		renderPixelPreview(previewCanvas, sample.input)
		predict(sample.input)

		// 显示真实标签
		const trueLabel = document.getElementById("true-label")
		if (trueLabel) {
			trueLabel.textContent = `真实数字: ${sample.label}`
		}
	}
}

// ========== UI 更新 ==========

function updateDataInfo(): void {
	const el = document.getElementById("data-info")
	if (el) {
		el.textContent = `训练集: ${state.dataset.train.length} 条 | 测试集: ${state.dataset.test.length} 条 | 输入: 28×28 | 输出: 10类`
	}
}

function updateTrainingProgress(metrics: TrainingMetrics): void {
	const el = document.getElementById("training-progress")
	if (el) {
		const current = state.currentStep
		const total = state.totalSteps
		const cumulative = state.cumulativeSteps
		const progressStr = total > 0 ? ` (${((current / total) * 100).toFixed(0)}%)` : ""
		el.textContent = `本次: ${current}/${total}${progressStr} | 累计: ${cumulative}步 | Loss: ${metrics.loss.toFixed(4)} | Batch: ${metrics.accuracy.toFixed(1)}%`
	}
}

function updateEvalResult(result: { accuracy: number; avgLoss: number }): void {
	const el = document.getElementById("eval-result")
	if (el) {
		el.textContent = `测试准确率: ${result.accuracy.toFixed(1)}% | 测试Loss: ${result.avgLoss.toFixed(4)}`
	}
}

function updateBestAccuracy(): void {
	const el = document.getElementById("best-accuracy")
	if (el) {
		el.textContent = `最佳准确率: ${state.bestAccuracy.toFixed(1)}%`
	}
}

function updatePredictionResult(predicted: number, confidence: number): void {
	const el = document.getElementById("prediction-result")
	if (el) {
		el.innerHTML = `预测结果: <span class="digit-${predicted}">${predicted}</span> (置信度: ${(confidence * 100).toFixed(1)}%)`
	}
}

function clearResults(): void {
	const predEl = document.getElementById("prediction-result")
	if (predEl) predEl.textContent = "绘制数字后自动识别..."

	const trueEl = document.getElementById("true-label")
	if (trueEl) trueEl.textContent = ""

	if (probCanvas) {
		const ctx = probCanvas.getContext("2d")
		if (ctx) {
			ctx.fillStyle = "#1a1a2e"
			ctx.fillRect(0, 0, probCanvas.width, probCanvas.height)
		}
	}
}

function updateButtonStates(): void {
	const buttonLabels: Record<string, string> = {
		"btn-train": "训练 1 轮",
		"btn-train-10": "训练 10 轮",
		"btn-train-50": "训练 50 轮"
	}
	Object.keys(buttonLabels).forEach(id => {
		const btn = document.getElementById(id) as HTMLButtonElement
		if (btn) {
			btn.disabled = state.isTraining
			btn.textContent = state.isTraining ? "训练中..." : `▶️ ${buttonLabels[id]}`
		}
	})
}

function resetNetwork(): void {
	state.net = createNetwork(NETWORK_CONFIG)
	state.cumulativeSteps = 0
	state.currentStep = 0
	state.totalSteps = 0
	state.bestAccuracy = 0
	updateTrainingProgress({ step: 0, loss: 0, accuracy: 0, progress: 0 })
	updateEvalResult({ accuracy: 0, avgLoss: 0 })
	updateBestAccuracy()
	drawNetwork()
	logger.log("MNIST-LAB", "网络已重置")
}

// ========== 网络可视化 ==========

function drawNetwork(): void {
	if (!networkCanvas) return

	const ctx = networkCanvas.getContext("2d")
	if (!ctx) return

	const w = networkCanvas.width
	const h = networkCanvas.height

	// 清空
	ctx.fillStyle = "#0f0f1e"
	ctx.fillRect(0, 0, w, h)

	// 网络结构
	const layers = [784, 128, 64, 10]
	const layerX = [60, 150, 240, 340]
	const maxNeurons = 20  // 最多显示20个神经元

	// 绘制连线
	ctx.strokeStyle = "rgba(74, 222, 128, 0.1)"
	ctx.lineWidth = 0.5

	for (let l = 0; l < layers.length - 1; l++) {
		const count1 = Math.min(layers[l], maxNeurons)
		const count2 = Math.min(layers[l + 1], maxNeurons)

		for (let i = 0; i < count1; i++) {
			const y1 = getNeuronY(i, count1, h)
			for (let j = 0; j < count2; j++) {
				const y2 = getNeuronY(j, count2, h)
				ctx.beginPath()
				ctx.moveTo(layerX[l], y1)
				ctx.lineTo(layerX[l + 1], y2)
				ctx.stroke()
			}
		}
	}

	// 绘制神经元
	for (let l = 0; l < layers.length; l++) {
		const count = Math.min(layers[l], maxNeurons)
		const isLast = l === layers.length - 1

		for (let i = 0; i < count; i++) {
			const y = getNeuronY(i, count, h)

			// 圆形
			ctx.beginPath()
			ctx.arc(layerX[l], y, isLast ? 12 : 4, 0, Math.PI * 2)
			ctx.fillStyle = isLast ? getDigitColor(i) : "#4ade80"
			ctx.fill()

			// 最后一层显示数字
			if (isLast) {
				ctx.fillStyle = "white"
				ctx.font = "10px sans-serif"
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.fillText(String(i), layerX[l], y)
			}
		}

		// 显示省略号
		if (layers[l] > maxNeurons) {
			ctx.fillStyle = "#666"
			ctx.font = "12px sans-serif"
			ctx.textAlign = "center"
			ctx.fillText("...", layerX[l], h - 20)
		}
	}

	// 标签
	ctx.fillStyle = "#888"
	ctx.font = "11px sans-serif"
	ctx.textAlign = "center"
	ctx.fillText("输入\n784", layerX[0], h - 5)
	ctx.fillText("隐藏\n128", layerX[1], h - 5)
	ctx.fillText("隐藏\n64", layerX[2], h - 5)
	ctx.fillText("输出\n10", layerX[3], h - 5)
}

function getNeuronY(index: number, total: number, height: number): number {
	const availableHeight = height - 60
	const spacing = availableHeight / Math.max(1, total - 1)
	return 30 + index * spacing
}

function getDigitColor(digit: number): string {
	const colors = [
		"#ef4444", "#f97316", "#f59e0b", "#84cc16",
		"#22c55e", "#10b981", "#06b6d4", "#3b82f6",
		"#8b5cf6", "#d946ef"
	]
	return colors[digit] ?? "#4ade80"
}

// ========== 启动 ==========

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init)
} else {
	init()
}
