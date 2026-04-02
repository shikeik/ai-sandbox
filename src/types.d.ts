declare module "*.css" {
	const content: string
	export default content
}

declare module "*.scss" {
	const content: string
	export default content
}

interface ImportMeta {
	hot?: {
		accept: () => void
		dispose: (callback: () => void) => void
	}
}
