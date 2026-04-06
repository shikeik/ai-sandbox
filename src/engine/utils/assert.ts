// ========== 通用断言工具 ==========

export type AssertLevel = "silent" | "error-only" | "verbose"

class AssertConfig {
	static level: AssertLevel = "silent"
	static stopOnFail: boolean = false

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

/** 基础断言 */
export function assert(
	condition: boolean,
	message: string,
	context?: Record<string, any>
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

/** 验证数值在范围内 [min, max] */
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

/** 验证对象非 null/undefined */
export function assertExists<T>(
	value: T | null | undefined,
	name: string,
	context?: Record<string, any>
): value is T {
	const passed = value !== null && value !== undefined
	return assert(passed, `${name} must exist`, context)
}

/** 验证数组长度 */
export function assertLength(
	arr: any[],
	expectedLength: number,
	name: string,
	context?: Record<string, any>
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
