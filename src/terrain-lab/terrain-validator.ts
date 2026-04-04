// ========== 地形验证器 ==========
// 职责：地形合法性检查 + HTML 报告生成

import type { AppState } from "./state.js"
import type { UIManager } from "./ui-manager.js"
import { NUM_COLS, ELEM_SLIME } from "./constants.js"
import { findHeroCol, getActionChecks } from "./terrain.js"

export interface ValidationResult {
	validActions: string[]
	htmlReport: string
}

export class TerrainValidator {
	private state: AppState
	private uiManager: UIManager

	constructor(state: AppState, uiManager: UIManager) {
		this.state = state
		this.uiManager = uiManager
	}

	/**
	 * 验证当前地形并生成报告
	 */
	validate(): void {
		const heroCol = findHeroCol(this.state.terrain)
		const checks = getActionChecks(this.state.terrain, heroCol)
		const walk = checks.canWalk
		const jump = checks.canJump
		const longJump = checks.canLongJump
		const wa = checks.canWalkAttack

		// 统计可行动作数
		const validActions: string[] = []
		if (walk.ok) validActions.push("走")
		if (jump.ok) validActions.push("跳")
		if (longJump.ok) validActions.push("远跳")
		if (wa.ok) validActions.push("走A")

		// 构建详细报告
		const lines: string[] = []
		lines.push(`<b>狐狸位置：x${heroCol}</b>`)
		lines.push("")

		if (validActions.length > 0) {
			lines.push(`✅ 可行动作：${validActions.join("、")}`)
		} else {
			lines.push("❌ 无可用动作（死局）")
		}

		// 显示各动作详情
		const actionDetails: string[] = []

		// 走
		if (walk.ok) {
			actionDetails.push(`✅ 走 → x${heroCol + 1}`)
		} else {
			actionDetails.push(`❌ 走：${walk.reasons[0] || "无法前行"}`)
		}

		// 跳
		if (jump.ok) {
			actionDetails.push(`✅ 跳 → x${heroCol + 2}`)
		} else {
			const jumpTarget = heroCol + 2
			if (jumpTarget >= NUM_COLS) {
				actionDetails.push("❌ 跳：超出地图边界")
			} else {
				actionDetails.push(`❌ 跳：${jump.reasons[0] || "无法跳跃"}`)
			}
		}

		// 远跳
		if (longJump.ok) {
			actionDetails.push(`✅ 远跳 → x${heroCol + 3}`)
		} else {
			const longJumpTarget = heroCol + 3
			if (longJumpTarget >= NUM_COLS) {
				actionDetails.push("❌ 远跳：超出地图边界")
			} else {
				actionDetails.push(`❌ 远跳：${longJump.reasons[0] || "无法远跳"}`)
			}
		}

		// 走A
		if (wa.ok) {
			const hasSlime = this.state.terrain[1][heroCol + 1] === ELEM_SLIME
			actionDetails.push(`✅ 走A → x${heroCol + 1}${hasSlime ? "（击杀史莱姆）" : ""}`)
		} else {
			const walkATarget = heroCol + 1
			if (walkATarget >= NUM_COLS) {
				actionDetails.push("❌ 走A：超出地图边界")
			} else {
				actionDetails.push(`❌ 走A：${wa.reasons[0] || "无法攻击"}`)
			}
		}

		lines.push("")
		lines.push(actionDetails.join("<br>"))

		this.uiManager.updateTerrainStatus(validActions.length > 0 ? "ok" : "bad", lines.join("<br>"))
	}
}
