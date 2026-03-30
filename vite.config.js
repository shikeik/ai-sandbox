import { resolve } from 'path'

export default {
  server: {
    host: '0.0.0.0',
    port: 4000
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  resolve: {
    alias: {
      '@game': resolve(__dirname, 'src/game'),
      '@render': resolve(__dirname, 'src/render'),
      '@ai': resolve(__dirname, 'src/ai'),
      '@views': resolve(__dirname, 'src/views'),
      '@utils': resolve(__dirname, 'src/utils')
    }
  }
}
