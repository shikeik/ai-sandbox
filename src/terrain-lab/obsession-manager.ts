// ========== 观察样本管理器 ==========
// 职责：观察样本设置 + 执念曲线数据更新

import type { AppState } from "./state.js"
import type { UIManager } from "./ui-manager.js"
import type { SnapshotManager } from "./snapshot-manager.js"
import { ACTIONS } from "./constants.js"
import { terrainToIndices, getLabel } from "./terrain.js"

export class ObsessionManager {
	private state: AppState
	private uiManager: UIManager
	private snapshotManager: SnapshotManager

	constructor(state: AppState, uiManager: UIManager, snapshotManager: SnapshotManager) {
		this.state = state
		this.uiManager = uiManager
		this.snapshotManager = snapshotManager
	}

	/**
	 * 从当前地形设置观察样本
	 */
	setFromTerrain(onUpdate: () => void): void {
		const indices = terrainToIndices(this.state.terrain)
		const label = getLabel(this.state.terrain)
		if (label === -1) {
			this.uiManager.updateObsessionStatus("当前地形为死局，无法设为观察样本", "bad")
			return
		}
		this.state.observedSample = { t: this.state.terrain.map(row => row.slice()), indices, y: label }
		this.uiManager.updateObsessionStatus(`观察样本：当前地形 | 规则答案：${ACTIONS[label]}`, "ok")
		// 重新计算所有快照对该样本的概率
		for (let i = 0; i < this.state.snapshots.length; i++) {
			this.snapshotManager.recordStats(i)
		}
		onUpdate()
	}

	/**
	 * 从数据集随机设置观察样本
	 */
	setRandom(onUpdate: () => void): void {
		if (this.state.dataset.length === 0) {
			this.uiManager.updateObsessionStatus("数据集为空，无法抽取样本", "bad")
			return
		}
		const sample = this.state.dataset[Math.floor(Math.random() * this.state.dataset.length)]
		this.state.observedSample = sample
		this.uiManager.updateObsessionStatus(`观察样本：数据集第 ${this.state.dataset.indexOf(sample) + 1} 条 | 规则答案：${ACTIONS[sample.y]}`, "ok")
		this.snapshotManager.recomputeAllStats()
		onUpdate()
	}
}
