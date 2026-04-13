// ========== 因果链 AI Web 版 - UI 管理器 ==========

import type { AgentState, Experience, Rule } from "./types"

export class UIManager {
	private logContainer: HTMLElement
	private expListContainer: HTMLElement
	private ruleListContainer: HTMLElement
	private planLogContainer: HTMLElement
	private expCountEl: HTMLElement
	private ruleCountEl: HTMLElement
	private posDisplay: HTMLElement
	private holdDisplay: HTMLElement
	private facingDisplay: HTMLElement
	private mapDisplay: HTMLElement

	constructor() {
		this.logContainer = document.getElementById("logContainer")!
		this.expListContainer = document.getElementById("expListContainer")!
		this.ruleListContainer = document.getElementById("ruleListContainer")!
		this.planLogContainer = document.getElementById("planLogContainer")!
		this.expCountEl = document.getElementById("expCount")!
		this.ruleCountEl = document.getElementById("ruleCount")!
		this.posDisplay = document.getElementById("posDisplay")!
		this.holdDisplay = document.getElementById("holdDisplay")!
		this.facingDisplay = document.getElementById("facingDisplay")!
		this.mapDisplay = document.getElementById("mapDisplay")!
	}

	// 绑定动作按钮
	bindActionButton(action: string, handler: () => void): void {
		const buttons = document.querySelectorAll(`[data-action="${action}"]`)
		buttons.forEach(btn => {
			btn.addEventListener("click", handler)
		})
	}

	// 绑定普通按钮
	bindButton(id: string, handler: () => void): void {
		const btn = document.getElementById(id)
		if (btn) {
			btn.addEventListener("click", handler)
		}
	}

	// 添加日志
	addLog(msg: string): void {
		const entry = document.createElement("div")
		entry.className = "entry"
		entry.textContent = msg
		this.logContainer.appendChild(entry)
		this.logContainer.scrollTop = this.logContainer.scrollHeight
	}

	// 清空日志
	clearLog(): void {
		this.logContainer.innerHTML = ""
	}

	// 添加规划日志
	addPlanLog(msg: string): void {
		this.planLogContainer.textContent += msg + "\n"
		this.planLogContainer.scrollTop = this.planLogContainer.scrollHeight
	}

	// 清空规划日志
	clearPlanLog(): void {
		this.planLogContainer.textContent = ""
	}

	// 更新状态显示
	updateStateDisplay(agent: AgentState): void {
		this.posDisplay.textContent = `(${agent.pos.x},${agent.pos.y})`
		this.facingDisplay.textContent = agent.facing
		
		const hasKey = agent.inventory.includes("钥匙")
		this.holdDisplay.textContent = hasKey ? "🔑 钥匙" : "空手"
	}

	// 更新地图名称显示
	updateMapName(name: string): void {
		this.mapDisplay.textContent = name
	}

	// 更新计数
	updateCounts(expCount: number, ruleCount: number): void {
		this.expCountEl.textContent = String(expCount)
		this.ruleCountEl.textContent = String(ruleCount)
	}

	// 渲染经验列表
	renderExpList(experiences: Experience[]): void {
		if (experiences.length === 0) {
			this.expListContainer.innerHTML = "<div class=\"entry\">暂无经验数据</div>"
			return
		}

		this.expListContainer.innerHTML = experiences.slice(-20).map((exp, i) => {
			const beforeStr = Array.from(exp.before).slice(0, 5).join(", ") + "..."
			const afterStr = Array.from(exp.after).slice(0, 5).join(", ") + "..."
			return `
				<div class="entry">
					<div><strong>#${i + 1}</strong> 动作: ${exp.action}</div>
					<div>前: ${beforeStr}</div>
					<div>后: ${afterStr}</div>
				</div>
			`
		}).join("")
	}

	// 渲染规则列表
	renderRuleList(rules: Rule[]): void {
		if (rules.length === 0) {
			this.ruleListContainer.innerHTML = "<div class=\"entry\">暂无规则，请先探索积累经验</div>"
			return
		}

		this.ruleListContainer.innerHTML = rules.map((rule, i) => {
			const preStr = Array.from(rule.preconditions).slice(0, 3).join(", ") + "..."
			const addStr = Array.from(rule.effects.add).slice(0, 3).join(", ") || "无"
			const removeStr = Array.from(rule.effects.remove).slice(0, 3).join(", ") || "无"
			return `
				<div class="entry">
					<div><strong>#${i + 1}</strong> ${rule.action}</div>
					<div>前提: ${preStr}</div>
					<div>效果+: ${addStr}</div>
					<div>效果-: ${removeStr}</div>
				</div>
			`
		}).join("")
	}

	// 清空指令输入框
	clearCmdInput(): void {
		const input = document.getElementById("cmdInput") as HTMLInputElement | null
		if (input) input.value = ""
	}

	// 设置视野切换按钮文本
	setViewButtonText(mode: "local" | "global"): void {
		const btn = document.getElementById("viewToggleBtn")
		if (btn) {
			btn.textContent = mode === "local" ? "👁️ 视野: 局部" : "👁️ 视野: 全局"
		}
	}

	// 显示地图选择器
	showMapSelector(maps: { id: string; name: string }[], onSelect: (id: string) => void): void {
		// 创建弹窗
		const modal = document.createElement("div")
		modal.className = "map-selector-modal"
		modal.innerHTML = `
			<div class="map-selector-content">
				<h3>选择地图</h3>
				<div class="map-list">
					${maps.map(m => `
						<button class="map-btn" data-map="${m.id}">${m.name}</button>
					`).join("")}
				</div>
			</div>
		`
		document.body.appendChild(modal)

		// 绑定选择事件
		modal.querySelectorAll(".map-btn").forEach(btn => {
			btn.addEventListener("click", () => {
				const mapId = btn.getAttribute("data-map")!
				onSelect(mapId)
				document.body.removeChild(modal)
			})
		})

		// 点击外部关闭
		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				document.body.removeChild(modal)
			}
		})
	}
}
