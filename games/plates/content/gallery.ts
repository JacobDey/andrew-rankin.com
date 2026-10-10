// games/plates/content/gallery.ts — ?gallery=1 contact sheet: every plate developed at P (default 40),
// under velvet (positive), both eyes. &hot=1 outlines hotspots and portrait crops; &plate=pNN shows one;
// &neg=1 shows the negative; &s=<scale>.
import { PLATE_IDS, PLATE_W, PLATE_H, type PlateId } from '../contracts'
import { createPlateLibrary } from './library'
import { developRegion } from './develop'
import { hexRGB255, PALETTES } from '../render/palette'
import type * as THREE from 'three'

export async function mountGallery(root: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search)
  const P = Number(q.get('P') ?? 40), hot = q.get('hot') === '1', only = q.get('plate') as PlateId | null
  const mode = q.get('neg') === '1' ? 'neg' : 'pos'
  const scale = Number(q.get('s') ?? (only ? 1 : 0.5))
  const lib = createPlateLibrary()
  const wrap = document.createElement('div')
  wrap.className = 'pl-gallery'
  root.appendChild(wrap)
  const ink = hexRGB255(PALETTES.canary.ink), light = hexRGB255(PALETTES.canary.light)
  for (const id of only ? [only] : PLATE_IDS) {
    const m = lib.meta(id)
    const e = await lib.expose(id, null as unknown as THREE.WebGLRenderer, q.get('q') === 'full' ? 'full' : 'low')
    const fig = document.createElement('figure')
    const cap = document.createElement('figcaption')
    cap.textContent = `${id} · ${m.no === 'TRIAL' ? 'TRIAL' : 'No. ' + m.no} · ${m.title}`
    const c = document.createElement('canvas')
    const ow = Math.round(PLATE_W * scale), oh = Math.round(PLATE_H * scale)
    c.width = ow; c.height = oh
    const x = c.getContext('2d')
    if (!x) continue
    x.putImageData(developRegion(e.L, { P, F: 0.015 }, [11, 23], 0, 0, PLATE_W, PLATE_H, ow, oh, mode, ink, light), 0, 0)
    if (hot) {
      x.lineWidth = 1
      for (const h of m.hotspots) {
        x.strokeStyle = h.zone === 'shadow' ? '#3af' : h.zone === 'highlight' ? '#f3a' : '#3f3'
        x.beginPath(); x.arc(h.x * scale, h.y * scale, h.r * scale, 0, Math.PI * 2); x.stroke()
        x.fillStyle = x.strokeStyle; x.font = '10px sans-serif'; x.fillText(h.id, h.x * scale + h.r * scale, h.y * scale)
      }
      x.strokeStyle = '#ff0'
      for (const p of m.portraits) x.strokeRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale)
    }
    fig.append(c, cap)
    wrap.appendChild(fig)
    await new Promise((r) => setTimeout(r, 0))
  }
  document.body.dataset.ready = '1'
}
