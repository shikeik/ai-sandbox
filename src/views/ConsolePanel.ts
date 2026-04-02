/**
 * 控制台面板
 * 拦截 console 输出并按标签分类显示，支持筛选、自动滚动、下载
 */

type LogLevel = "log" | "warn" | "error" | "info"

export class ConsolePanel {
	private isOpen: boolean = false
	private logsContainer: HTMLElement | null = null
	private originalLog: typeof console.log
	private originalWarn: typeof console.warn
	private originalError: typeof console.error
	private originalInfo: typeof console.info
	private tagRegistry: Set<string> = new Set()
	private tagVisible: Map<string, boolean> = new Map()
	private autoScroll: boolean = true

	constructor() {
		this.originalLog = console.log
		this.originalWarn = console.warn
		this.originalError = console.error
		this.originalInfo = console.info
	}

	init(): void {
		this.logsContainer = document.getElementById("console-logs")
		if (!this.logsContainer) {
			console.warn("[CONSOLE]", "未找到 console-logs 容器，控制台面板未初始化")
			return
		}

		this._bindLogIntercept()
		this._bindGlobalErrors()
		this._bindToolbarButtons()
		console.log("[CONSOLE]", "控制台面板已初始化")
	}

	toggle(): void {
		this.isOpen = !this.isOpen
		const panel = document.getElementById("console-panel")
		const btn = document.getElementById("btn-console")
		if (panel) panel.classList.toggle("open", this.isOpen)
		if (btn) btn.classList.toggle("active", this.isOpen)
		console.log("[CONSOLE]", `面板状态: ${this.isOpen ? "打开" : "关闭"}`)
	}

	private _formatArg(a: unknown): string {
		if (a instanceof Error) {
			return a.stack || a.message || String(a)
		}
		if (typeof a === "object") {
			try { return JSON.stringify(a) } catch { return String(a) }
		}
		return String(a)
	}

	private _extractTag(args: unknown[]): { tag: string, rest: unknown[] } {
		if (args.length > 0 && typeof args[0] === "string") {
			const match = args[0].match(/^\[([^\]]+)\]$/)
			if (match) {
				return { tag: match[1], rest: args.slice(1) }
			}
		}
		return { tag: "app", rest: args }
	}

	private _registerTag(tag: string): void {
		if (!this.tagRegistry.has(tag)) {
			this.tagRegistry.add(tag)
			this.tagVisible.set(tag, true)
			this._renderFilterMenu()
		}
	}

	private _applyTagFilters(): void {
		if (!this.logsContainer) return
		const lines = this.logsContainer.querySelectorAll(".console-line")
		lines.forEach(line => {
			const tag = (line as HTMLElement).dataset.tag || "app"
			;(line as HTMLElement).style.display = this.tagVisible.get(tag) ? "" : "none"
		})
	}

	private _renderFilterMenu(): void {
		const list = document.getElementById("console-filter-list")
		if (!list) return
		list.innerHTML = ""
		const tags = Array.from(this.tagRegistry).sort((a, b) => a.localeCompare(b))
		tags.forEach(tag => {
			const row = document.createElement("label")
			row.className = "console-filter-item"
			const checked = this.tagVisible.get(tag) ? "checked" : ""
			row.innerHTML = `
				<input type="checkbox" ${checked}>
				<span class="console-filter-tag">${tag}</span>
			`
			const input = row.querySelector("input")
			if (input) {
				input.addEventListener("change", (e) => {
					this.tagVisible.set(tag, (e.target as HTMLInputElement).checked)
					this._applyTagFilters()
				})
			}
			list.appendChild(row)
		})
	}

	private _appendLine(level: LogLevel, args: unknown[]): void {
		if (!this.logsContainer) return
		
		const { tag, rest } = this._extractTag(args)
		this._registerTag(tag)

		const time = new Date().toLocaleTimeString("zh-CN", { hour12: false })
		const entry = document.createElement("div")
		entry.className = `console-line ${level}`
		entry.dataset.tag = tag
		entry.style.display = this.tagVisible.get(tag) ? "" : "none"

		const textParts = rest.map(a => this._formatArg(a))
		const header = document.createElement("div")
		header.textContent = `[${time}] [${tag}] ${textParts.join(" ")}`
		entry.appendChild(header)

		rest.forEach(a => {
			if (a instanceof Error && a.stack) {
				const stackDiv = document.createElement("div")
				stackDiv.className = "console-stack"
				const stackLines = a.stack.split("\n").slice(1)
				stackDiv.textContent = stackLines.join("\n")
				entry.appendChild(stackDiv)
			}
		})

		this.logsContainer.appendChild(entry)
		if (this.autoScroll) {
			this.logsContainer.scrollTop = this.logsContainer.scrollHeight
		}
	}

	private _makeTaggedLogger(orig: Function, level: LogLevel): (...args: unknown[]) => void {
		const self = this
		return function (...args: unknown[]) {
			orig.apply(console, args)
			self._appendLine(level, args)
		}
	}

	private _bindLogIntercept(): void {
		console.log = this._makeTaggedLogger(this.originalLog, "log")
		console.warn = this._makeTaggedLogger(this.originalWarn, "warn")
		console.error = this._makeTaggedLogger(this.originalError, "error")
		console.info = this._makeTaggedLogger(this.originalInfo, "info")

		;(window as unknown as Record<string, unknown>).gameLog = {
			log: (tag: string, ...args: unknown[]) => console.log(`[${tag}]`, ...args),
			warn: (tag: string, ...args: unknown[]) => console.warn(`[${tag}]`, ...args),
			error: (tag: string, ...args: unknown[]) => console.error(`[${tag}]`, ...args),
			info: (tag: string, ...args: unknown[]) => console.info(`[${tag}]`, ...args)
		}
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

	private _bindToolbarButtons(): void {
		const btnClear = document.getElementById("btn-clear-console")
		const btnDownload = document.getElementById("btn-download-console")
		const btnFilter = document.getElementById("btn-filter-console")
		const btnAutoscroll = document.getElementById("btn-autoscroll")
		const filterMenu = document.getElementById("console-filter-menu")

		if (btnClear) {
			btnClear.addEventListener("click", () => {
				if (this.logsContainer) this.logsContainer.innerHTML = ""
				this.tagRegistry.clear()
				this.tagVisible.clear()
				this._renderFilterMenu()
				console.log("[CONSOLE]", "日志已清空")
			})
		}

		if (btnDownload) {
			btnDownload.addEventListener("click", () => {
				if (!this.logsContainer) return
				const lines = Array.from(this.logsContainer.children).map(el => el.textContent || "")
				const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
				const url = URL.createObjectURL(blob)
				const a = document.createElement("a")
				a.href = url
				a.download = `console-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
				URL.revokeObjectURL(url)
				console.log("[CONSOLE]", "日志已下载")
			})
		}

		if (btnAutoscroll) {
			btnAutoscroll.addEventListener("click", () => {
				this.autoScroll = !this.autoScroll
				btnAutoscroll.classList.toggle("active", this.autoScroll)
				console.log("[CONSOLE]", `自动滚动: ${this.autoScroll ? "开启" : "关闭"}`)
			})
		}

		if (btnFilter && filterMenu) {
			btnFilter.addEventListener("click", (e) => {
				e.stopPropagation()
				const isOpen = filterMenu.classList.toggle("open")
				btnFilter.classList.toggle("active", isOpen)
			})

			document.addEventListener("click", (e) => {
				if (!filterMenu.contains(e.target as Node) && e.target !== btnFilter) {
					filterMenu.classList.remove("open")
					btnFilter.classList.remove("active")
				}
			})

			const btnAll = document.getElementById("btn-filter-all")
			const btnNone = document.getElementById("btn-filter-none")

			if (btnAll) {
				btnAll.addEventListener("click", () => {
					this.tagRegistry.forEach(tag => this.tagVisible.set(tag, true))
					this._renderFilterMenu()
					this._applyTagFilters()
					console.log("[CONSOLE]", "筛选: 全部显示")
				})
			}
			if (btnNone) {
				btnNone.addEventListener("click", () => {
					this.tagRegistry.forEach(tag => this.tagVisible.set(tag, false))
					this._renderFilterMenu()
					this._applyTagFilters()
					console.log("[CONSOLE]", "筛选: 全部隐藏")
				})
			}
		}
	}
}

export default ConsolePanel
