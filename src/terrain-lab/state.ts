import type { NetParams, ForwardResult, DatasetItem } from "./types.js"
import type { ActionType } from "./types.js"
import { createNet } from "./neural-network.js"
import { createAnimationState } from "./grid-world/index.js"
import { NUM_COLS, NUM_LAYERS, ELEM_AIR, ELEM_HERO, ELEM_GROUND, DEFAULT_TERRAIN_CONFIG } from "./constants.js"

// ========== 应用状态 ==========

export interface Snapshot {
	step: number
	net: NetParams
	observedProbs?: number[]
	acc?: number
	loss?: number
}

export interface AppState {
	// 地形
	terrain: number[][]
	selectedBrush: number
	terrainConfig: import("./constants.js").TerrainConfig

	// 数据集
	dataset: DatasetItem[]
	trainSteps: number

	// 神经网络
	net: NetParams
	lastForwardResult: ForwardResult | null

	// 训练快照
	snapshots: Snapshot[]
	selectedSnapshotIndex: number

	// 执念曲线观察样本
	observedSample: DatasetItem | null

	// 动画
	animation: {
		animId: number | null
		animStartTime: number
		animAction: ActionType | null
		animSlimeKilled: boolean
	}

	// 学习模式：supervised | unsupervised
	learningMode: "supervised" | "unsupervised"

	// 无监督学习动态探索率
	unsupervisedHistory: number[]  // 滑动窗口：最近几次评估的合法率
	epsilon: number  // 当前探索率
}

export function createInitialState(): AppState {
	return {
		terrain: [
			Array(NUM_COLS).fill(ELEM_AIR),                    // 天上: 全空气
			[ELEM_HERO, ...Array(NUM_COLS - 1).fill(ELEM_AIR)], // 地上: 狐狸默认在x0（编辑器初始状态，数据生成时位置随机）
			[ELEM_GROUND, ELEM_GROUND, ...Array(NUM_COLS - 2).fill(ELEM_AIR)], // 地面
		],
		selectedBrush: ELEM_AIR,
		terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
		dataset: [],
		trainSteps: 0,
		net: createNet(),
		lastForwardResult: null,
		snapshots: [],
		selectedSnapshotIndex: -1,
		observedSample: null,
		animation: createAnimationState(),
		learningMode: "supervised",
		unsupervisedHistory: [],
		epsilon: 0.5,
	}
}

// ========== 状态更新辅助函数 ==========

export function resetState(state: AppState): void {
	state.terrain = [
		Array(NUM_COLS).fill(ELEM_AIR),
		[ELEM_HERO, ...Array(NUM_COLS - 1).fill(ELEM_AIR)],
		[ELEM_GROUND, ELEM_GROUND, ...Array(NUM_COLS - 2).fill(ELEM_AIR)],
	]
	state.selectedBrush = ELEM_AIR
	state.dataset = []
	state.trainSteps = 0
	state.net = createNet()
	state.lastForwardResult = null
	state.snapshots = []
	state.selectedSnapshotIndex = -1
	state.observedSample = null
	// 注意：不重置 learningMode，保留用户选择
	state.unsupervisedHistory = []
	state.epsilon = 0.5
	stopAnimation(state)
}

export function stopAnimation(state: AppState): void {
	if (state.animation.animId !== null) {
		cancelAnimationFrame(state.animation.animId)
		state.animation.animId = null
	}
	state.animation.animAction = null
	state.animation.animSlimeKilled = false
}

export function setTerrainCell(state: AppState, r: number, c: number, brush: number): void {
	// 如果放置狐狸，清除之前位置的狐狸
	if (brush === 1) {
		for (let col = 0; col < NUM_COLS; col++) {
			if (state.terrain[1][col] === 1) state.terrain[1][col] = 0
		}
	}
	state.terrain[r][c] = brush
}
