import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Nginx publica este MFE en /mfe-pos/. Se generan dos entradas:
//  - index.html: el POS como PWA independiente
//  - pos-element.js: Web Component <licoreria-pos> que carga el Shell (nombre fijo, sin hash)
export default defineConfig({
  base: '/mfe-pos/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Licorería – Punto de venta',
        short_name: 'POS',
        start_url: '/mfe-pos/',
        scope: '/mfe-pos/',
        display: 'standalone',
        theme_color: '#7c3aed',
        background_color: '#faf9fd',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        'pos-element': 'src/pos-element.tsx',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'pos-element' ? 'pos-element.js' : 'assets/[name]-[hash].js'),
      },
      // Sin esto Rollup quita los exports de la entrada del Web Component
      preserveEntrySignatures: 'exports-only',
    },
  },
  server: { port: 4202 },
})
