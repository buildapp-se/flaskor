import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/flaskor/',
  plugins: [
    react(),
    // PWA (beslut 11, 27): skalet cachas av service workern, senaste listan ligger i localStorage (store.tsx).
    // Skrivningar kräver nät. autoUpdate: ingen "ladda om"-banner, inget pågående arbete att förlora.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Flaskor',
        short_name: 'Flaskor',
        description: 'Hushållets viner, önskelista och barskåp',
        lang: 'sv',
        theme_color: '#EFE8DB',
        background_color: '#EFE8DB',
        display: 'standalone',
        scope: '/flaskor/',
        start_url: '/flaskor/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'google-fonts-css' } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\//, handler: 'CacheFirst', options: { cacheName: 'google-fonts', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
          { urlPattern: /^https:\/\/product-cdn\.systembolaget\.se\//, handler: 'CacheFirst', options: { cacheName: 'bottle-images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 } } },
          { urlPattern: /^https:\/\/www\.caviste\.se\/wp-content\//, handler: 'CacheFirst', options: { cacheName: 'caviste-images', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 90 } } },
        ],
      },
    }),
  ],
  build: { target: 'es2022' },
})
