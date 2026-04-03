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

function extractTag(args: unknown[]): { tag: string; rest: unknown[] } {
	if (args.length > 0 && typeof args[0] === "string") {
		const match = args[0].match(/^\[([^\]]+)\]$/)
		if (match) {
			return { tag: match[1], rest: args.slice(1) }
		}
	}
	return { tag: "app", rest: args }
}

class GlobalLogger {
	private static instance: GlobalLogger | null = null
	static getInstance(): GlobalLogger {
		if (!GlobalLogger.instance) {
			GlobalLogger.instance = new GlobalLogger()
		}
		return GlobalLogger.instance
	}

	private inited = false
	private logs: LogEntry[] = []
	private listeners: LogListener[] = []
	private originalLog = console.log
	private originalWarn = console.warn
	private originalError = console.error
	private originalInfo = console.info

	private constructor() {}

	init(): void {
		if (this.inited) return
		this.inited = true
		this._intercept()
		this._bindGlobalErrors()
	}

	private _intercept(): void {
		console.log = this._makeTaggedLogger(this.originalLog, "log")
		console.warn = this._makeTaggedLogger(this.originalWarn, "warn")
		console.error = this._makeTaggedLogger(this.originalError, "error")
		console.info = this._makeTaggedLogger(this.originalInfo, "info")
	}

	private _makeTaggedLogger(orig: (...args: unknown[]) => void, level: LogLevel): (...args: unknown[]) => void {
		const self = this
		return function (...args: unknown[]) {
			orig.apply(console, args)
			self._push(level, args)
		}
	}

	private _push(level: LogLevel, args: unknown[]): void {
		const { tag, rest } = extractTag(args)
		const time = new Date().toLocaleTimeString("zh-CN", { hour12: false })
		const message = rest.map(a => formatArg(a)).join(" ")
		const entry: LogEntry = { time, level, tag, message, rawArgs: args }
		this.logs.push(entry)
		this.listeners.forEach(fn => {
			try { fn(entry) } catch { /* ignore */ }
		})
	}

	private _bindGlobalErrors(): void {
		window.addEventListener("error", (e) => {
			console.error("[EXCEPTION]", `未捕获的错误: ${e.message}`, "\n源文件:", e.filename, "\n行号:", e.lineno, "\n列号:", e.colno, "\n", e.error || "")
		})
		window.addEventListener("unhandledrejection", (e) => {
			const reason = e.reason
			if (reason instanceof Error) {
				console.error("[UNHANDLED]", `未处理的 Promise 拒绝: ${reason.message}`, reason)
			} else {
				console.error("[UNHANDLED]", "未处理的 Promise 拒绝:", reason)
			}
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
		a.download = `console-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}
}

export const globalLogger = GlobalLogger.getInstance()
