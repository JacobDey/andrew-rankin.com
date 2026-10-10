// Latent Image shared interfaces (GDD §11.3), adapted: stations draw with Canvas 2D into a luminance
// layer that one 1-bit dither pass maps to the station's two-colour palette (no three.js scenes).

export type StationId = 'terminal' | 'lighttable' | 'darkroom' | 'line'
export type Pattern = 'BURIED' | 'BLOWN' | 'SMALL' | 'MIRRORED' | 'GHOST' | 'PUSHED' | 'OFFFRAME'
export type FactId = 'HEEL_TANNERY' | 'CAN_TANNERY' | 'HORIZON_RUTH' | 'HEEL_PARTY' | 'RUTH_TALL'
  | 'MINA_FACE' | 'HEIGHT_MARKS' | 'WATCH_M' | 'KDL_TANNERY' | 'CANS_TANNERY' | 'KDL_NEG'
  | 'STAIRWELL_FIRE' | 'HEEL_PLANT' | 'KDL_PLANT' | 'ENVELOPE_LANTERN' | 'HALE_FACE' | 'KDL_LANTERN'
  | 'HORIZON_MINA' | 'GD_BRIEFCASE' | 'CLAIM_PAID' | 'HALE_SAW' | 'HEIGHT_MARKS_2' | 'CURSIVE_LABEL' | 'MINA_1987'
export type StageId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K'
export interface FrameRef { roll: number; frame: number }              // roll 1..11, frame 1..36
export type BBox = [x: number, y: number, w: number, h: number]          // frame coords, 0..1, positive orientation
export type Grade = 0 | 1 | 2 | 3 | 4 | 5
export interface PrintOps {
  M: number; cx: number; cy: number; focus?: number /* default φ* */; flip: boolean
  grade: Grade; seconds: number
  dodge?: { x: number; y: number; r: number; z: number; frac: number }[]   // paper mm (from the paper centre), frac of exposure time held
  burn?: { x: number; y: number; r: number; z: number; extraSeconds: number }[]
  devSeconds: number
}
export interface DetailSpec {
  id: FactId; bbox: BBox; rho: number; mMin: number; pattern: Pattern[]
  hide: string[]; inset?: boolean; solution?: Partial<PrintOps> & { devR?: number }
  /** Needs no legibility check (GHOST frames that only have to be seen). */
  noCheck?: boolean
}
export interface FrameRecipe {
  roll: number; frame: number; template: string; ev: number; seed: number
  params: Record<string, unknown>; details: DetailSpec[]; marks?: Crescent[]
}
export interface RollMeta {
  id: number; property: string; label: string; hand: 'caps' | 'cursive' | 'none'
  frames: number; nominalEV: number; preDeveloped?: DevResult; dx?: boolean; ageFog: number
  shotBy: string; date: string; sleeve?: boolean
}
export interface FrameImage {
  ref: FrameRef; w: number; h: number
  /** Decoded scene luminance, row 0 = top (positive orientation). */
  L: Float32Array
  /** 4 box-filtered levels of L (level 0 = L). */
  mips: { w: number; h: number; L: Float32Array }[]
  insets: { bbox: BBox; w: number; h: number; L: Float32Array }[]
  deltas: Partial<Record<FactId, { bbox: BBox; w: number; h: number; d: Float32Array; off: Float32Array }>>
}
export interface Crescent { frame: number; x: number; y: number; rot: number }
export interface Spot { frame: number; x: number; y: number; r: number }
export interface DevResult {
  tDev: number; inversionsPerMin: number; rapped: boolean; r: number; agit: number
  bubbles: Spot[]; kinks: Crescent[]
}
export interface Negative {
  ref: FrameRef; widthMm: 36; heightMm: 24
  /** Dneg incl. grain and marks at a point in negative mm (0..36, 0..24; positive orientation). */
  density(xMm: number, yMm: number, footprintMm: number): number
}
export interface EnlargerState {
  ref: FrameRef | null; M: number; cx: number; cy: number; focus: number; flip: boolean
  grade: Grade; timer: number; redFilter: boolean; lampOn: boolean; tool: 'wand' | 'hand' | 'card'; toolZ: number
}
export interface PrintRecord {
  id: string; ref: FrameRef; ops: PrintOps; legible: { fact: FactId; rho: number }[]
  fixed: boolean; fogged: boolean; at: number; clock: number
}
export interface TapeLine { clock: number; text: string; count?: string; lower?: boolean }
export interface GamePointer {
  id: number; x: number; y: number; type: 'down' | 'move' | 'up' | 'cancel' | 'dbl' | 'long'
  button: number; pointerType: 'mouse' | 'touch' | 'pen'; pressure: number; t: number; shift: boolean
}
export interface Settings {
  steadyHands: boolean; bagLights: boolean; reducedMotion: boolean; highContrast: boolean
  textSize: 1 | 1.5 | 2; screenshotMode: boolean
}
export type Lights = 'off' | 'safe' | 'white'
export interface RollState { developed: boolean; dev?: DevResult; kinks: Crescent[] }
export interface SaveV1 {
  v: 1; seed: number; clock: number /* game minutes since 21:00 */
  flags: Partial<Record<StageId, boolean>>; tape: TapeLine[]; docsRead: string[]
  rolls: Record<number, RollState>
  prints: PrintRecord[]; line: string[] /* print ids in order */; envelope: string[]
  settings: Settings; stats: { searches: number; sheets: number; calls: number; kinks: number }
  hints: Partial<Record<StageId, number>>
  tutorialDone: boolean; lights: Lights; shelf: number | null
  ending?: { disposition: 'FILE' | 'PURGE'; kept?: string; at: number }
  unprompted: { first: boolean; dock: boolean; van: boolean }
}

/** Bus events. */
export interface Events extends Record<string, unknown> {
  station: StationId; lights: Lights; search: { q: string; count: number }
  'doc:open': string; 'roll:developed': { roll: number; dev: DevResult }; 'carrier:load': FrameRef
  'print:exposed': string; 'print:fixed': PrintRecord; 'print:legible': { id: string; fact: FactId }
  'print:hung': string; ending: { disposition: 'FILE' | 'PURGE' }; dirty: void
}

/** A station: draws luminance (dithered) plus crisp overlay text, receives input. */
export interface Station {
  id: StationId
  palette: () => { ink: string; light: string }
  enter(): void
  exit(): void
  update(dt: number): void
  resize(w: number, h: number, phone: boolean): void
  drawLum(g: CanvasRenderingContext2D, w: number, h: number): void
  drawCrisp(g: CanvasRenderingContext2D, w: number, h: number): void
  pointer(p: GamePointer): boolean
  wheel?(dy: number, x: number, y: number, shift: boolean): boolean
  key(e: KeyboardEvent): boolean
  layout(): Record<string, [number, number]>
  /** DOM controls shown under the canvas area while this station is active. */
  controls?: HTMLElement
}
