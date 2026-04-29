import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Dividir el bundle en chunks más pequeños para builds más rápidos
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router', 'react-router-dom'],
          'antd-vendor':   ['antd', '@ant-design/icons'],
          'refine-vendor': ['@refinedev/core', '@refinedev/antd', '@refinedev/react-router'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
