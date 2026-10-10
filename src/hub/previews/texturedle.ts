// Texturedle (8 s, hero 2.6): an extreme macro of peeling barn paint over weathered wood. Not a
// puzzle answer. Height fields (fbm, cracks, craquelure) become normal maps, relit every frame by a
// raking warm light whose azimuth turns 360° per loop, so the shadows wheel like a sundial. The
// paint layer sits higher and shifts against the wood (the ±5° tilt as parallax). A glass marble
// rolls a slow Lissajous path, refracting (inverted, magnified) what is under it.

import type { Preview, PreviewEnv } from './types'
import { W, H, TAU, ctx2d, makeCanvas, designSpace, fbm2, chunkedRows, smoothstep, finish, windowed } from './kit'
import { worley2 } from '@shared/core'

const IW = 300
const IH = 200
const EL = (21 * Math.PI) / 180

export function createTexturedlePreview(): Preview {
  const period = 8
  let env: PreviewEnv | null = null
  // per-texel fields
  const N = IW * IH
  const wN = new Float32Array(N * 3)
  const pN = new Float32Array(N * 3)
  const wA = new Uint8ClampedArray(N * 3)
  const pA = new Uint8ClampedArray(N * 3)
  const pM = new Float32Array(N) // paint coverage 0..1
  let woodC: HTMLCanvasElement | null = null
  let paintC: HTMLCanvasElement | null = null
  let shadowC: HTMLCanvasElement | null = null
  let woodI: ImageData | null = null
  let paintI: ImageData | null = null

  function heights(seed: number, hw: Float32Array, hp: Float32Array): (y: number) => void {
    // option objects made once: the loop below runs 60k times
    const oWarp = { seed, octaves: 3 }
    const oFibre = { seed: seed + 1, octaves: 3 }
    const oCrack = { seed: seed + 2, octaves: 3 }
    const oPaint = { seed: seed + 3, octaves: 5 }
    const oPaint2 = { seed: seed + 4, octaves: 3 }
    const oWorley = { seed: seed + 5 }
    const oChalk = { seed: seed + 6, octaves: 3 }
    const hit = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 }
    return (y) => {
      for (let x = 0; x < IW; x++) {
        const i = y * IW + x
        const u = (x / IW) * W
        const v = (y / IH) * H
        // ---- wood: boards running left to right, grain lines, fibres, a seam and a dry crack
        const warp = fbm2(u * 0.009, v * 0.035, oWarp)
        const grain = Math.sin((v + warp * 30) * 0.45)
        const fibre = fbm2(u * 0.05, v * 0.7, oFibre)
        const seam = smoothstep(3.2, 0, Math.abs(v - 172 - warp * 4))
        const crackN = Math.abs(fbm2(u * 0.004, v * 0.03, oCrack) + 0.12)
        const crack = crackN < 0.035 ? 1 - crackN / 0.035 : 0
        hw[i] = 0.22 * grain + 0.2 * fibre - 1.2 * seam - 0.7 * crack
        const tone = 0.5 + 0.22 * grain + 0.22 * fibre - 0.5 * seam - 0.45 * crack
        wA[i * 3] = 70 + 92 * tone
        wA[i * 3 + 1] = 64 + 84 * tone
        wA[i * 3 + 2] = 56 + 74 * tone
        // ---- paint: faded barn red, lifting at its edges, crazed into small plates
        const m = fbm2(u * 0.011, v * 0.015, oPaint) + 0.16 * fbm2(u * 0.05, v * 0.05, oPaint2) + 0.05
        const cov = smoothstep(0, 0.035, m)
        pM[i] = cov
        const edge = 1 - smoothstep(0.0, 0.11, m)
        const wh = worley2(u * 0.075, v * 0.075, oWorley, hit)
        const craze = 1 - smoothstep(0.0, 0.07, wh.f2 - wh.f1)
        const chalk = fbm2(u * 0.03, v * 0.03, oChalk)
        hp[i] = 0.55 + 0.55 * edge - 0.45 * craze + 0.05 * chalk + 0.08 * grain
        const primer = smoothstep(0.035, 0.0, m - 0.0) * 0.9 + edge * 0.25
        const fade = 0.5 + 0.5 * chalk
        let r = 150 + 40 * fade
        let g = 58 + 34 * fade
        let b = 42 + 30 * fade
        r = r + (226 - r) * primer
        g = g + (214 - g) * primer
        b = b + (192 - b) * primer
        const dk = 1 - 0.5 * craze
        pA[i * 3] = r * dk
        pA[i * 3 + 1] = g * dk
        pA[i * 3 + 2] = b * dk
      }
    }
  }

  function normals(h: Float32Array, out: Float32Array, k: number): void {
    for (let y = 0; y < IH; y++) {
      for (let x = 0; x < IW; x++) {
        const i = y * IW + x
        const xl = h[y * IW + Math.max(0, x - 1)]!
        const xr = h[y * IW + Math.min(IW - 1, x + 1)]!
        const yu = h[Math.max(0, y - 1) * IW + x]!
        const yd = h[Math.min(IH - 1, y + 1) * IW + x]!
        const nx = -(xr - xl) * k
        const ny = -(yd - yu) * k
        const inv = 1 / Math.hypot(nx, ny, 1)
        out[i * 3] = nx * inv
        out[i * 3 + 1] = ny * inv
        out[i * 3 + 2] = inv
      }
    }
  }

  function light(t: number): void {
    const az = (t / period) * TAU + 0.6
    const lx = Math.cos(az) * Math.cos(EL)
    const ly = Math.sin(az) * Math.cos(EL)
    const lz = Math.sin(EL)
    // half vector with a top-down viewer
    const hx = lx
    const hy = ly
    const hz = lz + 1
    const hl = 1 / Math.hypot(hx, hy, hz)
    const w32 = new Uint32Array(woodI!.data.buffer)
    const p32 = new Uint32Array(paintI!.data.buffer)
    for (let i = 0; i < N; i++) {
      const j = i * 3
      // wood: matte
      let d = wN[j]! * lx + wN[j + 1]! * ly + wN[j + 2]! * lz
      if (d < 0) d = 0
      let s = 0.3 + 1.25 * d
      let r = wA[j]! * s * 1.0
      let g = wA[j + 1]! * s * 0.9
      let b = wA[j + 2]! * s * 0.78
      w32[i] = 0xff000000 | (clampByte(b) << 16) | (clampByte(g) << 8) | clampByte(r)
      const m = pM[i]!
      if (m <= 0.001) {
        p32[i] = 0
        continue
      }
      d = pN[j]! * lx + pN[j + 1]! * ly + pN[j + 2]! * lz
      if (d < 0) d = 0
      let sp = (pN[j]! * hx + pN[j + 1]! * hy + pN[j + 2]! * hz) * hl
      sp = sp > 0 ? sp ** 18 * 70 : 0
      s = 0.32 + 1.2 * d
      r = pA[j]! * s + sp
      g = pA[j + 1]! * s * 0.92 + sp
      b = pA[j + 2]! * s * 0.82 + sp * 0.9
      p32[i] = ((m * 255) << 24) | (clampByte(b) << 16) | (clampByte(g) << 8) | clampByte(r)
    }
    ctx2d(woodC!).putImageData(woodI!, 0, 0)
    ctx2d(paintC!).putImageData(paintI!, 0, 0)
  }

  return {
    period,
    heroT: 2.6,
    async init(e) {
      env = e
      const hw = new Float32Array(N)
      const hp = new Float32Array(N)
      await chunkedRows(IH, heights(e.seed, hw, hp))
      normals(hw, wN, 9)
      normals(hp, pN, 12)
      woodC = makeCanvas(IW, IH)
      paintC = makeCanvas(IW, IH)
      woodI = ctx2d(woodC).createImageData(IW, IH)
      paintI = ctx2d(paintC).createImageData(IW, IH)
      // the paint's own cast shadow: its coverage, blurred by a down/up sample
      const small = makeCanvas(IW / 4, IH / 4)
      const mc = makeCanvas(IW, IH)
      const mi = ctx2d(mc).createImageData(IW, IH)
      for (let i = 0; i < N; i++) {
        mi.data[i * 4 + 3] = pM[i]! * 255
      }
      ctx2d(mc).putImageData(mi, 0, 0)
      ctx2d(small).drawImage(mc, 0, 0, small.width, small.height)
      shadowC = makeCanvas(IW, IH)
      const sx = ctx2d(shadowC)
      sx.imageSmoothingEnabled = true
      sx.drawImage(small, 0, 0, IW, IH)
    },
    resize(e) {
      env = e
    },
    draw(t) {
      if (!env || !woodC) return
      const { ctx, w, h } = env
      const tt = ((t % period) + period) % period
      light(tt)
      const az = (tt / period) * TAU + 0.6
      const lx = Math.cos(az)
      const ly = Math.sin(az)
      const ph = (tt / period) * TAU
      const px = 2.6 * Math.sin(ph)
      const py = 1.7 * Math.sin(2 * ph + 1)
      ctx.save()
      designSpace(ctx, w, h)
      ctx.imageSmoothingEnabled = true
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.drawImage(woodC, -4, -4, W + 8, H + 8)
      const sl = 5.5
      ctx.globalAlpha = 0.6
      ctx.drawImage(shadowC!, -4 + px - lx * sl, -4 + py - ly * sl, W + 8, H + 8)
      ctx.globalAlpha = 1
      ctx.drawImage(paintC!, -4 + px, -4 + py, W + 8, H + 8)

      // ---- the marble
      const mx = 180 + 104 * Math.sin(ph + 0.4)
      const my = 120 + 56 * Math.sin(2 * ph)
      const R = 25
      // soft contact shadow, thrown away from the light, with a caustic in it
      const shx = mx - lx * R * 0.85
      const shy = my - ly * R * 0.85
      let g = ctx.createRadialGradient(shx, shy, R * 0.2, shx, shy, R * 1.35)
      g.addColorStop(0, 'rgba(10,6,4,0.55)')
      g.addColorStop(1, 'rgba(10,6,4,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(shx, shy, R * 1.35, R * 1.15, az, 0, TAU)
      ctx.fill()
      const cx = mx - lx * R * 1.05
      const cy = my - ly * R * 1.05
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42)
      g.addColorStop(0, 'rgba(255,236,190,0.75)')
      g.addColorStop(1, 'rgba(255,236,190,0)')
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = g
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
      ctx.globalCompositeOperation = 'source-over'
      // refraction: what is under the ball, inverted and magnified
      ctx.save()
      ctx.beginPath()
      ctx.arc(mx, my, R, 0, TAU)
      ctx.clip()
      const sx = w / W
      const sy = h / H
      const rr = R * 0.62
      ctx.translate(mx, my)
      ctx.rotate(Math.PI)
      ctx.drawImage(ctx.canvas, (mx - rr) * sx, (my - rr) * sy, rr * 2 * sx, rr * 2 * sy, -R, -R, R * 2, R * 2)
      ctx.restore()
      // glass: dark Fresnel rim, warm bright rim on the far side, specular glints
      g = ctx.createRadialGradient(mx, my, R * 0.55, mx, my, R)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.85, 'rgba(8,10,14,0.35)')
      g.addColorStop(1, 'rgba(8,10,14,0.75)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mx, my, R, 0, TAU)
      ctx.fill()
      ctx.globalCompositeOperation = 'screen'
      g = ctx.createRadialGradient(mx - lx * R * 0.55, my - ly * R * 0.55, 0, mx - lx * R * 0.55, my - ly * R * 0.55, R * 0.6)
      g.addColorStop(0, 'rgba(255,214,160,0.45)')
      g.addColorStop(1, 'rgba(255,214,160,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mx, my, R, 0, TAU)
      ctx.fill()
      const gx = mx + lx * R * 0.5
      const gy = my + ly * R * 0.5
      g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.32)
      g.addColorStop(0, 'rgba(255,255,250,1)')
      g.addColorStop(0.25, 'rgba(255,250,235,0.7)')
      g.addColorStop(1, 'rgba(255,250,235,0)')
      ctx.fillStyle = g
      ctx.fillRect(gx - R, gy - R, R * 2, R * 2)
      ctx.globalCompositeOperation = 'source-over'

      // ---- the scale bar fades in at 5–6 s
      const a = windowed(tt, 4.8, 5.4, 6.7, 7.3)
      if (a > 0.001) {
        ctx.globalAlpha = a
        ctx.strokeStyle = '#F4EFE6'
        ctx.fillStyle = '#F4EFE6'
        ctx.lineWidth = 1.6
        ctx.shadowColor = 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = 3
        const bx = 18
        const by = 220
        const bl = 46
        ctx.beginPath()
        ctx.moveTo(bx, by - 4)
        ctx.lineTo(bx, by)
        ctx.lineTo(bx + bl, by)
        ctx.lineTo(bx + bl, by - 4)
        ctx.stroke()
        ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText('1 mm', bx, by - 8)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
      ctx.restore()
      finish(ctx, tt, w, h, { bloom: 0.3 })
    },
  }
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : v | 0
}


