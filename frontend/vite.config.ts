import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    // PWA: installable app shell for teachers' phones (attendance module).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Sistema de Gestión Escolar',
        short_name: 'Gestión Escolar',
        description: 'Sistema de gestión escolar — asistencias, notas y administración',
        lang: 'es',
        id: '/',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app is a single large chunk today; allow precaching it so the
        // PWA is fully installable. Never cache API calls — attendance/grades
        // data must always be fresh.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            // Static assets from the backend (logos, documents)
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
    // calculadora.html / asistencias.html ship their own manifest (dedicated name/start_url).
    // VitePWA also injects the main one into every entry, and a page must declare exactly one.
    {
      name: 'secondary-entries-own-manifest',
      enforce: 'post',
      transformIndexHtml: {
        order: 'post',
        handler(html: string, ctx: { filename?: string }) {
          if (!/(calculadora|asistencias)\.html$/.test(ctx.filename ?? '')) return html;
          return html.replace(/<link rel="manifest" href="\/manifest\.webmanifest"\s*\/?>/g, '');
        },
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Separate installable entry: dedicated launcher icon for the rate calculator
        calculadora: path.resolve(__dirname, 'calculadora.html'),
        // Teacher-only installable entry: just the "Tomar Asistencia" view
        asistencias: path.resolve(__dirname, 'asistencias.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    }
  }
})
