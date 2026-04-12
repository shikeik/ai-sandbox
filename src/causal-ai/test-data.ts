// ========== 因果链 AI - 测试数据（复用数据源） ==========

import type { GameState, Experience, ActionType } from "./types"
import { createInitialState } from "./state"
import { WORLD_CONFIG } from "./config"

// 关键位置
export const TEST_POSITIONS = {
	start: { x: 0, y: 0 },
	key: WORLD_CONFIG.keyPos,
	door: WORLD_CONFIG.doorPos,
	flag: WORLD_CONFIG.flagPos,
	// 门左侧（开门位置）
	doorLeft: { x: WORLD_CONFIG.doorPos.x - 1, y: WORLD_CONFIG.doorPos.y },
	// 钥匙上方（拾取后方便去门的位置）
	keyAbove: { x: WORLD_CONFIG.keyPos.x, y: WORLD_CONFIG.keyPos.y - 1 }
} as const

// 创建特定状态
export function createState(partial: Partial<GameState> = {}): GameState {
	const initial = createInitialState()
	return {
		...initial,
		...partial,
		agent: partial.agent ? { ...partial.agent } : { ...initial.agent }
	}
}

// 预定义的测试状态
export const TEST_STATES = {
	// 初始状态
	initial: createInitialState(),

	// 在钥匙位置，空手
	atKeyEmpty: createState({
		agent: { ...TEST_POSITIONS.key },
		holding: null,
		keyExists: true,
		doorOpen: false
	}),

	// 在钥匙位置，已拾取钥匙
	atKeyWithKey: createState({
		agent: { ...TEST_POSITIONS.key },
		holding: "key",
		keyExists: false,
		doorOpen: false
	}),

	// 在门左侧，有钥匙，门关闭
	atDoorLeftWithKey: createState({
		agent: { ...TEST_POSITIONS.doorLeft },
		holding: "key",
		keyExists: false,
		doorOpen: false
	}),

	// 在门位置，有钥匙，门已开
	atDoorOpen: createState({
		agent: { ...TEST_POSITIONS.door },
		holding: "key",
		keyExists: false,
		doorOpen: true
	}),

	// 在终点
	atFlag: createState({
		agent: { ...TEST_POSITIONS.flag },
		holding: "key",
		keyExists: false,
		doorOpen: true
	})
} as const

// 创建经验记录
export function createExperience(
	before: GameState,
	action: ActionType,
	after: GameState
): Experience {
	return {
		before: JSON.parse(JSON.stringify(before)),
		action,
		after: JSON.parse(JSON.stringify(after))
	}
}

// 手动构造的关键经验（完成游戏所需的最小经验集）
export function createKeyExperiences(): Experience[] {
	const exps: Experience[] = []

	// 1. 从起点移动到钥匙位置（假设需要向下8次，向右1次）
	// 简化：直接从钥匙位置开始记录拾取经验
	exps.push(createExperience(
		TEST_STATES.atKeyEmpty,
		"pickup",
		TEST_STATES.atKeyWithKey
	))

	// 2. 从门左侧开门进入
	exps.push(createExperience(
		TEST_STATES.atDoorLeftWithKey,
		"move_right",
		TEST_STATES.atDoorOpen
	))

	// 3. 通过已打开的门（从其他地方移动到门位置）
	// 这个经验用于泛化"通过已开门"规则
	const atDoorRightOpen = createState({
		agent: { x: TEST_POSITIONS.door.x + 1, y: TEST_POSITIONS.door.y },
		holding: "key",
		keyExists: false,
		doorOpen: true
	})
	exps.push(createExperience(
		atDoorRightOpen,
		"move_left",
		TEST_STATES.atDoorOpen
	))

	return exps
}

// 完整的通关路径（用于验证规划器）
export const EXPECTED_SOLUTION: ActionType[] = [
	// 从 (0,0) 到钥匙 (1,8)
	"move_right",
	"move_down", "move_down", "move_down", "move_down",
	"move_down", "move_down", "move_down", "move_down",
	// 拾取钥匙
	"pickup",
	// 返回到门左侧 (2,5)
	"move_up", "move_up", "move_up",
	// 开门进入
	"move_right",
	// 到终点 (9,0)
	"move_right", "move_right", "move_right",
	"move_right", "move_right", "move_up", "move_up", "move_up", "move_up", "move_up"
]

// 简化的通关路径（BFS 找到的最短路径）
export const SIMPLE_SOLUTION: ActionType[] = [
	"move_down", "move_down", "move_down", "move_down",
	"move_down", "move_down", "move_down", "move_down",
	"move_right",
	"pickup",
	"move_up", "move_up", "move_up",
	"move_right", "move_right", "move_right",
	"move_up", "move_up", "move_up", "move_up", "move_up",
	"move_right", "move_right", "move_right", "move_right", "move_right"
]
