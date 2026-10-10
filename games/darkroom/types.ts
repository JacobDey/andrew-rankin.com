// CONTRACT (darkroom.md §11.3, with the architecture §5.2 overrides):
// Paper.silver / Paper.cyano are the shared photochem sheets.
// Additive changes only.
import type { CyanoSheet, SilverSheet } from '@shared/photochem'
import type { TrayBody, TrayFluid, ScalarField } from './sim/fluid'

export type StationId = 'prep' | 'enlarger' | 'trays' | 'sink' | 'iron' | 'window'
export type TrayId = 'dev' | 'stop' | 'fix' | 'wash' | 'tone'
export type LightId = 'room' | 'safe' | 'enlarger' | 'uv' | 'blind'
export type Grade = '00' | '0' | '1' | '2' | '3' | '4' | '5'
export type ToolId = 'hand' | 'fist' | 'wand' | 'card' | 'brush' | 'rod' | 'dryer' | 'dropper'
export type Place =
  | { at: 'box' } | { at: 'envelope' } | { at: 'carried' } | { at: 'easel' } | { at: 'frame' } | { at: 'uvbox' } | { at: 'sill' }
  | { at: 'tray'; tray: TrayId } | { at: 'bench'; x: number; z: number } | { at: 'line'; slot: number }
  | { at: 'coat' } // additive: the coating spot at the iron station

export interface PrepSettings { channel: 'r' | 'g' | 'b' | 'lum'; invert: boolean; flip: boolean; curve: number[]; uvTint: boolean }
export interface Negative {
  id: string; name: string; W: number; H: number; T: Float32Array
  format: '35mm' | '8x10'; source: 'builtin' | 'import'; prep?: PrepSettings
}

export interface PrintLog {
  no: number
  paper: string
  negative: string | null
  exposures: { seconds: number; grade: Grade | null; strip?: boolean; source: string }[]
  dodgeS: number; burnS: number
  dev: number; stop: number; fix: number; wash: number; uv: number; dry: number
  peroxide: boolean
  fogged: boolean
  parentPin: string | null
}

export interface PaperBody { x: number; y: number; rot: number; vx: number; vy: number; w: number; sunk: boolean }

export interface Paper {
  id: string; kind: 'silver' | 'cyano'; size: 'sheet' | 'strip'; place: Place; faceUp: boolean
  body: PaperBody
  silver?: SilverSheet; cyano?: CyanoSheet; ratio?: number
  W: number; H: number
  albedo: Uint8ClampedArray; dirty: boolean
  /** bumped every time albedo is re-rendered (the view uploads on change) */
  albedoVer: number
  contact: Float32Array
  log: PrintLog; flags: string[]
  title: string
  /** frame contents when in the contact frame / UV box */
  hungAt?: number
  /** seconds since last chemistry tick (sleep scheduler) */
  idle: number
  /** imported negative used for the last exposure */
  fromImport: boolean
}

export interface TrayState {
  id: TrayId
  fluid: TrayFluid
  body: TrayBody
  rocking: boolean
  held: boolean
  restTilt: [number, number]
  bulk: number
  dye: ScalarField | null
  perox: ScalarField | null
  kinetic: number
  impact: number
  spilled: number
}

export interface TimerState { seconds: number; running: boolean; remaining: number; strip: boolean; band: number; elapsed: number; total: number }
export interface EnlargerState { negative: string | null; grade: Grade; focus: boolean; exposing: boolean; grades: Set<Grade> }
export interface IronState {
  bottleA: number; bottleB: number; beakerA: number; beakerB: number
  brushLoad: number; tool: 'brush' | 'rod'
  frameOpen: boolean; frameIn: 'iron' | 'uvbox' | 'easel'
  frameNegative: string | null; frameProps: string[]
  uvLid: boolean; uvOn: boolean; dryer: boolean; dryerAt: { x: number; z: number }
  tap: boolean
}
export interface PropState { id: string; name: string; x: number; z: number; rot: number; on: 'tin' | 'easel' | 'frame' }

export interface Occluder { tool: 'hand' | 'fist' | 'wand' | 'card' | 'prop'; x: number; z: number; rot: number; height01: number; hole?: number }

export interface PrintStats {
  meanD: number; dmax: number; borderD: number; coverage: number; evenness: number; blue: number; bronze: number
  fixed: number; wet: number
}

export interface Pick {
  kind: 'paper' | 'tray' | 'easel' | 'line' | 'bench' | 'object'
  id?: string
  tray?: TrayId
  name?: string
  point: { x: number; y: number; z: number }
}

export interface Snapshot {
  v: 1
  savedAt: number
  header: Record<string, unknown>
  papers: { meta: Record<string, unknown>; bytes: Uint8Array }[]
  fluids: Record<string, { h: Float32Array; ux: Float32Array; uy: Float32Array }>
}

export interface Commands {
  setLight(id: LightId, on: boolean | number): void; guard(open: boolean): void
  holdTray(t: TrayId, tiltX: number, tiltY: number, offX?: number, offY?: number): void; releaseTray(t: TrayId): void
  autoRock(t: TrayId, on: boolean): void; poke(t: TrayId, x: number, y: number, s: number): void; refill(t: TrayId): void
  take(from: 'box-sheet' | 'box-strip' | 'envelope' | 'rag'): string | null
  pick(id: string): boolean; carry(x: number, z: number, rot?: number): void; drop(): Place | null
  dunk(id: string): void; flip(id: string): void; hang(id: string): void
  loadNegative(id: string | null): void; setGrade(g: Grade): void; setTimer(s: number): void
  startExposure(mode?: 'normal' | 'strip'): void; stopExposure(): void; setFocusLamp(on: boolean): void
  setOccluder(o: Occluder | null): void
  setBottleTilt(b: 'A' | 'B', rad: number): void; loadTool(t: 'brush' | 'rod'): void
  stroke(paperId: string, u0: number, v0: number, u1: number, v1: number, dt: number): void
  blow(x: number, z: number, on: boolean): void
  frame(a: 'open' | 'close' | 'peekL' | 'peekR' | 'unpeek'): void; putInFrame(item: string): void
  setUVLid(closed: boolean): void; setBlind(open01: number): void; tap(on: boolean): void
  peroxide(t: TrayId, x: number, y: number): void; placeProp(id: string, x: number, z: number, rot: number, vx?: number, vz?: number): void
  fastForward(on: boolean): void
  // additive
  moveTo(id: string, place: Place): void
  pour(b: 'A' | 'B', ml: number): void
  emptyBeaker(): void
}

export interface WorldRead {
  time: number; lights: Record<LightId, number>; guardOpen: boolean; exposureX: number; trays: Record<TrayId, TrayState>
  papers: Paper[]; carried: string | null; carryPos: { x: number; z: number }; timer: TimerState; enlarger: EnlargerState; iron: IronState
  props: PropState[]; discoveries: string[]; occluder: Occluder | null; fastForward: boolean
  negatives: DarkroomContent
}

export interface World extends WorldRead {
  cmd: Commands
  tick(dt: number): void
  serialize(): Snapshot
  deserialize(s: Snapshot): void
  stats(paperId?: string): PrintStats
  paper(id: string): Paper | undefined
}

export interface View {
  frame(dt: number, world: WorldRead): void
  resize(): void
  pick(cx: number, cy: number): Pick | null
  benchPoint(cx: number, cy: number, y?: number): { x: number; z: number } | null
  project(anchor: string | [number, number, number]): { x: number; y: number; visible: boolean }
  setFocus(station: StationId, sub?: number): void
  thumbnail(): Promise<Blob>
  setPoster(on: boolean): void
  readonly focus: StationId
  readonly focusX: number
  panBy(dxPx: number): void
  settle(): void
  snap(): void
  renderMs: number
}

export interface PropMask { id: string; name: string; W: number; H: number; T: Float32Array; sizeM: number }

export interface PrepPipeline {
  run(src: ImageData, s: PrepSettings, out?: { lum: Float32Array; T: Float32Array }): { lum: Float32Array; T: Float32Array; W: number; H: number }
  toNegative(id: string, name: string, src: ImageData, s: PrepSettings, format: '35mm' | '8x10'): Negative
}

export interface DarkroomContent {
  getNegative(id: string): Negative | undefined
  listNegatives(): Negative[]
  addNegative(n: Negative): void
  prep: PrepPipeline
  props: PropMask[]
}
