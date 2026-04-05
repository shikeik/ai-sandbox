#!/usr/bin/env node
// ========== Kimi API Bridge CLI ==========
// 美观打印的 curl 包装器

const API_URL = process.env.KIMI_API_URL || 'http://localhost:4000/api/kimi'

// 颜色代码
const C = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	bold: '\x1b[1m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	white: '\x1b[37m'
}

function color(c, text) {
	return `${C[c]}${text}${C.reset}`
}

// 打印分隔线
function hr(char = '─', length = 50) {
	return color('dim', char.repeat(length))
}

// 打印标题
function header(text) {
	console.log()
	console.log(hr('═', 40))
	console.log(color('bold', `  ${text}`))
	console.log(hr('═', 40))
}

// 格式化地图为紧凑视图
function formatViewport(viewport) {
	if (!viewport || !viewport.grid) return color('red', '  [无地图数据]')
	
	const emojis = { 0: '⬛', 1: '🦊', 2: '🟩', 3: '🦠', 4: '👿', 5: '🪙' }
	const lines = []
	
	for (const row of viewport.grid) {
		lines.push('  ' + row.map(c => emojis[c] || '?').join(''))
	}
	return lines.join('\n')
}

// 获取地图图例
function getMapLegend() {
	return `
${color('dim', '图例:')} ⬛空气 🦊狐狸 🟩平地 🦠史莱姆 👿恶魔 🪙金币`
}

// 格式化 JSON
function formatJson(obj) {
	return JSON.stringify(obj, null, 2)
		.split('\n')
		.map(line => '  ' + line)
		.join('\n')
}

// 发送请求
async function sendAction(action) {
	const startTime = Date.now()

	try {
		console.log(color('dim', `\n📤 POST ${API_URL}`))
		console.log(color('dim', `   Body: {"action":"${action}"}`))

		const response = await fetch(API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action })
		})

		const latency = Date.now() - startTime

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`HTTP ${response.status}: ${errorText}`)
		}

		const data = await response.json()

		// 打印响应
		header(`响应 #${data.requestId || '?'} | ${latency}ms`)

		if (data.success) {
			console.log(color('green', '✅ 成功'))
		} else {
			console.log(color('red', '❌ 失败'))
			if (data.error) {
				console.log(color('red', `   错误: ${data.error}`))
			}
		}

		// 地图
		if (data.viewport) {
			console.log()
			console.log(color('cyan', '🗺️  视野 (5×3):'))
			console.log(formatViewport(data.viewport))
			console.log(getMapLegend())

			if (data.viewport.heroPos !== undefined) {
				const { heroPos, heroWorldCol, steps, status } = data.viewport
				console.log()
				console.log(color('yellow', `🦊 狐狸: 视野内[${heroPos.col},${heroPos.row}] | 世界[${heroWorldCol}] | 步数:${steps}`))
				if (status) console.log(color('magenta', `📊 状态: ${status}`))
			}
		}

		// 其他字段
		const otherFields = { ...data }
		delete otherFields.success
		delete otherFields.viewport
		delete otherFields.requestId
		delete otherFields.timestamp

		if (Object.keys(otherFields).length > 0) {
			console.log()
			console.log(color('blue', '📋 其他数据:'))
			console.log(formatJson(otherFields))
		}

		console.log()
		console.log(hr('-', 40))

		return data

	} catch (err) {
		console.error(color('red', `\n❌ 错误: ${err.message}`))
		process.exit(1)
	}
}

// 演示模式
async function demoMode() {
	console.log(color('bold', '\n🎮 Kimi API Bridge CLI - 演示模式'))
	console.log(color('dim', `服务器: ${API_URL}`))
	console.log(color('dim', '按 Ctrl+C 随时退出\n'))

	const actions = ['走', '跳', '走', '远跳', '走']

	for (let i = 0; i < actions.length; i++) {
		console.log(color('yellow', `\n▶ 动作 ${i + 1}/${actions.length}: ${actions[i]}`))
		await sendAction(actions[i])
		await new Promise(r => setTimeout(r, 500))
	}

	console.log(color('green', '\n✨ 演示完成！'))
	console.log(color('dim', '提示: 使用参数指定动作，如: node kimi-cli.mjs 跳'))
}

// 主函数
const action = process.argv[2]

if (action && action !== '--help' && action !== '-h') {
	// 单次执行模式
	sendAction(action)
} else {
	// 演示模式
	demoMode()
}
