import { resolve } from "path"
import { buildResponse, formatJsonCompact, formatPretty } from "../scripts/api-bridge/formatter.mjs"
import { brainLabPlugin } from "./brain-lab-plugin.ts"

// ========== API Bridge 插件 ==========
// 职责：HTTP 路由 + WebSocket 桥接（通用配置，无业务逻辑）

const pendingRequests = new Map()
let requestId = 0

// 项目根目录（vite.config.ts 现在在 configs/ 目录下）
const rootDir = resolve(__dirname, "..")

const apiBridgePlugin = {
	name: "api-bridge",
	configureServer(server) {
		// HTTP 中间件 - 接收 CLI/curl 请求
		server.middlewares.use("/api/kimi", async (req, res, _next) => {
			if (req.method !== "POST") {
				res.statusCode = 405
				res.setHeader("Content-Type", "application/json")
				res.end(JSON.stringify({ error: "Method not allowed" }) + "\n")
				return
			}

			const id = ++requestId

			// 读取请求体
			let body = ""
			req.setEncoding("utf8")
			for await (const chunk of req) {
				body += chunk
			}

			// 创建 Promise 等待浏览器响应
			const responsePromise = new Promise((resolve, reject) => {
				pendingRequests.set(id, { resolve, reject })
				setTimeout(() => {
					if (pendingRequests.has(id)) {
						pendingRequests.delete(id)
						reject(new Error("Timeout waiting for browser response"))
					}
				}, 30000)
			})

			try {
				const parsedBody = JSON.parse(body || "{}")

				// 通过 WebSocket 发送给浏览器
				server.ws.send("api-request", { id, body: parsedBody })

				// 等待浏览器响应
				const result = await responsePromise
				const response = buildResponse(result, id)

				// 检查是否请求美观格式
				const url = new URL(req.url, `http://${req.headers.host}`)
				const isPretty = url.searchParams.has("pretty") || 
					url.searchParams.get("format") === "pretty"

				res.setHeader("Access-Control-Allow-Origin", "*")
				
				if (isPretty) {
					res.setHeader("Content-Type", "text/plain; charset=utf-8")
					res.end(formatPretty(response, id))
				} else {
					res.setHeader("Content-Type", "application/json")
					res.end(formatJsonCompact(response) + "\n")
				}
			} catch (err) {
				res.statusCode = 500
				res.setHeader("Content-Type", "application/json")
				res.end(JSON.stringify({ error: err.message, requestId: id }) + "\n")
			}
		})

		// 接收浏览器响应
		server.ws.on("api-response", (data) => {
			const pending = pendingRequests.get(data.id)
			if (pending) {
				pendingRequests.delete(data.id)
				pending.resolve(data.result)
			}
		})
	}
}

export default {
	server: {
		host: "0.0.0.0",
		port: 4000
	},
	build: {
		target: "es2022",
		outDir: "dist",
		assetsDir: "assets",
		rollupOptions: {
			input: {
				index: resolve(rootDir, "index.html"),
				"fox-jump": resolve(rootDir, "pages/fox-jump.html"),
				"terrain-lab": resolve(rootDir, "pages/terrain-lab.html"),
				"mlp-teaching": resolve(rootDir, "pages/mlp-teaching.html"),
				
				"api-bridge": resolve(rootDir, "pages/api-bridge.html"),
				"brain-lab": resolve(rootDir, "pages/brain-lab.html"),
				"mnist-lab": resolve(rootDir, "pages/mnist-lab.html")
			}
		}
	},
	plugins: [apiBridgePlugin, brainLabPlugin],
	resolve: {
		alias: {
			"@": resolve(rootDir, "src"),
			"@engine": resolve(rootDir, "src/engine"),
			"@fox-jump": resolve(rootDir, "src/fox-jump"),
			"@game": resolve(rootDir, "src/fox-jump/game"),
			"@render": resolve(rootDir, "src/fox-jump/render"),
			"@ai": resolve(rootDir, "src/fox-jump/ai"),
			"@views": resolve(rootDir, "src/fox-jump/views"),
			"@utils": resolve(rootDir, "src/fox-jump/utils"),
			"@managers": resolve(rootDir, "src/fox-jump/managers")
		},
		extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"]
	},
	esbuild: {
		loader: "ts",
		include: ["src/**/*.ts", "src/**/*.js"]
	},
	optimizeDeps: {
		rolldownOptions: {
			resolve: {
				extensions: [".ts", ".js"]
			}
		}
	}
}
