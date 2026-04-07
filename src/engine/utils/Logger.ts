export type LogLevel = "log" | "warn" | "error" | "info"

export interface LogEntry {
	time: string
	level: LogLevel
	tag: string
	message: string
	rawArgs: unknown[]
}

type LogListener = (entry: LogEntry) => void

function formatArg(a: unknown): string {
	if (a instanceof Error) {
		return a.stack || a.message || String(a)
	}
	if (typeof a === "object") {
		try { return JSON.stringify(a) } catch { return String(a) }
	}
	return String(a)
}

/**
 * 提取日志标签
 * 格式要求: "TAG", "message"（TAG 为大写字母、数字、下划线、连字符）
 * 示例: console.log("GAME", "玩家得分:", 100)
 */
function extractTag(args: unknown[]): { tag: string; rest: unknown[] } {
	if (args.length > 1 && typeof args[0] === "string") {
		// 支持 "TAG" 格式（大写字母、数字、下划线、连字符）
		if (/^[A-Z][A-Z0-9_-]*$/.test(args[0])) {
			return { tag: args[0], rest: args.slice(1) }
		}
	}
	return { tag: "app", rest: args }
}

// 所有 Logger 实例的注册表
const instances: Logger[] = []
let consoleIntercepted = false
let originalLog: typeof console.log
let originalWarn: typeof console.warn
let originalError: typeof console.error
let originalInfo: typeof console.info

function broadcastLog(level: LogLevel, args: unknown[]): void {
	const { tag, rest } = extractTag(args)
	const time = new Date().toLocaleTimeString("zh-CN", { hour12: false })
	const message = rest.map(a => formatArg(a)).join(" ")
	const entry: LogEntry = { time, level, tag, message, rawArgs: args }

	// 分发给所有实例
	instances.forEach(logger => {
		if (logger.isActive) {
			logger._receive(entry)
		}
	})
}

function interceptConsole(): void {
	if (consoleIntercepted) return
	consoleIntercepted = true

	originalLog = console.log
	originalWarn = console.warn
	originalError = console.error
	originalInfo = console.info

	console.log = function (...args: unknown[]) {
		originalLog.apply(console, args)
		broadcastLog("log", args)
	}
	console.warn = function (...args: unknown[]) {
		originalWarn.apply(console, args)
		broadcastLog("warn", args)
	}
	console.error = function (...args: unknown[]) {
		originalError.apply(console, args)
		broadcastLog("error", args)
	}
	console.info = function (...args: unknown[]) {
		originalInfo.apply(console, args)
		broadcastLog("info", args)
	}

	// 全局错误监听（只绑定一次）
	window.addEventListener("error", (e) => {
		console.error("EXCEPTION", `未捕获的错误: ${e.message}`, "\n源文件:", e.filename, "\n行号:", e.lineno, "\n列号:", e.colno, "\n", e.error || "")
	})
	window.addEventListener("unhandledrejection", (e) => {
		const reason = e.reason
		if (reason instanceof Error) {
			console.error("UNHANDLED", `未处理的 Promise 拒绝: ${reason.message}`, reason)
		} else {
			console.error("UNHANDLED", "未处理的 Promise 拒绝:", reason)
		}
	})
}

export class Logger {
	private logs: LogEntry[] = []
	private listeners: LogListener[] = []
	private _isActive = true
	readonly name: string

	constructor(name: string) {
		this.name = name
		instances.push(this)
		interceptConsole()
	}

	get isActive(): boolean {
		return this._isActive
	}

	setActive(active: boolean): void {
		this._isActive = active
	}

	// 内部方法：接收广播的日志
	_receive(entry: LogEntry): void {
		this.logs.push(entry)
		this.listeners.forEach(fn => {
			try { fn(entry) } catch { /* ignore */ }
		})
	}

	subscribe(fn: LogListener): () => void {
		this.listeners.push(fn)
		return () => {
			const idx = this.listeners.indexOf(fn)
			if (idx !== -1) this.listeners.splice(idx, 1)
		}
	}

	getLogs(): LogEntry[] {
		return this.logs.slice()
	}

	clear(): void {
		this.logs.length = 0
	}

	download(): void {
		const lines = this.logs.map(l => `[${l.time}] [${l.tag}] [${l.level.toUpperCase()}] ${l.message}`)
		const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `${this.name}-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	// 销毁实例
	destroy(): void {
		const idx = instances.indexOf(this)
		if (idx !== -1) instances.splice(idx, 1)
		this.listeners.length = 0
		this.logs.length = 0
	}

	/** 获取或创建 Logger 实例 */
	static get(name: string): Logger {
		const existing = instances.find(l => l.name === name)
		if (existing) return existing
		return new Logger(name)
	}

	/** 手动记录日志 */
	log(message: string, ...args: unknown[]): void {
		const time = new Date().toLocaleTimeString("zh-CN", { hour12: false })
		const fullMessage = args.length > 0 ? `${message} ${args.map(a => formatArg(a)).join(" ")}` : message
		const entry: LogEntry = {
			time,
			level: "log",
			tag: this.name,
			message: fullMessage,
			rawArgs: [message, ...args]
		}
		this.logs.push(entry)
		this.listeners.forEach(fn => {
			try { fn(entry) } catch { /* ignore */ }
		})
	}
}

// 保留兼容性的单例导出（可选）
export const globalLogger = new Logger("global")
