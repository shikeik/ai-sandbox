// ========== 动态地图加载器 ==========

import type { MapConfig } from "./maps"
import { MAPS, getMapById } from "./maps"

// 尝试动态加载用户自定义地图
export async function loadMap(id: string): Promise<MapConfig | null> {
	// 先检查内置地图
	const builtIn = getMapById(id)
	if (builtIn) return builtIn

	// 尝试动态加载自定义地图
	try {
		// 支持两种方式：
		// 1. map_xxx.ts 导出 default
		// 2. map_xxx.ts 导出 named export
		const module = await import(`./map_${id}.ts`)

		// 检查 default export
		if (module.default && isValidMapConfig(module.default)) {
			return module.default as MapConfig
		}

		// 检查 named export（如 MAP_XXX）
		for (const key in module) {
			if (key.startsWith("MAP_") && isValidMapConfig(module[key])) {
				return module[key] as MapConfig
			}
		}
	} catch {
		// 文件不存在或加载失败
	}

	return null
}

// 验证地图配置是否有效
function isValidMapConfig(obj: unknown): obj is MapConfig {
	if (typeof obj !== "object" || obj === null) return false

	const m = obj as Record<string, unknown>
	return (
		typeof m.id === "string" &&
		typeof m.name === "string" &&
		typeof m.width === "number" &&
		typeof m.height === "number" &&
		typeof m.agent === "object" &&
		typeof m.goal === "object" &&
		typeof m.key === "object" &&
		typeof m.door === "object" &&
		Array.isArray(m.walls)
	)
}

// 列出所有可用地图（内置 + 动态发现的）
export async function listAllMaps(): Promise<{ id: string; name: string; source: string }[]> {
	const result = MAPS.map(m => ({ id: m.id, name: m.name, source: "内置" }))

	// 这里可以扫描目录发现自定义地图
	// 暂时只返回内置的
	return result
}
