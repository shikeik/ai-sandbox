// ========== 快照管理器 ==========
// 职责：快照保存/应用/统计计算

import type { AppState } from "./state.js"
import type { UIManager } from "./ui-manager.js"
import { forward } from "./neural-network.js"
import { cloneNet } from "./neural-network.js"

export class SnapshotManager {
	private state: AppState
	private uiManager: UIManager

	constructor(state: AppState, uiManager: UIManager) {
		this.state = state
		this.uiManager = uiManager
		console.log("SNAPSHOT-MANAGER", "实例化完成")
	}

	/**
	 * 记录快照统计信息（准确率、损失、执念曲线概率）
	 */
	recordStats(snapshotIndex: number): void {
		if (snapshotIndex < 0 || snapshotIndex >= this.state.snapshots.length) return
		const snap = this.state.snapshots[snapshotIndex]

		// 执念曲线概率
		if (this.state.observedSample) {
			const fp = forward(snap.net, this.state.observedSample.indices)
			snap.observedProbs = fp.o.slice()
		}

		// 准确率与损失
		if (this.state.dataset.length > 0) {
			let correct = 0
			let lossSum = 0
			for (const sample of this.state.dataset) {
				const fp = forward(snap.net, sample.indices)
				if (fp.o.indexOf(Math.max(...fp.o)) === sample.y) correct++
				lossSum += -Math.log(Math.max(fp.o[sample.y], 1e-7))
			}
			snap.acc = (correct / this.state.dataset.length) * 100
			snap.loss = lossSum / this.state.dataset.length
		}
	}

	/**
	 * 添加新快照
	 */
	addSnapshot(): void {
		this.state.snapshots.push({
			step: this.state.trainSteps,
			net: cloneNet(this.state.net)
		})
		this.recordStats(this.state.snapshots.length - 1)
		console.log("SNAPSHOT-MANAGER", `添加快照 #${this.state.snapshots.length - 1}, 步数 ${this.state.trainSteps}`)
	}

	/**
	 * 应用指定索引的快照
	 */
	applySnapshot(index: number, onApply: () => void): void {
		console.log("SNAPSHOT-MANAGER", `应用快照 #${index}`)
		if (index < 0 || index >= this.state.snapshots.length) return
		this.state.selectedSnapshotIndex = index
		this.state.net = cloneNet(this.state.snapshots[index].net)
		const snap = this.state.snapshots[index]
		this.uiManager.applySnapshotLabel(snap.step, snap.acc, snap.loss)
		onApply()
	}

	/**
	 * 初始化快照（添加初始状态）
	 */
	initSnapshot(): void {
		if (this.state.snapshots.length === 0) {
			this.state.snapshots.push({
				step: this.state.trainSteps,
				net: cloneNet(this.state.net)
			})
			this.recordStats(0)
			this.state.selectedSnapshotIndex = 0
			console.log("SNAPSHOT-MANAGER", "初始化快照完成")
		}
	}

	/**
	 * 重新计算所有快照的统计信息
	 */
	recomputeAllStats(): void {
		for (let i = 0; i < this.state.snapshots.length; i++) {
			this.recordStats(i)
		}
		console.log("SNAPSHOT-MANAGER", `重新计算 ${this.state.snapshots.length} 个快照统计`)
	}

	/**
	 * 清空快照（保留初始状态）
	 */
	resetSnapshots(): void {
		this.state.snapshots = [{ step: this.state.trainSteps, net: cloneNet(this.state.net) }]
		this.recordStats(0)
		this.state.selectedSnapshotIndex = 0
		console.log("SNAPSHOT-MANAGER", "重置快照完成")
	}
}
