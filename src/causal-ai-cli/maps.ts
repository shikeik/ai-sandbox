// ========== 地图配置 ==========

export interface Position {
	x: number
	y: number
}

export interface MapConfig {
	id: string
	name: string
	width: number
	height: number
	agent: Position
	goal: Position
	key: Position
	door: Position
	walls: Position[]
}

// 简单地图：必须拿钥匙开门才能过
// 路径：起点→下拿钥匙→右→上开门→右到终点
export const MAP_SIMPLE: MapConfig = {
	id: "simple",
	name: "简单",
	width: 6,
	height: 4,
	agent: { x: 0, y: 0 },
	goal: { x: 5, y: 0 },
	key: { x: 1, y: 2 },
	door: { x: 3, y: 0 },  // 门在第一行
	walls: [
		// 第一行：起点右边和门左边封死
		{ x: 1, y: 0 }, { x: 2, y: 0 },
		// 下方通道墙
		{ x: 2, y: 1 }, { x: 4, y: 1 },
		{ x: 2, y: 2 }, { x: 4, y: 2 },
		// 终点下方封死
		{ x: 5, y: 1 }, { x: 5, y: 2 }
	]
}

// 中等地图：需要绕路，必须开门
export const MAP_MEDIUM: MapConfig = {
	id: "medium",
	name: "中等",
	width: 8,
	height: 6,
	agent: { x: 0, y: 0 },
	goal: { x: 7, y: 0 },
	key: { x: 6, y: 4 },
	door: { x: 4, y: 0 },
	walls: [
		// 门两侧封死
		{ x: 3, y: 0 }, { x: 5, y: 0 },
		// 其他障碍
		{ x: 2, y: 1 }, { x: 2, y: 2 },
		{ x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 },
		{ x: 6, y: 1 }, { x: 6, y: 2 }
	]
}

// 困难地图：复杂地形
export const MAP_HARD: MapConfig = {
	id: "hard",
	name: "困难",
	width: 10,
	height: 8,
	agent: { x: 0, y: 7 },
	goal: { x: 9, y: 0 },
	key: { x: 8, y: 6 },
	door: { x: 5, y: 3 },
	walls: [
		// 左墙
		{ x: 3, y: 4 }, { x: 3, y: 5 }, { x: 3, y: 6 }, { x: 3, y: 7 },
		// 中墙
		{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 },
		{ x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 },
		// 右墙
		{ x: 7, y: 0 }, { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 },
		{ x: 7, y: 5 }, { x: 7, y: 7 }
	]
}

// 所有地图列表
export const MAPS: MapConfig[] = [
	MAP_SIMPLE,
	MAP_MEDIUM,
	MAP_HARD
]

// 根据ID获取地图
export function getMapById(id: string): MapConfig | null {
	return MAPS.find(m => m.id === id) || null
}

// 显示地图列表
export function listMaps(): string {
	return MAPS.map((m, i) => `${i + 1}. ${m.name} (${m.width}×${m.height})`).join("\n")
}
