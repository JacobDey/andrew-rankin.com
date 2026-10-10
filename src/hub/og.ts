// ?og=<slug|hub> renders only a 1200×630 social-card composition (hub.md §11.2); ?poster=<slug>
// renders a 1200×800 still of that game's procedural preview at its hero moment (a stand-in
// poster until scripts/posters.mjs captures the real games). Both set __game.ready when done.

import './og.css'
import { GAMES, gameBySlug, SITE, type GameSlug, type GameInfo } from '@shared/games'
import { installGameApi, markReady } from '@shared/core'
import { circlePath, ensureGreaseFilter, installGrain } from '@shared/ui'
import { PREVIEWS, seedOf } from './previews'

const isSlug = (s: string | null): s is GameSlug => !!s && GAMES.some((g) => g.slug === s)
const two = (n: number): string => String(n).padStart(2, '0')

async function still(slug: GameSlug, canvas: HTMLCanvasElement, w: number, h: number): Promise<void> {
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const p = PREVIEWS[slug]()
  const env = { canvas, ctx, w, h, dpr: 1, seed: seedOf(slug), accentLit: gameBySlug(slug).accentLit }
  await p.init(env)
  p.draw(p.heroT)
}

async function posterOr(slug: GameSlug, canvas: HTMLCanvasElement, w: number, h: number): Promise<void> {
  // a real poster, when one exists; the procedural hero still otherwise
  const ok = await new Promise<HTMLImageElement | null>((res) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = `/posters/${slug}.jpg`
  })
  if (ok && ok.naturalWidth > 0) {
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')
    if (g) {
      const s = Math.max(w / ok.naturalWidth, h / ok.naturalHeight)
      const dw = ok.naturalWidth * s
      const dh = ok.naturalHeight * s
      g.drawImage(ok, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }
    return
  }
  await still(slug, canvas, w, h)
}

function frameStrip(g: GameInfo, width: number): { el: HTMLElement; canvas: HTMLCanvasElement } {
  const cell = document.createElement('div')
  cell.className = 'hub-frame og-cell'
  cell.style.width = `${width}px`
  cell.style.setProperty('--accent-lit', g.accentLit)
  cell.innerHTML = `<div class="hub-card"><div class="hub-strip">
    <div class="hub-perfs hub-perfs--top"></div><div class="hub-perfs hub-perfs--bottom"></div>
    <span class="hub-edge hub-edge--stock">RANKIN 400 ▸${two(g.frame)}</span>
    <span class="hub-edge hub-edge--num">${g.frame}</span>
    <span class="hub-edge hub-edge--sub">▸${g.frame}A</span>
    <div class="hub-image"><canvas class="og-canvas"></canvas></div></div></div>`
  return { el: cell, canvas: cell.querySelector('canvas')! }
}

export async function startOg(og: string | null, poster: string | null): Promise<void> {
  installGameApi('hub:og', 'hub@1', { state: () => ({ og, poster }) })
  document.documentElement.dataset.og = ''
  document.querySelector('.hub-page')?.remove()
  document.querySelector('.hub-table')?.remove()
  document.querySelector('.ar-skip')?.remove()
  ensureGreaseFilter()
  const stage = document.createElement('div')
  document.body.append(stage)

  if (poster && isSlug(poster)) {
    stage.className = 'og-poster'
    const c = document.createElement('canvas')
    stage.append(c)
    await still(poster, c, 1200, 800)
  } else if (og && isSlug(og)) {
    installGrain()
    const g = gameBySlug(og)
    stage.className = 'og-card og-card--game'
    stage.style.setProperty('--accent-lit', g.accentLit)
    const { el, canvas } = frameStrip(g, 640)
    const text = document.createElement('div')
    text.className = 'og-text'
    text.innerHTML = `<p class="og-kicker">▸${two(g.frame)} · NOTE ${g.frame} · ${g.noteName.toUpperCase()}</p>
      <h1 class="og-title">${g.title}</h1>
      <p class="og-tagline">${g.tagline}</p>
      <p class="og-foot">Andrew Rankin · Minigame collection</p>`
    stage.append(el, text)
    await document.fonts.ready
    const r = canvas.getBoundingClientRect()
    await posterOr(og, canvas, Math.round(r.width * 1.5), Math.round(r.height * 1.5))
    // a red grease circle around the frame
    const card = el.querySelector<HTMLElement>('.hub-card')!
    const u = 640 / 38
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'og-grease')
    svg.innerHTML = `<path d="${circlePath({ x: u - 0.4 * u, y: 5.5 * u - 0.6 * u, w: 36 * u + 0.8 * u, h: 24 * u + 1.2 * u }, `og:${og}`)}"/>`
    card.append(svg)
  } else {
    // the hub card: the wordmark beside a two-strip sheet
    stage.className = 'og-card og-card--hub'
    const text = document.createElement('div')
    text.className = 'og-hubtext'
    text.innerHTML = `<p class="og-kicker og-kicker--hub">Minigame collection · Roll 01</p>
      <h1 class="og-wordmark">Andrew Rankin</h1>
      <p class="og-lede">${SITE.tagline}</p>
      <p class="og-edge">${SITE.stock} · ${SITE.roll} · 06 exp.</p>`
    const paper = document.createElement('div')
    paper.className = 'og-paper'
    const exp = document.createElement('div')
    exp.className = 'og-exposed'
    paper.append(exp)
    const canvases: [GameSlug, HTMLCanvasElement][] = []
    for (const g of GAMES) {
      const { el, canvas } = frameStrip(g, 206)
      exp.append(el)
      canvases.push([g.slug, canvas])
    }
    stage.append(text, paper)
    await document.fonts.ready
    for (const [slug, c] of canvases) {
      const r = c.getBoundingClientRect()
      await still(slug, c, Math.round(r.width * 2), Math.round(r.height * 2))
    }
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  markReady()
}
