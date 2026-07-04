import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'RootFacts - AI Vegetable Recognition',
        short_name: 'RootFacts',
        description: 'Aplikasi AI untuk mengenali sayuran dan memberikan fakta menarik',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#10b981',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Allow large chunks (TF.js / ONNX wasm files) to be precached
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        // Precache core assets: HTML, CSS, JS, icons
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // Precache AI model files for offline detection (Advanced)
        additionalManifestEntries: [
          { url: '/model/model.json', revision: '1' },
          { url: '/model/metadata.json', revision: '1' },
          { url: '/model/weights.bin', revision: '1' },
        ],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Cache Transformers.js model files from HuggingFace CDN
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hf-models',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
    host: true,
  },
});
