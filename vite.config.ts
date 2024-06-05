import solidPlugin from 'vite-plugin-solid'
import suidPlugin from '@suid/vite-plugin'

import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [solidPlugin(), suidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'modules',
  },
})
