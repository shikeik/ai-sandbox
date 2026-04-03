// ========== 测试工具函数（DRY）==========

export function assertEqual(actual: unknown, expected: unknown, message: string): void {
	if (actual !== expected) {
		throw new Error(`❌ ${message}\n   期望: ${expected}\n   实际: ${actual}`)
	}
	console.log(`✅ ${message}`)
}

export function assertTrue(value: boolean, message: string): void {
	if (!value) {
		throw new Error(`❌ ${message}`)
	}
	console.log(`✅ ${message}`)
}

export function assertClose(actual: number, expected: number, epsilon: number, message: string): void {
	if (Math.abs(actual - expected) > epsilon) {
		throw new Error(`❌ ${message}\n   期望: ${expected}\n   实际: ${actual}`)
	}
	console.log(`✅ ${message}`)
}

export function assertGreaterThan(actual: number, threshold: number, message: string): void {
	if (!(actual > threshold)) {
		throw new Error(`❌ ${message}\n   期望 > ${threshold}\n   实际: ${actual}`)
	}
	console.log(`✅ ${message}`)
}

export function assertBetween(actual: number, min: number, max: number, message: string): void {
	if (actual < min || actual > max) {
		throw new Error(`❌ ${message}\n   期望范围: ${min} ~ ${max}\n   实际: ${actual}`)
	}
	console.log(`✅ ${message}`)
}

// 测试套件运行器
export function describe(name: string, fn: () => void): void {
	console.log(`\n--- ${name} ---`)
	fn()
}

export function it(name: string, fn: () => void): void {
	try {
		fn()
	} catch (e) {
		console.error(`❌ ${name}`)
		throw e
	}
}

// 测试套件标题
export function printTestSuite(name: string): void {
	console.log(`\n========== ${name} ==========\n`)
}

// 测试完成提示
export function printTestComplete(): void {
	console.log("\n========== 所有测试通过! ==========\n")
}
