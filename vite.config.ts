import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

/**
 * Backend the dev server proxies to. Same topology as production: nginx forwards
 * `/api/` and `/nostromo/` to PocketBase with NO prefix stripping, so the dev
 * proxy does the same and the paths reach PocketBase untouched.
 */
const NOSTROMO_PROXY_TARGET =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NOSTROMO_PROXY_TARGET ??
  'http://127.0.0.1:8090'
const NOSTROMO_PROXY_ENTRY = { changeOrigin: true, target: NOSTROMO_PROXY_TARGET }

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [solidPlugin(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': NOSTROMO_PROXY_ENTRY,
      '/nostromo': NOSTROMO_PROXY_ENTRY,
    },
  },
})
