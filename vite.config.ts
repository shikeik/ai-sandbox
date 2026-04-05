import { resolve } from 'path'

export default {
	server: {
		host: '0.0.0.0',
		port: 4000
	},
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
		rollupOptions: {
			input: {
				index: resolve(__dirname, 'index.html'),
				'fox-jump': resolve(__dirname, 'pages/fox-jump.html'),
				'terrain-lab': resolve(__dirname, 'pages/terrain-lab.html'),
				'mlp-teaching': resolve(__dirname, 'pages/mlp-teaching.html'),
				'metrics-dashboard': resolve(__dirname, 'pages/metrics-dashboard.html'),
				'model-comparison': resolve(__dirname, 'pages/model-comparison.html')
			}
		}
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
			'@engine': resolve(__dirname, 'src/engine'),
			'@fox-jump': resolve(__dirname, 'src/fox-jump'),
			'@game': resolve(__dirname, 'src/fox-jump/game'),
			'@render': resolve(__dirname, 'src/fox-jump/render'),
			'@ai': resolve(__dirname, 'src/fox-jump/ai'),
			'@views': resolve(__dirname, 'src/fox-jump/views'),
			'@utils': resolve(__dirname, 'src/fox-jump/utils'),
			'@managers': resolve(__dirname, 'src/fox-jump/managers')
		},
		extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
	},
	esbuild: {
		loader: 'ts',
		include: [
			'src/**/*.ts',
			'src/**/*.js'
		]
	},
	// 支持 .js 扩展名导入 TS 文件
	optimizeDeps: {
		esbuildOptions: {
			resolveExtensions: ['.ts', '.js']
		}
	}
}
