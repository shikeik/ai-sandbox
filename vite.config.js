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
				'vector-params': resolve(__dirname, 'pages/vector-params.html'),
				'mlp-teaching': resolve(__dirname, 'pages/mlp-teaching.html')
			}
		}
	},
	resolve: {
		alias: {
			'@game': resolve(__dirname, 'src/game'),
			'@render': resolve(__dirname, 'src/render'),
			'@ai': resolve(__dirname, 'src/ai'),
			'@views': resolve(__dirname, 'src/views'),
			'@utils': resolve(__dirname, 'src/utils'),
			'@managers': resolve(__dirname, 'src/managers')
		}
	},
	esbuild: {
		loader: 'ts',
		include: [
			'src/**/*.ts',
			'src/**/*.js'
		]
	}
}
