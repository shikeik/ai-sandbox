import type { ElementType, ActionType } from "./types.js"

// ========== 元素ID常量 ==========
export const ELEM_AIR = 0      // 空气
export const ELEM_HERO = 1     // 狐狸
export const ELEM_GROUND = 2   // 平地
export const ELEM_SLIME = 3    // 史莱姆
export const ELEM_DEMON = 4    // 恶魔
export const ELEM_COIN = 5     // 金币

// ========== 元素定义 ==========
export const ELEMENTS: { id: number; name: ElementType; emoji: string }[] = [
  { id: ELEM_AIR, name: "空气", emoji: "⬛" },
  { id: ELEM_HERO, name: "狐狸", emoji: "🦊" },
  { id: ELEM_GROUND, name: "平地", emoji: "🟩" },
  { id: ELEM_SLIME, name: "史莱姆", emoji: "🦠" },
  { id: ELEM_DEMON, name: "恶魔", emoji: "👿" },
  { id: ELEM_COIN, name: "金币", emoji: "🪙" },
]

// 层限制：0=天上，1=地上，2=地面
export const LAYER_LIMITS: number[][] = [
  [ELEM_AIR, ELEM_DEMON, ELEM_COIN],           // 天上: 空气, 恶魔, 金币
  [ELEM_AIR, ELEM_HERO, ELEM_SLIME, ELEM_COIN], // 地上: 空气, 狐狸, 史莱姆, 金币
  [ELEM_AIR, ELEM_GROUND],                      // 地面: 空气, 平地
]

// ========== 网络架构常量 ==========
export const NUM_LAYERS = 3        // 层数（天上、地上、地面）
export const NUM_COLS = 5          // 列数（x0-x4）
export const NUM_ELEMENTS = 6      // 元素种类数
export const EMBED_DIM = 2         // 元素向量维度
export const HIDDEN_DIM = 16       // 隐藏层神经元数
export const OUTPUT_DIM = 4        // 输出层动作数

// 派生常量
export const INPUT_DIM = NUM_COLS * NUM_LAYERS * EMBED_DIM     // 30 = 5×3×2

// ========== 地形配置 ==========
export interface TerrainConfig {
	groundOnly: boolean // true = 地面层只有平地（无坑）
	slime: boolean
	demon: boolean
	coin: boolean
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
	groundOnly: false,
	slime: true,
	demon: true,
	coin: true,
}

export const CURRICULUM_STAGES: { name: string; config: TerrainConfig }[] = [
	{ name: "阶段1：平地大道", config: { groundOnly: true, slime: false, demon: false, coin: false } },
	{ name: "阶段2：小心坑洞", config: { groundOnly: false, slime: false, demon: false, coin: false } },
	{ name: "阶段3：史莱姆出没", config: { groundOnly: false, slime: true, demon: false, coin: false } },
	{ name: "阶段4：天降恶魔", config: { groundOnly: false, slime: true, demon: true, coin: false } },
	{ name: "阶段5：金币干扰", config: { groundOnly: false, slime: true, demon: true, coin: true } },
]

// ========== 可视化常量 ==========
// embedding 元素点大小由全局 R 值缩放：factor = base - sensitivity * (maxAbs - offset)
export const EMBED_SIZE_BASE = 1.8
export const EMBED_SIZE_SENSITIVITY = 0.1
export const EMBED_SIZE_OFFSET = 0.5
export const EMBED_SIZE_MIN = 0.6
export const EMBED_SIZE_MAX = 2

// ========== 其他常量 ==========
export const ACTIONS: ActionType[] = ["走", "跳", "远跳", "走A"]
export const ROW_NAMES = ["天上", "地上", "地面"]
export const LR = 0.05

// ========== 无监督学习配置（在这里改数值）==========
export const UNSUPERVISED_CONFIG = {
	// 奖励值（细粒度，正负必须对称）
	rewardOptimal: 0.05,     // 最优动作奖励
	rewardValid: 0.02,       // 合法但非最优奖励  
	rewardInvalid: -0.05,    // 非法动作惩罚（与 optimal 完全对称）

	// 动态探索率
	epsilonMin: 0.1,        // 最小探索率
	epsilonMax: 0.4,        // 最大探索率
	epsilonWindowSize: 5,   // 滑动窗口大小
	epsilonImproveThreshold: 0.5,  // 进步阈值（百分比）
	epsilonDecayStep: 0.015,  // 进步时降低量
	epsilonGrowStep: 0.015,   // 退步时增加量
	epsilonDecayIdle: 0.005,  // 持平时降低量
}

// ========== 训练配置（统一入口）==========
export const TRAIN_CONFIG = {
	supervised: {
		batchSize: 32,
		steps: 100,
	},
	unsupervised: {
		batchSize: 32,
		steps: 1000,  // 无监督需要更多步数收敛
	},
}
