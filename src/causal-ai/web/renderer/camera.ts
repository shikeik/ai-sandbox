// ========== 相机跟随系统 ==========

export class Camera {
	private rafId: number | null = null

	constructor(
		private viewportEl: HTMLElement,
		private worldContentEl: HTMLElement,
		private getPlayerElement: () => HTMLElement | null,
		private cellSize: number
	) {}

	startTracking(): void {
		if (this.rafId) return
		const track = () => {
			this.sync()
			this.rafId = requestAnimationFrame(track)
		}
		this.rafId = requestAnimationFrame(track)
	}

	stop(): void {
		if (this.rafId) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}
	}

	sync(): void {
		this.stop()

		const playerElement = this.getPlayerElement()
		if (!playerElement || !this.viewportEl || !this.worldContentEl) return

		// 强制重绘确保 offsetLeft/Top 是最新值
		void playerElement.offsetHeight

		const playerRenderX = playerElement.offsetLeft
		const playerRenderY = playerElement.offsetTop

		const playerCenterX = playerRenderX + this.cellSize / 2
		const playerCenterY = playerRenderY + this.cellSize / 2

		const viewportWidth = this.viewportEl.clientWidth
		const viewportHeight = this.viewportEl.clientHeight

		const cameraOffsetX = viewportWidth / 2 - playerCenterX
		const cameraOffsetY = viewportHeight / 2 - playerCenterY

		this.worldContentEl.style.transform = `translate(${cameraOffsetX}px, ${cameraOffsetY}px)`
	}
}
