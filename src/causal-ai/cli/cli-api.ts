// ========== CLI API ==========
// 人类玩家与源格世界的交互接口
// 基于 MetaGridworld，提供全局视野、地图打印等人类专属能力

import { MetaGridworld } from "../meta-gridworld/world-engine"
import type { Action, MapData } from "../meta-gridworld/types"

export class CliAPI {
	private world: MetaGridworld

	constructor(mapData: MapData) {
		this.world = new MetaGridworld(mapData)
	}

	execute(action: Action): ReturnType<MetaGridworld["execute"]> {
		return this.world.execute(action)
	}

	getPlayerStatus(): string {
		return this.world.getPlayerStatus()
	}

	printGlobalMap(): void {
		this.world.printGlobalMap()
	}

	getGlobalView(): ReturnType<MetaGridworld["getGlobalView"]> {
		return this.world.getGlobalView()
	}

	getLocalView(): ReturnType<MetaGridworld["getLocalView"]> {
		return this.world.getLocalView()
	}

	isTerminated(): boolean {
		return this.world.isTerminated()
	}

	reset(mapData: MapData): void {
		this.world = new MetaGridworld(mapData)
	}

	// 暴露底层世界实例，供需要直接操作的场景使用
	getWorld(): MetaGridworld {
		return this.world
	}
}
