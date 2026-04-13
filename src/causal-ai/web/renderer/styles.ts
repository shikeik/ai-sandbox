// ========== 渲染器全局样式注入 ==========

export function injectStyles(): void {
	const style = document.createElement("style")
	style.textContent = `
		@keyframes ca-pop-in {
			0% { transform: scale(0.5); opacity: 0; }
			100% { transform: scale(1); opacity: 1; }
		}
		@keyframes ca-pop-out {
			0% { transform: scale(1); opacity: 1; }
			100% { transform: scale(0.5); opacity: 0; }
		}
		@keyframes ca-float {
			0%, 100% { transform: translateY(0); }
			50% { transform: translateY(-2px); }
		}
		@keyframes ca-pulse {
			0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(159, 122, 234, 0.6)); }
			50% { transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(159, 122, 234, 0.9)); }
		}
	`
	document.head.appendChild(style)
}
