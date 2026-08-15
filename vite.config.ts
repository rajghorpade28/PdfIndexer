import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,mjs}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB to allow for workers
      },
      manifest: {
        name: 'PDF Indexer',
        short_name: 'PDF Indexer',
        description: 'Turn any PDF into a smart, clickable index entirely in your browser.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: true // Allows testing PWA offline behavior in dev mode
      }
    })
  ],
  optimizeDeps: {
    // Exclude transformers from optimization if it causes issues, but usually it's fine.
  }
})
