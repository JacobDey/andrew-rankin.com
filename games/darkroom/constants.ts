// Every tunable of darkroom.md §5, plus the time-compression constants that
// architecture §3.2 asks games to keep in their own files. @shared/photochem runs
// in physical real time; we scale the dt we pass for slow processes only.

export const FLUID = {
  nx: 48, ny: 36, dx: 0.0075, depth: 0.012, lip: 0.045, damping: 0.8, substepDt: 1 / 240, maxSubsteps: 8,
  lowNx: 32, lowNy: 24,
}
export const TILT = {
  degPerPx: 0.06, maxDeg: 10, keyDeg: 6, offsetPerM: 0.1,
}
/** First-run DEV tray: rests on a wedge so liquid pools at the near end (§9.3). */
export const TITLE_WEDGE = { tiltYDeg: 9, fill: 0.008 }

export const CHEM_HZ = 30
export const SHEET_RES = { high: [160, 200], medium: [160, 200], low: [128, 160], test: [128, 160] } as const
export const STRIP_RES = [48, 200] as const

/** Time compression (game seconds → chemistry seconds). The developer is always real time. */
export const TIME = {
  dev: 1, stop: 1, fix: 1.2, wash: 2.5, airDry: 10, lineDry: 14,
  uv: 22, cyanoDry: 8, cyanoWash: 8, peroxide: 1.6,
  fastForward: 8,
}

/** Light levels fed to @shared/photochem (lux, or W/m² UVA for the UV box). */
export const LIGHT = {
  roomLux: 400,
  safelightLux: 2.5, // at 1.2 m from the bulb; falls off with (1.2/r)²
  safelightRef: 1.2,
  enlargerLux: 0.9, // f/8-ish, 35 mm → 8×10; tuned so grade 2 at 10 s prints the mailbox at mean D ≈ 0.8
  enlargerLux8x10: 3.2, // contact frame on the baseboard: brighter, no enlargement
  uvW: 40,
  uvGlass: 0.85,
  visGlass: 0.92,
  faceDown: 0.03,
  safelightBatchS: 1.0, // safelight fog is applied in 1 s batches (cheap and identical)
}

/** Dark adaptation (§7.1). */
export const ADAPT = {
  room: 1.0, enlarger: 0.06, uvOpen: 0.05, uvClosed: 0.01, safe: 0.03, floor: 0.0008,
  maxX: 40, tauDark: 4, tauBright: 0.25,
}

export const PAPER = {
  wetTau: 1.0, dryTau: 25, curlLift: 0.004, sunkW: 0.7, dunkW: 0.35,
  kdFloat: 2.0, kdSunk: 0.25, restitution: 0.2, contactLo: 0.0003, contactHi: 0.0008,
  airDevFactor: 0.35, dripRate: 6,
}

/** Cyanotype mixing and coating (§5.8). */
export const IRON_K = {
  bottleMl: 100, pourMlPerS: 8, mlPerCoat: 2, brushMax: 2.0, brushMlPerS: 0.9,
  colA: '#9DB83A', colB: '#E09A2C',
}

export const PEROXIDE = { amount: 1.0, sigma: 0.015, diffusion: 3e-4, decay: 1 / 30, ripple: 0.001 }
export const DYE = { diffusion: 2e-5, decay: 0.03 }

export const TIMER = { min: 1, max: 99, default: 10, stripBands: 5 }
export const GRADES = ['00', '0', '1', '2', '3', '4', '5'] as const
export const gradeNumber = (g: string): number => (g === '00' ? -1 : Number(g))

export const AUTOSAVE_S = 20
export const NOTEBOOK_GATE = 8
