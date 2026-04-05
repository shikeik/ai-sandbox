// ========== 格子世界系统 - 编辑器 ==========
// 职责：地形编辑功能（画笔、点击绘制、层限制检查）

import type { ElementDef, EditorConfig, CellPos } from "./types.js"
import { Logger } from "@/engine/utils/Logger.js"

// ========== 编辑器类 ==========

export class GridWorldEditor {
	private config: EditorConfig
	private elements: ElementDef[]
	private numLayers: number
	private numCols: number
	private logger: Logger

	// 回调
	onCellPainted: ((row: number, col: number, elementId: number) => void) | null = null
	onInvalidPlacement: ((message: string) => void) | null = null

	constructor(
		elements: ElementDef[],
		numLayers: number,
		numCols: number,
		config?: Partial<EditorConfig>
	) {
		this.elements = elements
		this.numLayers = numLayers
		this.numCols = numCols
		this.logger = new Logger("GRID-EDITOR")

		// 默认配置：所有层都允许所有元素
		const defaultAllowedElements: number[][] = []
		for (let i = 0; i < numLayers; i++) {
			defaultAllowedElements.push(elements.map(e => e.id))
		}

		this.config = {
			enabled: config?.enabled ?? true,
			selectedBrush: config?.selectedBrush ?? 0,
			allowedElements: config?.allowedElements ?? defaultAllowedElements,
		}

		console.log(`编辑器初始化 | enabled=${this.config.enabled}, brush=${this.config.selectedBrush}`)
	}

	// ========== 配置方法 ==========

	/**
	 * 设置是否启用编辑
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
		console.log(`编辑状态变更 | enabled=${enabled}`)
	}

	/**
	 * 设置当前画笔
	 */
	setBrush(elementId: number): void {
		this.config.selectedBrush = elementId
		const elem = this.elements[elementId]
		console.log(`画笔切换 | id=${elementId}, name=${elem?.name ?? "未知"}`)
	}

	/**
	 * 获取当前画笔
	 */
	getBrush(): number {
		return this.config.selectedBrush
	}

	/**
	 * 设置层允许的元素
	 */
	setLayerAllowedElements(layer: number, elementIds: number[]): void {
		if (layer < 0 || layer >= this.numLayers) {
			console.error(`无效的层索引 | layer=${layer}`)
			return
		}
		this.config.allowedElements[layer] = [...elementIds]
		console.log(`层元素限制更新 | layer=${layer}, elements=[${elementIds.join(",")}]`)
	}

	/**
	 * 获取指定层允许的元素
	 */
	getLayerAllowedElements(layer: number): number[] {
		return this.config.allowedElements[layer] ?? []
	}

	// ========== 绘制操作 ==========

	/**
	 * 检查是否可以在指定位置放置元素
	 */
	canPaintAt(row: number, col: number, elementId?: number): { ok: boolean; message: string } {
		if (!this.config.enabled) {
			return { ok: false, message: "编辑器未启用" }
		}

		// 检查边界
		if (row < 0 || row >= this.numLayers || col < 0 || col >= this.numCols) {
			return { ok: false, message: "超出边界" }
		}

		const brush = elementId ?? this.config.selectedBrush
		const allowed = this.config.allowedElements[row] ?? []

		if (!allowed.includes(brush)) {
			const elem = this.elements[brush]
			const layerNames = ["天空层", "中层", "地面层"]
			return {
				ok: false,
				message: `❌ ${elem?.name ?? "未知元素"}不能放在${layerNames[row]}层`,
			}
		}

		return { ok: true, message: "可以放置" }
	}

	/**
	 * 在指定位置绘制
	 * @returns 是否成功绘制
	 */
	paintAt(row: number, col: number, elementId?: number): boolean {
		const brush = elementId ?? this.config.selectedBrush

		const check = this.canPaintAt(row, col, brush)
		if (!check.ok) {
			console.log(`绘制失败 | row=${row}, col=${col}, reason=${check.message}`)
			if (this.onInvalidPlacement) {
				this.onInvalidPlacement(check.message)
			}
			return false
		}

		// 特殊处理：放置狐狸时要清除其他位置的狐狸
		if (brush === 1) {
			console.log("放置狐狸 | 清除其他位置的狐狸")
		}

		console.log(`绘制成功 | row=${row}, col=${col}, brush=${brush}`)
		
		if (this.onCellPainted) {
			this.onCellPainted(row, col, brush)
		}

		return true
	}

	/**
	 * 处理点击事件
	 */
	handleClick(cellPos: CellPos | null): boolean {
		if (!cellPos) return false
		return this.paintAt(cellPos.row, cellPos.col)
	}

	// ========== 画笔列表 ==========

	/**
	 * 获取可用的画笔列表（带当前层过滤）
	 */
	getAvailableBrushes(forLayer?: number): { id: number; name: string; emoji: string; allowed: boolean }[] {
		return this.elements.map(elem => {
			let allowed = true
			if (forLayer !== undefined) {
				const layerAllowed = this.config.allowedElements[forLayer] ?? []
				allowed = layerAllowed.includes(elem.id)
			}
			return {
				id: elem.id,
				name: elem.name,
				emoji: elem.emoji,
				allowed,
			}
		})
	}

	// ========== 配置获取 ==========

	getConfig(): EditorConfig {
		return { ...this.config }
	}

	isEnabled(): boolean {
		return this.config.enabled
	}
}
