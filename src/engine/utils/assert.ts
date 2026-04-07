// ========== 通用断言工具 ==========

export type AssertLevel = "silent" | "error-only" | "verbose"

/** 日志回调函数类型 */
export type AssertLogHandler = (tag: string, message: string, context?: Record<string, unknown>) => void

class AssertConfig {
	static level: AssertLevel = "silent"
	static stopOnFail: boolean = false
	static logHandler: AssertLogHandler | null = null

	static setLevel(level: AssertLevel) {
		this.level = level
	}

	static setStopOnFail(stop: boolean) {
		this.stopOnFail = stop
	}

	static setLogHandler(handler: AssertLogHandler | null) {
		this.logHandler = handler
	}
}

export function setAssertLevel(level: AssertLevel) {
	AssertConfig.setLevel(level)
}

export function setAssertStopOnFail(stop: boolean) {
	AssertConfig.setStopOnFail(stop)
}

export function setAssertLogHandler(handler: AssertLogHandler | null) {
	AssertConfig.setLogHandler(handler)
}

/** 内部日志输出（已禁用） */
function logAssert(_tag: string, _status: string, _message: string, _context?: Record<string, unknown>) {
	// 日志输出已禁用
}

/** 基础断言 */
export function assert(
	condition: boolean,
	message: string,
	_context?: Record<string, unknown>
): boolean {
	const passed = condition

	if (!passed && AssertConfig.stopOnFail) {
		throw new Error(`[ASSERT FAILED] ${message}`)
	}

	return passed
}

/** 验证数值相等 */
export function assertEq<T>(
	actual: T,
	expected: T,
	message: string,
	context?: Record<string, unknown>
): boolean {
	const passed = actual === expected
	const fullContext = {
		...context,
		actual,
		expected,
		diff: passed ? null : `${actual} !== ${expected}`
	}

	// verbose 模式下始终输出
	if (AssertConfig.level === "verbose") {
		const status = passed ? "PASS" : "FAIL"
		logAssert("ASSERT", status, `${message} (expected: ${expected}, actual: ${actual})`, fullContext)
	}
	// error-only 模式下只输出失败
	else if (AssertConfig.level === "error-only" && !passed) {
		logAssert("ASSERT", "FAIL", `${message} (expected: ${expected}, actual: ${actual})`, fullContext)
	}

	return assert(passed, `${message} (expected: ${expected}, actual: ${actual})`, fullContext)
}

/** 验证数值在范围内 [min, max] */
export function assertInRange(
	value: number,
	min: number,
	max: number,
	message: string,
	context?: Record<string, unknown>
): boolean {
	const passed = value >= min && value <= max
	return assert(passed, `${message} (value: ${value}, range: [${min}, ${max}])`, {
		...context,
		value,
		min,
		max
	})
}

/** 验证对象非 null/undefined */
export function assertExists<T>(
	value: T | null | undefined,
	name: string,
	context?: Record<string, unknown>
): value is T {
	const passed = value !== null && value !== undefined
	return assert(passed, `${name} must exist`, context)
}

/** 验证数组长度 */
export function assertLength(
	arr: unknown[],
	expectedLength: number,
	name: string,
	context?: Record<string, unknown>
): boolean {
	const passed = arr.length === expectedLength
	return assert(passed, `${name} length should be ${expectedLength}, got ${arr.length}`, {
		...context,
		actualLength: arr.length,
		expectedLength
	})
}

/** 批量验证 */
export function assertBatch(name: string, assertions: (() => boolean)[]): boolean {
	let allPassed = true
	for (const fn of assertions) {
		if (!fn()) allPassed = false
	}
	return allPassed
}
