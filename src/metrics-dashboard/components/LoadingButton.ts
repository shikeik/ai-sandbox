// ========== 带加载状态的按钮组件 ==========
// 职责：封装按钮加载状态管理，供刷新/导出/选择等按钮复用
// 遵循 DRY 原则：不重复实现 loading 逻辑

/** 按钮配置选项 */
export interface LoadingButtonOptions {
	/** 按钮文本 */
	text: string
	/** 加载中文本 */
	loadingText?: string
	/** 按钮样式类 */
	className?: string
	/** 点击回调 */
	onClick: () => void | Promise<void>
	/** 是否禁用 */
	disabled?: boolean
}

/** 带加载状态的按钮 */
export class LoadingButton {
	private element: HTMLButtonElement
	private isLoading = false
	private options: LoadingButtonOptions

	/**
	 * 创建加载按钮
	 * @param container 父容器
	 * @param options 配置选项
	 */
	constructor(container: HTMLElement, options: LoadingButtonOptions) {
		this.options = options
		this.element = this.createButton()
		container.appendChild(this.element)
	}

	/**
	 * 创建按钮元素
	 */
	private createButton(): HTMLButtonElement {
		const btn = document.createElement("button")
		btn.className = this.options.className ?? "btn-primary"
		btn.textContent = this.options.text
		btn.disabled = this.options.disabled ?? false

		btn.addEventListener("click", () => this.handleClick())

		return btn
	}

	/**
	 * 处理点击事件
	 */
	private async handleClick(): Promise<void> {
		if (this.isLoading) return

		this.setLoading(true)

		try {
			await this.options.onClick()
		} finally {
			this.setLoading(false)
		}
	}

	/**
	 * 设置加载状态
	 * @param loading 是否加载中
	 */
	setLoading(loading: boolean): void {
		this.isLoading = loading
		this.element.disabled = loading || (this.options.disabled ?? false)
		this.element.textContent = loading
			? (this.options.loadingText ?? "加载中...")
			: this.options.text
		this.element.classList.toggle("loading", loading)
	}

	/**
	 * 设置禁用状态
	 * @param disabled 是否禁用
	 */
	setDisabled(disabled: boolean): void {
		this.options.disabled = disabled
		if (!this.isLoading) {
			this.element.disabled = disabled
		}
	}

	/**
	 * 更新按钮文本
	 * @param text 新文本
	 */
	setText(text: string): void {
		this.options.text = text
		if (!this.isLoading) {
			this.element.textContent = text
		}
	}

	/**
	 * 获取按钮元素
	 */
	getElement(): HTMLButtonElement {
		return this.element
	}

	/**
	 * 销毁按钮
	 */
	destroy(): void {
		this.element.remove()
	}
}

/**
 * 创建按钮组（批量创建）
 * @param container 父容器
 * @param buttons 按钮配置数组
 */
export function createButtonGroup(
	container: HTMLElement,
	buttons: LoadingButtonOptions[]
): LoadingButton[] {
	const wrapper = document.createElement("div")
	wrapper.className = "btn-group"
	container.appendChild(wrapper)

	return buttons.map(opts => new LoadingButton(wrapper, opts))
}
