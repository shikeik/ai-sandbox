// ========== Terrain Lab 主入口 ==========
// 职责：初始化全局状态，管理三个 Tab 的入口类

import type { AppState } from "./state.js"
import { createInitialState } from "./state.js"
import { TrainingEntry } from "./TrainingEntry.js"
import { ChallengeEntry } from "./ChallengeEntry.js"
import { MapGeneratorEntry } from "./MapGeneratorEntry.js"
import { KimiEntry } from "./KimiEntry.js"
import { Logger } from "@/engine/utils/Logger.js"
import { ConsolePanel } from "@/engine/console/ConsolePanel.js"

// ========== 全局状态 ==========
const state: AppState = createInitialState()

// ========== 四个入口类实例 ==========
let trainingEntry: TrainingEntry
let challengeEntry: ChallengeEntry
let generatorEntry: MapGeneratorEntry
let kimiEntry: KimiEntry

// ========== Tab 切换 ==========

function switchTab(tabName: string): void {
	// 更新 Tab 按钮状态
	document.querySelectorAll(".tab-btn").forEach(btn => {
		btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName)
	})

	// 切换内容显示
	document.querySelectorAll(".tab-content").forEach(content => {
		content.classList.remove("active")
	})
	const targetContent = document.getElementById(`tab-${tabName}`)
	if (targetContent) {
		targetContent.classList.add("active")
	}

	// Tab 特定的激活逻辑
	if (tabName === "challenge") {
		challengeEntry?.onTabActivate()
	} else if (tabName === "generator") {
		generatorEntry?.onTabActivate()
	} else if (tabName === "kimi") {
		kimiEntry?.onTabActivate()
	}
}

// ========== 预测同步 ==========
// 当训练Entry更新网络后，需要通知其他Entry
function onNetworkUpdated(): void {
	// 网络已更新，其他Entry在下次预测时会自动使用新网络
}

// ========== 初始化 ==========

function init(): void {
	// 创建独立的 Logger 实例
	const logger = new Logger("terrain-lab")

	// 初始化四个入口类
	trainingEntry = new TrainingEntry(state, onNetworkUpdated)
	challengeEntry = new ChallengeEntry(state, onNetworkUpdated)
	generatorEntry = new MapGeneratorEntry(state)
	kimiEntry = new KimiEntry(state)

	// 分别初始化
	trainingEntry.init()
	challengeEntry.init()
	generatorEntry.init()
	kimiEntry.init()

	// 绑定全局 Tab 切换函数
	;(window as any).switchTab = switchTab

	// 初始化控制台
	const consolePanel = new ConsolePanel("#console-mount", logger)
	consolePanel.init()

	// 暴露全局 console API
	;(window as any).toggleConsole = () => consolePanel.toggle()
	;(window as any).clearConsole = () => consolePanel.clear()
	;(window as any).downloadConsole = () => consolePanel.download()

}

init()
