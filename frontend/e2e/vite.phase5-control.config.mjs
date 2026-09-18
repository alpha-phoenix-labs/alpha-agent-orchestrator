import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
    proxy: {
      '/v1/sandbox-control': {
        target: 'http://127.0.0.1:4181',
        changeOrigin: false,
      },
    },
  },
})
