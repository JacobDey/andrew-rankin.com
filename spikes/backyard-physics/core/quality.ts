/**
 * Quality presets: every knob that matters for a mid-range phone in one place.
 * Pick with `?q=low|medium|high` or let `autoQuality()` decide.
 */
export interface Quality {
  name: 'low' | 'medium' | 'high'
  /** Max devicePixelRatio. */
  pixelRatio: number
  /** Shadow map size; 0 disables shadows. */
  shadowMapSize: number
  /** MSAA on the default framebuffer. */
  antialias: boolean
  /** Instanced grass tufts (3 blades each). */
  grassTufts: number
  /** Live sprinkler droplets. */
  sprinklerDroplets: number
  /** Cloth particles across x down for the big sheet. */
  clothGrid: [number, number]
  /** Cloth constraint iterations. */
  clothIterations: number
  /** Step the cloth every N physics steps (2 = 30 Hz cloth, interpolated). */
  clothEvery: number
  /** Physics: fixed steps allowed per frame. */
  maxSubSteps: number
  /** Physics: Rapier solver iterations. */
  solverIterations: number
  /** Leaf cards in the maple crown. */
  leaves: number
  /** Atmospheric sky shader (else a cheap gradient dome). */
  skyShader: boolean
  /** Clouds in the sky shader. */
  clouds: boolean
}

export const QUALITY: Record<Quality['name'], Quality> = {
  high: {
    name: 'high', pixelRatio: 2, shadowMapSize: 2048, antialias: true,
    grassTufts: 26000, sprinklerDroplets: 1600, clothGrid: [22, 16], clothIterations: 8, clothEvery: 1,
    maxSubSteps: 4, solverIterations: 4, leaves: 2600, skyShader: true, clouds: true,
  },
  medium: {
    name: 'medium', pixelRatio: 1.5, shadowMapSize: 1024, antialias: true,
    grassTufts: 9000, sprinklerDroplets: 700, clothGrid: [16, 12], clothIterations: 6, clothEvery: 2,
    maxSubSteps: 3, solverIterations: 4, leaves: 1400, skyShader: true, clouds: false,
  },
  low: {
    name: 'low', pixelRatio: 1, shadowMapSize: 0, antialias: false,
    grassTufts: 0, sprinklerDroplets: 350, clothGrid: [12, 9], clothIterations: 4, clothEvery: 2,
    maxSubSteps: 2, solverIterations: 3, leaves: 700, skyShader: false, clouds: false,
  },
}

export function isTouchDevice(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
}

export function autoQuality(search = typeof location !== 'undefined' ? location.search : ''): Quality {
  const q = new URLSearchParams(search).get('q')
  if (q === 'low' || q === 'medium' || q === 'high') return QUALITY[q]
  if (isTouchDevice()) return QUALITY.medium
  return QUALITY.high
}
