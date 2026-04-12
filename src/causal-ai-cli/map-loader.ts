// ========== 地图加载器 ==========
// 支持内置地图 + gamedatas/maps/*.json 自定义地图

import * as fs from "node:fs"
import * as path from "node:path"
import type { MapData } from "./types"
import { MAPS, getMapById } from "./maps"

const GAME_DATA_DIR = "gamedatas/maps"

// 加载地图（内置优先，其次 JSON 文件）
export function loadMap(id: string): MapData | null {
	// 先检查内置地图
	const builtIn = getMapById(id)
	if (builtIn) return builtIn

	// 尝试从 JSON 文件加载
	const jsonPath = path.join(GAME_DATA_DIR, `${id}.json`)
	if (fs.existsSync(jsonPath)) {
		try {
			const content = fs.readFileSync(jsonPath, "utf-8")
			const data = JSON.parse(content) as unknown
			if (isValidMapData(data)) {
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
						if (isValidMapData(data)) {
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

// 验证地图数据格式
function isValidMapData(obj: unknown): obj is MapData {
	if (typeof obj !== "object" || obj === null) return false

	const m = obj as Record<string, unknown>

	// 基础字段检查
	if (typeof m.id !== "string") return false
	if (typeof m.name !== "string") return false
	if (typeof m.width !== "number") return false
	if (typeof m.height !== "number") return false
	if (!Array.isArray(m.tiles)) return false
	if (!Array.isArray(m.objects)) return false

	// tiles 检查（每个元素应该是字符串）
	for (const row of m.tiles) {
		if (typeof row !== "string") return false
	}

	// objects 检查
	for (const obj of m.objects) {
		if (typeof obj !== "object" || obj === null) return false
		const o = obj as Record<string, unknown>
		if (typeof o.id !== "string") return false
		if (typeof o.type !== "string") return false
		if (typeof o.pos !== "object" || o.pos === null) return false
		const pos = o.pos as Record<string, unknown>
		if (typeof pos.x !== "number") return false
		if (typeof pos.y !== "number") return false
	}

	return true
}
