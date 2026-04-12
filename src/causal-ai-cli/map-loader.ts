// ========== 地图加载器 ==========
// 支持内置地图 + gamedatas/maps/*.json 自定义地图

import * as fs from "node:fs"
import * as path from "node:path"
import type { MapConfig } from "./maps"
import { MAPS, getMapById } from "./maps"

const GAME_DATA_DIR = "gamedatas/maps"

// 加载地图（内置优先，其次 JSON 文件）
export function loadMap(id: string): MapConfig | null {
	// 先检查内置地图
	const builtIn = getMapById(id)
	if (builtIn) return builtIn

	// 尝试从 JSON 文件加载
	const jsonPath = path.join(GAME_DATA_DIR, `${id}.json`)
	if (fs.existsSync(jsonPath)) {
		try {
			const content = fs.readFileSync(jsonPath, "utf-8")
			const data = JSON.parse(content) as unknown
			if (isValidMapConfig(data)) {
				return data
			}
			console.error(`地图文件格式无效: ${jsonPath}`)
		} catch (err) {
			console.error(`加载地图失败: ${jsonPath}`, err)
		}
	}

	return null
}

// 列出所有可用地图
export function listAllMaps(): { id: string; name: string; source: string }[] {
	const result: { id: string; name: string; source: string }[] = []

	// 内置地图
	for (const m of MAPS) {
		result.push({ id: m.id, name: m.name, source: "内置" })
	}

	// JSON 地图
	if (fs.existsSync(GAME_DATA_DIR)) {
		const files = fs.readdirSync(GAME_DATA_DIR)
		for (const file of files) {
			if (file.endsWith(".json")) {
				const id = file.slice(0, -5)
				// 跳过与内置同名的
				if (!getMapById(id)) {
					try {
						const content = fs.readFileSync(path.join(GAME_DATA_DIR, file), "utf-8")
						const data = JSON.parse(content) as unknown
						if (isValidMapConfig(data)) {
							result.push({ id: data.id, name: data.name, source: "自定义" })
						}
					} catch {
						// 忽略无效文件
					}
				}
			}
		}
	}

	return result
}

// 验证地图配置
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
