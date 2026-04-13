// ========== CLI 地图加载 ==========
// 注入 Node.js fs 实现到 core/maps

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import type { MapData, MapInfo } from "../core"
import { loadMapData as coreLoadMapData, setMapBasePath, setLoadMapImpl } from "../core"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 注入 CLI 加载实现
setLoadMapImpl(async (filePath: string): Promise<MapData | null> => {
	// 尝试多个路径
	const possiblePaths = [
		filePath,
		path.join(process.cwd(), filePath),
		path.join(process.cwd(), "gamedatas/maps", path.basename(filePath)),
		path.join(__dirname, "../../../gamedatas/maps", path.basename(filePath))
	]
	
	for (const p of possiblePaths) {
		try {
			if (fs.existsSync(p)) {
				const content = fs.readFileSync(p, "utf-8")
				return JSON.parse(content) as MapData
			}
		} catch {
			// 继续尝试下一个
		}
	}
	
	console.error(`[MAPS] 找不到文件: ${filePath}`)
	return null
})

// 设置默认路径
setMapBasePath(path.join(__dirname, "../../../gamedatas/maps"))

// 重新导出
export { listMaps, getMapInfo, setMapBasePath, clearMapCache } from "../core"
export type { MapData, MapInfo }

// 导出加载函数（已注入实现）
export { coreLoadMapData as loadMapData }

// 默认地图 ID
export const DEFAULT_MAP_ID = "default"
