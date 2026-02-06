import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://155.212.218.104:5001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://155.212.218.104:5001',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://155.212.218.104:5001',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
