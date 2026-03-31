#!/usr/bin/env node
/**
 * 标准方案：将 Vite 构建结果合并为单文件 HTML
 * 使用 Node.js 原生 fs 模块，无需额外依赖
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

// 1. 先执行标准 Vite 构建
console.log('🔨 执行 Vite 构建...')
import('child_process').then(({ execSync }) => {
	execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  
	// 2. 读取生成的文件
	console.log('\n📦 合并为单文件...')
  
	const htmlPath = path.join(distDir, 'index.html')
	let html = fs.readFileSync(htmlPath, 'utf-8')
  
	// 3. 内联 CSS
	const cssRegex = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g
	let match
	while ((match = cssRegex.exec(html)) !== null) {
		const cssRelPath = match[1]
		const cssFullPath = path.join(distDir, cssRelPath)
		if (fs.existsSync(cssFullPath)) {
			const cssContent = fs.readFileSync(cssFullPath, 'utf-8')
			html = html.replace(match[0], `<style>${cssContent}</style>`)
			console.log(`  ✓ 内联 CSS: ${cssRelPath}`)
		}
	}
  
	// 4. 内联 JS
	const jsRegex = /<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g
	while ((match = jsRegex.exec(html)) !== null) {
		const jsRelPath = match[1]
		const jsFullPath = path.join(distDir, jsRelPath)
		if (fs.existsSync(jsFullPath)) {
			const jsContent = fs.readFileSync(jsFullPath, 'utf-8')
			html = html.replace(match[0], `<script type="module">${jsContent}</script>`)
			console.log(`  ✓ 内联 JS: ${jsRelPath}`)
		}
	}
  
	// 5. 移除 preload 标签
	html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>\n?/g, '')
  
	// 6. 写入 game.html
	const outputPath = path.join(distDir, 'game.html')
	fs.writeFileSync(outputPath, html)
  
	const size = (fs.statSync(outputPath).size / 1024).toFixed(2)
	console.log(`\n✅ 单文件已生成: dist/game.html (${size} KB)`)
	console.log('🎮 直接双击打开即可游玩，无需服务器！')
})
