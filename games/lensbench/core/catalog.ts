// Bodies, shutters, stocks and filters (lensbench.md §5.8, §5.10, §6.1, §6.2).
import type { BodyId, FilterId, ShutterId, StockId } from './types'

export interface BodyInfo {
  id: BodyId; name: string; format: [number, number] /* w, h mm (print upright) */; finder: 'sight' | 'frame' | 'reflex' | 'groundglass'
  frames: number; massG: number; extMax: number; shutter: ShutterId; meter: 'none' | 'selenium' | 'ttl'
}
export const BODIES: Record<BodyId, BodyInfo> = {
  tin: { id: 'tin', name: 'Biscuit tin', format: [120, 96], finder: 'sight', frames: 1, massG: 150, extMax: 40, shutter: 'cap', meter: 'none' },
  box: { id: 'box', name: 'Box camera', format: [56, 56], finder: 'frame', frames: 12, massG: 450, extMax: 6, shutter: 'leaf', meter: 'selenium' },
  rangefinder: { id: 'rangefinder', name: 'Rangefinder 35', format: [36, 24], finder: 'frame', frames: 24, massG: 590, extMax: 8, shutter: 'clothFP', meter: 'selenium' },
  reflex: { id: 'reflex', name: 'Mirror reflex 35', format: [36, 24], finder: 'reflex', frames: 24, massG: 780, extMax: 10, shutter: 'metalFP', meter: 'ttl' },
  view: { id: 'view', name: '4×5 view camera', format: [120, 96], finder: 'groundglass', frames: 1, massG: 2600, extMax: 250, shutter: 'leaf', meter: 'none' },
}
export const BODY_IDS: BodyId[] = ['tin', 'box', 'rangefinder', 'reflex', 'view']

export interface ShutterInfo { id: ShutterId; name: string; fastest: number; slowest: number; bulb: boolean; travel: number; dir: 'left' | 'up' | null }
export const SHUTTERS: Record<ShutterId, ShutterInfo> = {
  cap: { id: 'cap', name: 'Lens cap', fastest: 0, slowest: 0, bulb: true, travel: 0, dir: null },
  leaf: { id: 'leaf', name: 'Leaf', fastest: 1 / 500, slowest: 1, bulb: true, travel: 0, dir: null },
  clothFP: { id: 'clothFP', name: 'Cloth focal-plane', fastest: 1 / 1000, slowest: 1, bulb: true, travel: 0.018, dir: 'left' },
  metalFP: { id: 'metalFP', name: 'Metal focal-plane', fastest: 1 / 4000, slowest: 1, bulb: true, travel: 0.0065, dir: 'up' },
  rollerFP: { id: 'rollerFP', name: 'Roller-blind', fastest: 1 / 1000, slowest: 1 / 10, bulb: false, travel: 0.12, dir: 'up' },
  tricolour: { id: 'tricolour', name: 'Tri-colour back', fastest: 1 / 500, slowest: 1, bulb: false, travel: 0, dir: null },
}
export const SHUTTER_IDS: ShutterId[] = ['cap', 'leaf', 'clothFP', 'metalFP', 'rollerFP']

export const SPEEDS = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000]
export function speedsFor(s: ShutterId): number[] {
  const sh = SHUTTERS[s]
  const list = SPEEDS.filter((t) => t <= sh.slowest + 1e-9 && t >= sh.fastest - 1e-9)
  return sh.bulb ? [0, ...list] : list
}
export function formatSpeed(t: number): string {
  if (t <= 0) return 'B'
  if (t >= 1) return `${Math.round(t * 10) / 10} s`
  return `1/${Math.round(1 / t)}`
}
export const F_STOPS = [1.4, 1.7, 2, 2.4, 2.8, 3.4, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22, 27, 32, 38, 45, 54, 64]

export interface StockInfo {
  id: StockId; name: string; iso: number; w: [number, number, number]; gamma: number; dMin: number; dMax: number
  G: number; p: number; normalMin: number; colour: boolean; halation: boolean; edge: string
}
export const STOCKS: Record<StockId, StockInfo> = {
  ortho25: { id: 'ortho25', name: 'Lantern Ortho 25', iso: 25, w: [0, 0.35, 0.65], gamma: 0.75, dMin: 0.12, dMax: 2.6, G: 0.3, p: 0.8, normalMin: 6, colour: false, halation: false, edge: 'LANTERN ORTHO 25' },
  pan100: { id: 'pan100', name: 'Lantern Pan 100', iso: 100, w: [0.27, 0.55, 0.18], gamma: 0.62, dMin: 0.15, dMax: 2.5, G: 0.38, p: 0.88, normalMin: 8, colour: false, halation: false, edge: 'LANTERN PAN 100' },
  pan400: { id: 'pan400', name: 'Lantern Pan 400', iso: 400, w: [0.27, 0.55, 0.18], gamma: 0.65, dMin: 0.22, dMax: 2.4, G: 0.72, p: 0.85, normalMin: 9.5, colour: false, halation: false, edge: 'LANTERN PAN 400' },
  nightjar1600: { id: 'nightjar1600', name: 'Nightjar 1600', iso: 1600, w: [0.3, 0.52, 0.18], gamma: 0.6, dMin: 0.3, dMax: 2.2, G: 1.2, p: 0.85, normalMin: 11, colour: false, halation: true, edge: 'NIGHTJAR 1600' },
  colour200: { id: 'colour200', name: 'Daylight Colour 200', iso: 200, w: [1, 1, 1], gamma: 0.55, dMin: 0.25, dMax: 2.25, G: 0.6, p: 0.9, normalMin: 3.25, colour: true, halation: true, edge: 'DAYLIGHT COLOUR 200' },
  ir820: { id: 'ir820', name: 'Infrared 820', iso: 50, w: [0.8, 0.15, 0.05], gamma: 0.7, dMin: 0.18, dMax: 2.3, G: 0.8, p: 0.85, normalMin: 10, colour: false, halation: true, edge: 'INFRARED 820' },
}
export const STOCK_IDS: StockId[] = ['ortho25', 'pan100', 'pan400', 'colour200']

export interface FilterInfo { id: FilterId; name: string; t: [number, number, number] }
export const FILTERS: Record<FilterId, FilterInfo> = {
  none: { id: 'none', name: 'No filter', t: [1, 1, 1] },
  nd8: { id: 'nd8', name: 'ND×8', t: [1 / 8, 1 / 8, 1 / 8] },
  nd64: { id: 'nd64', name: 'ND×64', t: [1 / 64, 1 / 64, 1 / 64] },
  yellow: { id: 'yellow', name: 'Yellow ×2', t: [0.95, 0.85, 0.12] },
  orange: { id: 'orange', name: 'Orange ×3', t: [0.95, 0.45, 0.03] },
  red: { id: 'red', name: 'Red ×8', t: [0.9, 0.08, 0.01] },
  green: { id: 'green', name: 'Green ×4', t: [0.1, 0.8, 0.2] },
  deepRed: { id: 'deepRed', name: 'Deep red', t: [0.6, 0.01, 0.005] },
}
export const FILTER_IDS: FilterId[] = ['none', 'nd8', 'nd64', 'yellow', 'orange', 'red', 'green']

/** Effective film speed through a filter for a stock (filter factor folded into the stock's spectral weights). */
export function filterStops(stock: StockId, filter: FilterId): number {
  const s = STOCKS[stock], f = FILTERS[filter]
  const w = s.colour ? [1 / 3, 1 / 3, 1 / 3] : s.w
  const sum = w[0] + w[1] + w[2]
  const tr = (w[0] * f.t[0] + w[1] * f.t[1] + w[2] * f.t[2]) / sum
  return -Math.log2(Math.max(1e-6, tr))
}

/** Mid-grey reference exposure H_ref(S) = (π/4)·K/S = 9.82/S lux·s (§5.7). */
export const hRef = (iso: number) => 9.82 / iso
export const H0 = 0.1
