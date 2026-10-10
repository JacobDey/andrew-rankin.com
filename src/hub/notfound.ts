// "Frame not found" (hub.md §2.5): a film strip with one fogged frame and a grease circle round it.

import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import './hub.css'
import './notfound.css'
import { mountHubShell, circlePath, drawStroke, prefersReducedMotion } from '@shared/ui'
import { installGameApi, markReady } from '@shared/core'
import { uiSound } from '@shared/audio/core'

const SVGNS = 'http://www.w3.org/2000/svg'

mountHubShell().el.querySelector('.ar-shell__loupe')?.remove() // nothing to magnify here
const skip = document.querySelector('.ar-skip')
if (skip) document.body.prepend(skip)

installGameApi('hub:404', 'hub@1', { state: () => ({ page: '404', path: location.pathname }) })

const card = document.querySelector<HTMLElement>('.nf-cell .hub-card')!
const svg = document.createElementNS(SVGNS, 'svg')
svg.setAttribute('class', 'nf-grease')
svg.setAttribute('aria-hidden', 'true')
const p = document.createElementNS(SVGNS, 'path')
svg.append(p)
card.append(svg)

function layout(): void {
  const u = card.clientWidth / 38
  p.setAttribute('d', circlePath({ x: u * 0.6, y: 5.1 * u, w: 36.8 * u, h: 24.8 * u }, 'frame-not-found'))
  p.style.strokeWidth = `${Math.max(3, 0.45 * u)}px`
}
layout()
new ResizeObserver(layout).observe(card)

document.querySelector('.nf-btn')?.addEventListener('click', () => uiSound('advance'))

void document.fonts.ready.then(async () => {
  layout()
  if (!prefersReducedMotion()) await drawStroke(p, { ms: 620 })
  else p.style.strokeDasharray = 'none'
  markReady()
})
