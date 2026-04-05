import { resolve } from 'path'

// ========== API Bridge 插件 ==========
const pendingRequests = new Map()
let requestId = 0

// 格式化 JSON，数组内部不换行
function formatJsonCompactArrays(obj) {
	// 深拷贝，避免修改原对象
	const data = JSON.parse(JSON.stringify(obj))
	
	// 手动构建格式化的 JSON
	const lines = []
	lines.push('{')
	
	// success
	lines.push(`  "success": ${data.success},`)
	
	// death
	if (data.death !== undefined) {
		lines.push(`  "death": ${data.death},`)
	}
	if (data.deathReason !== undefined) {
		lines.push(`  "deathReason": ${data.deathReason === null ? 'null' : '"' + data.deathReason + '"'},`)
	}
	if (data.killedSlime !== undefined) {
		lines.push(`  "killedSlime": ${data.killedSlime},`)
	}
	
	// viewport
	if (data.viewport) {
		lines.push('  "viewport": {')
		// grid - 数组保持单行
		if (data.viewport.grid) {
			const gridStr = data.viewport.grid.map(row => `[${row.join(', ')}]`).join(',\n      ')
			lines.push('    "grid": [')
			lines.push('      ' + gridStr)
			lines.push('    ],')
		}
		// heroPos
		if (data.viewport.heroPos) {
			lines.push(`    "heroPos": { "col": ${data.viewport.heroPos.col}, "row": ${data.viewport.heroPos.row} },`)
		}
		// heroWorldCol
		if (data.viewport.heroWorldCol !== undefined) {
			lines.push(`    "heroWorldCol": ${data.viewport.heroWorldCol},`)
		}
		// steps
		if (data.viewport.steps !== undefined) {
			lines.push(`    "steps": ${data.viewport.steps},`)
		}
		// status
		if (data.viewport.status !== undefined) {
			lines.push(`    "status": "${data.viewport.status}"`)
		}
		lines.push('  },')
	}
	
	// timestamp
	if (data.timestamp !== undefined) {
		lines.push(`  "timestamp": ${data.timestamp},`)
	}
	
	// requestId
	lines.push(`  "requestId": ${data.requestId}`)
	lines.push('}')
	
	return lines.join('\n')
}

// 格式化美观响应（用于 curl ?pretty 模式）
function formatPrettyResponse(result, requestId) {
	const emojis = { 0: '⬛', 1: '🦊', 2: '🟩', 3: '🦠', 4: '👿', 5: '🪙' }
	const lines = []
	
	// 状态判断
	let statusIcon = '✅ 成功'
	if (result.death) statusIcon = '💀 死亡'
	else if (!result.success) statusIcon = '❌ 失败'
	
	lines.push('══════════════════════════════════════════')
	lines.push(`  响应 #${requestId} | ${statusIcon}`)
	lines.push('══════════════════════════════════════════')
	
	// 死亡原因
	if (result.death && result.deathReason) {
		lines.push(`死因: ${result.deathReason}`)
	}
	
	// 击杀提示
	if (result.killedSlime) {
		lines.push('🗡️ 击杀了史莱姆！')
	}
	
	if (result.viewport) {
		const { grid, heroPos, heroWorldCol, steps, status } = result.viewport
		
		lines.push('')
		lines.push('🗺️  视野 (5×3):')
		lines.push('天上: ' + grid[0].map(c => emojis[c] || '?').join(''))
		lines.push('地上: ' + grid[1].map(c => emojis[c] || '?').join(''))
		lines.push('地面: ' + grid[2].map(c => emojis[c] || '?').join(''))
		lines.push('')
		lines.push('图例: ⬛空气 🦊狐狸 🟩平地 🦠史莱姆 👿恶魔 🪙金币')
		
		if (heroPos !== undefined) {
			lines.push('')
			lines.push(`🦊 狐狸: 视野内[${heroPos.col},${heroPos.row}] | 世界[${heroWorldCol}] | 步数:${steps}`)
			if (status) lines.push(`📊 状态: ${status}`)
		}
		
		// 添加游戏规则教程
		lines.push('')
		lines.push('📖 规则说明:')
		lines.push('  • 走(+1): 地面[0]是平地, 地上无史莱姆 | 不看天上')
		lines.push('  • 跳(+2): 地面[1]是平地, 天上/地上无恶魔/史莱姆')
		lines.push('  • 远跳(+3): 地面[2]是平地, 路径天上无恶魔')
		lines.push('  • 走A(+1): 地上有史莱姆(击杀), 地面是平地')
	}
	
	lines.push('')
	lines.push('──────────────────────────────────────────')
	lines.push('')  // 结尾空行，避免顶住命令行提示符
	
	return lines.join('\n')
}

const apiBridgePlugin = {
	name: 'api-bridge',
	configureServer(server) {
		// HTTP 中间件 - 接收 CLI/curl 请求
		server.middlewares.use('/api/kimi', async (req, res, next) => {
			if (req.method !== 'POST') {
				res.statusCode = 405
				res.setHeader('Content-Type', 'application/json')
				res.end(JSON.stringify({ error: 'Method not allowed' }))
				return
			}

			const id = ++requestId

			// 读取请求体
			let body = ''
			req.setEncoding('utf8')
			for await (const chunk of req) {
				body += chunk
			}

			// 创建 Promise 等待浏览器响应
			const responsePromise = new Promise((resolve, reject) => {
				pendingRequests.set(id, { resolve, reject })
				// 30秒超时
				setTimeout(() => {
					if (pendingRequests.has(id)) {
						pendingRequests.delete(id)
						reject(new Error('Timeout waiting for browser response'))
					}
				}, 30000)
			})

			try {
				const parsedBody = JSON.parse(body || '{}')

				// 通过 WebSocket 发送给浏览器
				server.ws.send('api-request', {
					id,
					body: parsedBody
				})

				// 等待浏览器响应
				const result = await responsePromise

				// 检查是否请求美观格式 (?pretty 或 ?format=pretty)
				const url = new URL(req.url, `http://${req.headers.host}`)
				const isPretty = url.searchParams.has('pretty') || 
					url.searchParams.get('format') === 'pretty'

				if (isPretty) {
					// 美观纯文本格式
					const text = formatPrettyResponse(result, id)
					res.setHeader('Content-Type', 'text/plain; charset=utf-8')
					res.setHeader('Access-Control-Allow-Origin', '*')
					res.end(text)
				} else {
					// JSON 格式
					res.setHeader('Content-Type', 'application/json')
					res.setHeader('Access-Control-Allow-Origin', '*')
						res.end(formatJsonCompactArrays({ ...result, requestId: id }) + "\n")
				}
			} catch (err) {
				res.statusCode = 500
				res.setHeader('Content-Type', 'application/json')
				res.end(JSON.stringify({ error: err.message, requestId: id }) + "\n")
			}
		})

		// 接收浏览器响应
		server.ws.on('api-response', (data) => {
			const pending = pendingRequests.get(data.id)
			if (pending) {
				pendingRequests.delete(data.id)
				pending.resolve(data.result)
			}
		})
	}
}
// ========== API Bridge 插件结束 ==========

export default {
	server: {
		host: '0.0.0.0',
		port: 4000
	},
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
		rollupOptions: {
			input: {
				index: resolve(__dirname, 'index.html'),
				'fox-jump': resolve(__dirname, 'pages/fox-jump.html'),
				'terrain-lab': resolve(__dirname, 'pages/terrain-lab.html'),
				'mlp-teaching': resolve(__dirname, 'pages/mlp-teaching.html'),
				'metrics-dashboard': resolve(__dirname, 'pages/metrics-dashboard.html'),
				'model-comparison': resolve(__dirname, 'pages/model-comparison.html'),
				'api-bridge': resolve(__dirname, 'pages/api-bridge.html')
			}
		}
	},
	plugins: [apiBridgePlugin],
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
			'@engine': resolve(__dirname, 'src/engine'),
			'@fox-jump': resolve(__dirname, 'src/fox-jump'),
			'@game': resolve(__dirname, 'src/fox-jump/game'),
			'@render': resolve(__dirname, 'src/fox-jump/render'),
			'@ai': resolve(__dirname, 'src/fox-jump/ai'),
			'@views': resolve(__dirname, 'src/fox-jump/views'),
			'@utils': resolve(__dirname, 'src/fox-jump/utils'),
			'@managers': resolve(__dirname, 'src/fox-jump/managers')
		},
		extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
	},
	esbuild: {
		loader: 'ts',
		include: [
			'src/**/*.ts',
			'src/**/*.js'
		]
	},
	optimizeDeps: {
		esbuildOptions: {
			resolveExtensions: ['.ts', '.js']
		}
	}
}
