import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const certDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'certs');

// SN-ERMS client: installable PWA (Web + Android + iOS home-screen app).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Saba Nursery ERMS',
        short_name: 'Saba ERMS',
        description: 'Saba Nursery Enterprise Resource & Smart Inventory Management System',
        theme_color: '#166534',
        background_color: '#f0fdf4',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'plant-media',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    https: {
      key: fs.readFileSync(path.join(certDir, 'dev-key.pem')),
      cert: fs.readFileSync(path.join(certDir, 'dev-cert.pem')),
    },
    // Allow access through proxied/tunnelled hostnames (e.g. Cloud Agent port
    // forwarding). Without this Vite 5 returns "Blocked request. This host is
    // not allowed." for any non-localhost Host header.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
    https: {
      key: fs.readFileSync(path.join(certDir, 'dev-key.pem')),
      cert: fs.readFileSync(path.join(certDir, 'dev-cert.pem')),
    },
    allowedHosts: true,
  },
});
