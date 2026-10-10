// Device and GPU probing, quality tiers, and the frame-time monitor (architecture.md §4.1, §7.2).

import { flags, type Tier } from './flags'

export interface DeviceInfo {
  coarsePointer: boolean
  smallScreen: boolean // min(screen w, h) < 900
  cores: number
  memoryGB: number | null
  ios: boolean
  android: boolean
  webdriver: boolean
  saveData: boolean
}

interface NavigatorExtras {
  deviceMemory?: number
  connection?: { saveData?: boolean }
  maxTouchPoints?: number
}

let deviceCache: DeviceInfo | null = null

export function deviceInfo(): DeviceInfo {
  if (deviceCache) return deviceCache
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & NavigatorExtras
  const ua = nav.userAgent ?? ''
  const touchMac = nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1 // iPadOS reports as a Mac
  const sw = typeof screen !== 'undefined' ? screen.width : 1920
  const sh = typeof screen !== 'undefined' ? screen.height : 1080
  deviceCache = {
    coarsePointer: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    smallScreen: Math.min(sw, sh) < 900,
    cores: nav.hardwareConcurrency || 4,
    memoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    ios: /iPad|iPhone|iPod/.test(ua) || touchMac,
    android: /Android/i.test(ua),
    webdriver: nav.webdriver === true,
    saveData: nav.connection?.saveData === true,
  }
  return deviceCache
}

export interface GLInfo {
  renderer: string
  vendor: string
  swiftshader: boolean
  maxTextureSize: number
  floatRT: boolean
  halfFloatRT: boolean
  floatBlend: boolean
  floatLinear: boolean
}

let glCache: GLInfo | null | undefined
const glByContext = new WeakMap<WebGL2RenderingContext, GLInfo>()

function readGL(gl: WebGL2RenderingContext): GLInfo {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  const vendor = String(dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR))
  const floatRT = !!gl.getExtension('EXT_color_buffer_float')
  const halfFloatRT = floatRT || !!gl.getExtension('EXT_color_buffer_half_float')
  return {
    renderer,
    vendor,
    swiftshader: /swiftshader|llvmpipe|software|softpipe/i.test(renderer + ' ' + vendor),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    floatRT,
    halfFloatRT,
    floatBlend: !!gl.getExtension('EXT_float_blend'),
    floatLinear: !!gl.getExtension('OES_texture_float_linear'),
  }
}

/** Capabilities of the GPU. With no context given it uses (and releases) a throwaway one, and caches the result. */
export function probeGL(gl?: WebGL2RenderingContext | null): GLInfo | null {
  if (gl) {
    let info = glByContext.get(gl)
    if (!info) {
      info = readGL(gl)
      glByContext.set(gl, info)
    }
    return info
  }
  if (glCache !== undefined) return glCache
  glCache = null
  try {
    const c = document.createElement('canvas')
    const ctx = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false, powerPreference: 'high-performance' })
    if (ctx) {
      glCache = readGL(ctx)
      ctx.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    glCache = null
  }
  return glCache
}

const RANK: Record<Tier, number> = { test: 0, low: 1, medium: 2, high: 3 }

/**
 * Pick a quality tier. Order: ?quality= (or ?q=) -> test (flags().test, webdriver or a software
 * rasterizer) -> low (iOS, coarse pointer on a small screen, <= 4 cores, <= 4 GB) -> medium (coarse) -> high.
 * `prefer` is a ceiling: the result is never above it (a game that tops out at 'medium').
 */
export function detectTier(o: { gl?: WebGL2RenderingContext | null; prefer?: Tier } = {}): Tier {
  const f = flags()
  if (f.quality) return f.quality
  const d = deviceInfo()
  let tier: Tier
  if (f.test || d.webdriver || probeGL(o.gl ?? undefined)?.swiftshader) tier = 'test'
  else if (d.ios || (d.coarsePointer && d.smallScreen) || d.cores <= 4 || (d.memoryGB !== null && d.memoryGB <= 4) || d.saveData)
    tier = 'low'
  else if (d.coarsePointer) tier = 'medium'
  else tier = 'high'
  if (o.prefer && RANK[tier] > RANK[o.prefer]) tier = o.prefer
  return tier
}

/** Device-pixel-ratio cap per tier: high 2, medium 1.5, low 1, test 1. */
export function dprCap(tier: Tier): number {
  return tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1
}

export interface PerfMonitor {
  sample(frameMs: number): void
  readonly meanMs: number
  readonly p75Ms: number
  readonly p90Ms: number
  onDegrade(cb: () => void, o?: { thresholdMs?: number; windowS?: number; cooldownS?: number }): () => void
  onImprove(cb: () => void, o?: { thresholdMs?: number; windowS?: number }): () => void
}

interface Rule {
  kind: 'degrade' | 'improve'
  cb: () => void
  threshold: number
  windowS: number
  cooldownS: number
  armedAt: number // monitor time when registered or last fired
  lastFire: number
}

const CAP = 720 // samples kept (12 s at 60 fps)

/** Frame-time statistics on a rolling window, driven by sample(frameMs). Time is the sum of samples, not wall-clock. */
export function createPerfMonitor(): PerfMonitor {
  const ms = new Float32Array(CAP)
  const tt = new Float64Array(CAP) // monitor time (s) at each sample
  let n = 0
  let head = 0
  let time = 0
  let nextCheck = 0
  const rules: Rule[] = []
  const scratch = new Float32Array(CAP)
  let statsAt = -1
  let mean = 0
  let p75 = 0
  let p90 = 0

  /** Percentile over samples newer than `since` (monitor seconds). Returns [count, p, mean]. */
  const window = (since: number, p: number): { count: number; q: number } => {
    let c = 0
    for (let k = 0; k < n; k++) {
      const i = (head - 1 - k + CAP) % CAP
      if ((tt[i] as number) < since) break
      scratch[c++] = ms[i] as number
    }
    if (c === 0) return { count: 0, q: 0 }
    const v = scratch.subarray(0, c)
    v.sort()
    return { count: c, q: v[Math.min(c - 1, Math.floor(p * (c - 1) + 0.5))] as number }
  }

  const refreshStats = (): void => {
    if (statsAt === head) return
    statsAt = head
    const w = Math.min(n, 120)
    if (w === 0) {
      mean = p75 = p90 = 0
      return
    }
    let sum = 0
    for (let k = 0; k < w; k++) {
      const i = (head - 1 - k + CAP) % CAP
      const v = ms[i] as number
      scratch[k] = v
      sum += v
    }
    mean = sum / w
    const v = scratch.subarray(0, w)
    v.sort()
    p75 = v[Math.min(w - 1, Math.floor(0.75 * (w - 1) + 0.5))] as number
    p90 = v[Math.min(w - 1, Math.floor(0.9 * (w - 1) + 0.5))] as number
  }

  const check = (): void => {
    for (const r of rules) {
      if (time - r.armedAt < r.windowS) continue // not enough observation since arming
      if (r.kind === 'degrade' && time - r.lastFire < r.cooldownS) continue
      const w = window(time - r.windowS, 0.75)
      if (w.count < 10) continue
      const hit = r.kind === 'degrade' ? w.q > r.threshold : w.q < r.threshold
      if (hit) {
        r.lastFire = time
        r.armedAt = time // improve needs a fresh full window after firing
        r.cb()
      }
    }
  }

  return {
    sample(frameMs: number) {
      if (!(frameMs >= 0) || frameMs > 1000) return // tab switches and stalls are not performance
      const v = frameMs > 250 ? 250 : frameMs
      time += v / 1000
      ms[head] = v
      tt[head] = time
      head = (head + 1) % CAP
      if (n < CAP) n++
      if (time >= nextCheck && rules.length) {
        nextCheck = time + 0.25
        check()
      }
    },
    get meanMs() {
      refreshStats()
      return mean
    },
    get p75Ms() {
      refreshStats()
      return p75
    },
    get p90Ms() {
      refreshStats()
      return p90
    },
    onDegrade(cb, o = {}) {
      const r: Rule = {
        kind: 'degrade',
        cb,
        threshold: o.thresholdMs ?? 22,
        windowS: o.windowS ?? 3,
        cooldownS: o.cooldownS ?? 5,
        armedAt: time,
        lastFire: -Infinity,
      }
      rules.push(r)
      return () => {
        const i = rules.indexOf(r)
        if (i >= 0) rules.splice(i, 1)
      }
    },
    onImprove(cb, o = {}) {
      const r: Rule = {
        kind: 'improve',
        cb,
        threshold: o.thresholdMs ?? 12,
        windowS: o.windowS ?? 10,
        cooldownS: 0,
        armedAt: time,
        lastFire: -Infinity,
      }
      rules.push(r)
      return () => {
        const i = rules.indexOf(r)
        if (i >= 0) rules.splice(i, 1)
      }
    },
  }
}
