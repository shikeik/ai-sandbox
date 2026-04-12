// ========== 示例自定义地图 ==========
// 使用方式: npx tsx src/causal-ai-cli/main.ts --map test

import type { MapConfig } from "./maps"

// 方式1: default export
const MAP_TEST: MapConfig = {
	id: "test",
	name: "测试地图",
	width: 5,
	height: 5,
	agent: { x: 0, y: 0 },
	goal: { x: 4, y: 0 },
	key: { x: 2, y: 2 },
	door: { x: 2, y: 0 },
	walls: [
		// 门两侧封死
		{ x: 1, y: 0 }, { x: 3, y: 0 },
		// 通道墙
		{ x: 1, y: 1 }, { x: 3, y: 1 },
		{ x: 1, y: 2 }, { x: 3, y: 2 }
	]
}

export default MAP_TEST

// 方式2: named export（也可以）
// export { MAP_TEST }
