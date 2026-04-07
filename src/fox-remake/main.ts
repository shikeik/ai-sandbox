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

	const app = document.getElementById("app")
	if (app) {
		app.textContent = "Fox Remake 已加载"
	}
})
