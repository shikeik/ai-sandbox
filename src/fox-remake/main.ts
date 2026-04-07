// ========== Fox Remake 入口 ==========

import EPS from "../engine/eps.js"

document.addEventListener("DOMContentLoaded", () => {
	console.log("FOX-REMAKE", "初始化")

	// 初始化 EPS 恒竖布局
	EPS.init()

	// 更新 EPS 状态显示
	const epsStatus = document.getElementById("eps-st")
	function updateEpsStatus() {
		if (epsStatus) {
			epsStatus.textContent = EPS.isActive() ? "恒竖" : "-"
		}
	}
	updateEpsStatus()

	// 绑定工具栏按钮
	const btnToggle = document.getElementById("btn-toggle")
	const btnFullscreen = document.getElementById("btn-fullscreen")
	const btnMenu = document.getElementById("btn-menu")
	const menuContainer = document.getElementById("menu-container")

	if (btnToggle) {
		btnToggle.classList.toggle("active", EPS.isActive())
		btnToggle.addEventListener("click", () => {
			EPS.toggle()
			btnToggle.classList.toggle("active", EPS.isActive())
			updateEpsStatus()
		})
	}

	if (btnFullscreen) {
		const updateFullscreenBtn = () => {
			btnFullscreen.classList.toggle("active", !!document.fullscreenElement)
		}
		document.addEventListener("fullscreenchange", updateFullscreenBtn)
		document.addEventListener("webkitfullscreenchange", updateFullscreenBtn)
		btnFullscreen.addEventListener("click", () => EPS.fullscreen())
	}

	// 汉堡菜单点击事件
	if (btnMenu && menuContainer) {
		btnMenu.addEventListener("click", (e) => {
			e.stopPropagation()
			const isOpen = menuContainer.classList.contains("active")
			if (isOpen) {
				menuContainer.classList.remove("active")
				btnMenu.classList.remove("active")
			} else {
				menuContainer.classList.add("active")
				btnMenu.classList.add("active")
			}
		})

		// 点击菜单项关闭菜单
		menuContainer.addEventListener("click", (e) => {
			const item = e.target as HTMLElement
			if (item.classList.contains("menu-item")) {
				console.log("[MENU] 点击:", item.textContent)
				menuContainer.classList.remove("active")
				btnMenu.classList.remove("active")
			}
		})

		// 点击页面其他地方关闭菜单
		document.addEventListener("click", (e) => {
			if (!menuContainer.contains(e.target as Node) && e.target !== btnMenu) {
				menuContainer.classList.remove("active")
				btnMenu.classList.remove("active")
			}
		})
	}

	const app = document.getElementById("app")
	if (app) {
		app.textContent = "Fox Remake 已加载"
	}
})
