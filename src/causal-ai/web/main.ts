// ========== 因果链 AI Web 版 - 主入口 ==========
// 基于 core 模块的谓词表示和 AI 系统

import { GameController } from "./game-controller"
import { UIManager } from "./ui-manager"
import type { MapData, ActionType } from "./types"

// 内置地图数据
const BUILTIN_MAPS: MapData[] = [
	{
		id: "default",
		name: "默认（钥匙-门）",
		width: 6,
		height: 4,
		tiles: [
			"＃＃＃＃＃＃",
			"＃．．．．＃",
			"＃．．＃．＃",
			"＃＃＃＃＃＃"
		],
		objects: [
			{ id: "p1", type: "agent", pos: { x: 1, y: 1 } },
			{ id: "k1", type: "钥匙", pos: { x: 2, y: 2 } },
			{ id: "d1", type: "门", pos: { x: 3, y: 1 }, state: { open: false } },
			{ id: "g1", type: "终点", pos: { x: 4, y: 1 } }
		]
	},
	{
		id: "empty",
		name: "空地测试",
		width: 11,
		height: 7,
		tiles: [
			"＃＃＃＃＃＃＃＃＃＃＃",
			"＃．．．．．．．．．．．",
			"＃．．．．．．．．．．．",
			"＃．．．．．．．．．．．",
			"＃．．．．．．．．．．．",
			"＃．．．．．．．．．．．",
			"＃＃＃＃＃＃＃＃＃＃＃"
		],
		objects: [
			{ id: "p1", type: "agent", pos: { x: 5, y: 3 } },
			{ id: "g1", type: "终点", pos: { x: 9, y: 3 } }
		]
	},
	{
		id: "obstacle",
		name: "障碍测试",
		width: 6,
		height: 4,
		tiles: [
			"＃＃＃＃＃＃",
			"＃．＃．．＃",
			"＃．．．．＃",
			"＃＃＃＃＃＃"
		],
		objects: [
			{ id: "p1", type: "agent", pos: { x: 1, y: 1 } },
			{ id: "g1", type: "终点", pos: { x: 4, y: 1 } }
		]
	}
]

// 是否已尝试进入全屏
let hasAttemptedFullscreen = false

// 进入全屏
async function enterFullscreen(): Promise<void> {
	const docEl = document.documentElement as HTMLElement & {
		requestFullscreen?: () => Promise<void>
		webkitRequestFullscreen?: () => Promise<void>
	}

	try {
		if (docEl.requestFullscreen) {
			await docEl.requestFullscreen()
		} else if (docEl.webkitRequestFullscreen) {
			await docEl.webkitRequestFullscreen()
		}
	} catch (err) {
		console.log("[CAUSAL-AI] 全屏请求失败:", err)
	}
}

// 锁定横屏
async function lockLandscape(): Promise<void> {
	const scr = globalThis.screen as typeof globalThis.screen & {
		orientation?: { lock?: (orientation: string) => Promise<void> }
	}
	try {
		if (scr.orientation?.lock) {
			await scr.orientation.lock("landscape")
		}
	} catch (err) {
		console.log("[CAUSAL-AI] 横屏锁定失败:", err)
	}
}

// 初始化全屏覆盖层
function initFullscreenOverlay(): void {
	const overlay = document.getElementById("fullscreenOverlay")
	if (!overlay || hasAttemptedFullscreen) return

	overlay.classList.remove("hidden")
	overlay.addEventListener("click", async () => {
		hasAttemptedFullscreen = true
		await enterFullscreen()
		await lockLandscape()
		document.body.classList.add("is-fullscreen")
		overlay.classList.add("hidden")
		window.dispatchEvent(new Event("resize"))
	})
}

// 初始化标签切换
function initTabs(): void {
	const tabs = document.querySelectorAll(".tab")
	const panes = document.querySelectorAll(".tab-pane")

	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			const target = tab.getAttribute("data-tab")
			tabs.forEach((t) => t.classList.remove("active"))
			tab.classList.add("active")
			panes.forEach((pane) => {
				pane.classList.remove("active")
				if (pane.id === `tab-${target}`) {
					pane.classList.add("active")
				}
			})
		})
	})
}

// 初始化函数
function init(): void {
	const canvas = document.getElementById("worldCanvas") as HTMLCanvasElement
	if (!canvas) {
		throw new Error("未找到 canvas 元素")
	}

	// 创建 UI 管理器
	const uiManager = new UIManager()

	// 创建游戏控制器
	const controller = new GameController(canvas, uiManager)

	// 加载默认地图
	controller.loadMap(BUILTIN_MAPS[0]!)
	uiManager.updateMapName(BUILTIN_MAPS[0]!.name)

	// 绑定基础动作按钮（新的动作命名）
	const actionButtons: ActionType[] = ["上", "下", "左", "右", "互", "等"]
	actionButtons.forEach((action) => {
		uiManager.bindActionButton(action, () => controller.executeAction(action))
	})

	// 绑定重置按钮
	uiManager.bindButton("resetBtn", () => controller.reset())

	// 绑定探索按钮
	uiManager.bindButton("exploreBtn", () => controller.explore())

	// 绑定清空按钮
	uiManager.bindButton("clearExpBtn", () => controller.clearKnowledge())

	// 绑定规划按钮
	uiManager.bindButton("planBtn", () => {
		const input = document.getElementById("goalInput") as HTMLInputElement
		const goal = input?.value.trim() || "3,0"
		controller.planTo(goal)
	})

	// 绑定执行按钮
	uiManager.bindButton("executeBtn", () => controller.executePlannedStep())

	// 绑定地图切换按钮
	uiManager.bindButton("mapSelectBtn", () => {
		uiManager.showMapSelector(
			BUILTIN_MAPS.map(m => ({ id: m.id, name: m.name })),
			(mapId) => {
				const map = BUILTIN_MAPS.find(m => m.id === mapId)
				if (map) {
					controller.loadMap(map)
					uiManager.updateMapName(map.name)
				}
			}
		)
	})

	// 绑定视野切换按钮
	uiManager.bindButton("viewToggleBtn", () => {
		const mode = controller.toggleViewMode()
		const btn = document.getElementById("viewToggleBtn")
		if (btn) {
			btn.textContent = mode === "local" ? "👁️ 视野: 局部" : "👁️ 视野: 全局"
		}
		uiManager.addLog(mode === "local" ? "👁️ 切换到局部视野" : "🗺️ 切换到全局视野")
	})

	// 初始化标签切换
	initTabs()

	// 初始化全屏覆盖层
	initFullscreenOverlay()

	// 初始日志
	uiManager.addLog("👋 因果链 AI Web 版已启动")
	uiManager.addLog("💡 提示：先探索积累经验，然后输入目标进行规划")
}

// DOM 加载完成后初始化
document.addEventListener("DOMContentLoaded", init)
