// ========== 统一地图数据源 ==========
// Web 和 CLI 都使用这份数据

import type { MapData } from "./world/types"

// 内置地图（作为 fallback，与 json 保持一致）
export const BUILTIN_MAPS: MapData[] = [
	{
		id: "level1",
		name: "测试地图",
		width: 7,
		height: 5,
		tiles: [
			"＃＃＃＃＃＃＃",
			"＃．．．．．＃",
			"＃．．＃．．＃",
			"＃．．＃．．＃",
			"＃＃＃＃＃＃＃"
		],
		objects: [
			{ id: "p1", type: "agent", pos: { x: 1, y: 1 } },
			{ id: "k1", type: "钥匙", pos: { x: 2, y: 3 } },
			{ id: "d1", type: "门", pos: { x: 3, y: 1 }, state: { open: false } },
			{ id: "g1", type: "终点", pos: { x: 5, y: 1 } }
		]
	},
	{
		id: "empty",
		name: "空地测试",
		width: 11,
		height: 7,
		tiles: [
			"＃＃＃＃＃＃＃＃＃＃＃",
			"＃．．．．．．．．．＃",
			"＃．．．．．．．．．＃",
			"＃．．．．．．．．．＃",
			"＃．．．．．．．．．＃",
			"＃．．．．．．．．．＃",
			"＃＃＃＃＃＃＃＃＃＃＃"
		],
		objects: [
			{ id: "p1", type: "agent", pos: { x: 5, y: 3 } }
		]
	},
	{
		id: "obstacle",
		name: "障碍测试",
		width: 6,
		height: 4,
		tiles: [
			"＃＃＃＃＃＃",
			"＃．＃．．＃",
			"＃．．．．＃",
			"＃＃＃＃＃＃"
		],
		objects: [
			{ id: "p1", type: "agent", pos: { x: 1, y: 1 } },
			{ id: "g1", type: "终点", pos: { x: 4, y: 1 } }
		]
	}
]

// 根据 ID 获取地图
export function getMapById(id: string): MapData | undefined {
	return BUILTIN_MAPS.find(m => m.id === id)
}

// 获取所有地图列表
export function listMaps(): { id: string; name: string }[] {
	return BUILTIN_MAPS.map(m => ({ id: m.id, name: m.name }))
}
