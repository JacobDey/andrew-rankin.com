// games/plates/contracts.ts — FROZEN at kickoff. Only the integrator edits after WPs start.
import type * as THREE from 'three'

export const CONTENT_VERSION = 1
export const PLATE_W = 1024, PLATE_H = 512, SIM_W = 128, SIM_H = 64
export const EYE = { L: { x: 24, y: 24, w: 480, h: 424 }, R: { x: 520, y: 24, w: 480, h: 424 } } as const
export const WEDGE = { x0: 24, y: 460, size: 40, gap: 8, steps: 8 } as const   // step n: L = -(n-1)
export const REBATE_NUMBER = { x: 600, y: 462, h: 14 } as const                  // scratched "No. 7"
export const L_MIN = -12, L_SPAN = 13                                            // byte b: L = b/255*13-12
export const K_DEV = 1 / 22, S_SLOPE = 0.5, F_AGE = 0.015

/** 1888 room = 1887 darkroom set. Metres; origin floor centre; +x along bench to the right; +z toward viewer. */
export const ROOM = {
  x: [-2.0, 2.0], z: [-1.2, 1.4], vaultPeak: 2.5, backWallSagitta: 0.25,
  benchTop: 0.9, bench: { x: [-1.9, 1.9], z: [-1.2, -0.55] },
  shelf: { x: [-1.9, -0.8], y: 1.45, depth: 0.25 },
  tin: [-1.35, 0.9, -0.85], trays: { dev: [-0.36, 0.9, -0.85], water: [0, 0.9, -0.85], hypo: [0.36, 0.9, -0.85] },
  trayInterior: [0.30, 0.24], lampHook: [0.62, 1.95, -0.75], lampRod: 0.25,
  table: [1.3, 0.9, -0.85], tableTop: [0.45, 0.35], rack: [1.75, 0.9, -0.95], book: [1.05, 0.9, -0.62],
  line: { from: [-1.9, 2.05, -1.0], to: [1.9, 2.05, -1.0] }, door: { x: 2.0, z: 0.4, w: 0.8, h: 1.9 },
  coalBin: [-1.6, 0, 0.6], camera1887: [-1.7, 0, 0.9],
  stations: {
    shelf: { pos: [-1.3, 1.55, 0.55], look: [-1.3, 1.05, -0.9] },
    trays: { pos: [0, 1.75, 0.35], look: [0, 0.85, -0.85] },
    table: { pos: [1.3, 1.6, 0.3], look: [1.3, 0.9, -0.85] },
  },
  trayFocus: { dy: 0.55, dz: 0.40 },                               // camera = tray + (0, dy, dz), looks at tray
} as const

export type PlateId = 'p00'|'p01'|'p02'|'p03'|'p04'|'p05'|'p06'|'p07'|'p08'|'p09'|'p10'|'p11'|'p12'|'p13'
export const PLATE_IDS: PlateId[] = ['p00','p01','p02','p03','p04','p05','p06','p07','p08','p09','p10','p11','p12','p13']
export type SoulId = 'amos'|'keturah'|'nell'|'saul'|'davy'|'ottilie'|'hosken'|'abery'|'rype'|'shilling'
export type FateId = 'survived'|'rescuedBy'|'drowned'|'drownedSaving'|'mast'|'struckBy'|'cold'|'lost'
export type FindingId = 'f1'|'f2'|'f3'|'f4'|'f5'
export type Bath = 'dev'|'water'|'hypo'
export type Station = 'shelf'|'trays'|'table'
export type LightMode = 'ruby'|'white'|'dark'
export type PaletteName = 'ruby'|'canary'|'bone'|'prussian'
export type Grade = 'unfixed'|'brilliant'|'good'|'thin'|'dense'|'fogged'|'streaked'
export type Where =
  | { kind: 'tin' } | { kind: 'tray'; bath: Bath } | { kind: 'hand' } | { kind: 'bench' }
  | { kind: 'table' } | { kind: 'rack'; slot: number } | { kind: 'camera' }

export interface Hotspot { id: string; eye: 'L'|'R'|'both'; x: number; y: number; r: number
  zone: 'shadow'|'mid'|'highlight'; minPower?: 1|2|4|8; kind: 'clue'|'wick'|'face'; clue?: string }
export interface PortraitRect { soul: SoulId; fig: number; eye: 'L'|'R'; x: number; y: number; w: number; h: number }
export interface PlateMeta { id: PlateId; no: number | 'TRIAL'; title: string; date: string; time: string
  bundle: 1|2|3|4; register: string; souls: SoulId[]; portraits: PortraitRect[]; hotspots: Hotspot[]
  convergencePx: number; chord: number[]; shards?: [number, number][][] }
export interface ExposureMap { id: PlateId; L: Uint8Array }          // PLATE_W*PLATE_H, row 0 = top
export interface PlateLibrary { list(): PlateMeta[]; meta(id: PlateId): PlateMeta
  expose(id: PlateId, renderer: THREE.WebGLRenderer, quality: 'low'|'full'): Promise<ExposureMap> }

export interface PlateChem { id: PlateId; P: Float32Array; H: Float32Array; F: Float32Array; B: Float32Array; cDev: number; fixed: boolean }
export interface PlateGPU { E: THREE.DataTexture; chem: THREE.DataTexture; seed: THREE.Vector2 }
export interface WedgeReading { density: number[]; visible: number; blocked: number; fog: number; grade: Grade }
export interface WetSnapshot { v: 1; where: Partial<Record<PlateId, Where>>
  chem: Partial<Record<PlateId, { P: Uint16Array; H: Uint8Array; F: Uint8Array; B: Uint8Array; cDev: number; fixed: boolean }>>
  liquid: Record<Bath, number> }

export interface LightState { mode: LightMode; wick: number; windowIn: boolean; rubyI: number; whiteI: number; canaryI: number }
export type SfxName = 'clack'|'plop'|'drip'|'glass'|'tink'|'fixChord'|'stamp'|'pen'|'paper'|'fog'|'unwrap'|'palette'|'pin'|'restore'|'lampSwing'|'wick'|'snap'
export type GameEvent =
  | { t: 'wave'; strength: number; dirX: number; dirZ: number }
  | { t: 'plateMoved'; id: PlateId; to: Where }
  | { t: 'plateFixed'; id: PlateId; grade: Grade }
  | { t: 'fogged'; id: PlateId; amount: number }
  | { t: 'light'; light: LightState }
  | { t: 'station'; station: Station; tray: Bath | null }
  | { t: 'inspect'; id: PlateId | 'pane' | null }
  | { t: 'bundle'; n: 1|2|3|4 }
  | { t: 'stamp'; kind: 'persons'|'finding'|'sector'|'found'; ids: string[] }
  | { t: 'wick'; plate: PlateId }
  | { t: 'paneRead' }
  | { t: 'sealed'; complete: boolean; named: boolean | null }
  | { t: 'pin'; index: number } | { t: 'restore'; index: number }
  | { t: 'sfx'; name: SfxName; gain?: number; pan?: number; data?: number }
export interface Bus { on<T extends GameEvent['t']>(t: T, fn: (e: Extract<GameEvent, { t: T }>) => void): () => void; emit(e: GameEvent): void }

export interface Ctx { renderer: THREE.WebGLRenderer; bus: Bus; light: LightState; lib: PlateLibrary
  noise: THREE.DataTexture                      // 128² blue noise from render/dither.ts
  settings: { reducedMotion: boolean; hurry: boolean; muted: boolean; quality: 'low'|'full' }
  test: boolean; timeScale: number; rng(seed: string): () => number }

export interface BenchPointer { kind: 'down'|'move'|'up'|'tap'|'dbl'|'long'|'cancel'
  x: number; y: number; ndc: THREE.Vector2; ray: THREE.Ray; id: number; button: number; touches: number }

export interface WetBench {                      // WP2 → created by createWetBench(ctx, anchors)
  readonly group: THREE.Group
  update(dt: number): void
  pointer(p: BenchPointer): boolean
  place(id: PlateId, where: Where): void
  where(id: PlateId): Where
  openBundle(n: 1|2|3|4): Promise<void>
  chem(id: PlateId): PlateChem
  gpu(id: PlateId): PlateGPU | null
  setChem(id: PlateId, patch: { P?: number; H?: number; F?: number }): void   // uniform fill (tests)
  wedge(id: PlateId): WedgeReading
  impulse(ax: number, az: number, seconds: number): void
  rock(pattern: 'corners'|'lr'|'still' | null): void                           // auto-rock driver
  focusTarget(b: Bath): THREE.Object3D
  slosh(): number
  thumb(id: PlateId, w: number, h: number, mode: 'neg'|'pos'): ImageData
  snapshot(): WetSnapshot
  restore(s: WetSnapshot): void
}
export type BenchAnchors = Record<'tin'|'trays'|'rack'|'table'|'bench', THREE.Object3D>

export interface InspectOpts { velvet?: number; eye?: 'L'|'R'|'both'; wiggle?: boolean
  loupe?: { u: number; v: number; power: 2|4|8 } | null; zoom?: number; pan?: [number, number] }
export interface LightTable {                    // WP4 → createLightTable(ctx, bench)
  readonly isOpen: boolean; readonly showing: PlateId | 'pane' | null
  open(id: PlateId | 'pane'): void; close(): void; set(o: InspectOpts): void
  update(dt: number): void; render(): void; pointer(p: BenchPointer): boolean }

export interface PersonAnswer { name: SoulId | null; fate: FateId | null; agent: SoulId | null }
export interface ReturnStatus { persons: number; findings: number; sector: boolean; found: boolean; sealed: boolean; ending: 'A'|'B'|'C'|null }
export interface ReturnModel {
  visibleFigures(): number[]
  setPerson(fig: number, a: PersonAnswer): void
  setFinding(f: FindingId, verdict: 'stands'|'withdraw'|null, plate: PlateId | null): void
  setSector(q: 'when'|'who'|'why', v: string | null): void
  markFound(): void
  status(): ReturnStatus
  solveAll(): void                                // everything except 'found'
  seal(named: boolean | null): ReturnStatus
  serialize(): unknown; load(d: unknown): void }
export interface ReturnBook {                    // WP4 → createReturnBook(ctx, bench, table, root: HTMLElement)
  readonly isOpen: boolean; readonly model: ReturnModel
  open(page?: 'persons'|'findings'|'sector'|'documents'): void; close(): void
  onPlateFixed(id: PlateId): void }              // reveals figure rows + Register page
