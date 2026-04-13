// ========== CLI 地图加载 ==========
// 统一使用 core/maps 的数据

import type { MapData } from "../core"
import { BUILTIN_MAPS, getMapById, listMaps } from "../core"

// 重新导出，保持兼容性
export { BUILTIN_MAPS, getMapById, listMaps }

// 别名兼容性
export const MAPS = BUILTIN_MAPS

// 默认地图（第一个）
export const MAP_DEFAULT = BUILTIN_MAPS[0]!
