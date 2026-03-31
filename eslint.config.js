export default [
	{
		name: 'app-files',
		files: ['**/*.js', '**/*.mjs'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				document: 'readonly',
				window: 'readonly',
				console: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				localStorage: 'readonly',
			},
		},
		rules: {
			// 强制使用 tab 缩进
			'indent': ['error', 'tab', { 'SwitchCase': 1 }],
      
			// 强制使用单引号
			//'quotes': ['error', 'single'],
      
			// 强制分号
			'semi': ['error', 'never'],
      
			// 禁止使用 var
			'no-var': 'error',
      
			// 强制使用 const/let
			'prefer-const': 'error',
      
			// 禁止 console（开发时可注释掉）
			// 'no-console': 'warn',
		},
	},
]
