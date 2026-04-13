// ========== 内置地图配置 ==========
// 使用新格式：tiles + objects

import type { MapData } from "./types"

// 默认地图：新手教学
export const MAP_DEFAULT: MapData = {
	id: "default",
	name: "默认",
	width: 6,
	height: 4,
	tiles: [
		"＃＃＃＃＃＃",
		"＃．．．．＃",
		"＃．．＃．＃",
		"＃＃＃＃＃＃"
	],
	objects: [
		{ id: "p1", type: "agent", pos: { x: 1, y: 1 } },
		{ id: "k1", type: "钥匙", pos: { x: 2, y: 2 } },
		{ id: "d1", type: "门", pos: { x: 3, y: 1 }, state: { open: false } },
		{ id: "g1", type: "终点", pos: { x: 4, y: 1 } }
	]
}

// 内置地图列表
export const MAPS: MapData[] = [
	MAP_DEFAULT
]

// 根据ID获取地图
export function getMapById(id: string): MapData | null {
	return MAPS.find(m => m.id === id) || null
}

// 显示地图列表
export function listMaps(): string {
	return MAPS.map((m, i) => `${i + 1}. ${m.name} (${m.width}×${m.height})`).join("\n")
}
