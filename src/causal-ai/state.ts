// ========== 因果链 AI - 状态管理 ==========

import type { GameState, Experience, Rule } from "./types"
import { INITIAL_AGENT_POS } from "./config"

// 创建初始状态
export function createInitialState(): GameState {
	return {
		agent: { ...INITIAL_AGENT_POS },
		holding: null,
		keyExists: true,
		doorOpen: false
	}
}

// 深拷贝状态
export function cloneState(state: GameState): GameState {
	return {
		agent: { ...state.agent },
		holding: state.holding,
		keyExists: state.keyExists,
		doorOpen: state.doorOpen
	}
}

// 状态管理器类
export class StateManager {
	private state: GameState
	private experiences: Experience[] = []
	private rules: Rule[] = []
	private listeners: Array<() => void> = []

	constructor() {
		this.state = createInitialState()
	}

	// 获取当前状态
	getState(): GameState {
		return cloneState(this.state)
	}

	// 设置状态（完全替换）
	setState(newState: GameState): void {
		this.state = cloneState(newState)
		this.notify()
	}

	// 更新状态（部分更新）
	updateState(partial: Partial<GameState>): void {
		this.state = { ...this.state, ...partial }
		if (partial.agent) {
			this.state.agent = { ...partial.agent }
		}
		this.notify()
	}

	// 重置为初始状态
	reset(): void {
		this.state = createInitialState()
		this.notify()
	}

	// 添加经验
	addExperience(exp: Experience): void {
		this.experiences.push(exp)
	}

	// 获取所有经验
	getExperiences(): Experience[] {
		return [...this.experiences]
	}

	// 清空经验
	clearExperiences(): void {
		this.experiences = []
	}

	// 获取经验数量
	getExperienceCount(): number {
		return this.experiences.length
	}

	// 设置规则
	setRules(rules: Rule[]): void {
		this.rules = rules
	}

	// 获取所有规则
	getRules(): Rule[] {
		return [...this.rules]
	}

	// 获取规则数量
	getRuleCount(): number {
		return this.rules.length
	}

	// 订阅状态变化
	subscribe(listener: () => void): () => void {
		this.listeners.push(listener)
		return () => {
			const idx = this.listeners.indexOf(listener)
			if (idx > -1) {
				this.listeners.splice(idx, 1)
			}
		}
	}

	// 通知所有监听器
	private notify(): void {
		this.listeners.forEach(fn => fn())
	}
}
