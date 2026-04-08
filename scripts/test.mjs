#!/usr/bin/env node
// 测试脚本包装器
// 使用: npm run test                      (只跑单元测试 test/unit/)
// 使用: npm run test -- terrain-lab/map-generator  (跑单个单元测试文件)
// 使用: npm run test:all                  (跑所有测试: unit + slow)
// 使用: npm run test:slow                 (只跑慢速测试 test/slow/)
// 使用: npm run test:ts                   (跑所有 TS 测试)
// 使用: npm run test:ts -- terrain-lab/debug-generate  (跑单个 TS 测试文件)

import { spawn } from "child_process"
import { readdirSync, statSync } from "fs"
import { join } from "path"

// 简单的递归获取文件函数
function getFiles(dir, pattern) {
	const files = []
	const items = readdirSync(dir)
	
	for (const item of items) {
		const fullPath = join(dir, item)
		const stat = statSync(fullPath)
		
		if (stat.isDirectory()) {
			files.push(...getFiles(fullPath, pattern))
		} else if (pattern.test(fullPath)) {
			files.push(fullPath)
		}
	}
	
	return files
}

const args = process.argv.slice(2)
const command = process.env.TEST_COMMAND || "test"

let testArgs = []

if (command === "test:all") {
	// 跑所有测试 (unit + slow)
	testArgs = [
		...getFiles("test/unit", /\.test\.ts$/),
		...getFiles("test/slow", /\.test\.ts$/)
	]
} else if (command === "test:slow") {
	// 只跑慢速测试
	testArgs = getFiles("test/slow", /\.test\.ts$/)
} else if (command === "test:ts") {
	// 跑 TS 测试
	const tsFile = args[0]
	if (tsFile) {
		// 单个文件
		testArgs = [`test/ts/${tsFile}.ts`]
	} else {
		// 所有 TS 测试
		testArgs = getFiles("test/ts", /\.ts$/)
	}
	// TS 测试用 node 直接运行，不是 --test 模式
	const child = spawn("npx", ["tsx", ...testArgs], { stdio: "inherit" })
	child.on("exit", (code) => process.exit(code ?? 0))
	process.exit(0)
} else if (command === "test:dir") {
	// 跑指定目录下的单元测试
	const dirName = args[0]
	if (!dirName) {
		console.error("错误: 请指定目录名，如: npm run test:dir terrain-lab")
		process.exit(1)
	}
	testArgs = getFiles(`test/unit/${dirName}`, /\.test\.ts$/)
} else {
	// 默认: 只跑单元测试 (test/unit/)
	const testFile = args[0]
	if (testFile) {
		// 单个文件
		testArgs = [`test/unit/${testFile}.test.ts`]
	} else {
		// 所有单元测试
		testArgs = getFiles("test/unit", /\.test\.ts$/)
	}
}

if (testArgs.length === 0) {
	console.log("没有找到测试文件")
	process.exit(0)
}

console.log(`运行测试: ${testArgs.join(" ")}`)

const child = spawn("npx", ["tsx", "--test", ...testArgs], {
	stdio: "inherit",
})

child.on("exit", (code) => {
	process.exit(code ?? 0)
})
