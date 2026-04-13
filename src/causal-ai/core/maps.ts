// ========== 统一地图数据源 ==========
// Web: fetch 加载 JSON
// CLI: 需注入 loadMapImpl

import type { MapData } from "./world/types"

// 地图信息（不含数据）
export interface MapInfo {
	id: string
	name: string
	file: string
}

// 地图列表配置
export const MAP_LIST: MapInfo[] = [
	{ id: "default", name: "默认（钥匙-门）", file: "default.json" },
	{ id: "empty", name: "空地测试", file: "empty.json" },
	{ id: "obstacle", name: "障碍测试", file: "obstacle.json" },
	{ id: "level1", name: "测试地图", file: "level1.json" }
]

// 地图数据缓存
const mapCache: Map<string, MapData> = new Map()

// 基础路径
let basePath = ""

// 加载实现（由 Web 或 CLI 注入）
let loadMapImpl: ((path: string) => Promise<MapData | null>) | null = null

// 设置基础路径
export function setMapBasePath(path: string): void {
	basePath = path.replace(/\/$/, "")
}

// 设置加载实现
export function setLoadMapImpl(impl: (path: string) => Promise<MapData | null>): void {
	loadMapImpl = impl
}

// 获取地图列表
export function listMaps(): MapInfo[] {
	return MAP_LIST
}

// 根据 ID 获取地图信息
export function getMapInfo(id: string): MapInfo | undefined {
	return MAP_LIST.find(m => m.id === id)
}

// 加载地图数据
export async function loadMapData(id: string): Promise<MapData | null> {
	// 检查缓存
	const cached = mapCache.get(id)
	if (cached) return cached

	const info = getMapInfo(id)
	if (!info) {
		console.error(`[MAPS] 未知地图: ${id}`)
		return null
	}

	// 使用注入的实现
	if (!loadMapImpl) {
		// 默认使用 fetch（Web 环境）
		return loadMapDataWeb(info)
	}

	// 使用 CLI 注入的实现
	const path = basePath ? `${basePath}/${info.file}` : info.file
	const data = await loadMapImpl(path)
	if (data) {
		mapCache.set(info.id, data)
	}
	return data
}

// Web: fetch 加载
async function loadMapDataWeb(info: MapInfo): Promise<MapData | null> {
	const path = basePath ? `${basePath}/${info.file}` : `gamedatas/maps/${info.file}`
	
	try {
		const response = await fetch(path)
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}
		const data = await response.json() as MapData
		mapCache.set(info.id, data)
		return data
	} catch (err) {
		console.error(`[MAPS] 加载失败: ${path}`, err)
		return null
	}
}

// 清空缓存
export function clearMapCache(): void {
	mapCache.clear()
}
