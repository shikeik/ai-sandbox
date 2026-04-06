// ========== 元素类型定义 ==========

/** 元素类型枚举 */
export const enum Element {
	AIR = 0,
	HERO = 1,
	PLATFORM = 2,
	ENEMY = 3,
	GOAL = 4,
	SPIKE = 5,      // 尖刺（机关）
	BUTTON = 6,     // 按钮（触发机关）
}

/** 元素类型（值类型） */
export type ElementType = Element

/** 元素显示名称 */
export const ELEMENT_NAMES: Record<Element, string> = {
	[Element.AIR]: "空气",
	[Element.HERO]: "玩家",
	[Element.PLATFORM]: "平台",
	[Element.ENEMY]: "敌人",
	[Element.GOAL]: "终点",
	[Element.SPIKE]: "尖刺",
	[Element.BUTTON]: "按钮",
}
