// ========== Brain Lab 配置常量 ==========

import type { LevelData } from "./types/index.js"
import type { Position } from "./types/index.js"

/** 默认世界尺寸 */
export const DEFAULT_WORLD_SIZE = {
	width: 10,
	height: 6,
} as const

/** 渲染配置 */
export const RENDER_CONFIG = {
	cellSize: 28,      // 格子大小（像素）
	gap: 3,            // 格子间距（像素）
	viewportWidth: 320,   // 视口宽度（像素）
	viewportHeight: 170,  // 视口高度（像素）
	minViewportWidth: 280, // 最小视口宽度
} as const

/** 动画时长配置（毫秒） */
export const ANIMATION_DURATION = {
	heroMove: 250,
	heroMoveFast: 150,
	heroJump: 500,
	heroJumpLong: 600,
	heroFall: 300,
	heroFallLong: 500,
	spikeFall: 600,
	spikeFallFast: 300,
	enemyDie: 400,
	buttonPress: 200,
	cameraTransition: 300,
} as const

/** 跳跃配置 */
export const JUMP_CONFIG = {
	maxHeight: 2,      // 最大跳跃高度（格）
	parabolaHeight: 40, // 抛物线最高点偏移（像素）
} as const

/** 游戏元素字符映射（用于关卡地图） */
export const CHAR_MAP: Record<string, number> = {
	"．": 0,     // 全角句点 - 空气
	"＃": 2,     // 全角井号 - 平台
	"！": 6,     // 全角叹号 - 按钮
	"￡": 4,     // 全角英镑 - 终点
	"＾": 5,     // 全角脱字符 - 尖刺
	"￠": 0,     // 全角分币 - 敌人（下方需要平台）
	"＠": 0,     // 全角at - 玩家起点
} as const

/** 特殊字符标记 */
export const SPECIAL_CHARS = {
	heroStart: "＠",    // 玩家起点
	enemy: "￠",        // 敌人
} as const

/** 默认关卡地图（视觉从上到下，代码会反转） */
export const DEFAULT_LEVEL_MAP: LevelData = {
	name: "default",
	width: 10,
	height: 5,
	map: [
		"．．．．＾．．．．．",  // y=4 顶层：尖刺悬挂
		"．．．．．．．．．．",  // y=3
		"．．＃！．．．．．．",  // y=2
		"．＠＃．＃．．．￡．",  // y=1：平台、按钮、敌人
		"．＃＃＃￠＃＃＃＃．",  // y=0 底层：地面平台
	],
}

/** 进阶关卡地图 - 多按钮多尖刺设计（12×8） */
export const ADVANCED_LEVEL_MAP: LevelData = {
	name: "advanced",
	width: 12,
	height: 8,
	map: [
		"．．．．．＾．．＾．．．．",  // y=7 顶层：两个尖刺(x=5, x=7)
		"．．．．！．．．！．．．．",  // y=6 高台(x=4, x=7)
		"．．．．＃．．．＃．．．．",  // y=5 两个按钮(x=4在平台下, x=7在平台下)
		"．．＃．．．．＃．．．￡．",  // y=4 中层散台
		"．＠．．．．．．．．．＃．",  // y=3 玩家起点(x=1)
		"．＃＃．．．＃．．．．．．",  // y=2 中层平台
		"．．．．．￠．．￠．．．＃",  // y=1 两个敌人(x=5在尖刺1下, x=7在尖刺2下)
		"＃＃＃＃＃＃＃＃＃＃＃＃＃",  // y=0 底层长平台
	],
}

/** AI配置 */
export const AI_CONFIG = {
	defaultDepth: 3,        // 默认想象深度
	discountFactor: 0.9,    // 奖励折扣因子
	planningSteps: 2,       // 规划步数
} as const

/** 奖励值 */
export const REWARDS = {
	reachGoal: 1000,        // 到达终点
	killEnemy: 50,          // 击杀敌人
	perStepX: 10,           // 每向右一步
	death: -100,            // 死亡
} as const

/** 按钮-尖刺对应关系的颜色编码 */
export const BUTTON_SPIKE_COLORS = [
	{ button: "#e74c3c", spike: "#c0392b", name: "红" },    // 红色
	{ button: "#3498db", spike: "#2980b9", name: "蓝" },    // 蓝色
	{ button: "#2ecc71", spike: "#27ae60", name: "绿" },    // 绿色
	{ button: "#f39c12", spike: "#d68910", name: "橙" },    // 橙色
	{ button: "#9b59b6", spike: "#8e44ad", name: "紫" },    // 紫色
	{ button: "#1abc9c", spike: "#16a085", name: "青" },    // 青色
] as const
