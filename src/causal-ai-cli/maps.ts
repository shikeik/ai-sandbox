// ========== 内置地图配置 ==========

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

// 默认地图：新手教学
export const MAP_DEFAULT: MapConfig = {
	id: "default",
	name: "默认",
	width: 6,
	height: 4,
	agent: { x: 0, y: 0 },
	goal: { x: 5, y: 0 },
	key: { x: 1, y: 2 },
	door: { x: 3, y: 0 },
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

// 内置地图列表（只保留 default）
export const MAPS: MapConfig[] = [
	MAP_DEFAULT
]

// 根据ID获取地图
export function getMapById(id: string): MapConfig | null {
	return MAPS.find(m => m.id === id) || null
}

// 显示地图列表
export function listMaps(): string {
	return MAPS.map((m, i) => `${i + 1}. ${m.name} (${m.width}×${m.height})`).join("\n")
}
