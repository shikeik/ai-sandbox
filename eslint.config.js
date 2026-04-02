import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
	js.configs.recommended,
	{
		name: 'app-files',
		files: ['**/*.js', '**/*.mjs', '**/*.ts'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parser: tsParser,
			globals: {
				// 浏览器全局变量
				document: 'readonly',
				window: 'readonly',
				console: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				localStorage: 'readonly',
				screen: 'readonly',
				navigator: 'readonly',
				location: 'readonly',
				history: 'readonly',
				fetch: 'readonly',
				XMLHttpRequest: 'readonly',
				WebSocket: 'readonly',
				EventSource: 'readonly',
				
				// DOM 类型
				HTMLElement: 'readonly',
				HTMLButtonElement: 'readonly',
				HTMLDivElement: 'readonly',
				HTMLInputElement: 'readonly',
				HTMLCanvasElement: 'readonly',
				Event: 'readonly',
				MouseEvent: 'readonly',
				KeyboardEvent: 'readonly',
				TouchEvent: 'readonly',
				Touch: 'readonly',
				FocusEvent: 'readonly',
				EventTarget: 'readonly',
				AddEventListenerOptions: 'readonly',
				Node: 'readonly',
				
				// BOM 类型
				Blob: 'readonly',
				URL: 'readonly',
				
				// 动画/定时器
				requestAnimationFrame: 'readonly',
				cancelAnimationFrame: 'readonly',
				
				// CSS/DOM
				getComputedStyle: 'readonly',
				matchMedia: 'readonly',
				ResizeObserver: 'readonly',
				
				// Canvas
				CanvasRenderingContext2D: 'readonly',
				ImageData: 'readonly',
				ImageBitmap: 'readonly',
				Path2D: 'readonly',
				TextMetrics: 'readonly',
				
				// 媒体
				Image: 'readonly',
				Audio: 'readonly',
				Video: 'readonly',
				
				// 存储
				indexedDB: 'readonly',
				
				// 网络
				WebSocket: 'readonly',
				
				// Workers
				Worker: 'readonly',
				
				// 其他
				performance: 'readonly',
				sessionStorage: 'readonly',
				localStorage: 'readonly',
				crypto: 'readonly',
				Notification: 'readonly',
				
				// 动画
				Animation: 'readonly',
				AnimationEffect: 'readonly',
				KeyframeEffect: 'readonly',
				Keyframe: 'readonly',
				KeyframeAnimationOptions: 'readonly',
				
				// 导入/导出
				import: 'readonly',
				export: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			// 强制不使用分号
			'semi': ['error', 'never'],

			// 强制使用双引号
			'quotes': ['error', 'double'],

			// 禁止使用 var
			'no-var': 'error',

			// 强制使用 const/let
			'prefer-const': 'error',

			// 允许 console（游戏需要大量日志输出）
			'no-console': 'off',

			// 未使用变量降级为警告
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', {
				'argsIgnorePattern': '^_',
				'varsIgnorePattern': '^_',
				'caughtErrorsIgnorePattern': '^_',
			}],
			
			// 允许 any
			'@typescript-eslint/no-explicit-any': 'off',
			
			// 关闭无用赋值检查（容易产生误报）
			'no-useless-assignment': 'off',
		},
	},
]
