import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const RULES = JSON.parse(readFileSync(join(__dirname, "rules.json"), "utf-8"))

// 简化的规则（非美观用，纯文字）
const SIMPLE_RULES = {
	ids: { 0: "空气", 1: "狐狸", 2: "平地", 3: "史莱姆", 4: "恶魔", 5: "金币" },
	layers: { 0: "天空层", 1: "中层", 2: "地面层" },
	actionIds: { 0: "走", 1: "跳", 2: "远跳", 3: "走A" },
	actions: {
		走: "地面层+1==2 且 中层+1!=3",
		跳: "地面层+2==2 且 天空层+1/+2!=4 且 中层+2!=3",
		远跳: "地面层+3==2 且 天空层+1/+2/+3!=4 且 中层+3!=3",
		走A: "中层+1==3 且 地面层+1==2"
	},
	hint: "grid[0]=天空层, grid[1]=中层, grid[2]=地面层。action可用数字: 0=走,1=跳,2=远跳,3=走A"
}

export function buildResponse(result, requestId) {
	return { ...result, rules: SIMPLE_RULES, requestId }
}

// 自定义 JSON 序列化：数组单行，不转义数字数组
export function formatJsonCompact(obj) {
	// 手动构建紧凑 JSON
	const lines = []
	lines.push("{")
	lines.push(`  "success": ${obj.success},`)
	if (obj.death !== undefined) lines.push(`  "death": ${obj.death},`)
	if (obj.deathReason !== undefined) lines.push(`  "deathReason": ${obj.deathReason === null ? "null" : "\"" + obj.deathReason + "\""},`)
	if (obj.killedSlime !== undefined) lines.push(`  "killedSlime": ${obj.killedSlime},`)
	
	if (obj.viewport) {
		const v = obj.viewport
		lines.push("  \"viewport\": {")
		lines.push(`    "grid": [[${v.grid[0].join(", ")}], [${v.grid[1].join(", ")}], [${v.grid[2].join(", ")}]],`)
		lines.push(`    "heroPos": {"col": ${v.heroPos.col}, "row": ${v.heroPos.row}},`)
		lines.push(`    "heroWorldCol": ${v.heroWorldCol},`)
		lines.push(`    "steps": ${v.steps},`)
		lines.push(`    "status": "${v.status}"`)
		lines.push("  },")
	}
	
	lines.push(`  "timestamp": ${obj.timestamp},`)
	
	// 简化规则
	lines.push("  \"rules\": {")
	lines.push("    \"ids\": {\"0\":\"空气\",\"1\":\"狐狸\",\"2\":\"平地\",\"3\":\"史莱姆\",\"4\":\"恶魔\",\"5\":\"金币\"},")
	lines.push("    \"actionIds\": {\"0\":\"走\",\"1\":\"跳\",\"2\":\"远跳\",\"3\":\"走A\"},")
	lines.push("    \"actions\": {\"走\":\"地面层+1==2\",\"跳\":\"地面层+2==2\",\"远跳\":\"地面层+3==2\",\"走A\":\"中层+1==3\"},")
	lines.push("    \"hint\": \"grid[0]=天空层,grid[1]=中层,grid[2]=地面层。action:0=走,1=跳,2=远跳,3=走A\"")
	lines.push("  },")
	
	lines.push(`  "requestId": ${obj.requestId}`)
	lines.push("}")
	
	return lines.join("\n")
}

// Emoji 映射（美观输出用）
const EMOJIS = { 0: "⬛", 1: "🦊", 2: "🟩", 3: "🦠", 4: "👿", 5: "🪙" }

// 把规则中的数字ID替换成emoji
function emojifyRule(text) {
	return text
		.replace(/\(2\)/g, "🟩")
		.replace(/\(3\)/g, "🦠")
		.replace(/\(4\)/g, "👿")
}

export function formatPretty(result, requestId) {
	const lines = [], R = RULES
	const status = result.death ? "💀 死亡" : (result.success ? "✅ 成功" : "❌ 失败")
	
	lines.push("══════════════════════════════════════════")
	lines.push(`  响应 #${requestId} | ${status}`)
	lines.push("══════════════════════════════════════════")
	
	if (result.death && result.deathReason) {
		lines.push(`💀 死因: ${result.deathReason}`)
	}
	if (result.killedSlime) {
		lines.push("🗡️ 击杀了史莱姆！")
	}
	
	if (result.viewport) {
		const g = result.viewport.grid
		lines.push("")
		lines.push("🗺️  视野 (5×3):")
		// 数字转 emoji
		lines.push(`天空: ${g[0].map(c => EMOJIS[c] || "?").join("")}`)
		lines.push(`中层: ${g[1].map(c => EMOJIS[c] || "?").join("")}`)
		lines.push(`地面: ${g[2].map(c => EMOJIS[c] || "?").join("")}`)
		lines.push("")
		lines.push("图例: " + Object.entries(R.elements).map(([k,v]) => `${k}=${EMOJIS[k]}${v}`).join(" "))
		
		const h = result.viewport
		lines.push("")
		lines.push(`🦊 狐狸: 世界[${h.heroWorldCol}] | 步数:${h.steps}`)
		if (h.status) lines.push(`📊 状态: ${h.status}`)
	}
	
	lines.push("")
	lines.push("📖 规则:")
	Object.entries(R.actions).forEach(([k,v]) => {
		lines.push(`  ${k}(+${v.move}): ${emojifyRule(v.check)}`)
	})
	lines.push("")
	lines.push(`💡 提示: ${emojifyRule(R.hint)}`)
	lines.push("")
	lines.push("──────────────────────────────────────────")
	lines.push("")
	
	return lines.join("\n")
}

export { RULES }
