import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const env = globalThis?.process?.env || {}
const isGitHubActions = env.GITHUB_ACTIONS === 'true'
const repoName = env.GITHUB_REPOSITORY?.split('/')?.[1] || 'flowapp'
// BASE_PATH lets the CI workflow deploy different branches under different
// sub-paths (e.g. /flowapp/ for main, /flowapp/testing/ for the testing branch).
const base = env.BASE_PATH || (isGitHubActions ? `/${repoName}/` : '/')

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(getGitCommit()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/pwa-192.png', 'icons/pwa-512.png'],
      manifest: {
        name: 'Traffic Monitor PWA',
        short_name: 'TrafficMonitor',
        description: 'Offline-first traffic provider observation logger',
        id: base,
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The root (main) SW has scope "/flowapp/", which also covers sub-path
        // deploys like "/flowapp/testing/". Without this denylist its SPA
        // navigation fallback would serve the main index.html for those URLs,
        // bouncing them back to "/flowapp/". Let those navigations hit the
        // network so each sub-deploy loads its own app + service worker.
        navigateFallbackDenylist: [/\/testing\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
            },
          },
          {
            urlPattern: ({ request }) =>
              ['style', 'script', 'worker', 'image', 'font'].includes(
                request.destination,
              ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
})
