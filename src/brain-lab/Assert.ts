// ========== 断言系统 - 用于验证游戏各环节符合预期 ==========

export type AssertLevel = 'silent' | 'error-only' | 'verbose'

class AssertConfig {
	static level: AssertLevel = 'verbose'  // 'silent' | 'error-only' | 'verbose'
	static stopOnFail: boolean = true      // 断言失败时是否停止
	
	static setLevel(level: AssertLevel) {
		this.level = level
	}
	
	static setStopOnFail(stop: boolean) {
		this.stopOnFail = stop
	}
}

export function setAssertLevel(level: AssertLevel) {
	AssertConfig.setLevel(level)
}

export function setAssertStopOnFail(stop: boolean) {
	AssertConfig.setStopOnFail(stop)
}

// 断言函数
export function assert(
	condition: boolean,
	message: string,
	context?: Record<string, any>
): boolean {
	const passed = condition
	
	if (passed) {
		if (AssertConfig.level === 'verbose') {
			console.log(`[ASSERT] ✅ PASS: ${message}`)
			if (context) {
				console.log(`[ASSERT]    Context:`, context)
			}
		}
	} else {
		// 失败时总是输出
		console.error(`[ASSERT] ❌ FAIL: ${message}`)
		if (context) {
			console.error(`[ASSERT]    Context:`, context)
		}
		
		if (AssertConfig.stopOnFail) {
			throw new Error(`[ASSERT FAILED] ${message}`)
		}
	}
	
	return passed
}

// 验证数值相等
export function assertEq(
	actual: any,
	expected: any,
	message: string,
	context?: Record<string, any>
): boolean {
	const passed = actual === expected
	const fullContext = {
		...context,
		actual,
		expected,
		diff: passed ? null : `${actual} !== ${expected}`
	}
	
	return assert(passed, `${message} (expected: ${expected}, actual: ${actual})`, fullContext)
}

// 验证数值在范围内
export function assertInRange(
	value: number,
	min: number,
	max: number,
	message: string,
	context?: Record<string, any>
): boolean {
	const passed = value >= min && value <= max
	return assert(passed, `${message} (value: ${value}, range: [${min}, ${max}])`, {
		...context,
		value,
		min,
		max
	})
}

// 验证对象存在
export function assertExists(
	value: any,
	name: string,
	context?: Record<string, any>
): boolean {
	const passed = value !== null && value !== undefined
	return assert(passed, `${name} 必须存在`, context)
}

// 验证数组长度
export function assertLength(
	arr: any[],
	expectedLength: number,
	name: string,
	context?: Record<string, any>
): boolean {
	const passed = arr.length === expectedLength
	return assert(passed, `${name} 长度应为 ${expectedLength}, 实际为 ${arr.length}`, {
		...context,
		actualLength: arr.length,
		expectedLength
	})
}

// 验证位置是否在有效范围内
export function assertValidPosition(
	x: number,
	y: number,
	width: number,
	height: number,
	name: string = 'Position'
): boolean {
	const validX = x >= 0 && x < width
	const validY = y >= 0 && y < height
	
	return assert(validX && validY, `${name} (${x},${y}) 应在地图范围 [0-${width-1}, 0-${height-1}] 内`, {
		x, y, width, height,
		validX, validY
	})
}

// 验证相机位置是否合理
export function assertValidCamera(
	cameraX: number,
	cameraY: number,
	worldWidth: number,
	worldHeight: number,
	viewportWidth: number,
	viewportHeight: number
): boolean {
	const maxCameraX = Math.max(0, worldWidth - viewportWidth)
	const maxCameraY = Math.max(0, worldHeight - viewportHeight)
	
	const validX = cameraX >= 0 && cameraX <= maxCameraX
	const validY = cameraY >= 0 && cameraY <= maxCameraY
	
	return assert(validX && validY, 
		`相机位置 (${cameraX.toFixed(1)}, ${cameraY.toFixed(1)}) 应在有效范围 [0-${maxCameraX.toFixed(1)}, 0-${maxCameraY.toFixed(1)}] 内`,
		{ cameraX, cameraY, worldWidth, worldHeight, viewportWidth, viewportHeight, maxCameraX, maxCameraY }
	)
}

// 验证英雄在视口内可见
export function assertHeroInViewport(
	heroX: number,
	heroY: number,
	cameraX: number,
	cameraY: number,
	viewportWidth: number,
	viewportHeight: number,
	cellSize: number,
	gap: number
): boolean {
	const heroPixelX = heroX * (cellSize + gap)
	const heroPixelY = heroY * (cellSize + gap)
	
	const visibleX = heroPixelX >= cameraX && heroPixelX <= cameraX + viewportWidth - cellSize
	const visibleY = heroPixelY >= cameraY && heroPixelY <= cameraY + viewportHeight - cellSize
	
	return assert(visibleX && visibleY,
		`英雄应在视口内可见`,
		{ heroX, heroY, heroPixelX, heroPixelY, cameraX, cameraY, viewportWidth, viewportHeight, visibleX, visibleY }
	)
}

// 验证坐标转换正确
export function assertCoordinateConversion(
	logicX: number,
	logicY: number,
	gridHeight: number,
	expectedDisplayY: number
): boolean {
	const actualDisplayY = gridHeight - 1 - logicY
	return assertEq(actualDisplayY, expectedDisplayY, 
		`坐标转换: 逻辑(${logicX},${logicY}) -> 显示Y应为 ${expectedDisplayY}`,
		{ logicX, logicY, gridHeight, actualDisplayY, expectedDisplayY }
	)
}

// 批量验证
export function assertBatch(name: string, assertions: (() => boolean)[]): boolean {
	console.log(`[ASSERT] ====== ${name} ======`)
	let allPassed = true
	for (const fn of assertions) {
		if (!fn()) allPassed = false
	}
	console.log(`[ASSERT] ${name}: ${allPassed ? '✅ 全部通过' : '❌ 有失败'}`)
	return allPassed
}
