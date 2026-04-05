// 调试：8次生成，每次打印完整地图
import { generateTerrainForAction } from "../../../src/terrain-lab/terrain.js"
import { TerrainConfig, ELEMENTS } from "../../../src/terrain-lab/constants.js"

const STAGE5_CONFIG: TerrainConfig = {
	groundOnly: false,
	slime: true,
	demon: true,
	coin: true,
}

// 统一元素ID到显示符号的映射
const ELEM_SYMBOL: Record<number, string> = {
	"-1": "??",   // 未生成
	0: "⬛",       // 空气
	1: "🦊",       // 狐狸（幽灵渲染）
	2: "🟩",       // 平地
	3: "🦠",       // 史莱姆
	4: "👿",       // 恶魔
	5: "🪙",       // 金币
}

// 动作定义
const ACTION_DEFS = [
	{ idx: 0, name: "走", delta: 1 },
	{ idx: 1, name: "跳", delta: 2 },
	{ idx: 2, name: "远跳", delta: 3 },
	{ idx: 3, name: "走A", delta: 1 },
]

// 随机选一个动作（简化版，不检查合法性）
function randomAction() {
	const r = Math.random()
	if (r < 0.3) return ACTION_DEFS[0]  // 走 30%
	if (r < 0.6) return ACTION_DEFS[1]  // 跳 30%
	if (r < 0.8) return ACTION_DEFS[2]  // 远跳 20%
	return ACTION_DEFS[3]  // 走A 20%
}

function getSymbol(elem: number, isHeroCol: boolean): string {
	if (isHeroCol) return ELEM_SYMBOL[1]  // 狐狸
	if (elem === -1) return ELEM_SYMBOL[-1]  // 未生成
	return ELEM_SYMBOL[elem] ?? "❓"
}

function printMap(map: number[][], heroCol: number, step: number, actionName: string, from: number, to: number) {
	console.log(`\n=== 第${step}次生成: ${actionName} (${from}→${to}) ===`)
	
	// 打印列索引（0-31，带空格）
	let header = "列号 "
	for (let i = 0; i < 32; i++) {
		header += `${i.toString().padStart(2)} `
	}
	console.log(header)
	
	// 打印天上层（layer 2）
	let sky = "天上 "
	for (let i = 0; i < 32; i++) {
		sky += `${getSymbol(map[2][i], false)} `
	}
	console.log(sky)
	
	// 打印地上层（layer 1）
	let mid = "地上 "
	for (let i = 0; i < 32; i++) {
		mid += `${getSymbol(map[1][i], i === heroCol)} `
	}
	console.log(mid)
	
	// 打印地面层（layer 0）
	let ground = "地面 "
	for (let i = 0; i < 32; i++) {
		ground += `${getSymbol(map[0][i], false)} `
	}
	console.log(ground)
	
	// 图例
	console.log(`图例: ${ELEM_SYMBOL[-1]}=未生成 ${ELEM_SYMBOL[0]}=空气 ${ELEM_SYMBOL[2]}=平地 ${ELEM_SYMBOL[3]}=史莱姆 ${ELEM_SYMBOL[4]}=恶魔 ${ELEM_SYMBOL[5]}=金币 ${ELEM_SYMBOL[1]}=狐狸`)
}

// 执行生成直到填满32列或到达边界
let map: number[][] = [
	Array(32).fill(-1),
	Array(32).fill(-1),
	Array(32).fill(-1),
]

// 初始状态：狐狸在第0列，只有地面是平地
map[0][0] = 2  // 地面：平地

let currentHeroCol = 0
let step = 0

// 打印初始状态
printMap(map, currentHeroCol, step, "初始", 0, 0)

// 持续生成直到接近边界
while (currentHeroCol < 29 && step < 30) {
	step++
	const actionDef = randomAction()
	const from = currentHeroCol
	const to = currentHeroCol + actionDef.delta
	
	// 边界检查
	if (to > 31) {
		continue
	}
	
	// 单步模式：minimal=true
	const result = generateTerrainForAction(actionDef.idx, currentHeroCol, STAGE5_CONFIG, map, true)
	
	if (result) {
		map = result
		currentHeroCol = to
		printMap(map, currentHeroCol, step, actionDef.name, from, to)
	}
}

// 如果还没到31，用"走"补到终点
while (currentHeroCol < 31) {
	step++
	const from = currentHeroCol
	const to = currentHeroCol + 1
	
	const result = generateTerrainForAction(0, currentHeroCol, STAGE5_CONFIG, map, true)
	if (result) {
		map = result
		currentHeroCol = to
		printMap(map, currentHeroCol, step, "走(补)", from, to)
	}
}

console.log("\n=== 32列地图生成完成 ===")
