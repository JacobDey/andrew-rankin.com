#!/usr/bin/env node
// Regenerates the static frame markup in index.html (between <!--frames--> and <!--/frames-->)
// from the registry, src/shared/games.ts. vite.config.ts is frozen, so there is no build-time
// injection (architecture §5.8): run this by hand whenever the registry copy changes, then check
// with __game.lintRegistry() in the browser (it returns [] when the DOM matches GAMES).
//
//   node --experimental-strip-types src/hub/dev/render-frames.mjs
//
// Dev tool only: never imported by the page.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const { GAMES } = await import(pathToFileURL(resolve(root, 'src/shared/games.ts')).href)

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const two = (n) => String(n).padStart(2, '0')

/** 32 DX bars from the bits of the slug's first four char codes, as one path in a 32 x 1 box. */
function dxPath(slug) {
  let d = ''
  for (let i = 0; i < 4; i++) {
    const code = slug.charCodeAt(i) || 0
    for (let b = 7; b >= 0; b--) {
      const x = i * 8 + (7 - b)
      if ((code >> b) & 1) d += `M${x} 0h.88v1h-.88z`
    }
  }
  return d
}

function frame(g) {
  const n = g.frame
  const odd = n % 2 === 1
  const kicker = `▸${two(n)} · NOTE ${n} · ${g.noteName.toUpperCase()}`
  const meta = g.meta.join(' · ')
  const top = odd
    ? `<span class="hub-edge hub-edge--stock">RANKIN 400</span>`
    : `<span class="hub-edge hub-edge--joke">${esc(g.edgeJoke)}</span>`
  const side = odd ? esc(g.edgeJoke) : 'RANKIN'
  const stamp = g.status === 'developing' ? `\n            <span class="hub-stamp">In the tray</span>` : ''
  const credit = g.credit ? `\n          <p class="hub-credit">${esc(g.credit)}</p>` : ''
  return `      <li class="hub-frame" data-slug="${g.slug}" data-frame="${n}" data-status="${g.status}" style="--accent-lit: ${g.accentLit}">
        <article class="hub-card" aria-labelledby="t-${g.slug}">
          <div class="hub-strip" aria-hidden="true">
            <div class="hub-perfs hub-perfs--top"></div>
            <div class="hub-perfs hub-perfs--bottom"></div>
            ${top}
            <svg class="hub-dx" viewBox="0 0 32 1" preserveAspectRatio="none"><path d="${dxPath(g.slug)}"/></svg>
            <span class="hub-edge hub-edge--num">${n}</span>
            <span class="hub-edge hub-edge--sub">▸${n}A</span>
            <span class="hub-edge hub-edge--side">${side}</span>
            <div class="hub-image">
              <noscript><img src="/posters/${g.slug}.jpg" loading="lazy" decoding="async" alt="" /></noscript>${stamp}
            </div>
          </div>
          <div class="hub-caption">
            <p class="hub-kicker" aria-hidden="true">${esc(kicker)}</p>
            <h3 class="hub-title"><a href="/games/${g.slug}/" id="t-${g.slug}" aria-describedby="b-${g.slug} m-${g.slug} p-${g.slug}">${esc(g.title)}</a></h3>
            <p class="hub-tagline">${esc(g.tagline)}</p>
            <p class="hub-blurb" id="b-${g.slug}">${esc(g.blurb)}</p>${credit}
            <p class="hub-metaline"><span class="hub-meta" id="m-${g.slug}">${esc(meta)}</span><span class="hub-cta" aria-hidden="true">Play ▸</span></p>
            <span class="visually-hidden" id="p-${g.slug}"></span>
          </div>
        </article>
      </li>`
}

const file = resolve(root, 'index.html')
const html = readFileSync(file, 'utf8')
const start = html.indexOf('<!--frames-->')
const end = html.indexOf('<!--/frames-->')
if (start < 0 || end < 0) throw new Error('index.html has no <!--frames--> … <!--/frames--> markers')
const out = html.slice(0, start + '<!--frames-->'.length) + '\n' + GAMES.map(frame).join('\n') + '\n      ' + html.slice(end)
writeFileSync(file, out)
console.log(`index.html: wrote ${GAMES.length} frames`)
