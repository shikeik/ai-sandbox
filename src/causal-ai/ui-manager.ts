// ========== 因果链 AI - UI 管理器 ==========

import type { Experience, Rule, GameState } from "./types"

// UI 元素引用
interface UIElements {
	posDisplay: HTMLElement
	holdDisplay: HTMLElement
	doorDisplay: HTMLElement
	expCount: HTMLElement
	ruleCount: HTMLElement
	logContainer: HTMLElement
	expListContainer: HTMLElement
	ruleListContainer: HTMLElement
	planLogContainer: HTMLElement
}

// UI 管理器类
export class UIManager {
	private elements: UIElements

	constructor() {
		this.elements = {
			posDisplay: getElement("posDisplay"),
			holdDisplay: getElement("holdDisplay"),
			doorDisplay: getElement("doorDisplay"),
			expCount: getElement("expCount"),
			ruleCount: getElement("ruleCount"),
			logContainer: getElement("logContainer"),
			expListContainer: getElement("expListContainer"),
			ruleListContainer: getElement("ruleListContainer"),
			planLogContainer: getElement("planLogContainer")
		}
	}

	// 更新状态显示
	updateStateDisplay(state: GameState): void {
		this.elements.posDisplay.textContent = `(${state.agent.x},${state.agent.y})`
		this.elements.holdDisplay.textContent = state.holding ? "🔑 钥匙" : "🫙 空手"
		this.elements.doorDisplay.textContent = state.doorOpen ? "打开" : "关闭"
	}

	// 更新计数
	updateCounts(expCount: number, ruleCount: number): void {
		this.elements.expCount.textContent = String(expCount)
		this.elements.ruleCount.textContent = String(ruleCount)
	}

	// 添加操作日志
	addLog(message: string): void {
		const div = document.createElement("div")
		div.innerHTML = message
		this.elements.logContainer.appendChild(div)
		this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight

		// 限制日志数量
		while (this.elements.logContainer.children.length > 20) {
			this.elements.logContainer.removeChild(this.elements.logContainer.children[0])
		}
	}

	// 添加规划日志
	addPlanLog(message: string): void {
		this.elements.planLogContainer.innerHTML += message + "<br>"
		this.elements.planLogContainer.scrollTop = this.elements.planLogContainer.scrollHeight
	}

	// 清空规划日志
	clearPlanLog(): void {
		this.elements.planLogContainer.innerHTML = ""
	}

	// 设置规划日志
	setPlanLog(html: string): void {
		this.elements.planLogContainer.innerHTML = html
	}

	// 渲染经验列表
	renderExpList(experiences: Experience[]): void {
		this.elements.expListContainer.innerHTML = ""

		if (experiences.length === 0) {
			this.elements.expListContainer.innerHTML = "<div>暂无经验</div>"
			return
		}

		// 倒序显示
		const reversed = [...experiences].reverse()

		reversed.forEach((exp) => {
			const div = document.createElement("div")
			div.className = "entry"
			div.innerHTML = `
				<div><strong>${exp.action}</strong></div>
				<div>before: (${exp.before.agent.x},${exp.before.agent.y}) 手持:${exp.before.holding ?? "无"} 钥匙存在:${exp.before.keyExists} 门开:${exp.before.doorOpen}</div>
				<div>after: (${exp.after.agent.x},${exp.after.agent.y}) 手持:${exp.after.holding ?? "无"} 钥匙存在:${exp.after.keyExists} 门开:${exp.after.doorOpen}</div>
			`
			this.elements.expListContainer.appendChild(div)
		})
	}

	// 渲染规则列表
	renderRuleList(rules: Rule[]): void {
		this.elements.ruleListContainer.innerHTML = ""

		if (rules.length === 0) {
			this.elements.ruleListContainer.innerHTML = "<div>暂无规则，请先探索并点击「泛化」</div>"
			return
		}

		rules.forEach((rule, idx) => {
			const div = document.createElement("div")
			div.className = "entry"
			div.textContent = `${idx + 1}. ${rule.description}`
			this.elements.ruleListContainer.appendChild(div)
		})
	}

	// 绑定按钮事件
	bindActionButton(action: string, handler: () => void): void {
		const btn = document.querySelector(`[data-action="${action}"]`)
		if (btn) {
			btn.addEventListener("click", handler)
		}
	}

	bindButton(id: string, handler: () => void): void {
		const btn = document.getElementById(id)
		if (btn) {
			btn.addEventListener("click", handler)
		}
	}
}

// 辅助函数：获取元素
function getElement(id: string): HTMLElement {
	const el = document.getElementById(id)
	if (!el) {
		throw new Error(`未找到元素: ${id}`)
	}
	return el
}
