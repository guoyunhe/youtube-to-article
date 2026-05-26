import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const workerDevOrigin = process.env.WORKER_DEV_ORIGIN ?? 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: workerDevOrigin,
        changeOrigin: true,
      },
    },
  },
})
