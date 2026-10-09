// Recipe: Day 1, the rusty mailbox at the end of the drive.
// A convex arch-top sheet-steel box (R = 120 mm), one stamped stiffening rib,
// faded dark-green enamel with craquelure, Worley rust blisters with flaked
// crowns, pits, laminar scale, scratches through to bright steel, and rust
// run-off streaks that all run one way (-y): the box stands upright.
// Units: millimetres. Pure function of (x, y, seed).

import { fbm, gnoise, ridged, worley, worleyHit, hash2, hash2b, rng, smoothstep, clamp, mix } from './noise'
import type { SurfaceRecipe, Texel } from './surface'

export interface MailboxParams {
  /** arch radius of the box top (mm) */
  formRadius: number
  /** stamped rib height (mm) */
  ribHeight: number
  /** stamped rib half-width (mm) */
  ribHalfWidth: number
  /** 0..1 overall rust amount */
  rustiness: number
  /** number of scratches */
  scratches: number
}

export const MAILBOX_DEFAULTS: MailboxParams = {
  formRadius: 120,
  ribHeight: 0.4,
  ribHalfWidth: 0.85,
  rustiness: 0.55,
  scratches: 9,
}

interface Scratch {
  ax: number
  ay: number
  ux: number
  uy: number
  len: number
  w: number
  depth: number
  rusted: number
  wob: number
}

export function rustyMailbox(params: Partial<MailboxParams> = {}): SurfaceRecipe {
  const P = { ...MAILBOX_DEFAULTS, ...params }
  return {
    id: 'rusty-mailbox',
    name: 'Rusty mailbox',
    prepare(seed: number, sizeX: number, sizeY: number) {
      const R = P.formRadius
      const fa = 0.11 // arch axis tilted a few degrees off the screen axes
      const ca = Math.cos(fa)
      const sa = Math.sin(fa)
      // rib: a straight stamped line crossing the frame diagonally
      const ribAng = 0.63
      const rnx = -Math.sin(ribAng)
      const rny = Math.cos(ribAng)
      const ribPx = -1.5
      const ribPy = 2.5

      // coarse rust-coverage grid (sampled for blister centres and run-off)
      const G = 160
      const gx0 = -sizeX / 2 - 4
      const gy0 = -sizeY / 2 - 4
      const gw = sizeX + 8
      const gh = sizeY + 8
      const grid = new Float32Array(G * G)
      const rawRust = (x: number, y: number) => {
        const dr = Math.abs((x - ribPx) * rnx + (y - ribPy) * rny)
        let rm = 0.55 * fbm(x * 0.085, y * 0.085, seed + 11, 4) + 0.32 * fbm(x * 0.3, y * 0.3, seed + 12, 3)
        rm += 0.38 * Math.exp(-((dr / 2.4) ** 2)) // paint cracks along the stamped rib first
        rm += (P.rustiness - 0.5) * 0.6
        rm -= 0.006 * y // water sits lower on the box
        return rm
      }
      for (let j = 0; j < G; j++)
        for (let i = 0; i < G; i++) grid[j * G + i] = rawRust(gx0 + ((i + 0.5) / G) * gw, gy0 + ((j + 0.5) / G) * gh)
      const gridAt = (arr: Float32Array, x: number, y: number) => {
        let fx = ((x - gx0) / gw) * G - 0.5
        let fy = ((y - gy0) / gh) * G - 0.5
        fx = clamp(fx, 0, G - 1.001)
        fy = clamp(fy, 0, G - 1.001)
        const i = fx | 0
        const j = fy | 0
        const tx = fx - i
        const ty = fy - j
        const k = j * G + i
        const a = arr[k] + (arr[k + 1] - arr[k]) * tx
        const b = arr[k + G] + (arr[k + G + 1] - arr[k + G]) * tx
        return a + (b - a) * ty
      }
      const rustAt = (x: number, y: number) => gridAt(grid, x, y)
      const coverage = (rm: number) => smoothstep(0.1, 0.45, rm)
      // run-off: rust above (higher y) bleeds down; precomputed on the coarse grid
      const stainGrid = new Float32Array(G * G)
      for (let j = 0; j < G; j++)
        for (let i = 0; i < G; i++) {
          const x = gx0 + ((i + 0.5) / G) * gw
          const y = gy0 + ((j + 0.5) / G) * gh
          let st = 0
          for (let k = 1; k <= 6; k++) st += coverage(rustAt(x, y + k * 0.9)) * (1 - k / 7)
          stainGrid[j * G + i] = st / 3
        }

      // scratches: mostly one direction (a key dragged along the lid), a few strays
      const rand = rng(seed * 7 + 3)
      const scratches: Scratch[] = []
      const mainDir = 2.75
      for (let s = 0; s < P.scratches; s++) {
        const stray = rand() < 0.3
        const ang = stray ? rand() * Math.PI : mainDir + (rand() - 0.5) * 0.35
        const len = 5 + rand() * 26
        const cx = (rand() - 0.5) * sizeX * 0.9
        const cy = (rand() - 0.5) * sizeY * 0.9
        const ux = Math.cos(ang)
        const uy = Math.sin(ang)
        scratches.push({
          ax: cx - (ux * len) / 2,
          ay: cy - (uy * len) / 2,
          ux,
          uy,
          len,
          w: 0.045 + rand() * 0.09,
          depth: 0.018 + rand() * 0.035,
          rusted: rand() < 0.45 ? 1 : 0,
          wob: rand() * 100,
        })
      }

      const W = worleyHit()
      const Wp = worleyHit()
      const Wc = worleyHit()

      return (x: number, y: number, o: Texel) => {
        // ---- big form --------------------------------------------------------
        const xr = x * ca + y * sa
        const yr = -x * sa + y * ca
        const form = Math.sqrt(R * R - xr * xr) - R

        // ---- stamped rib with gutters -----------------------------------------
        const dr = (x - ribPx) * rnx + (y - ribPy) * rny
        const adr = Math.abs(dr)
        const rw = P.ribHalfWidth
        const ribProfile = smoothstep(rw, rw * 0.32, adr)
        const gut = adr > rw * 0.9 && adr < rw * 2.3 ? -0.035 * Math.sin((Math.PI * (adr - rw * 0.9)) / (rw * 1.4)) : 0
        const rib = P.ribHeight * ribProfile + gut

        // ---- rust coverage + run-off ------------------------------------------
        const rm = rustAt(x, y)
        const cov = coverage(rm)
        // run-off: rust above (higher y) bleeds down in streaks
        let stain = gridAt(stainGrid, x, y)
        const streak = smoothstep(-0.1, 0.6, gnoise(x * 2.4, y * 0.11, seed + 21) + 0.35 * gnoise(x * 7.0, y * 0.3, seed + 22))
        stain = clamp(stain * streak - cov * 0.5, 0, 1)

        // ---- blisters (Worley 2.4 mm cells) -----------------------------------
        const cell = 2.4
        let blister = 0
        let crown = 0
        let blisterProx = 0
        let exists = 0
        let tb = 9
        let covC = 0
        if (rm > -0.35) {
          // (no blister can reach texels this far below the rust threshold)
          worley(x / cell, y / cell, seed + 31, W, 0.85)
          const bd = W.f1 * cell
          covC = coverage(rustAt(W.cx * cell, W.cy * cell))
          const bh1 = hash2b(Math.floor(W.cx), Math.floor(W.cy), seed + 32)
          exists = W.id < covC * 0.95 ? 1 : 0
          const Rb = (0.5 + 1.35 * bh1) * (0.55 + 0.45 * covC)
          tb = bd / Rb
        }
        if (exists && tb < 1.6) {
          blisterProx = smoothstep(1.6, 0.6, tb)
          if (tb < 1) {
            const hb = (0.1 + 0.36 * hash2(Math.floor(W.cx) + 7, Math.floor(W.cy), seed + 33)) * (0.45 + 0.55 * covC)
            const q = 1 - tb * tb
            blister = hb * q * Math.sqrt(q)
            crown = smoothstep(0.85, 0.55, tb)
          }
        }

        // ---- pits (Worley 0.7 mm) ---------------------------------------------
        const pc = 0.7
        let pit = 0
        let pitW = 0
        if (cov > 0.001) worley(x / pc, y / pc, seed + 41, Wp, 0.8)
        if (cov > 0.001 && Wp.id < 0.42 * cov) {
          const rp = (0.12 + 0.22 * hash2(Math.floor(Wp.cx), Math.floor(Wp.cy), seed + 42)) * pc * 0.9
          const dp = Wp.f1 * pc
          if (dp < rp * 1.25) {
            const tp = dp / rp
            const depth = 0.08 + 0.15 * hash2b(Math.floor(Wp.cx), Math.floor(Wp.cy), seed + 43)
            pit = tp < 1 ? -depth * (1 - tp * tp) : 0
            // raised rim of corrosion product
            pit += tp > 0.8 ? 0.02 * smoothstep(1.25, 1.0, tp) * smoothstep(0.8, 1.0, tp) : 0
            pitW = smoothstep(1.15, 0.6, tp)
          }
        }

        // ---- paint: loss, craquelure, orange peel -------------------------------
        const pl = 0.5 + 0.5 * fbm(x * 0.21, y * 0.21, seed + 51, 4)
        const lossT = 0.74 - 0.36 * cov - 0.25 * blisterProx
        const loss = smoothstep(lossT - 0.015, lossT + 0.015, pl)
        const flakeLift = 0.022 * Math.exp(-(((pl - lossT) / 0.012) ** 2)) * (1 - loss * 0.3)
        const crackAmt = smoothstep(0.18, 0.75, cov + 0.7 * blisterProx)
        let crack = 0
        if (crackAmt > 0) {
          worley(x / 0.85, y / 0.85, seed + 61, Wc, 0.95)
          crack = (1 - smoothstep(0.0, 0.045, Wc.f2 - Wc.f1)) * crackAmt
        }
        const peel = gnoise(x * 1.7, y * 1.7, seed + 71) * 0.007 + gnoise(x * 5.3, y * 5.3, seed + 72) * 0.003
        // scuffs: short fine scratches in two loose directions (the box gets handled)
        const sa1 = 0.5 + 0.6 * gnoise(x * 0.05, y * 0.05, seed + 141)
        const c1 = Math.cos(sa1)
        const s1 = Math.sin(sa1)
        const u1 = x * c1 + y * s1
        const v1 = -x * s1 + y * c1
        const line1 = 1 - Math.abs(gnoise(u1 * 0.35, v1 * 9, seed + 142))
        const seg1 = smoothstep(0.15, 0.55, gnoise(u1 * 0.7, v1 * 0.7, seed + 143))
        const u2 = x * 0.2 - y * 0.98
        const v2 = x * 0.98 + y * 0.2
        const line2 = 1 - Math.abs(gnoise(u2 * 0.5, v2 * 13, seed + 144))
        const seg2 = smoothstep(0.3, 0.6, gnoise(u2 * 1.1, v2 * 1.1, seed + 145))
        const scuff = Math.max(smoothstep(0.955, 0.995, line1) * seg1, smoothstep(0.96, 0.995, line2) * seg2 * 0.7)
        // dust and grit specks
        const dn = gnoise(x * 11, y * 11, seed + 151)
        const dust = smoothstep(0.55, 0.8, dn)

        // ---- what is on top ----------------------------------------------------
        let rust = clamp(cov * (0.25 + 0.75 * loss) + crown * 0.95 + pitW * 0.9 + crack * cov * 0.4, 0, 1)
        rust = smoothstep(0.2, 0.75, rust)
        let paint = (1 - loss) * (1 - rust)
        let steel = clamp(1 - rust - paint, 0, 1)

        // ---- scratches -----------------------------------------------------------
        let scr = 0
        let scrH = 0
        let scrRust = 0
        for (let s = 0; s < scratches.length; s++) {
          const S = scratches[s]
          const px = x - S.ax
          const py = y - S.ay
          const t = px * S.ux + py * S.uy
          if (t < -0.2 || t > S.len + 0.2) continue
          const tc = t < 0 ? 0 : t > S.len ? S.len : t
          let dperp = Math.abs(px * S.uy - py * S.ux) + 0.03 * gnoise(t * 0.6 + S.wob, 0.5, seed + 81)
          if (t !== tc) dperp = Math.hypot(t - tc, dperp)
          // taper at ends
          const taper = smoothstep(0, 1.2, tc) * smoothstep(S.len, S.len - 2.0, tc)
          const w = S.w * (0.35 + 0.65 * taper)
          if (dperp > w * 1.8) continue
          const u = dperp / w
          const g = u < 1 ? -(S.depth * taper) * (1 - u * u) : 0
          const burr = u > 0.9 && u < 1.8 ? S.depth * 0.3 * taper * Math.sin(((u - 0.9) / 0.9) * Math.PI) : 0
          scrH = Math.min(scrH, g) + burr
          const inside = smoothstep(1.1, 0.7, u) * taper
          if (inside > scr) {
            scr = inside
            scrRust = S.rusted
          }
        }
        if (scr > 0) {
          const fresh = scr * (1 - scrRust)
          const old = scr * scrRust
          paint *= 1 - scr
          rust = Math.max(rust, old)
          steel = clamp(1 - rust - paint, 0, 1)
          void fresh
        }

        // ---- micro surfaces ------------------------------------------------------
        const mill = gnoise(xr * 0.7, yr * 26, seed + 91) * 0.0016 + gnoise(xr * 2.3, yr * 60, seed + 92) * 0.0008
        const crustR = ridged(x * 2.3, y * 2.3, seed + 101, 4)
        const crust = (crustR - 0.45) * 0.075 + gnoise(x * 9.5, y * 9.5, seed + 102) * 0.012 + gnoise(x * 22, y * 22, seed + 103) * 0.005

        const paintThick = 0.06 * paint * (1 - crack * 0.85) + flakeLift * (1 - rust) - scuff * 0.006 * paint
        const rustThick = rust * (0.045 + crust)
        let h = form + rib + mill * steel + paintThick + peel * paint + rustThick + blister + pit * smoothstep(0.1, 0.5, cov) + scrH + dust * 0.006
        o.h = h

        // ---- colour (sRGB) ------------------------------------------------------
        // enamel: faded mailbox green, chalked in patches, darker in cracks
        const fade = smoothstep(-0.4, 0.7, fbm(x * 0.13, y * 0.13, seed + 111, 3)) * 0.75
        const mott = gnoise(x * 3.1, y * 3.1, seed + 112) * 0.035 + gnoise(x * 13, y * 13, seed + 113) * 0.02
        let pr = mix(0.12, 0.38, fade) + mott
        let pg = mix(0.25, 0.44, fade) + mott
        let pb = mix(0.17, 0.38, fade) + mott * 0.8
        // scuffs read lighter (chalky paint), dust darker/greyer
        pr = mix(pr, 0.52, scuff * 0.55)
        pg = mix(pg, 0.56, scuff * 0.55)
        pb = mix(pb, 0.5, scuff * 0.55)
        pr = mix(pr, 0.22, dust * 0.5)
        pg = mix(pg, 0.2, dust * 0.5)
        pb = mix(pb, 0.17, dust * 0.5)
        const crackDark = 1 - crack * 0.3
        pr *= crackDark
        pg *= crackDark
        pb *= crackDark
        // rust: dark brown in low spots, orange/ochre on raised scale
        const rv = clamp(0.5 + crust * 7 + gnoise(x * 1.3, y * 1.3, seed + 121) * 0.35, 0, 1)
        const speck = smoothstep(0.72, 0.9, gnoise(x * 6.5, y * 6.5, seed + 122) * 0.5 + 0.5)
        let rr = mix(0.2, 0.62, rv)
        let rg = mix(0.08, 0.27, rv)
        let rb = mix(0.04, 0.1, rv)
        rr = mix(rr, 0.8, speck * 0.45)
        rg = mix(rg, 0.5, speck * 0.45)
        rb = mix(rb, 0.22, speck * 0.45)
        const pitDark = 1 - pitW * 0.6
        rr *= pitDark
        rg *= pitDark
        rb *= pitDark
        // steel: grey with mill streak brightness; fresh scratch brighter
        const sv = 0.43 + mill * 40 + gnoise(xr * 0.4, yr * 9, seed + 131) * 0.03
        const fresh = scr * (1 - scrRust)
        const sr = mix(sv, 0.7, fresh)
        const sg = mix(sv + 0.005, 0.71, fresh)
        const sb = mix(sv + 0.012, 0.72, fresh)
        let r = paint * pr + rust * rr + steel * sr
        let g = paint * pg + rust * rg + steel * sg
        let b = paint * pb + rust * rb + steel * sb
        // run-off stain over paint/steel
        const st = clamp(stain * 0.95, 0, 0.85) * (1 - rust)
        r = mix(r, 0.42, st)
        g = mix(g, 0.2, st)
        b = mix(b, 0.09, st)
        o.r = r
        o.g = g
        o.b = b

        // ---- shading + physics material -------------------------------------------
        o.rough = paint * mix(0.36, 0.64, Math.max(fade, scuff)) + rust * mix(0.92, 0.8, rv) + steel * mix(0.34, 0.22, fresh)
        o.metal = steel * (1 - stain * 0.5)
        o.mu = paint * 1.1 + rust * 1.6 + steel * 1.2
        o.rest = paint * 0.55 + rust * 0.25 + steel * 0.72
        o.crr = paint * 0.012 + rust * 0.06 + steel * 0.006
        o.hardness = rust * 1.0 + flakeLift * 25 + steel * 0.25 + scr * 0.3
        o.tag = rust
      }
    },
  }
}
