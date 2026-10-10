// The frame markup is written statically into index.html from the registry (architecture §5.8:
// vite.config.ts is frozen, so there is no build-time injection; regenerate with
// src/hub/dev/render-frames.mjs). lintRegistry() compares the DOM with GAMES and returns [] when
// they agree; syncRegistry() patches any drift at runtime so visitors never see stale copy.

import { GAMES, type GameInfo } from '@shared/games'

const two = (n: number): string => String(n).padStart(2, '0')

interface Field {
  name: string
  sel: string
  want: (g: GameInfo) => string | null // null: the element must not exist
  attr?: string
}

const FIELDS: Field[] = [
  { name: 'kicker', sel: '.hub-kicker', want: (g) => `▸${two(g.frame)} · NOTE ${g.frame} · ${g.noteName.toUpperCase()}` },
  { name: 'title', sel: '.hub-title a', want: (g) => g.title },
  { name: 'href', sel: '.hub-title a', want: (g) => `/games/${g.slug}/`, attr: 'href' },
  { name: 'tagline', sel: '.hub-tagline', want: (g) => g.tagline },
  { name: 'blurb', sel: '.hub-blurb', want: (g) => g.blurb },
  { name: 'meta', sel: '.hub-meta', want: (g) => g.meta.join(' · ') },
  { name: 'credit', sel: '.hub-credit', want: (g) => g.credit ?? null },
  { name: 'joke', sel: '.hub-edge--joke, .hub-edge--side', want: (g) => g.edgeJoke },
  { name: 'stamp', sel: '.hub-stamp', want: (g) => (g.status === 'developing' ? 'In the tray' : null) },
]

function check(li: HTMLElement, g: GameInfo, fix: boolean): string[] {
  const out: string[] = []
  if (li.dataset.frame !== String(g.frame)) {
    out.push(`${g.slug}: frame ${li.dataset.frame} ≠ ${g.frame}`)
    if (fix) li.dataset.frame = String(g.frame)
  }
  if (li.dataset.status !== g.status) {
    out.push(`${g.slug}: status ${li.dataset.status} ≠ ${g.status}`)
    if (fix) li.dataset.status = g.status
  }
  if (li.style.getPropertyValue('--accent-lit').trim().toUpperCase() !== g.accentLit.toUpperCase()) {
    out.push(`${g.slug}: accentLit`)
    if (fix) li.style.setProperty('--accent-lit', g.accentLit)
  }
  for (const f of FIELDS) {
    const want = f.want(g)
    if (f.name === 'joke') {
      const texts = [...li.querySelectorAll(f.sel)].map((e) => e.textContent?.trim())
      if (!texts.includes(g.edgeJoke)) {
        out.push(`${g.slug}: edgeJoke`)
        if (fix) {
          const e = li.querySelector(g.frame % 2 === 0 ? '.hub-edge--joke' : '.hub-edge--side')
          if (e) e.textContent = g.edgeJoke
        }
      }
      continue
    }
    const el = li.querySelector<HTMLElement>(f.sel)
    if (want === null) {
      if (el) {
        out.push(`${g.slug}: ${f.name} should be absent`)
        if (fix) el.remove()
      }
      continue
    }
    if (!el) {
      out.push(`${g.slug}: ${f.name} missing`)
      if (fix && f.name === 'stamp') {
        const s = document.createElement('span')
        s.className = 'hub-stamp'
        s.textContent = want
        li.querySelector('.hub-image')?.append(s)
      } else if (fix && f.name === 'credit') {
        const p = document.createElement('p')
        p.className = 'hub-credit'
        p.textContent = want
        li.querySelector('.hub-blurb')?.after(p)
      }
      continue
    }
    const have = f.attr ? el.getAttribute(f.attr) ?? '' : (el.textContent ?? '').trim()
    if (have !== want) {
      out.push(`${g.slug}: ${f.name} "${have.slice(0, 40)}" ≠ "${want.slice(0, 40)}"`)
      if (fix) {
        if (f.attr) el.setAttribute(f.attr, want)
        else el.textContent = want
      }
    }
  }
  return out
}

export function lintRegistry(root: ParentNode = document.querySelector('.hub-sheet') ?? document): string[] {
  const out: string[] = []
  const lis = [...root.querySelectorAll<HTMLElement>('.hub-frames > .hub-frame')]
  if (lis.length !== GAMES.length) out.push(`frames: ${lis.length} in the DOM, ${GAMES.length} in GAMES`)
  GAMES.forEach((g, i) => {
    const li = lis.find((x) => x.dataset.slug === g.slug)
    if (!li) {
      out.push(`${g.slug}: no frame`)
      return
    }
    if (lis[i] !== li) out.push(`${g.slug}: out of order`)
    out.push(...check(li, g, false))
  })
  return out
}

/** Patches text drift in place; returns what it fixed (logged at debug level). */
export function syncRegistry(root: ParentNode = document.querySelector('.hub-sheet') ?? document): string[] {
  const fixed: string[] = []
  for (const g of GAMES) {
    const li = root.querySelector<HTMLElement>(`.hub-frames > .hub-frame[data-slug="${g.slug}"]`)
    if (li) fixed.push(...check(li, g, true))
  }
  if (fixed.length) console.debug('[hub] index.html drifted from the registry; patched at runtime:', fixed)
  return fixed
}
