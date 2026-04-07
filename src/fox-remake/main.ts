// ========== Fox Remake 入口 ==========

import EPS from "../engine/eps.js"

document.addEventListener("DOMContentLoaded", () => {
	console.log("FOX-REMAKE", "初始化")

	// 初始化 EPS 恒竖布局
	EPS.init()

	// DOM 元素
	const btnToggle = document.getElementById("btn-toggle")
	const btnFullscreen = document.getElementById("btn-fullscreen")
	const btnMenu = document.getElementById("btn-menu")
	const btnCmd = document.getElementById("btn-cmd")
	const cmdLine = document.getElementById("command-line")
	const cmdInput = document.getElementById("cmd-input") as HTMLInputElement

	// ========== EPS 按钮 ==========
	if (btnToggle) {
		btnToggle.classList.toggle("active", EPS.isActive())
		btnToggle.addEventListener("click", () => {
			EPS.toggle()
			btnToggle.classList.toggle("active", EPS.isActive())
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

	// ========== 命令行切换 ==========
	if (btnCmd && cmdLine && cmdInput) {
		btnCmd.addEventListener("click", () => {
			const isActive = cmdLine.classList.contains("active")
			if (isActive) {
				cmdLine.classList.remove("active")
				btnCmd.classList.remove("active")
				cmdInput.blur()
			} else {
				cmdLine.classList.add("active")
				btnCmd.classList.add("active")
				cmdInput.focus()
			}
		})

		// 执行命令
		cmdInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				const cmd = cmdInput.value.trim()
				if (cmd) {
					console.log("[CMD]", cmd)
					// TODO: 执行命令
					cmdInput.value = ""
				}
			} else if (e.key === "Escape") {
				cmdLine.classList.remove("active")
				btnCmd.classList.remove("active")
				cmdInput.blur()
			}
		})
	}

	// ========== 命令行跟随输入法 ==========
	if (cmdLine && window.visualViewport) {
		const vv = window.visualViewport

		const updatePosition = () => {
			if (!cmdLine.classList.contains("active")) return

			// 计算键盘高度
			const keyboardHeight = window.innerHeight - vv.height
			const offset = vv.offsetTop + keyboardHeight - window.innerHeight

			// 向上偏移，贴在输入法上方
			if (keyboardHeight > 0) {
				cmdLine.style.transform = `translateY(${offset}px)`
			} else {
				cmdLine.style.transform = "translateY(0)"
			}
		}

		vv.addEventListener("resize", updatePosition)
		vv.addEventListener("scroll", updatePosition)
	}

	// ========== 全局暴露 ==========
	;(window as unknown as Record<string, unknown>).foxRemake = {
		EPS,
		// TODO: 游戏实例
	}

	console.log("[FOX-REMAKE] 就绪")
})
