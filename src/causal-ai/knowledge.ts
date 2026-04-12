// ========== 因果链 AI - 知识系统（经验与规则） ==========

import type { Experience, Rule, GameState, ActionType } from "./types"
import { WORLD_CONFIG } from "./config"
// 注意：如果需要调试可取消注释
// import { getAllActions, applyAction } from "./actions"

// 知识管理器类
export class KnowledgeManager {
	private experiences: Experience[] = []
	private rules: Rule[] = []

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

	// 获取所有规则
	getRules(): Rule[] {
		return [...this.rules]
	}

	// 获取规则数量
	getRuleCount(): number {
		return this.rules.length
	}

	// 清空所有知识
	clearAll(): void {
		this.experiences = []
		this.rules = []
	}

	// 从经验泛化规则
	generalize(): Rule[] {
		this.rules = []

		// 1. 移动规则
		const moveActions: ActionType[] = [
			"move_up",
			"move_down",
			"move_left",
			"move_right"
		]

		// 筛选成功的移动经验
		const moveExps = this.experiences.filter((e) => {
			if (!moveActions.includes(e.action)) return false
			// 位置发生了变化才是成功的移动
			return (
				e.before.agent.x !== e.after.agent.x ||
				e.before.agent.y !== e.after.agent.y
			)
		})

		if (moveExps.length > 0) {
			// 添加普通移动规则
			this.rules.push(this.createMoveRule())

			// 检查是否有开门经验
			const doorOpenExps = this.experiences.filter((e) =>
				moveActions.includes(e.action) &&
				e.before.doorOpen === false &&
				e.after.doorOpen === true
			)

			if (doorOpenExps.length > 0) {
				this.rules.push(this.createOpenDoorRule())
			}

			// 检查是否有通过已开门经验
			const passDoorExps = this.experiences.filter((e) =>
				moveActions.includes(e.action) &&
				e.before.doorOpen === true &&
				e.after.agent.x === WORLD_CONFIG.doorPos.x &&
				e.after.agent.y === WORLD_CONFIG.doorPos.y
			)

			if (passDoorExps.length > 0) {
				this.rules.push(this.createPassOpenDoorRule())
			}
		}

		// 2. 拾取规则
		const pickupExps = this.experiences.filter(
			(e) =>
				e.action === "pickup" &&
				e.before.holding === null &&
				e.after.holding === "key"
		)

		if (pickupExps.length > 0) {
			this.rules.push(this.createPickupRule())
		}

		return this.rules
	}

	// 创建移动规则
	private createMoveRule(): Rule {
		return {
			action: "move",
			description: "向空地移动",
			struct: {
				action: "move",
				pre: (_s: GameState) => {
					// 简化检查：实际使用时由 applyAction 验证
					return true
				},
				eff: (s: GameState) => ({
					// 效果也是简化的
					agent: s.agent
				})
			}
		}
	}

	// 创建开门规则
	private createOpenDoorRule(): Rule {
		return {
			action: "open_door",
			description: "手持钥匙开门并进入",
			struct: {
				action: "move_to_door",
				pre: (s: GameState) => {
					if (s.holding !== "key") return false
					if (s.doorOpen) return false
					// 检查是否在门旁边
					const ax = s.agent.x
					const ay = s.agent.y
					const dx = WORLD_CONFIG.doorPos.x
					const dy = WORLD_CONFIG.doorPos.y
					const adjacent =
						(ax === dx - 1 && ay === dy) ||
						(ax === dx + 1 && ay === dy) ||
						(ax === dx && ay === dy - 1) ||
						(ax === dx && ay === dy + 1)
					return adjacent
				},
				eff: () => ({
					agent: { ...WORLD_CONFIG.doorPos },
					doorOpen: true
				})
			}
		}
	}

	// 创建通过已开门规则
	private createPassOpenDoorRule(): Rule {
		return {
			action: "pass_open_door",
			description: "通过已打开的门",
			struct: {
				action: "move_to_door",
				pre: (s: GameState) => {
					if (!s.doorOpen) return false
					const ax = s.agent.x
					const ay = s.agent.y
					const dx = WORLD_CONFIG.doorPos.x
					const dy = WORLD_CONFIG.doorPos.y
					const adjacent =
						(ax === dx - 1 && ay === dy) ||
						(ax === dx + 1 && ay === dy) ||
						(ax === dx && ay === dy - 1) ||
						(ax === dx && ay === dy + 1)
					return adjacent
				},
				eff: () => ({
					agent: { ...WORLD_CONFIG.doorPos }
				})
			}
		}
	}

	// 创建拾取规则
	private createPickupRule(): Rule {
		return {
			action: "pickup",
			description: "拾取钥匙",
			struct: {
				action: "pickup",
				pre: (s: GameState) =>
					s.agent.x === WORLD_CONFIG.keyPos.x &&
					s.agent.y === WORLD_CONFIG.keyPos.y &&
					s.keyExists &&
					s.holding === null,
				eff: () => ({
					holding: "key",
					keyExists: false
				})
			}
		}
	}
}

// 状态键生成（用于规划器 visited 集合）
export function getStateKey(s: GameState): string {
	return `${s.agent.x},${s.agent.y},${s.holding},${s.keyExists},${s.doorOpen}`
}
