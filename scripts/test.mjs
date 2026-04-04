#!/usr/bin/env node
// 测试脚本包装器
// 使用: npm test                          (跑快速测试，不包括 slow-tests)
// 使用: npm run test:all                  (跑所有测试)
// 使用: npm test -- terrain-lab/map-generator  (跑单个文件，自动补全路径)
// 使用: npm run test:dir terrain-lab      (跑整个目录下的测试)

import { spawn } from "child_process"

const args = process.argv.slice(2)
const command = process.env.TEST_COMMAND || "test"

let testArgs = []

if (command === "test:all") {
	// 跑所有测试
	testArgs = ["src/**/*.test.ts"]
} else if (command === "test:dir") {
	// 跑指定目录下的所有测试（不包括 slow-tests 子目录）
	const dirName = args[0]
	if (!dirName) {
		console.error("错误: 请指定目录名，如: npm run test:dir terrain-lab")
		process.exit(1)
	}
	testArgs = [`src/${dirName}/*.test.ts`]
} else {
	// 默认: 跑快速测试（不包括 slow-tests）
	const testFile = args[0]
	if (testFile) {
		// 单个文件，自动补全路径
		testArgs = [`src/${testFile}.test.ts`]
	} else {
		// 跑所有非 slow-tests 的测试：指定 src 目录，但排除 slow-tests 子目录
		// 由于 Node.js glob 不支持排除模式，我们显式指定要跑的目录
		testArgs = ["src/terrain-lab/*.test.ts"]
	}
}

console.log(`运行测试: ${testArgs.join(" ")}`)

const child = spawn("npx", ["tsx", "--test", ...testArgs], {
	stdio: "inherit",
})

child.on("exit", (code) => {
	process.exit(code ?? 0)
})
