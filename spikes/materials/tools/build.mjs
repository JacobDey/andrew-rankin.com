#!/usr/bin/env node
// Production-build just this spike into a folder of your choice (default: OS temp), without
// touching the shared dev server or the repo's dist/. measure.mjs --dist <dir> then serves it
// to Playwright through request interception (no HTTP server is started).
//
//   node spikes/materials/tools/build.mjs [outDir]

import { build } from 'vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(process.argv[2] || resolve(tmpdir(), 'materials-spike-dist'))
const t0 = Date.now()
await build({
  configFile: false,
  root,
  base: './',
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 4096 },
})
console.log(`built ${root} -> ${outDir} in ${Date.now() - t0} ms`)
