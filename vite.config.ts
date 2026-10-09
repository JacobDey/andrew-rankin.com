import { defineConfig } from 'vite'
import { resolve, dirname } from 'node:path'
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

// Every games/<slug>/index.html is its own page. Add a folder, get a page.
const gamePages = readdirSync(resolve(root, 'games'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(resolve(root, 'games', d.name, 'index.html')))
  .map((d) => [d.name, resolve(root, 'games', d.name, 'index.html')] as const)

export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      input: { main: resolve(root, 'index.html'), ...Object.fromEntries(gamePages) },
    },
  },
  resolve: { alias: { '@shared': resolve(root, 'src/shared') } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173 },
})
