// ========== 预测器 ==========
// 职责：AI 预测 + 结果展示

import type { AppState } from "./state.js"
import type { UIManager } from "./ui-manager.js"
import type { ForwardResult, ActionType } from "./types.js"
import { ACTIONS } from "./constants.js"
import { forward } from "./neural-network.js"
import { terrainToIndices, findHeroCol, getActionChecks, getLabel, getActionName, isActionValidByChecks } from "./terrain.js"
import { stopAnimation } from "./state.js"

export interface PredictionResult {
	action: number
	actionName: string
	confidence: number
	probabilities: number[]
	isValid: boolean
	isOptimal: boolean
	correctAction: number
	correctActionName: string
}

export class Predictor {
	private state: AppState
	private uiManager: UIManager
	private drawMLP: (fp: ForwardResult | null) => void
	private drawEmbedding: () => void
	private playAnimation: (action: string) => void

	constructor(
		state: AppState,
		uiManager: UIManager,
		drawMLP: (fp: ForwardResult | null) => void,
		drawEmbedding: () => void,
		playAnimation: (action: string | ActionType) => void
	) {
		this.state = state
		this.uiManager = uiManager
		this.drawMLP = drawMLP
		this.drawEmbedding = drawEmbedding
		this.playAnimation = playAnimation
	}

	/**
	 * 执行预测并更新UI
	 */
	predict(): void {
		const indices = terrainToIndices(this.state.terrain)
		const fp = forward(this.state.net, indices)
		this.state.lastForwardResult = fp
		const pred = fp.o.indexOf(Math.max(...fp.o))
		const heroCol = findHeroCol(this.state.terrain)
		const checks = getActionChecks(this.state.terrain, heroCol)
		const correct = getLabel(this.state.terrain)

		// 调试日志

		const conf = (fp.o[pred] * 100).toFixed(1)

		// 死局处理
		if (correct === -1) {
			this.uiManager.updateTerrainStatus(
				"bad",
				`AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)<br>规则答案: <b style="color:#f9ab00">此地形无解（死局）</b>`
			)
			this.drawMLP(fp)
			this.drawEmbedding()
			this.uiManager.updateProbs(fp.o)
			stopAnimation(this.state)
			return
		}

		// 统一使用与合法性检查同一数据源的判定函数
		const isValid = isActionValidByChecks(checks, pred)
		const lines: string[] = []
		lines.push(`AI 预测: <b>${ACTIONS[pred]}</b> (置信度 ${conf}%)`)
		lines.push(`规则答案: <b>${ACTIONS[correct]}</b>`)

		if (isValid) {
			if (pred === correct) {
				lines.push("<span style='color:#34a853'>✅ 最优</span>")
				this.uiManager.updateTerrainStatus("ok", lines.join("<br>"))
			} else {
				lines.push("<span style='color:#f9ab00'>✅ 合法（但非最优）</span>")
				this.uiManager.updateTerrainStatus("ok", lines.join("<br>"))
			}
		} else {
			lines.push("<span style='color:#ea4335'>❌ 非法</span>")
			this.uiManager.updateTerrainStatus("bad", lines.join("<br>"))
		}

		this.drawMLP(fp)
		this.drawEmbedding()
		this.uiManager.updateProbs(fp.o)
		this.playAnimation(ACTIONS[pred])
	}
}
