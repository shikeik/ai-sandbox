// ========== 因果链 AI Web 版 - 主入口 ==========
// 基于 core 模块的谓词表示和 AI 系统
// 地图数据通过 fetch 动态加载

import { GameController } from "./game-controller"
import { UIManager } from "./ui-manager"
import type { ActionType } from "./types"
import { executeCommand, type CommandContext, loadMapData, setMapBasePath, listMaps } from "../core"

// 游戏控制器（全局变量供其他函数使用）
let controller: GameController | null = null

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

// 初始化全屏遮罩层
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

// 异步加载并切换地图
async function loadAndSwitchMap(
	mapId: string,
	ctrl: GameController,
	uiManager: UIManager
): Promise<void> {
	uiManager.addLog(`🗺️ 正在加载地图: ${mapId}...`)
	
	const mapData = await loadMapData(mapId)
	if (!mapData) {
		uiManager.addLog(`❌ 加载地图失败: ${mapId}`)
		return
	}
	
	ctrl.loadMap(mapData)
	uiManager.updateMapName(mapData.name)
	uiManager.addLog(`✅ 已加载: ${mapData.name}`)
}

// 初始化函数（异步）
async function init(): Promise<void> {
	const worldContainer = document.getElementById("worldContainer")
	if (!worldContainer) {
		throw new Error("未找到 worldContainer 元素")
	}

	// 初始化全屏遮罩层
	initFullscreenOverlay()

	// 设置地图基础路径（相对于当前页面）
	setMapBasePath("/gamedatas/maps")

	// 创建 UI 管理器
	const uiManager = new UIManager()

	// 创建游戏控制器
	controller = new GameController("worldContainer", uiManager)

	// 异步加载默认地图
	const defaultMap = await loadMapData("default")
	if (defaultMap) {
		controller.loadMap(defaultMap)
		uiManager.updateMapName(defaultMap.name)
	} else {
		uiManager.addLog("❌ 默认地图加载失败")
	}

	// 绑定基础动作按钮
	const actionButtons: ActionType[] = ["上", "下", "左", "右", "互", "等"]
	actionButtons.forEach((action) => {
		uiManager.bindActionButton(action, () => controller?.executeAction(action))
	})

	// 绑定重置按钮
	uiManager.bindButton("resetBtn", async () => {
		controller?.reset()
		const cmdInput = document.getElementById("cmdInput") as HTMLInputElement
		if (cmdInput) cmdInput.value = ""
		const viewBtn = document.getElementById("viewToggleBtn")
		if (viewBtn) viewBtn.textContent = "👁️ 视野: 局部"
		// 重新加载默认地图
		const map = await loadMapData("default")
		if (map && controller) {
			controller.loadMap(map)
			uiManager.updateMapName(map.name)
		}
	})

	// 绑定探索按钮
	uiManager.bindButton("exploreBtn", () => controller?.explore())

	// 绑定清空按钮
	uiManager.bindButton("clearExpBtn", () => controller?.clearKnowledge())

	// 执行指令的辅助函数
	async function execCmd(cmd: string): Promise<void> {
		if (!controller) return
		const world = controller.getWorld()
		if (!world) return

		const ctx: CommandContext = {
			world,
			expDB: controller.expDB,
			ruleDB: controller.ruleDB,
			plannedActions: controller.plannedActions,
			onSwitchMap: async (mapId) => {
				await loadAndSwitchMap(mapId, controller!, uiManager)
			},
			onPlanUpdate: (plan) => {
				if (plan.length > 0) {
					uiManager.addLog(`📋 计划: ${plan.join(" → ")}`)
				}
			}
		}

		const result = executeCommand(ctx, cmd)
		uiManager.addLog(result.msg)

		if (cmd === "图" || cmd === "全") {
			controller.setViewMode?.("global")
		}

		controller["render"]?.()
		controller["updateUI"]?.()
	}

	// 绑定指令输入框
	uiManager.bindButton("cmdBtn", async () => {
		const input = document.getElementById("cmdInput") as HTMLInputElement
		const cmd = input?.value.trim()
		if (cmd) {
			await execCmd(cmd)
			input.value = ""
		}
	})

	// 支持回车执行
	const cmdInput = document.getElementById("cmdInput") as HTMLInputElement
	if (cmdInput) {
		cmdInput.addEventListener("keypress", async (e) => {
			if (e.key === "Enter") {
				const cmd = cmdInput.value.trim()
				if (cmd) {
					await execCmd(cmd)
					cmdInput.value = ""
				}
			}
		})
	}

	// 绑定地图切换按钮
	uiManager.bindButton("mapSelectBtn", () => {
		const maps = listMaps()
		uiManager.showMapSelector(
			maps.map(m => ({ id: m.id, name: m.name })),
			async (mapId) => {
				if (controller) {
					await loadAndSwitchMap(mapId, controller, uiManager)
				}
			}
		)
	})

	// 绑定视野切换按钮
	uiManager.bindButton("viewToggleBtn", () => {
		const mode = controller?.toggleViewMode()
		const btn = document.getElementById("viewToggleBtn")
		if (btn) {
			btn.textContent = mode === "local" ? "👁️ 视野: 局部" : "👁️ 视野: 全局"
		}
		uiManager.addLog(mode === "local" ? "👁️ 切换到局部视野" : "🗺️ 切换到全局视野")
	})

	// 绑定 Tab 切换
	initTabSwitching()

	// 初始日志
	uiManager.addLog("👋 因果链 AI Web 版已启动")
	uiManager.addLog("💡 提示：地图通过 JSON 动态加载")
}

// 初始化 Tab 切换
function initTabSwitching(): void {
	const tabs = document.querySelectorAll(".tab")
	const panes = document.querySelectorAll(".tab-pane")

	tabs.forEach(tab => {
		tab.addEventListener("click", () => {
			const targetTab = tab.getAttribute("data-tab")

			// 切换 tab 按钮状态
			tabs.forEach(t => t.classList.remove("active"))
			tab.classList.add("active")

			// 切换 pane 显示
			panes.forEach(pane => {
				pane.classList.remove("active")
				if (pane.id === `tab-${targetTab}`) {
					pane.classList.add("active")
				}
			})
		})
	})
}

// DOM 加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
	init().catch(err => {
		console.error("[CAUSAL-AI] 初始化失败:", err)
	})
})
