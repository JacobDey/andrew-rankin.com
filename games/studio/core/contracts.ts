// Sunny 16 contracts (docs/design/studio.md §11.3, with architecture.md §5.6 overrides).
// The data shapes (camera, ShotRecord, Roll, PrintMeta, HouseState) are verbatim. The engine surface is the
// single-agent build's actual one (see core/engine.ts); it keeps the GDD names where they exist.
import type * as THREE from 'three'

export type RoomId = 'overview' | 'yard' | 'workshop' | 'hall' | 'darkroom'
export type QualityName = 'high' | 'low' | 'test'
export interface Quality {
  name: QualityName; dprMax: number; shadow: number; captureLong: number
  samples: number; samplesFP: number; drops: number; physicsHz: number; previewLong: number
  bloom: boolean; transitions: boolean
}

export interface Steppable { step(dt: number, t: number): void }
export interface SimClock {
  readonly t: number; paused: boolean
  add(s: Steppable, order: number): () => void; advance(dt: number): void
}
export interface DayClock {
  hours: number; rate: number // game-seconds per sim-second; 0 = frozen
  set(h: number, source: 'drag' | 'scrub' | 'api' | 'timelapse'): void; onChange(cb: (h: number) => void): () => void
}
export interface SunState {
  elevDeg: number; azDeg: number; dir: THREE.Vector3; sunLux: number; skyLux: number
  moonDir: THREE.Vector3; moonLux: number; horizLux: number; kelvin: number
}

export type ImpactMaterial = 'grass' | 'wood' | 'metal' | 'glass' | 'rubber' | 'cloth'

export interface Events {
  noise: { pos: THREE.Vector3; loudness: number; kind?: 'shutter' | 'impact' } // shutter, impacts → sparrows
  shot: { record: ShotRecord }
  'roll:unloaded': { rollId: string }
  'roll:developed': { rollId: string }
  'print:made': { printId: string }
  'postcard:answered': { id: string; mark: 'miss' | 'check' | 'star' }
  'part:unlocked': { partId: string }
  room: { from: RoomId; to: RoomId }
  sun: SunState
  'ball:landed': { pos: THREE.Vector3 }
  [k: string]: unknown
}

/* ---------- camera ---------- */
export type BodyId = 'oatcan' | 'box' | 'field' | 'tin35' | 'marbletin'
export type ShutterKind = 'cap' | 'leaf' | 'drop' | 'focalplane'
export type StockId = 'ortho25' | 'nj100' | 'nj400' | 'colour200'
export interface CameraBuild {
  v: 1; body: BodyId; lens: string; shutter: ShutterKind; stock: StockId | null
  pinholeMm?: number; pinholeRagged?: number; dropHeightCm?: number; accessories: string[]
}
export interface CameraSpec {
  build: CameraBuild; formatMm: [number, number]; frames: number; finder: 'pins' | 'waist' | 'ground' | 'range'
  f: number; nMin: number; nMax: number; blades: number; imageCircleMm: number; vRangeMm: [number, number]
  tiltMaxDeg: number; shutterSpeeds: number[] /* seconds; 0 = B */; loudness: number; massKg: number; iso: number
  spectral: [number, number, number][]; post: { glow: number; edgeSoftPx: number; ca: number; k1: number; vignette: number; swirl: number }
}
export interface CameraSettings { N: number; t: number /* s; 0 = B */; focusM: number; tiltDeg: number }

export interface PhotoSubject {
  id: string; tag: string; dynamic: boolean
  center(out: THREE.Vector3): THREE.Vector3; radius: number
  /** collider handle to exclude when ray-testing visibility (the subject's own body) */
  colliderHandle?: number
  sample(): Record<string, number | boolean> // state at the current sim time
  extra?(cam: THREE.Camera, frameW: number, frameH: number, phase: 'start' | 'mid' | 'end'): Record<string, number> // drops, trail
}
export interface SubjectRegistry { all(): PhotoSubject[]; get(id: string): PhotoSubject | undefined; add(s: PhotoSubject): void }

export interface SubjectMeasure {
  id: string; tag: string; inFrame: number; visible: number; blurPx: number; defocusPx: number
  coverage: number; visibility: number; centerPx: [number, number]; distanceM: number
  stateMin: Record<string, number>; stateMax: Record<string, number>; stateMid: Record<string, number | boolean>
  anyTrue: Record<string, boolean>; extra: Record<string, number>
}
export interface ShotRecord {
  id: string; rollId: string; frame: number; takenAt: number; dayHours: number; sunElevDeg: number
  spec: { body: BodyId; lens: string; f: number; N: number; t: number; shutter: ShutterKind; stock: StockId; iso: number; formatMm: [number, number] }
  focusM: number; tiltDeg: number; handheld: boolean; shakePx: number; samples: number; timelapse: number
  exposure: { evScene: number; overStops: number }; doubleExposures: number; subjects: SubjectMeasure[]; tags: string[]
}

export interface Roll {
  id: string; stock: StockId; body: BodyId; frames: number; exposed: number[]
  state: 'loaded' | 'unloaded' | 'developed'; createdAt: number
}
export interface LatentFrame { frameId: string; rollId: string; index: number; w: number; h: number; channels: 1 | 3; png: Blob; record: ShotRecord }
export interface DevParams { tempC: number; chemSeconds: number; rho: number; cueRatio: number; surge: number; washed: boolean }
export interface PrintMeta {
  id: string; frameId: string; kind: 'contact' | 'enlargement'; lampS: number; grade: number; devS: number
  w: number; h: number; caption: string; tags: string[]; record: ShotRecord; createdAt: number; place: 'box' | 'fridge' | 'line' | 'gallery'
}

export type PostcardState = 'unissued' | 'open' | 'check' | 'star'
export interface HouseState {
  v: 1; seed: number; owned: string[]; builds: CameraBuild[]; activeBuild: number; rollInCamera: string | null
  pocket: string[]; postcards: Record<string, { state: PostcardState; misses: number; printId?: string }>
  fridge: (string | null)[]; tutorial: Record<string, boolean>; dayHours: number
  tripod: { pos: [number, number, number]; yaw: number; pitch: number; height: number }
  props: Record<string, [number, number, number, number, number, number, number]>
  settings: { erect: boolean; captions: boolean; steady: boolean; quality: 'auto' | QualityName }
  /** frames on the current (unfinished) sheet/roll: index of the next frame to expose */
  frameCursor: number
  /** frames exposed without winding on (double exposure pending) */
  wound: boolean
  negatives: string[] // frame ids that have been developed (newest roll first)
  prints: string[] // print ids, newest first
}

/* ---------- bridges ---------- */
export interface ChemBridge {
  negDensity(x: number, stock: StockId, rho: number, ch: 0 | 1 | 2): number
  reciprocity(t: number, stock: StockId): number; grainSigma(stock: StockId, D: number, rho: number): number
  paperDensity(xp: number, grade: number): number; devRate(tempC: number): number
}
