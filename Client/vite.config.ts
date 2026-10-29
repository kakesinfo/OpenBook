import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/images': {
        target: 'http://project-backend:8080',
        changeOrigin: true
      }
    }
  }
})
