import * as readline from "node:readline"

// ========== 控制台输入处理 ==========

export function askQuestion(query: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	return new Promise((resolve) => {
		rl.question(query, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}
