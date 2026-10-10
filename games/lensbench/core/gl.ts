// One WebGLRenderer and one canvas for the whole page (lensbench.md §11.3). Screens call attachTo().
import * as THREE from 'three'
import type { QualityTier } from './types'

export interface GLCore {
  renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement
  caps: { webgl2: boolean; floatRT: boolean }; quality: QualityTier
  attachTo(el: HTMLElement | null): void /* positions the single GL canvas over el */
  /** extras */
  readonly attached: HTMLElement | null
  /** CSS size of the attached element (0 when detached) */
  size(): { w: number; h: number }
  sync(): void
}

export function createGLCore(host: HTMLElement, quality: QualityTier): GLCore {
  const canvas = document.createElement('canvas')
  canvas.className = 'lb-gl'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: quality === 'test' })
  const dpr = quality === 'desktop' ? Math.min(2, devicePixelRatio || 1) : quality === 'phone' ? Math.min(1.5, devicePixelRatio || 1) : 1
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = quality === 'desktop' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = true
  const gl = renderer.getContext()
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
  const floatRT = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
  let attached: HTMLElement | null = null
  let lastW = 0, lastH = 0
  const sync = () => {
    if (!attached || !attached.isConnected) { canvas.style.display = 'none'; return }
    const r = attached.getBoundingClientRect()
    const hr = host.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) { canvas.style.display = 'none'; return }
    canvas.style.display = 'block'
    canvas.style.left = `${r.left - hr.left}px`
    canvas.style.top = `${r.top - hr.top}px`
    canvas.style.width = `${r.width}px`
    canvas.style.height = `${r.height}px`
    const w = Math.round(r.width), h = Math.round(r.height)
    if (w !== lastW || h !== lastH) { renderer.setSize(w, h, false); lastW = w; lastH = h }
  }
  const core: GLCore = {
    renderer, canvas, caps: { webgl2, floatRT }, quality,
    attachTo(el: HTMLElement | null) { attached = el; sync() },
    get attached() { return attached },
    size() { return { w: lastW, h: lastH } },
    sync,
  }
  return core
}
