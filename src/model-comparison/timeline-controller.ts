// ========== 时间轴播放控制器 ==========
// 职责：管理模型对比页面的时间轴播放控制
// 新增组件：与 Metrics Dashboard 的下拉选择器不同

/** 时间轴状态 */
export interface TimelineState {
	/** 当前步数索引 */
	currentIndex: number
	/** 总步数 */
	totalSteps: number
	/** 是否播放中 */
	isPlaying: boolean
	/** 播放速度（ms/帧） */
	playSpeed: number
}

/** 时间轴变更监听器 */
type TimelineListener = (state: TimelineState) => void

/** 时间轴播放控制器 */
export class TimelineController {
	private state: TimelineState
	private listeners: TimelineListener[] = []
	private playTimer: number | null = null

	/**
	 * 创建时间轴控制器
	 * @param totalSteps 总步数
	 */
	constructor(totalSteps: number) {
		this.state = {
			currentIndex: 0,
			totalSteps,
			isPlaying: false,
			playSpeed: 200, // 默认 200ms/帧
		}
	}

	/**
	 * 获取当前状态
	 */
	getState(): TimelineState {
		return { ...this.state }
	}

	/**
	 * 设置总步数（当数据更新时）
	 * @param totalSteps 新的总步数
	 */
	setTotalSteps(totalSteps: number): void {
		this.state.totalSteps = totalSteps
		// 确保当前索引不越界
		if (this.state.currentIndex >= totalSteps) {
			this.state.currentIndex = Math.max(0, totalSteps - 1)
		}
		this.notifyListeners()
	}

	/**
	 * 跳转到指定索引
	 * @param index 目标索引
	 */
	goTo(index: number): void {
		if (index < 0 || index >= this.state.totalSteps) return
		this.state.currentIndex = index
		this.notifyListeners()
	}

	/**
	 * 跳转到第一帧
	 */
	goToFirst(): void {
		this.goTo(0)
	}

	/**
	 * 跳转到最后一帧
	 */
	goToLast(): void {
		this.goTo(this.state.totalSteps - 1)
	}

	/**
	 * 上一帧
	 */
	goToPrevious(): void {
		if (this.state.currentIndex > 0) {
			this.goTo(this.state.currentIndex - 1)
		}
	}

	/**
	 * 下一帧
	 */
	goToNext(): void {
		if (this.state.currentIndex < this.state.totalSteps - 1) {
			this.goTo(this.state.currentIndex + 1)
		}
	}

	/**
	 * 复位到初始状态
	 */
	reset(): void {
		this.pause()
		this.state.currentIndex = 0
		this.notifyListeners()
	}

	/**
	 * 开始播放
	 */
	play(): void {
		if (this.state.isPlaying) return
		this.state.isPlaying = true
		this.notifyListeners()

		// 如果已经在末尾，从头开始
		if (this.state.currentIndex >= this.state.totalSteps - 1) {
			this.state.currentIndex = 0
		}

		this.startPlayLoop()
	}

	/**
	 * 暂停播放
	 */
	pause(): void {
		if (!this.state.isPlaying) return
		this.state.isPlaying = false
		this.stopPlayLoop()
		this.notifyListeners()
	}

	/**
	 * 切换播放/暂停
	 */
	togglePlay(): void {
		if (this.state.isPlaying) {
			this.pause()
		} else {
			this.play()
		}
	}

	/**
	 * 设置播放速度
	 * @param speedMs 每帧间隔（毫秒）
	 */
	setSpeed(speedMs: number): void {
		this.state.playSpeed = speedMs
		// 如果正在播放，重新启动定时器以应用新速度
		if (this.state.isPlaying) {
			this.stopPlayLoop()
			this.startPlayLoop()
		}
	}

	/**
	 * 订阅状态变更
	 * @param listener 监听器
	 * @returns 取消订阅函数
	 */
	subscribe(listener: TimelineListener): () => void {
		this.listeners.push(listener)
		return () => {
			const index = this.listeners.indexOf(listener)
			if (index !== -1) {
				this.listeners.splice(index, 1)
			}
		}
	}

	/**
	 * 清理资源
	 */
	destroy(): void {
		this.stopPlayLoop()
		this.listeners = []
	}

	/**
	 * 启动播放循环
	 */
	private startPlayLoop(): void {
		this.playTimer = window.setInterval(() => {
			if (this.state.currentIndex < this.state.totalSteps - 1) {
				this.state.currentIndex++
				this.notifyListeners()
			} else {
				// 到达末尾，停止播放
				this.pause()
			}
		}, this.state.playSpeed)
	}

	/**
	 * 停止播放循环
	 */
	private stopPlayLoop(): void {
		if (this.playTimer !== null) {
			clearInterval(this.playTimer)
			this.playTimer = null
		}
	}

	/**
	 * 通知所有监听器
	 */
	private notifyListeners(): void {
		const state = this.getState()
		for (const listener of this.listeners) {
			try {
				listener(state)
			} catch {
				// 忽略监听器错误
			}
		}
	}
}
