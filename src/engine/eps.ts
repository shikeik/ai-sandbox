/**
 * EPS 核心：恒竖布局系统
 * 当设备物理横屏时，通过 CSS rotate(-90deg) 将游戏容器强制显示为竖屏。
 * 同时计算硬件安全区域与软件 UI 内边距，动态更新 CSS 变量。
 */

interface Insets {
	top: number
	bottom: number
	left: number
	right: number
}

interface CanvasInfo {
	width: number
	height: number
	insets: Insets
}

interface TransformMode {
	isLandscape: boolean
	isActive: boolean
	logicW: number
	logicH: number
	insets: Insets
}

interface TouchInfo {
	id: number
	screenX: number
	screenY: number
	logicalX: number
	logicalY: number
}

interface WrappedEvent {
	native: Event
	x: number
	y: number
	screenX: number
	screenY: number
	touches: TouchInfo[]
	touchCount: number
	preventDefault: () => void
	stopPropagation: () => void
	button: number
	type: string
}

interface Position {
	x?: number
	y?: number
	left?: number
	bottom?: number
}

const EPS = {
	_active: true,

	isActive(): boolean { return this._active },
	isLandscape(): boolean { return window.innerWidth > window.innerHeight },

	getHardwareInsets(): Insets {
		const el = document.createElement("div")
		el.style.cssText = "position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);visibility:hidden;"
		document.body.appendChild(el)
		const s = getComputedStyle(el)
		const res: Insets = {
			top: parseFloat(s.paddingTop) || 0,
			bottom: parseFloat(s.paddingBottom) || 0,
			left: parseFloat(s.paddingLeft) || 0,
			right: parseFloat(s.paddingRight) || 0
		}
		document.body.removeChild(el)
		return res
	},

	getSoftwareInsets(): Insets {
		const vv = window.visualViewport
		if (!vv) return { top: 0, bottom: 0, left: 0, right: 0 }
		return {
			top: vv.offsetTop,
			bottom: window.innerHeight - (vv.offsetTop + vv.height),
			left: vv.offsetLeft,
			right: window.innerWidth - (vv.offsetLeft + vv.width)
		}
	},

	getVisualInsets(): Insets {
		const hw = this.getHardwareInsets()
		const sw = this.getSoftwareInsets()
		return {
			top: Math.max(hw.top, hw.bottom, sw.top, sw.bottom),
			bottom: Math.max(hw.top, hw.bottom, sw.top, sw.bottom),
			left: Math.max(hw.left, hw.right, sw.left, sw.right),
			right: Math.max(hw.left, hw.right, sw.left, sw.right)
		}
	},

	updateViewport(): CanvasInfo {
		const insets = this.getVisualInsets()
		const vv = window.visualViewport || { width: window.innerWidth, height: window.innerHeight }
		const availWidth = vv.width - insets.left - insets.right
		const availHeight = vv.height - insets.top - insets.bottom

		const container = document.getElementById("ep-container")
		if (container) {
			container.style.setProperty("--ep-avail-width", `${availWidth}px`)
			container.style.setProperty("--ep-avail-height", `${availHeight}px`)
		}

		const isLandscape = this.isLandscape()
		const canvas: CanvasInfo = this._active && isLandscape
			? { width: availHeight, height: availWidth, insets }
			: { width: availWidth, height: availHeight, insets }

		return canvas
	},

	transform: {
		_getMode(): TransformMode {
			const canvas = EPS.updateViewport()
			const isLandscape = EPS.isLandscape()
			return {
				isLandscape,
				isActive: EPS._active,
				logicW: canvas.width,
				logicH: canvas.height,
				insets: canvas.insets
			}
		},

		_screenToStage(x: number, y: number): { x: number, y: number } {
			const ins = EPS.getVisualInsets()
			const vvH = window.visualViewport?.height || window.innerHeight
			return {
				x: x - ins.left,
				y: vvH - y - ins.top
			}
		},

		_stageToLogical(x: number, y: number): { x: number, y: number } {
			const m = this._getMode()
			if (!m.isActive || !m.isLandscape) return { x, y }
			return { x: y, y: m.logicW - x }
		},

		screenToLogical(x: number, y: number): { x: number, y: number } {
			const s = this._screenToStage(x, y)
			return this._stageToLogical(s.x, s.y)
		},

		deltaScreenToLogical(dx: number, dy: number): { dx: number, dy: number } {
			const m = this._getMode()
			const sdx = dx
			const sdy = -dy
			if (!m.isActive || !m.isLandscape) return { dx: sdx, dy: sdy }
			return { dx: sdy, dy: -sdx }
		}
	},

	on(el: EventTarget | null, type: string, handler: (e: WrappedEvent) => void, opts: AddEventListenerOptions = {}): void {
		if (!el) return
		el.addEventListener(type, (e: Event) => {
			const wrapped = this._wrap(e)
			handler(wrapped)
		}, opts)
	},

	_wrap(e: Event): WrappedEvent {
		const mouseEvent = e as MouseEvent
		const touchEvent = e as TouchEvent
		
		const getT = (): TouchInfo[] => {
			if (touchEvent.touches?.length) {
				return Array.from(touchEvent.touches).map(t => {
					const l = this.transform.screenToLogical(t.clientX, t.clientY)
					return { id: t.identifier, screenX: t.clientX, screenY: t.clientY, logicalX: l.x, logicalY: l.y }
				})
			}
			if (touchEvent.changedTouches?.length) {
				return Array.from(touchEvent.changedTouches).map(t => {
					const l = this.transform.screenToLogical(t.clientX, t.clientY)
					return { id: t.identifier, screenX: t.clientX, screenY: t.clientY, logicalX: l.x, logicalY: l.y }
				})
			}
			const l = this.transform.screenToLogical(mouseEvent.clientX, mouseEvent.clientY)
			return [{ id: 0, screenX: mouseEvent.clientX, screenY: mouseEvent.clientY, logicalX: l.x, logicalY: l.y }]
		}
		const touches = getT()
		const p = touches[0]
		return {
			native: e,
			x: p.logicalX,
			y: p.logicalY,
			screenX: p.screenX,
			screenY: p.screenY,
			touches: touches,
			touchCount: touches.length,
			preventDefault: () => e.preventDefault(),
			stopPropagation: () => e.stopPropagation(),
			button: mouseEvent.button,
			type: e.type
		}
	},

	dom: {
		setPosition(el: HTMLElement | null, s: Position): void {
			if (!el || !s) return
			if ("x" in s && s.x !== undefined) el.style.left = s.x + "px"
			if ("y" in s && s.y !== undefined) el.style.bottom = s.y + "px"
			if ("left" in s && s.left !== undefined) el.style.left = s.left + "px"
			if ("bottom" in s && s.bottom !== undefined) el.style.bottom = s.bottom + "px"
		},

		getPosition(el: HTMLElement | null): { left: number, bottom: number, width: number, height: number } | null {
			if (!el) return null
			const c = getComputedStyle(el)
			const left = c.left === "auto" ? 0 : parseFloat(c.left)
			const bottom = c.bottom === "auto" ? 0 : parseFloat(c.bottom)
			return { left, bottom, width: el.offsetWidth, height: el.offsetHeight }
		}
	},

	toggle(): void {
		this._active = !this._active
		const c = document.getElementById("ep-container")
		if (c) c.classList.toggle("active", this._active)
	},

	async fullscreen(): Promise<void> {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen()
				if (screen.orientation?.lock) await screen.orientation.lock("landscape").catch(() => {})
			} else {
				if (screen.orientation?.unlock) await screen.orientation.unlock()
				await document.exitFullscreen()
			}
		} catch (e) {
			console.error("[EPS]", "全屏错误:", (e as Error).message)
		}
	},

	init(): void {
		window.addEventListener("resize", () => this.updateStatus())
		if (window.visualViewport) {
			window.visualViewport.addEventListener("resize", () => this.updateStatus())
		}
		let st: ReturnType<typeof setTimeout>
		window.addEventListener("scroll", () => {
			clearTimeout(st)
			st = setTimeout(() => this.updateStatus(), 100)
		}, { passive: true })
		this.updateStatus()
	},

	updateStatus(): void {
		const cvs = this.updateViewport()
		const ins = this.getVisualInsets()
		const mode = this.isLandscape() ? "横" : "竖"
		const st = document.getElementById("eps-st")
		if (st) st.textContent = `${mode} | ${cvs.width.toFixed(0)}×${cvs.height.toFixed(0)} | EPS:${this._active ? "ON" : "OFF"} | ↕${ins.top.toFixed(0)}`
	}
}

export default EPS
