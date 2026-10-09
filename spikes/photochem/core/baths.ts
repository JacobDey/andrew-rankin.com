// Processing baths for silver materials: developer, stop, fixer, wash and
// toners. Each bath is a small plain-data state object (JSON-serialisable for
// save games) plus pure functions that derive rates from it. The per-pixel
// work happens in silver.ts and film.ts, which read these rates and report
// back what they consumed.

import { type RGB, hexToLinear, mixRGB } from './color.ts'
import { q10, smoothstep } from './kinetics.ts'

// ---------------------------------------------------------------------------
// Developer
// ---------------------------------------------------------------------------

export interface DeveloperFormula {
  id: string
  name: string
  /** Paper development activity at working strength, 20 °C (reference MQ paper developer = 1). */
  paperActivity: number
  /** Film activity at working strength, 20 °C (reference MQ-borax stock = 1). */
  filmActivity: number
  /** Temperature coefficient of the development rate. */
  q10: number
  /** Temperature coefficient of chemical fog (fog climbs faster than image with heat). */
  fogQ10: number
  /** Chemical fog growth on paper, density per second at 20 °C after the induction period. */
  fogRate: number
  /** Hydroquinone cold cut-out: below lo °C the HQ contributes nothing, above hi fully. Null = no HQ. */
  hqCut: [number, number] | null
  /** Silver (g) one litre of working solution can develop before it is spent. */
  capacityGPerL: number
  /** Aerial oxidation time constant in an open tray, hours. */
  trayLifeH: number
  /** Parts water per part stock for normal working strength. */
  workingDilution: number
  /** Liquid colours (sRGB hex): fresh and spent. */
  fresh: string
  spent: string
  /** Image stain added per unit of developed density (pyro), linear-RGB channel densities. */
  stain: RGB | null
  /** Smell caption for the UI. */
  smell: string
}

export const DEVELOPERS = {
  paperMQ: {
    id: 'paperMQ', name: 'MQ paper developer (1+9)', paperActivity: 1, filmActivity: 2.2, q10: 2.5, fogQ10: 3.5,
    fogRate: 2.5e-4, hqCut: [9, 17], capacityGPerL: 0.9, trayLifeH: 10, workingDilution: 9,
    fresh: '#EDE6C8', spent: '#7A5A2A', stain: null, smell: '[faintly sweet, soapy]',
  },
  filmMQBorax: {
    id: 'filmMQBorax', name: 'MQ-borax fine grain (stock)', paperActivity: 0.32, filmActivity: 1, q10: 2.55, fogQ10: 3.2,
    fogRate: 1.2e-4, hqCut: [9, 16], capacityGPerL: 2.5, trayLifeH: 30, workingDilution: 0,
    fresh: '#F2F0E6', spent: '#A08860', stain: null, smell: '[nothing much]',
  },
  pyro: {
    id: 'pyro', name: 'Pyro-ammonia (plate developer)', paperActivity: 0.5, filmActivity: 0.85, q10: 2.3, fogQ10: 3.0,
    fogRate: 3e-4, hqCut: null, capacityGPerL: 1.2, trayLifeH: 1.2, workingDilution: 0,
    fresh: '#E6DCB0', spent: '#4A2E14', stain: [0.05, 0.12, 0.32], smell: '[sharp, ammonia]',
  },
  caffenol: {
    id: 'caffenol', name: 'Kitchen developer (coffee, washing soda, vitamin C)', paperActivity: 0.3, filmActivity: 0.55, q10: 2.2,
    fogQ10: 2.8, fogRate: 1.5e-4, hqCut: null, capacityGPerL: 0.6, trayLifeH: 0.7, workingDilution: 0,
    fresh: '#2E1A0E', spent: '#1E1009', stain: [0.04, 0.06, 0.1], smell: '[coffee]',
  },
} satisfies Record<string, DeveloperFormula>

export type DeveloperId = keyof typeof DEVELOPERS

export interface DeveloperBath {
  kind: 'developer'
  formula: DeveloperId
  /** Parts water per part stock as mixed (e.g. 9 for 1+9). */
  dilution: number
  tempC: number
  volumeL: number
  /** Silver developed so far, grams. */
  silverG: number
  /** Bromide released by development, grams. */
  bromideG: number
  /** Added restrainer, g/L of potassium bromide equivalent. */
  restrainerGL: number
  /** Hours the working solution has stood in an open tray. */
  ageH: number
  /** Fixer carried into the developer, mL per litre (tong mix-ups). */
  fixerMLPerL: number
}

export function makeDeveloper(formula: DeveloperId = 'paperMQ', opts: Partial<DeveloperBath> = {}): DeveloperBath {
  const f = DEVELOPERS[formula]
  return {
    kind: 'developer', formula, dilution: f.workingDilution, tempC: 20, volumeL: 1, silverG: 0, bromideG: 0,
    restrainerGL: 0, ageH: 0, fixerMLPerL: 0, ...opts,
  }
}

export interface DeveloperRates {
  /** Multiplier on the paper development rate (1 = fresh reference developer at 20 °C). */
  paper: number
  /** Multiplier on the film development rate. */
  film: number
  /** Chemical fog rate on paper (density/s while in full contact). */
  fog: number
  /** Fraction of full Dmax reachable (cold hydroquinone, exhaustion). */
  dmaxFactor: number
  /** 0 = fresh neutral tone, 1 = exhausted (warm, brown-black image). */
  warmth: number
  /** Remaining activity 0..1 (exhaustion and oxidation only). */
  activity: number
  /** Total bromide in g/L (released + added). */
  bromideGL: number
  /** Liquid colour, linear RGB. */
  liquid: RGB
}

/**
 * All developer behaviour in one place.
 *
 *   strength   = (1 + working dilution) / (1 + dilution)          relative concentration
 *   rate       = activity0 * strength^0.7 * Q10^((T-20)/10) * exhaustion * aerial * restraint * HQ(T)
 *   exhaustion = (1 - silver / capacity)^1.3                       capacity scales with volume and strength
 *   aerial     = exp(-ageH / trayLife)
 *   restraint  = 1 / (1 + Br / 2 g/L)       image
 *   fogRestr.  = 1 / (1 + Br / 0.35 g/L)    fog is restrained ~6x harder than image (why bromide rescues fogged plates)
 *   HQ(T)      = 0.55 + 0.45 * smoothstep(lo, hi, T)   cold hydroquinone barely works: soft, weak blacks
 *
 * The 0.7 dilution exponent matches D-76 stock vs 1+1 (time x ~1.6 for half
 * strength); Q10 = 2.5 is the familiar ~9-10% per °C time/temperature chart.
 */
export function developerRates(b: DeveloperBath): DeveloperRates {
  const f: DeveloperFormula = DEVELOPERS[b.formula]
  const strength = (1 + f.workingDilution) / (1 + Math.max(0, b.dilution))
  const conc = Math.pow(strength, 0.7)
  const cap = f.capacityGPerL * b.volumeL * strength
  const used = cap > 0 ? b.silverG / cap : 1
  const exhaustion = Math.pow(Math.max(0, 1 - used), 1.3)
  const aerial = Math.exp(-b.ageH / f.trayLifeH)
  const activity = exhaustion * aerial
  const br = b.bromideG / Math.max(1e-6, b.volumeL) + b.restrainerGL
  const restraint = 1 / (1 + br / 2)
  const fogRestraint = 1 / (1 + br / 0.35)
  const hq = f.hqCut ? smoothstep(f.hqCut[0], f.hqCut[1], b.tempC) : 1
  const hqRate = f.hqCut ? 0.55 + 0.45 * hq : 1
  const t = q10(f.q10, b.tempC)
  const base = conc * t * activity * restraint * hqRate
  const contam = 1 + 0.08 * b.fixerMLPerL
  return {
    paper: f.paperActivity * base,
    film: f.filmActivity * base,
    fog: f.fogRate * q10(f.fogQ10, b.tempC) * conc * Math.sqrt(activity) * fogRestraint * contam,
    dmaxFactor: (f.hqCut ? 0.78 + 0.22 * hq : 1) * Math.min(1, 0.62 + 0.38 * Math.sqrt(activity)),
    warmth: Math.min(1, (1 - activity) * 1.2 + 0.15 * b.fixerMLPerL / 10),
    activity,
    bromideGL: br,
    liquid: mixRGB(hexToLinear(f.fresh), hexToLinear(f.spent), Math.min(1, (1 - activity) * 1.3)),
  }
}

/** Report silver developed (grams) so the bath exhausts and releases bromide. */
export function consumeDeveloper(b: DeveloperBath, silverG: number): void {
  b.silverG += silverG
  b.bromideG += 0.74 * silverG // AgBr: 79.9 g Br per 107.9 g Ag
}

// ---------------------------------------------------------------------------
// Stop
// ---------------------------------------------------------------------------

export interface StopBath {
  kind: 'stop'
  acid: 'acetic' | 'citric' | 'water'
  volumeL: number
  tempC: number
  /** Developer carried in so far, litres. */
  carriedDevL: number
}

export function makeStop(acid: StopBath['acid'] = 'acetic', volumeL = 1): StopBath {
  return { kind: 'stop', acid, volumeL, tempC: 20, carriedDevL: 0 }
}

/**
 * Remaining acidity 0..1. A litre of 2% acetic neutralises ~0.12 L of carried
 * developer (about 30 8x10 RC prints at ~4 mL each). Indicator stop
 * (bromocresol purple) flips yellow -> purple below ~0.2.
 */
export function stopAcidity(s: StopBath): number {
  if (s.acid === 'water') return 0
  const cap = (s.acid === 'citric' ? 0.1 : 0.12) * s.volumeL
  return Math.max(0, 1 - s.carriedDevL / cap)
}

/** Time constant for killing development in the emulsion (s). Plain water lets it creep on. */
export function stopTau(s: StopBath): number {
  const a = stopAcidity(s)
  return 2 + (12 - 2) * (1 - a)
}

export function stopIndicatorColour(s: StopBath): RGB {
  if (s.acid === 'water') return hexToLinear('#DCE6EA')
  const a = stopAcidity(s)
  return mixRGB(hexToLinear('#7A3E8E'), hexToLinear('#E8C840'), smoothstep(0.1, 0.35, a))
}

// ---------------------------------------------------------------------------
// Fixer
// ---------------------------------------------------------------------------

export interface FixerBath {
  kind: 'fixer'
  formula: 'rapid' | 'hypo'
  /** Strength relative to normal working dilution (1 = normal, 0.5 = over-diluted). */
  strength: number
  tempC: number
  volumeL: number
  /** Dissolved silver, grams. */
  silverG: number
  /** Developer carried in without a stop bath, litres (makes the fixer alkaline). */
  carriedDevL: number
}

export function makeFixer(formula: FixerBath['formula'] = 'rapid', volumeL = 1): FixerBath {
  return { kind: 'fixer', formula, strength: 1, tempC: 20, volumeL, silverG: 0, carriedDevL: 0 }
}

export interface FixerRates {
  /** Multiplier on the material's fixing rate (1 = fresh rapid fixer, 20 °C). */
  rate: number
  /** Dissolved silver g/L. */
  silverGL: number
  /** How strongly argentothiosulfate complexes are retained in the paper (0 fresh .. 1 exhausted). */
  retention: number
  /** True once clearing time has doubled: the rule-of-thumb "discard" point. */
  exhausted: boolean
  /** Over-fixing etch rate on image silver (density/s) for paper left in too long. */
  etch: number
}

/**
 * Fixing is diffusion-limited thiosulfate complexation:
 *   rate = strength^0.8 * 1.4^((T-20)/10) * (hypo ? 0.5 : 1) / (1 + (Ag g/L / 3)^1.5) * alkalinity
 * Clearing time doubles at ~3 g/L silver, the classic "discard when the clip
 * test takes twice as long". Above ~1 g/L the paper starts to hold insoluble
 * silver complexes that no wash removes, which stain years later.
 */
export function fixerRates(f: FixerBath): FixerRates {
  const silverGL = f.silverG / Math.max(1e-6, f.volumeL)
  const alk = 1 / (1 + (f.carriedDevL / Math.max(1e-6, f.volumeL)) * 2)
  const rate = Math.pow(Math.max(0, f.strength), 0.8) * q10(1.4, f.tempC) * (f.formula === 'hypo' ? 0.5 : 1) * alk / (1 + Math.pow(silverGL / 3, 1.5))
  return {
    rate,
    silverGL,
    retention: smoothstep(0.8, 4, silverGL),
    exhausted: 1 + Math.pow(silverGL / 3, 1.5) >= 2,
    etch: f.formula === 'rapid' ? 0.0006 * Math.max(0, f.strength) : 0.0001,
  }
}

// ---------------------------------------------------------------------------
// Wash, hypo clearing agent, toners, reducer
// ---------------------------------------------------------------------------

export interface WashBath {
  kind: 'wash'
  tempC: number
  /** 0 = a still tray of water, 1 = running water / archival washer. */
  flow: number
  /** pH of the water (acid stop-like rinses, hard alkaline tap water). */
  pH: number
}

export function makeWash(flow = 1, tempC = 20): WashBath {
  return { kind: 'wash', tempC, flow, pH: 7 }
}

/** Wash time-constant multiplier: warm water washes faster (Q10 ≈ 1.6); still water ~4x slower. */
export function washTauFactor(w: WashBath): number {
  return (1 / q10(1.6, w.tempC)) * (1 + 3 * (1 - Math.max(0, Math.min(1, w.flow))))
}

export interface HypoClearBath {
  kind: 'hca'
  tempC: number
}

export interface TonerBath {
  kind: 'toner'
  toner: 'selenium' | 'bleach' | 'sulfide' | 'farmer'
  /** Relative strength (1 = normal working dilution, e.g. selenium 1+9). */
  strength: number
  tempC: number
}

export function makeToner(toner: TonerBath['toner'], strength = 1): TonerBath {
  return { kind: 'toner', toner, strength, tempC: 20 }
}

/** Out of liquid: hanging, on the bench, in the tongs. */
export interface AirBath {
  kind: 'air'
  /** 0 still air .. 1 hair dryer. */
  airflow: number
  tempC: number
}

export const AIR: AirBath = { kind: 'air', airflow: 0, tempC: 20 }

export type SilverBath = DeveloperBath | StopBath | FixerBath | WashBath | HypoClearBath | TonerBath | AirBath
