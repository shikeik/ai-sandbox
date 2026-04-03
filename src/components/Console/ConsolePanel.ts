import { globalLogger, LogEntry } from "../../utils/GlobalLogger.js"
import "./console.css"

export class ConsolePanel {
	private container: HTMLElement
	private isOpen = false
	private autoScroll = true
	private logsContainer: HTMLElement | null = null
	private tagRegistry = new Set<string>()
	private tagVisible = new Map<string, boolean>()
	private unsubscribe: (() => void) | null = null
	/**
	 * @param mount 挂载点，可以是 HTMLElement 或 CSS 选择器字符串
	 */
	constructor(mount: HTMLElement | string) {
		const el = typeof mount === "string" ? document.querySelector(mount) : mount
		if (!el || !(el instanceof HTMLElement)) {
			throw new Error(`ConsolePanel: 找不到挂载点 ${mount}`)
		}
		this.container = el
	}

	init(): void {
		this._renderInternals()
		this.unsubscribe = globalLogger.subscribe((entry) => this._appendEntry(entry))
		// 回放已有日志
		globalLogger.getLogs().forEach(l => this._appendEntry(l))
	}

	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe()
			this.unsubscribe = null
		}
		this.container.innerHTML = ""
	}

	toggle(): void {
		this.isOpen = !this.isOpen
		this.container.classList.toggle("open", this.isOpen)
	}

	open(): void {
		this.isOpen = true
		this.container.classList.add("open")
	}

	close(): void {
		this.isOpen = false
		this.container.classList.remove("open")
	}

	clear(): void {
		globalLogger.clear()
		if (this.logsContainer) this.logsContainer.innerHTML = ""
		this.tagRegistry.clear()
		this.tagVisible.clear()
		this._renderFilterMenu()
	}

	download(): void {
		globalLogger.download()
	}

	private _renderInternals(): void {
		this.container.innerHTML = `
			<div class="console-toolbar">
				<button class="console-btn active" data-action="autoscroll" title="自动滚动">⬇️</button>
				<button class="console-btn" data-action="filter" title="筛选">🔍</button>
				<button class="console-btn" data-action="clear" title="清空">🗑️</button>
				<button class="console-btn" data-action="download" title="下载日志">💾</button>
				<div class="console-filter-menu">
					<div class="console-filter-header">
						<button class="console-filter-header-btn" data-action="filter-all">全选</button>
						<button class="console-filter-header-btn" data-action="filter-none">全不选</button>
					</div>
					<div class="console-filter-list"></div>
				</div>
			</div>
			<div class="console-content"></div>
		`
		this.logsContainer = this.container.querySelector(".console-content") as HTMLElement
		this._bindToolbar()
	}

	private _bindToolbar(): void {
		const toolbar = this.container.querySelector(".console-toolbar") as HTMLElement
		const filterMenu = this.container.querySelector(".console-filter-menu") as HTMLElement
		if (!toolbar) return

		toolbar.addEventListener("click", (e) => {
			const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null
			if (!btn) return
			const action = btn.dataset.action
			if (action === "autoscroll") {
				this.autoScroll = !this.autoScroll
				btn.classList.toggle("active", this.autoScroll)
			} else if (action === "filter") {
				const isOpen = filterMenu.classList.toggle("open")
				btn.classList.toggle("active", isOpen)
			} else if (action === "clear") {
				this.clear()
			} else if (action === "download") {
				this.download()
			} else if (action === "filter-all") {
				this.tagRegistry.forEach(tag => this.tagVisible.set(tag, true))
				this._renderFilterMenu()
				this._applyTagFilters()
			} else if (action === "filter-none") {
				this.tagRegistry.forEach(tag => this.tagVisible.set(tag, false))
				this._renderFilterMenu()
				this._applyTagFilters()
			}
		})

		document.addEventListener("click", (e) => {
			if (!filterMenu.contains(e.target as Node) && !toolbar.contains(e.target as Node)) {
				filterMenu.classList.remove("open")
				const filterBtn = toolbar.querySelector("[data-action=\"filter\"]") as HTMLElement | null
				if (filterBtn) filterBtn.classList.remove("active")
			}
		})
	}

	private _appendEntry(entry: LogEntry): void {
		if (!this.logsContainer) return
		this._registerTag(entry.tag)

		const line = document.createElement("div")
		line.className = `console-line ${entry.level}`
		line.dataset.tag = entry.tag
		line.style.display = this.tagVisible.get(entry.tag) ? "" : "none"
		line.textContent = `[${entry.time}] [${entry.tag}] ${entry.message}`

		// 如果有 Error 且带 stack，追加 stack
		entry.rawArgs.forEach((arg) => {
			if (arg instanceof Error && arg.stack) {
				const stackDiv = document.createElement("div")
				stackDiv.className = "console-stack"
				stackDiv.textContent = arg.stack.split("\n").slice(1).join("\n")
				line.appendChild(stackDiv)
			}
		})

		this.logsContainer.appendChild(line)
		if (this.autoScroll) {
			this.logsContainer.scrollTop = this.logsContainer.scrollHeight
		}
	}

	private _registerTag(tag: string): void {
		if (!this.tagRegistry.has(tag)) {
			this.tagRegistry.add(tag)
			this.tagVisible.set(tag, true)
			this._renderFilterMenu()
		}
	}

	private _renderFilterMenu(): void {
		const list = this.container.querySelector(".console-filter-list") as HTMLElement | null
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

	private _applyTagFilters(): void {
		if (!this.logsContainer) return
		const lines = this.logsContainer.querySelectorAll(".console-line")
		lines.forEach(line => {
			const tag = (line as HTMLElement).dataset.tag || "app"
			;(line as HTMLElement).style.display = this.tagVisible.get(tag) ? "" : "none"
		})
	}
}

export default ConsolePanel
