/**
 * EPS 核心：恒竖布局系统
 * 当设备物理横屏时，通过 CSS rotate(-90deg) 将游戏容器强制显示为竖屏。
 * 同时计算硬件安全区域与软件 UI 内边距，动态更新 CSS 变量。
 */

const EPS = {
	_active: true,

	isActive() { return this._active },
	isLandscape() { return window.innerWidth > window.innerHeight },

	// 获取硬件安全区域
	getHardwareInsets() {
		const el = document.createElement('div')
		el.style.cssText = 'position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);visibility:hidden;'
		document.body.appendChild(el)
		const s = getComputedStyle(el)
		const res = {
			top: parseFloat(s.paddingTop) || 0,
			bottom: parseFloat(s.paddingBottom) || 0,
			left: parseFloat(s.paddingLeft) || 0,
			right: parseFloat(s.paddingRight) || 0
		}
		document.body.removeChild(el)
		return res
	},

	// 获取软件UI区域
	getSoftwareInsets() {
		const vv = window.visualViewport
		if (!vv) return { top: 0, bottom: 0, left: 0, right: 0 }
		return {
			top: vv.offsetTop,
			bottom: window.innerHeight - (vv.offsetTop + vv.height),
			left: vv.offsetLeft,
			right: window.innerWidth - (vv.offsetLeft + vv.width)
		}
	},

	// 获取完整保护区域
	getVisualInsets() {
		const hw = this.getHardwareInsets()
		const sw = this.getSoftwareInsets()
		return {
			top: Math.max(hw.top, hw.bottom, sw.top, sw.bottom),
			bottom: Math.max(hw.top, hw.bottom, sw.top, sw.bottom),
			left: Math.max(hw.left, hw.right, sw.left, sw.right),
			right: Math.max(hw.left, hw.right, sw.left, sw.right)
		}
	},

	// 更新 CSS 变量
	updateViewport() {
		const insets = this.getVisualInsets()
		const vv = window.visualViewport || { width: window.innerWidth, height: window.innerHeight }
		const availWidth = vv.width - insets.left - insets.right
		const availHeight = vv.height - insets.top - insets.bottom

		const container = document.getElementById('ep-container')
		if (container) {
			container.style.setProperty('--ep-avail-width', `${availWidth}px`)
			container.style.setProperty('--ep-avail-height', `${availHeight}px`)
		}

		const isLandscape = this.isLandscape()
		const canvas = this._active && isLandscape
			? { width: availHeight, height: availWidth, insets }
			: { width: availWidth, height: availHeight, insets }

		return canvas
	},

	// 坐标转换
	transform: {
		_getMode() {
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

		_screenToStage(x, y) {
			const ins = EPS.getVisualInsets()
			const vvH = window.visualViewport?.height || window.innerHeight
			return {
				x: x - ins.left,
				y: vvH - y - ins.top
			}
		},

		_stageToLogical(x, y) {
			const m = this._getMode()
			if (!m.isActive || !m.isLandscape) return { x, y }
			return { x: y, y: m.logicW - x }
		},

		screenToLogical(x, y) {
			const s = this._screenToStage(x, y)
			return this._stageToLogical(s.x, s.y)
		},

		deltaScreenToLogical(dx, dy) {
			const m = this._getMode()
			const sdx = dx
			const sdy = -dy
			if (!m.isActive || !m.isLandscape) return { dx: sdx, dy: sdy }
			return { dx: sdy, dy: -sdx }
		}
	},

	// 事件监听（带坐标转换）
	on(el, type, handler, opts = {}) {
		if (!el) return
		el.addEventListener(type, (e) => {
			const wrapped = this._wrap(e)
			handler(wrapped)
		}, opts)
	},

	_wrap(e) {
		const getT = () => {
			if (e.touches?.length) {
				return Array.from(e.touches).map(t => {
					const l = this.transform.screenToLogical(t.clientX, t.clientY)
					return { id: t.identifier, screenX: t.clientX, screenY: t.clientY, logicalX: l.x, logicalY: l.y }
				})
			}
			if (e.changedTouches?.length) {
				return Array.from(e.changedTouches).map(t => {
					const l = this.transform.screenToLogical(t.clientX, t.clientY)
					return { id: t.identifier, screenX: t.clientX, screenY: t.clientY, logicalX: l.x, logicalY: l.y }
				})
			}
			const l = this.transform.screenToLogical(e.clientX, e.clientY)
			return [{ id: 0, screenX: e.clientX, screenY: e.clientY, logicalX: l.x, logicalY: l.y }]
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
			button: e.button,
			type: e.type
		}
	},

	// DOM 操作
	dom: {
		setPosition(el, s) {
			if (!el || !s) return
			if ('x' in s) el.style.left = s.x + 'px'
			if ('y' in s) el.style.bottom = s.y + 'px'
			if ('left' in s) el.style.left = s.left + 'px'
			if ('bottom' in s) el.style.bottom = s.bottom + 'px'
		},

		getPosition(el) {
			if (!el) return null
			const c = getComputedStyle(el)
			const left = c.left === 'auto' ? 0 : parseFloat(c.left)
			const bottom = c.bottom === 'auto' ? 0 : parseFloat(c.bottom)
			return { left, bottom, width: el.offsetWidth, height: el.offsetHeight }
		}
	},

	toggle() {
		this._active = !this._active
		const c = document.getElementById('ep-container')
		if (c) c.classList.toggle('active', this._active)
	},

	async fullscreen() {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen()
				if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {})
			} else {
				if (screen.orientation?.unlock) await screen.orientation.unlock()
				await document.exitFullscreen()
			}
		} catch (e) {
			console.error('全屏错误:', e.message)
		}
	},

	init() {
		// 监听各种视口变化
		window.addEventListener('resize', () => this.updateStatus())
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', () => this.updateStatus())
		}
		let st
		window.addEventListener('scroll', () => {
			clearTimeout(st)
			st = setTimeout(() => this.updateStatus(), 100)
		}, { passive: true })
		this.updateStatus()
	},

	updateStatus() {
		const cvs = this.updateViewport()
		const ins = this.getVisualInsets()
		const mode = this.isLandscape() ? '横' : '竖'
		const st = document.getElementById('eps-st')
		if (st) st.textContent = `${mode} | ${cvs.width.toFixed(0)}×${cvs.height.toFixed(0)} | EPS:${this._active ? 'ON' : 'OFF'} | ↕${ins.top.toFixed(0)}`
	}
}

export default EPS
