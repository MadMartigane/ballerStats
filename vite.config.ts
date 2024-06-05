import solidPlugin from 'vite-plugin-solid'
import suidPlugin from '@suid/vite-plugin'

import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    solidPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@shoelace-style/shoelace/dist/assets/icons/*.svg',
          dest: 'assets/icons',
        },
      ],
    }),
    suidPlugin(),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'es2018',
  },
})
