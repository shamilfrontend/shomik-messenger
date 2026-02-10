import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'vite.svg'],
      manifest: {
        name: 'Shomik — простой мессенджер',
        short_name: 'Shomik',
        description: 'Простой мессенджер для общения',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'ru',
        icons: [
          { src: '/vite.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
          { src: '/vite.svg', type: 'image/svg+xml', sizes: '192x192', purpose: 'any' },
          { src: '/vite.svg', type: 'image/svg+xml', sizes: '512x512', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
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
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
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
