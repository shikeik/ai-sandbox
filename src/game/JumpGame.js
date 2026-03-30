/**
 * 跳跃游戏核心逻辑
 * 
 * 【游戏机制】
 * - 32格横版世界，地面有平地(可站)和坑(掉落死亡)
 * - 玩家只能：右移(x+1) 或 跳跃(x+2，抛物线)
 * - 跳跃落点坑上 → 死亡
 * - 移动中踩坑 → 死亡
 * - 到达终点(x30) → 胜利
 * 
 * 【使用方式】
 * const game = new JumpGame()
 * game.init()                    // 初始化世界
 * game.execute('right')          // 执行动作（立即完成逻辑）
 * game.execute('jump')
 * 
 * 【获取AI输入】
 * game.getStateForAI() -> { playerGrid, terrainAhead[], isMoving }
 */

import { formatTime as formatTimeUtil } from '@utils/timeUtils.js'

// ========== 游戏常量 ==========
// 所有尺寸使用"单位"(unit)，1 unit = 1格 = GRID_SIZE 像素
export const CONFIG = {
	WORLD_LENGTH: 32,       // 世界总格子数
	
	// 视野配置（单位）
	VIEWPORT_GRID_W: 6,     // 视野宽度（单位）
	VIEWPORT_GRID_H: 4,     // 视野高度（单位）
	
	// 运行时动态计算的像素值
	GRID_SIZE: 100,         // 1 unit = ? 像素（正方形）
	
	// 游戏元素尺寸（单位）
	GROUND_HEIGHT: 0.8,     // 地面高度（单位）
	PLAYER_SIZE: 0.45,      // 玩家大小（单位）- 稍微小一点，留出视觉空间
	GOAL_SIZE: 0.8,         // 终点旗子大小（单位）- 比之前大一点
	JUMP_HEIGHT: 1.0,       // 跳跃高度（单位）
	// 坐标系说明：玩家位置(x,y)是左下角坐标（对应CSS left/bottom）
	// 第0格范围：[0, 1] unit，中心在 0.5 unit
	// 玩家居中放置：左边缘 = 格子中心 - 玩家大小/2 = 0.5 - 0.45/2 = 0.275
	PLAYER_START_X: 0.275,  // 玩家初始X位置（单位），使玩家在第0格居中
	
	// 动画
	MOVE_DURATION: 400,     // 移动动画时长(ms)
	JUMP_DURATION: 600,     // 跳跃动画时长(ms)
	CAMERA_OFFSET_RATIO: 0.3, // 玩家在屏幕左侧30%位置
	
	// 辅助函数：单位转像素
	toPx(units) { return Math.floor(units * this.GRID_SIZE) },
	// 辅助函数：像素转单位
	toUnits(px) { return px / this.GRID_SIZE }
}

// 动作类型
export const ACTION = {
	RIGHT: 'right',
	JUMP: 'jump'
}

// ========== 状态分离定义 ==========

// 游戏生命周期状态（控制能否操作、计时、显示）
export const GAME_STATUS = {
	READY: 'ready',           // 准备中，未开始
	RUNNING: 'running',       // 游戏进行中，计时中
	TRANSITIONING: 'transitioning', // 转场中
	FINISHED: 'finished'      // 已结束（死亡或胜利）
}

// 人物动作状态（控制动画表现）
export const PLAYER_ACTION = {
	IDLE: 'idle',             // 待机，可接受操作
	MOVING: 'moving',         // 地面移动中
	JUMPING: 'jumping'        // 跳跃中
}

// 为兼容保留旧的 STATUS 导出
export const STATUS = {
	// 游戏生命周期状态（兼容旧代码）
	READY: GAME_STATUS.READY,
	RUNNING: GAME_STATUS.RUNNING,
	TRANSITIONING: GAME_STATUS.TRANSITIONING,
	// 人物动作状态（兼容旧代码）
	IDLE: PLAYER_ACTION.IDLE,
	MOVING: PLAYER_ACTION.MOVING,
	// 兼容旧代码
	DEAD: 'dead',
	WON: 'won'
}

// 地形类型
export const TERRAIN = {
	GROUND: 'ground',
	PIT: 'pit'
}

/**
 * 游戏核心类
 * 逻辑层：动作立即执行，无等待
 * 视觉层：由渲染器处理补间动画
 */
export class JumpGame {
	constructor() {
	// 世界地形数据
	this.terrain = []
	
	// 游戏生命周期状态（新增）
	this.gameStatus = GAME_STATUS.READY
	
	// 人物状态（修改结构）
	this.player = {
		x: 0,                    // 像素坐标
		y: 0,                    // 像素坐标（离地高度）
		grid: 0,                 // 所在格子
		action: PLAYER_ACTION.IDLE,  // 动作状态（替代旧的status）
		isJump: false,           // 是否是跳跃动作
		direction: 0             // 移动方向
	}
	
	// 相机位置（像素）
	this.camera = { x: 0 }
	
	// 世代计数（死亡/胜利后+1）
	this.generation = 1
	
	// 视口宽度（由外部设置）
	this.viewportWidth = 0
	
	// 事件回调
	this.onStateChange = null    // (player, camera) => void
	this.onActionStart = null    // (action, from, to, isJump) => void
	this.onActionEnd = null      // (result) => void
	this.onDeath = null          // () => void - 延迟到补间完成
	this.onWin = null            // () => void - 延迟到补间完成
	this.onGenerationChange = null // (gen) => void
	
	// 转场相关回调
	this.onTransitionStart = null    // 转场开始
	this.onTransitionEnd = null      // 转场结束
	
	// 视觉状态（等待补间完成）
	this._pendingDeath = false
	this._pendingWin = false
	
	// 输入控制（独立于视觉状态）
	this._inputLocked = false
	
	// 计时器（玩家模式）
	this.startTime = null
	this.currentRunTime = 0
	}

	// ========== 初始化 ==========
	
	init() {
	this._pendingDeath = false
	this._pendingWin = false
	this._inputLocked = true  // 开始时锁定输入（需要点击开始）
	this._generateTerrain()
	this._resetPlayer()
	this._notifyStateChange()
	
	// 游戏状态设为准备中
	this.gameStatus = GAME_STATUS.READY
	this.startTime = null
	this.currentRunTime = 0
	return this
	}
	
	/**
	* 开始计时（玩家模式）
	*/
	startTimer() {
	this.startTime = Date.now()
	}
	
	/**
	* 获取当前用时（毫秒）
	*/
	getElapsedTime() {
	if (!this.startTime) return 0
	return Date.now() - this.startTime
	}
	
	/**
	* 格式化时间为 mm:ss（保持向后兼容）
	* @param {number} ms - 毫秒
	* @returns {string} 格式化后的时间
	*/
	formatTime(ms) {
	return formatTimeUtil(ms)
	}
	
	/**
	* 开始游戏（从 READY 或 TRANSITIONING 状态进入 RUNNING）
	*/
	startGame() {
	if (this.gameStatus === GAME_STATUS.READY || 
		this.gameStatus === GAME_STATUS.TRANSITIONING) {
		this.gameStatus = GAME_STATUS.RUNNING
		this._inputLocked = false
		this.player.action = PLAYER_ACTION.IDLE
		this.startTimer()
	}
	}
	
	/**
	* 设置视口大小，动态计算 1 unit = ? 像素
	* @param {number} width - 视口宽度（像素）
	*/
	setViewportSize(width) {
	// 计算 1 unit = ? 像素
	CONFIG.GRID_SIZE = Math.floor(width / CONFIG.VIEWPORT_GRID_W)
	
	this.viewportWidth = width
	this.viewportHeight = CONFIG.toPx(CONFIG.VIEWPORT_GRID_H)
	
	this._updateCamera()
	}

	// ========== 核心操作 ==========
	
	/**
	* 执行动作（立即完成逻辑）
	* 
	* 【速通核心机制】
	* 逻辑位置立即改变（player.x/grid），不受动画限制。
	* 渲染层通过补间动画平滑过渡视觉位置，支持打断机制。
	* 玩家可在动画期间连续输入，实现"操作多快，角色移动多快"的速通体验。
	* 
	* @param {string} action - 'right' | 'jump'
	* @returns {Object|null} - 动作信息或失败
	*/
	execute(action) {
	// 检查输入锁定
	if (this._inputLocked) return null
	
	// 检查游戏状态
	if (this.gameStatus !== GAME_STATUS.RUNNING) return null
	
	const fromX = this.player.x
	const fromY = this.player.y
	const isJump = action === ACTION.JUMP
	
	// 计算目标位置（像素）
	let targetX
	if (action === ACTION.RIGHT) {
		targetX = fromX + CONFIG.toPx(1)  // 移动 1 unit
	} else if (action === ACTION.JUMP) {
		targetX = fromX + CONFIG.toPx(2)  // 跳跃 2 unit
	} else {
		return null
	}
	
	// 立即执行逻辑
	this.player.x = targetX
	this.player.y = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
	this.player.grid = Math.floor(targetX / CONFIG.GRID_SIZE)
	// 设置人物动作状态（不再影响 gameStatus）
	this.player.action = isJump ? PLAYER_ACTION.JUMPING : PLAYER_ACTION.MOVING
	this.player.isJump = isJump
	this.player.direction = action === ACTION.RIGHT ? 1 : 2  // 移动方向
	
	// 更新相机
	this._updateCamera()
	
	// 通知动作开始（提供补间所需信息）
	if (this.onActionStart) {
		this.onActionStart(action, { x: fromX, y: fromY }, { x: targetX, y: CONFIG.toPx(CONFIG.GROUND_HEIGHT) }, isJump)
	}
	
	this._notifyStateChange()
	
	// 立即检测结果
	this._checkResult(targetX)
	
	return { action, fromX, fromY, targetX, isJump }
	}
	
	/**
	* 通知渲染层动画完成（由渲染器调用）
	*/
	notifyVisualComplete() {
	// 优先处理死亡/胜利
	if (this._pendingDeath) {
		this.triggerDeath()
		return
	}
	if (this._pendingWin) {
		this.triggerWin()
		return
	}
	
	// 正常完成，人物回到待机状态
	if (this.player.action === PLAYER_ACTION.MOVING || 
		this.player.action === PLAYER_ACTION.JUMPING) {
		this.player.action = PLAYER_ACTION.IDLE
		this._notifyStateChange()
		
		if (this.onActionEnd) {
		this.onActionEnd({ success: true, grid: this.player.grid })
		}
	}
	}
	
	getStateForAI() {
	const grid = this.player.grid
	return {
		playerGrid: grid,
		isMoving: this.player.action === PLAYER_ACTION.MOVING || this.player.action === PLAYER_ACTION.JUMPING,
		terrainAhead: [
		this._getTerrainAt(grid + 1),
		this._getTerrainAt(grid + 2),
		this._getTerrainAt(grid + 3)
		]
	}
	}
	
	getState() {
	return {
		player: { ...this.player },
		camera: { ...this.camera },
		terrain: this.terrain,
		generation: this.generation,
		gameStatus: this.gameStatus  // 新增返回游戏状态
	}
	}

	// ========== 结果判定 ==========
	
	_checkResult(finalX) {
	// 检测落点
	if (this._isInPit(finalX)) {
		this.gameStatus = GAME_STATUS.FINISHED  // 游戏结束
		this.player.action = PLAYER_ACTION.IDLE
		this._pendingDeath = true
		this._inputLocked = true  // 锁定输入，等待死亡动画
	} else if (this.player.grid >= CONFIG.WORLD_LENGTH - 1) {
		this.gameStatus = GAME_STATUS.FINISHED  // 游戏结束
		this.player.action = PLAYER_ACTION.IDLE
		this._pendingWin = true
		this._inputLocked = true  // 锁定输入，等待胜利动画
	}
	// 否则等待动画完成，由 notifyVisualComplete 设为 IDLE
	}
	
	/**
	* 触发死亡（由渲染器在补间完成后调用）
	*/
	triggerDeath() {
	if (!this._pendingDeath) return
	this._pendingDeath = false
	
	this.gameStatus = GAME_STATUS.FINISHED  // 明确结束状态
	this._inputLocked = true  // 锁定输入

	if (this.onDeath) this.onDeath()

	// 使用转场而非直接重生
	if (this.onTransitionStart) {
		this.onTransitionStart(() => {
		// 转场中点回调
		this._executeRespawn()
		}, () => {
		// 转场结束回调
		this._onRespawnComplete()
		})
	} else {
		// 兼容：无转场管理器时直接重生
		setTimeout(() => this._nextGeneration(), 1500)
	}
	}

	/**
	* 触发胜利（由渲染器在补间完成后调用）
	*/
	triggerWin() {
	if (!this._pendingWin) return
	this._pendingWin = false
	
	this.gameStatus = GAME_STATUS.FINISHED  // 明确结束状态
	this._inputLocked = true  // 锁定输入

	if (this.onWin) this.onWin()

	if (this.onTransitionStart) {
		this.onTransitionStart(() => {
		this._executeRespawn()
		}, () => {
		this._onRespawnComplete()
		})
	} else {
		setTimeout(() => this._nextGeneration(), 1500)
	}
	}

	// 执行重生（在暗屏时调用）
	_executeRespawn() {
	this.generation++
	this.init()
	// init() 会将 gameStatus 设为 READY，但我们需要 TRANSITIONING
	this.gameStatus = GAME_STATUS.TRANSITIONING
	
	// 在暗屏时就让渲染器更新世界，这样渐亮时显示的是新世界
	if (this.onGenerationChange) {
		this.onGenerationChange(this.generation)
	}
	}

	// 转场完成后的处理
	_onRespawnComplete() {
	// 玩家模式：直接开始新一局
	// AI 模式：自动开始
	if (this.onTransitionEnd) {
		this.onTransitionEnd()
	}
	}

	_nextGeneration() {
	this.generation++
	this.init()
	if (this.onGenerationChange) {
		this.onGenerationChange(this.generation)
	}
	}

	// ========== 地形生成 ==========
	
	_generateTerrain() {
	this.terrain = []
	let currentGrid = 0
	let lastWasPit = false
	
	this._addGround(0, 2)
	currentGrid = 2
	
	while (currentGrid < CONFIG.WORLD_LENGTH - 2) {
		if (lastWasPit) {
		const len = 1 + Math.floor(Math.random() * 2)
		this._addGround(currentGrid, len)
		currentGrid += len
		lastWasPit = false
		} else {
		if (Math.random() < 0.6) {
			const len = 1 + Math.floor(Math.random() * 2)
			this._addGround(currentGrid, len)
			currentGrid += len
			lastWasPit = false
		} else {
			this._addPit(currentGrid)
			currentGrid += 1
			lastWasPit = true
		}
		}
	}
	
	this._addGround(currentGrid, 2)
	}
	
	_addGround(startGrid, length) {
	this.terrain.push({
		type: TERRAIN.GROUND,
		start: CONFIG.toPx(startGrid),
		end: CONFIG.toPx(startGrid + length)
	})
	}
	
	_addPit(grid) {
	this.terrain.push({
		type: TERRAIN.PIT,
		start: CONFIG.toPx(grid),
		end: CONFIG.toPx(grid + 1)
	})
	}

	// ========== 碰撞检测 ==========
	
	_isInPit(x) {
	return this.terrain.some(t => 
		t.type === TERRAIN.PIT && x >= t.start && x < t.end
	)
	}
	
	_getTerrainAt(grid) {
	const x = CONFIG.toPx(grid) + CONFIG.toPx(0.5)  // 格子中心
	if (this._isInPit(x)) return TERRAIN.PIT
	return TERRAIN.GROUND
	}

	// ========== 玩家与相机 ==========
	
	_resetPlayer() {
	// 玩家初始位置：第0格 + 偏移量，使其居中
	this.player.x = CONFIG.toPx(CONFIG.PLAYER_START_X)
	this.player.y = CONFIG.toPx(CONFIG.GROUND_HEIGHT)
	this.player.grid = 0
	this.player.action = PLAYER_ACTION.IDLE
	this.player.isJump = false
	this.player.direction = 0
	this._updateCamera()
	}
	
	_updateCamera(playerX = this.player.x) {
	if (this.viewportWidth <= 0) return
	const targetX = playerX - this.viewportWidth * CONFIG.CAMERA_OFFSET_RATIO
	const maxX = CONFIG.toPx(CONFIG.WORLD_LENGTH) - this.viewportWidth
	this.camera.x = Math.max(0, Math.min(targetX, maxX))
	}

	// ========== 事件通知 ==========
	
	_notifyStateChange() {
	if (this.onStateChange) {
		this.onStateChange({ ...this.player }, { ...this.camera })
	}
	}
}

export default JumpGame
