// Paper/film grain overlay (art-direction §6.4): one 192x192 greyscale noise tile, generated once
// from a fixed seed, shown by body::before (see base.css). Skipped when <html data-grain="off">.

import { mulberry32, gauss } from '../core/rng'

let installed = false

export function installGrain(): void {
  if (installed || typeof document === 'undefined') return
  if (document.documentElement.getAttribute('data-grain') === 'off') return
  installed = true
  const N = 192
  try {
    const c = document.createElement('canvas')
    c.width = c.height = N
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(N, N)
    const r = mulberry32(0x6a9e1)
    for (let i = 0; i < N * N; i++) {
      const v = Math.max(0, Math.min(255, Math.round(128 + gauss(r) * 46)))
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    c.toBlob((blob) => {
      if (!blob) return
      document.documentElement.style.setProperty('--ar-grain', `url(${URL.createObjectURL(blob)})`)
    }, 'image/png')
  } catch {
    /* no canvas: no grain */
  }
}
