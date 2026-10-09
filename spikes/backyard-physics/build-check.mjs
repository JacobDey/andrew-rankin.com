#!/usr/bin/env node
// Production-build check for the backyard spike, without touching the repo's vite.config.ts.
//
//   node spikes/backyard-physics/build-check.mjs            # build only, print chunk sizes
//   node spikes/backyard-physics/build-check.mjs --serve 600 # build, then serve for 600 s on :4321
//
// Output goes to shots/spike-build-check-backyard (git-ignored).
import { build, preview } from 'vite'
import { readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../../shots/spike-build-check-backyard')
const serveIdx = process.argv.indexOf('--serve')
const serveSeconds = serveIdx > 0 ? Number(process.argv[serveIdx + 1] || 300) : 0

const t0 = Date.now()
await build({
  root: here,
  base: './',
  configFile: false,
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 8192, sourcemap: false },
})
console.log(`built in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${outDir}`)

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
let total = 0
let totalGz = 0
for (const f of walk(outDir)) {
  const buf = readFileSync(f)
  const gz = gzipSync(buf, { level: 9 }).length
  total += buf.length
  totalGz += gz
  console.log(`${(buf.length / 1024).toFixed(1).padStart(9)} KB  ${(gz / 1024).toFixed(1).padStart(8)} KB gz  ${f.slice(outDir.length + 1)}`)
}
console.log(`${(total / 1024).toFixed(1).padStart(9)} KB  ${(totalGz / 1024).toFixed(1).padStart(8)} KB gz  TOTAL`)

if (serveSeconds > 0) {
  const server = await preview({
    root: here,
    configFile: false,
    build: { outDir },
    preview: { host: '127.0.0.1', port: 4321, strictPort: true },
    logLevel: 'warn',
  })
  console.log(`serving ${outDir} at http://127.0.0.1:4321/ for ${serveSeconds} s`)
  setTimeout(() => {
    server.httpServer.close()
    process.exit(0)
  }, serveSeconds * 1000)
}
