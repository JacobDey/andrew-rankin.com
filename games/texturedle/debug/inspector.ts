// ?debug=library: a contact sheet of every recipe's CPU-lit 5:1 thumbnail, for art review
// (texturedle.md §12 WP-D, §14 "noise soup" risk). ?debug=bake: the current bake's maps.

import { listRecipes, thumbnail, type SurfaceBake } from '@shared/surface'

export async function showLibrary(host: HTMLElement): Promise<void> {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:absolute;inset:0;overflow:auto;z-index:50;background:var(--ar-bg);padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;align-content:start'
  host.append(wrap)
  for (const r of listRecipes()) {
    const fig = document.createElement('figure')
    fig.style.cssText = 'margin:0;font:500 12px/1.3 var(--ar-font-ui)'
    const c = document.createElement('canvas')
    c.width = c.height = 180
    c.style.cssText = 'width:100%;height:auto;border-radius:4px;background:#000'
    const cap = document.createElement('figcaption')
    cap.textContent = `${String(r.no).padStart(3, '0')} · ${r.name}${r.pool ? '' : ' (poster)'}`
    fig.append(c, cap)
    wrap.append(fig)
    try {
      const img = await thumbnail(r.id, 180)
      c.getContext('2d')?.putImageData(img, 0, 0)
    } catch (e) {
      cap.textContent += ` · failed: ${String(e)}`
    }
  }
}

export function showBakeMaps(host: HTMLElement, b: SurfaceBake): void {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:absolute;right:8px;bottom:8px;z-index:50;display:flex;gap:6px;background:rgb(0 0 0 / .7);padding:6px;border-radius:6px'
  const n = Math.min(b.res, 256)
  const step = b.res / n
  const mk = (fill: (k: number, o: Uint8ClampedArray, i: number) => void, label: string) => {
    const c = document.createElement('canvas')
    c.width = c.height = n
    c.title = label
    c.style.cssText = 'width:128px;height:128px'
    const img = new ImageData(n, n)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = Math.floor((n - 1 - j) * step) * b.res + Math.floor(i * step)
      fill(k, img.data, (j * n + i) * 4)
      img.data[(j * n + i) * 4 + 3] = 255
    }
    c.getContext('2d')?.putImageData(img, 0, 0)
    wrap.append(c)
  }
  let lo = Infinity, hi = -Infinity
  for (let k = 0; k < b.height.length; k += 13) { lo = Math.min(lo, b.height[k]); hi = Math.max(hi, b.height[k]) }
  mk((k, o, i) => { o[i] = b.albedo[k * 4]; o[i + 1] = b.albedo[k * 4 + 1]; o[i + 2] = b.albedo[k * 4 + 2] }, 'albedo')
  mk((k, o, i) => { const v = ((b.height[k] - lo) / Math.max(1e-6, hi - lo)) * 255; o[i] = o[i + 1] = o[i + 2] = v }, 'height')
  mk((k, o, i) => { o[i] = b.orm[k * 4]; o[i + 1] = b.orm[k * 4 + 1]; o[i + 2] = b.orm[k * 4 + 2] }, 'ORM')
  mk((k, o, i) => { const v = b.topLayer[k] * 40; o[i] = v; o[i + 1] = 255 - v; o[i + 2] = 128 }, 'top layer')
  host.append(wrap)
}
