// ========== Fox Remake 入口 ==========

document.addEventListener("DOMContentLoaded", () => {
	console.log("FOX-REMAKE", "初始化")

	// DOM 元素
	const btnFullscreen = document.getElementById("btn-fullscreen")
	const btnMenu = document.getElementById("btn-menu")
	const btnCmd = document.getElementById("btn-cmd")
	const menuContainer = document.getElementById("menu-container")
	const cmdLine = document.getElementById("command-line")
	const cmdInput = document.getElementById("cmd-input") as HTMLInputElement

	// ========== 全屏按钮 ==========
	if (btnFullscreen) {
		const updateFullscreenBtn = () => {
			btnFullscreen.classList.toggle("active", !!document.fullscreenElement)
		}
		document.addEventListener("fullscreenchange", updateFullscreenBtn)
		document.addEventListener("webkitfullscreenchange", updateFullscreenBtn)
		btnFullscreen.addEventListener("click", () => {
			if (!document.fullscreenElement) {
				document.documentElement.requestFullscreen()
			} else {
				document.exitFullscreen()
			}
		})
	}

	// ========== 汉堡菜单 ==========
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

		menuContainer.addEventListener("click", (e) => {
			const item = e.target as HTMLElement
			if (item.classList.contains("menu-item")) {
				console.log("[MENU] 点击:", item.textContent)
				menuContainer.classList.remove("active")
				btnMenu.classList.remove("active")
			}
		})

		document.addEventListener("click", (e) => {
			if (!menuContainer.contains(e.target as Node) && e.target !== btnMenu) {
				menuContainer.classList.remove("active")
				btnMenu.classList.remove("active")
			}
		})
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

		cmdInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				const cmd = cmdInput.value.trim()
				if (cmd) {
					console.log("[CMD]", cmd)
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

			const keyboardHeight = window.innerHeight - vv.height
			const offset = keyboardHeight > 0 ? -keyboardHeight : 0
			cmdLine.style.transform = `translateY(${offset}px)`
		}

		vv.addEventListener("resize", updatePosition)
		vv.addEventListener("scroll", updatePosition)
	}

	console.log("[FOX-REMAKE] 就绪")
})
