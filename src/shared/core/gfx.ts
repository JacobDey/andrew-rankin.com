// three.js helpers. NOT re-exported by the @shared/core barrel (it must stay three-free): import from '@shared/core/gfx'.

import * as THREE from 'three'
import { dprCap } from './quality'
import type { Tier } from './flags'

export interface RendererOptions {
  tier: Tier
  alpha?: boolean
  antialias?: boolean
  preserveDrawingBuffer?: boolean
  powerPreference?: WebGLPowerPreference
  dprCap?: number
}

/** WebGL2 renderer; DPR = min(devicePixelRatio, dprCap(tier)); sRGB output; no tone mapping. */
export function createRenderer(canvas: HTMLCanvasElement, o: RendererOptions): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: o.alpha ?? false,
    antialias: o.antialias ?? false,
    preserveDrawingBuffer: o.preserveDrawingBuffer ?? false,
    powerPreference: o.powerPreference ?? 'high-performance',
  })
  const cap = o.dprCap ?? dprCap(o.tier)
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, cap))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  return renderer
}

/**
 * Keep the renderer's drawing buffer matched to `el` (ResizeObserver, debounced 100 ms after the first call).
 * Uses setSize(..., false): size the canvas with CSS (this sets width/height 100% and display block for you).
 * Returns a disposer.
 */
export function fitRenderer(
  renderer: THREE.WebGLRenderer,
  el: HTMLElement,
  onResize?: (cssW: number, cssH: number) => void,
): () => void {
  const canvas = renderer.domElement
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  let timer = 0
  let first = true
  const apply = (): void => {
    timer = 0
    const w = Math.max(1, Math.round(el.clientWidth))
    const h = Math.max(1, Math.round(el.clientHeight))
    renderer.setSize(w, h, false)
    onResize?.(w, h)
  }
  const ro = new ResizeObserver(() => {
    if (first) {
      first = false
      apply()
      return
    }
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(apply, 100)
  })
  ro.observe(el)
  apply()
  return () => {
    ro.disconnect()
    if (timer) clearTimeout(timer)
  }
}

/** One oversized triangle covering clip space (positions -1..3, uv 0..2). */
export function fullscreenTriangle(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))
  return g
}

export function createRT(
  w: number,
  h: number,
  o: {
    type?: THREE.TextureDataType
    format?: THREE.PixelFormat
    depth?: boolean | 'texture'
    filter?: 'nearest' | 'linear'
    mipmaps?: boolean
    samples?: number
  } = {},
): THREE.WebGLRenderTarget {
  const filter = o.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: o.type ?? THREE.UnsignedByteType,
    format: o.format ?? THREE.RGBAFormat,
    magFilter: filter,
    minFilter: o.mipmaps ? THREE.LinearMipmapLinearFilter : filter,
    generateMipmaps: !!o.mipmaps,
    depthBuffer: o.depth !== undefined && o.depth !== false,
    samples: o.samples ?? 0,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  })
  if (o.depth === 'texture') rt.depthTexture = new THREE.DepthTexture(Math.max(1, w), Math.max(1, h))
  return rt
}

export function floatCaps(renderer: THREE.WebGLRenderer): {
  floatRT: boolean
  halfFloatRT: boolean
  floatBlend: boolean
  floatLinear: boolean
} {
  const ext = renderer.extensions
  const floatRT = ext.has('EXT_color_buffer_float')
  return {
    floatRT,
    halfFloatRT: floatRT || ext.has('EXT_color_buffer_half_float'),
    floatBlend: ext.has('EXT_float_blend'),
    floatLinear: ext.has('OES_texture_float_linear'),
  }
}

function channelsOf(format: THREE.AnyPixelFormat): number {
  if (format === THREE.RedFormat || format === THREE.RedIntegerFormat || format === THREE.DepthFormat) return 1
  if (format === THREE.RGFormat || format === THREE.RGIntegerFormat) return 2
  return 4
}

/**
 * Read a render target back to the CPU. Uses readRenderTargetPixelsAsync (no GPU stall) with a sync
 * fallback. Half-float targets come back converted to Float32Array.
 */
export async function readRTPixels(
  renderer: THREE.WebGLRenderer,
  rt: THREE.WebGLRenderTarget,
  o: { async?: boolean } = {},
): Promise<Uint8Array | Float32Array> {
  const { width: w, height: h } = rt
  const ch = channelsOf(rt.texture.format)
  const type = rt.texture.type
  const n = w * h * ch
  const half = type === THREE.HalfFloatType
  const isFloat = type === THREE.FloatType
  const make = (): Uint8Array | Float32Array | Uint16Array => (isFloat ? new Float32Array(n) : half ? new Uint16Array(n) : new Uint8Array(n))
  let buf = make()
  let done = false
  if (o.async !== false && typeof renderer.readRenderTargetPixelsAsync === 'function') {
    try {
      const r = (await renderer.readRenderTargetPixelsAsync(rt, 0, 0, w, h, buf)) as typeof buf
      buf = r
      done = true
    } catch {
      buf = make() // fall back to the sync path
    }
  }
  if (!done) renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf as Uint8Array | Float32Array)
  if (half) {
    const u16 = buf as Uint16Array
    const out = new Float32Array(u16.length)
    for (let i = 0; i < u16.length; i++) out[i] = THREE.DataUtils.fromHalfFloat(u16[i] as number)
    return out
  }
  return buf as Uint8Array | Float32Array
}

/** A DataTexture from typed data. u8 textures use unpackAlignment 1 so odd widths are safe. */
export function dataTexture(
  data: Uint8Array | Float32Array | Uint16Array,
  w: number,
  h: number,
  o: {
    format: 'r' | 'rg' | 'rgba'
    type: 'u8' | 'f32' | 'f16'
    filter?: 'nearest' | 'linear'
    repeat?: boolean
    mipmaps?: boolean
  },
): THREE.DataTexture {
  const format = o.format === 'r' ? THREE.RedFormat : o.format === 'rg' ? THREE.RGFormat : THREE.RGBAFormat
  const type = o.type === 'u8' ? THREE.UnsignedByteType : o.type === 'f32' ? THREE.FloatType : THREE.HalfFloatType
  const tex = new THREE.DataTexture(data, w, h, format, type)
  const filter = o.filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter
  tex.magFilter = filter
  tex.minFilter = o.mipmaps ? THREE.LinearMipmapLinearFilter : filter
  tex.generateMipmaps = !!o.mipmaps
  tex.wrapS = tex.wrapT = o.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

export function toHalfFloatArray(f32: Float32Array): Uint16Array {
  const out = new Uint16Array(f32.length)
  for (let i = 0; i < f32.length; i++) out[i] = THREE.DataUtils.toHalfFloat(f32[i] as number)
  return out
}

/** Dispose geometries, materials and every texture a material references, for the whole subtree. */
export function disposeDeep(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const m = node as THREE.Mesh
    m.geometry?.dispose()
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
    for (const mat of mats) {
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) {
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
        else if (v && typeof v === 'object' && 'value' in (v as object)) {
          const val = (v as { value: unknown }).value
          if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose() // ShaderMaterial uniforms
        }
      }
      const uniforms = (mat as THREE.ShaderMaterial).uniforms
      if (uniforms) {
        for (const u of Object.values(uniforms)) {
          const val = (u as { value: unknown }).value
          if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose()
        }
      }
      mat.dispose()
    }
    const light = node as THREE.Light & { shadow?: THREE.LightShadow }
    light.shadow?.map?.dispose()
  })
}

/** Run `draw()` (which must render) then toBlob in the same task so the drawing buffer is still valid. */
export function snapshotCanvas(renderer: THREE.WebGLRenderer, draw: () => void, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    draw()
    renderer.domElement.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('snapshotCanvas: toBlob returned null'))),
      type,
      quality,
    )
  })
}
