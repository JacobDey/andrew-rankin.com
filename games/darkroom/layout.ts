// Bench layout (darkroom.md §5.1). Metres; bench top y=0, wall z=0, front z=0.75.
import type { StationId, TrayId } from './types'

export const STATIONS: { id: StationId; label: string; fx: number; x0: number; x1: number; subs?: number[] }[] = [
  { id: 'prep', label: 'Prep', fx: 0.6, x0: 0.0, x1: 1.2 },
  { id: 'enlarger', label: 'Enlarger', fx: 1.8, x0: 1.2, x1: 2.4 },
  { id: 'trays', label: 'Trays', fx: 3.1, x0: 2.4, x1: 3.8, subs: [2.66, 3.10, 3.54] },
  { id: 'sink', label: 'Sink', fx: 4.5, x0: 3.8, x1: 5.4, subs: [4.40, 4.86] },
  { id: 'iron', label: 'Iron', fx: 6.0, x0: 5.4, x1: 6.6, subs: [5.70, 6.30] },
  { id: 'window', label: 'Window', fx: 7.2, x0: 6.6, x1: 7.8 },
]
export const STATION_IDS = STATIONS.map((s) => s.id)
export const stationById = (id: StationId) => STATIONS.find((s) => s.id === id) ?? STATIONS[2]

export const BENCH = { x0: -0.2, x1: 8.0, depth: 0.75, wallH: 1.6 }

export interface TrayLayout { id: TrayId; x: number; z: number; color: number; label: string; outerW: number; outerD: number }
export const TRAY_INTERIOR = { w: 0.36, d: 0.27, lip: 0.045 }
export const TRAYS: TrayLayout[] = [
  { id: 'dev', x: 2.66, z: 0.40, color: 0xe9e4d8, label: 'DEV', outerW: 0.40, outerD: 0.31 },
  { id: 'stop', x: 3.10, z: 0.40, color: 0xb8322a, label: 'STOP', outerW: 0.40, outerD: 0.31 },
  { id: 'fix', x: 3.54, z: 0.40, color: 0x8d8f91, label: 'FIX', outerW: 0.40, outerD: 0.31 },
  { id: 'wash', x: 4.40, z: 0.40, color: 0xe9e4d8, label: 'WASH', outerW: 0.40, outerD: 0.31 },
]
export const trayLayout = (id: TrayId) => TRAYS.find((t) => t.id === id)
export const TRAY_IDS: TrayId[] = ['dev', 'stop', 'fix', 'wash']

export const SAFELIGHT_POS: [number, number, number] = [3.10, 1.05, 0.30]
export const SWITCH_POS: [number, number, number] = [2.48, 0.55, 0.01]

export const ENLARGER = {
  base: { x: 1.75, z: 0.38, w: 0.50, d: 0.45 },
  easel: { x: 1.75, z: 0.40, w: 0.203, d: 0.254 },
  column: { x: 1.75, z: 0.07 },
  headY: 0.45,
  paperBox: { x: 2.20, z: 0.52 },
  envelope: { x: 2.20, z: 0.22 },
  tin: { x: 1.36, z: 0.24 },
}
export const PREP = { table: { x: 0.45, z: 0.40, w: 0.50, d: 0.40 }, printer: { x: 0.98, z: 0.24 }, shoebox: { x: 0.98, z: 0.58 } }
export const SINK = { basin: { x0: 4.0, x1: 4.8 }, tap: { x: 4.40, z: 0.10, y: 0.30 }, peroxide: { x: 4.86, z: 0.20 } }
export const IRON = {
  bottleA: { x: 5.55, z: 0.14 }, bottleB: { x: 5.70, z: 0.14 }, beaker: { x: 5.86, z: 0.17 },
  rag: { x: 5.62, z: 0.56 }, coat: { x: 6.02, z: 0.44 }, brushRest: { x: 6.34, z: 0.18 }, dryer: { x: 6.40, z: 0.58 },
  frame: { x: 6.30, z: 0.42, w: 0.28, d: 0.33 },
}
export const WINDOW = { uvbox: { x: 6.92, z: 0.52, w: 0.40, d: 0.34 }, opening: { x0: 6.85, x1: 7.65, y0: 0.25, y1: 1.15 } }

export const LINE = { y: 0.58, x0: 0.5, x1: 7.6, slots: 13, spacing: 0.55, z: 0.05, scale: 0.62 }
export const lineSlotX = (slot: number) => LINE.x0 + 0.2 + slot * LINE.spacing

export const SHEET_M = { w: 0.203, h: 0.254 }
export const STRIP_M = { w: 0.064, h: 0.254 }

export const CAMERA = {
  landscape: { y: 1.2, z: 1.35, ty: 0.2, tz: 0.3, fov: 38 },
  enlarger: { y: 1.45, z: 1.05, ty: 0, tz: 0.40, fov: 34 },
  portrait: { y: 1.05, z: 0.98, ty: 0, tz: 0.38, fov: 48 },
  omega: 9,
}
