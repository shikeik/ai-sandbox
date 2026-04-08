#!/usr/bin/env node
/**
 * 将 Vite 构建产物中的全部 HTML 页面合并为单文件 HTML
 * 使用 Node.js 原生 fs 模块，无需额外依赖
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const distDir = path.join(rootDir, "dist")

/**
 * 递归查找目录下所有 HTML 文件
 */
function findHtmlFiles(dir, files = []) {
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			findHtmlFiles(fullPath, files)
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			files.push(fullPath)
		}
	}
	return files
}

/**
 * 解析资源引用路径为磁盘绝对路径
 */
function resolveAssetPath(distDir, htmlDir, href) {
	if (href.startsWith("/")) {
		return path.join(distDir, href.slice(1))
	}
	return path.resolve(htmlDir, href)
}

/**
 * 处理单个 HTML 文件：内联 CSS/JS，移除 modulepreload
 */
function inlineHtml(htmlPath) {
	const htmlDir = path.dirname(htmlPath)
	let html = fs.readFileSync(htmlPath, "utf-8")

	// 内联 CSS
	const cssRegex = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g
	let match
	while ((match = cssRegex.exec(html)) !== null) {
		const href = match[1]
		const fullPath = resolveAssetPath(distDir, htmlDir, href)
		if (fs.existsSync(fullPath)) {
			const cssContent = fs.readFileSync(fullPath, "utf-8")
			html = html.replace(match[0], `<style>${cssContent}</style>`)
			console.log(`    ✓ 内联 CSS: ${href}`)
		} else {
			console.log(`    ⚠ CSS 未找到: ${href}`)
		}
	}

	// 内联 JS（type="module"）
	const jsRegex = /<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g
	while ((match = jsRegex.exec(html)) !== null) {
		const src = match[1]
		const fullPath = resolveAssetPath(distDir, htmlDir, src)
		if (fs.existsSync(fullPath)) {
			const jsContent = fs.readFileSync(fullPath, "utf-8")
			html = html.replace(match[0], `<script type="module">${jsContent}</script>`)
			console.log(`    ✓ 内联 JS: ${src}`)
		} else {
			console.log(`    ⚠ JS 未找到: ${src}`)
		}
	}

	// 移除 modulepreload
	const preloadCount = (html.match(/<link[^>]+rel="modulepreload"[^>]*>/g) || []).length
	if (preloadCount > 0) {
		html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>\n?/g, "")
		console.log(`    ✓ 移除 ${preloadCount} 个 modulepreload`)
	}

	return html
}

// 1. 先执行标准 Vite 构建
console.log("🔨 执行 Vite 构建...")
import("child_process").then(({ execSync }) => {
	execSync("npm run build", { cwd: rootDir, stdio: "inherit" })

	// 2. 查找所有 HTML 文件
	const htmlFiles = findHtmlFiles(distDir)
	console.log(`\n📦 发现 ${htmlFiles.length} 个 HTML 文件，开始合并...`)

	for (const htmlPath of htmlFiles) {
		const relPath = path.relative(distDir, htmlPath)
		console.log(`\n  📝 处理: ${relPath}`)

		const inlined = inlineHtml(htmlPath)

		// 输出到 dist 根目录（去掉 pages/ 前缀）
		const outputName = relPath.replace(/pages[/]/g, "")
		const outputPath = path.join(distDir, outputName)
		fs.mkdirSync(path.dirname(outputPath), { recursive: true })
		fs.writeFileSync(outputPath, inlined)

		const size = (fs.statSync(outputPath).size / 1024).toFixed(2)
		console.log(`    ✅ 输出: ${path.relative(distDir, outputPath)} (${size} KB)`)

		// 3. fox-jump 额外输出一份 game.html 保持向后兼容
		if (outputName === "fox-jump.html") {
			const gamePath = path.join(distDir, "game.html")
			fs.writeFileSync(gamePath, inlined)
			const gameSize = (fs.statSync(gamePath).size / 1024).toFixed(2)
			console.log(`    ✅ 兼容输出: game.html (${gameSize} KB)`)
		}
	}

	console.log("\n🎮 所有单文件已生成，直接双击打开即可游玩，无需服务器！")
})
