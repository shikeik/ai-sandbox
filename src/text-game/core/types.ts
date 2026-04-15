// ========== 类型定义 ==========

/** 游戏场景 ID */
export type SceneId = string

/** 玩家动作 */
export interface Action {
	id: string
	label: string
	/** 不可用时置为 false，用于展示但不可选 */
	enabled?: boolean
	/** 不可选时的提示 */
	hint?: string
}

/** 场景内容 */
export interface Scene {
	id: SceneId
	name: string
	description: string
}

/** 玩家属性 */
export interface PlayerState {
	health: number
	maxHealth: number
	items: string[]
	flags: Record<string, boolean>
	notes: string[]
	day: number
	/** 通用数值属性，用于 Roguelike 等扩展玩法 */
	stats: Record<string, number>
}

/** 游戏全局状态 */
export interface GameState {
	player: PlayerState
	currentSceneId: SceneId
	log: string[]
	gameOver: boolean
	win: boolean
	worldFlags: Record<string, boolean | string | number>
}

/** 动作执行结果 */
export interface ActionResult {
	text: string
	/** 覆盖玩家状态 */
	playerChange?: Partial<PlayerState>
	/** 覆盖世界标记 */
	worldFlagsChange?: Record<string, boolean | string | number>
	/** 跳转场景 */
	nextSceneId?: SceneId
	/** 是否要求输入一个字符串（如密码） */
	requireInput?: {
		prompt: string
		/** 正确答案 */
		answer: string
		/** 答对后的额外结果 */
		onSuccess?: Partial<ActionResult>
		/** 答错后的文本 */
		onFailText?: string
	}
	gameOver?: boolean
	win?: boolean
}

/** 动态获取当前可用动作 */
export type ActionProvider = (state: GameState) => Action[]

/** 动作处理器 */
export type ActionHandler = (state: GameState, actionId: string, inputValue?: string) => ActionResult
