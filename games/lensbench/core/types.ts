// Lens Bench contracts: lensbench.md §11.2 "games/lensbench/core/types.ts" verbatim,
// plus Screen (architecture §5.5) and the app state used by the store.
import type { LensDesign, LensProfile } from '@shared/optics'

export type Place = 'bench' | 'street' | 'tank' | 'lightbox'
export type QualityTier = 'desktop' | 'phone' | 'test'
export type BodyId = 'tin' | 'box' | 'rangefinder' | 'reflex' | 'view'
export type ShutterId = 'cap' | 'leaf' | 'clothFP' | 'metalFP' | 'rollerFP' | 'tricolour'
export type StockId = 'ortho25' | 'pan100' | 'pan400' | 'nightjar1600' | 'colour200' | 'ir820'
export type FilterId = 'none' | 'nd8' | 'nd64' | 'yellow' | 'orange' | 'red' | 'green' | 'deepRed'
export type StandpointId = 'window' | 'shopStep' | 'bakery' | 'fountain' | 'across' | 'farEnd' | 'chart'
export type TargetId = 'bakeryYear' | 'chalkboard' | 'catEye' | 'catWall' | 'fountain' | 'reader' | 'walker1'
  | 'walker2' | 'lamp2' | 'railing' | 'chart' | 'clockPlaque' | 'courier' | 'courierPlate' | 'windmill'
  | 'bladeNumber' | 'postbox' | 'tree' | 'shopSign' | 'facadeBehindCourier'
export interface CameraSpec {
  v: 1; name: string; lens: LensDesign; body: BodyId
  shutter: ShutterId; stock: StockId; filter: FilterId
}
export interface ShotRecord {
  id: string; seed: number; camera: CameraSpec; ext: number; fNumber: number
  shutterS: number /* set speed, or actual hold for B/cap */; worldT0: number; timeOfDay: number
  pos: [number, number, number]; trackHz: number; track: Float32Array /* yaw,pitch rad pairs */
  aimNoShake: Float32Array /* same layout, without θ: for grading */
  tripod: boolean; mirrorLocked: boolean; textSeed: number
}
export interface FrameRecord {
  id: string; rollId: string; index: number; shots: ShotRecord[]
  status: 'exposed' | 'rendered' | 'developed'; meta?: FrameMeta
}
export interface RollRecord {
  id: string; stock: StockId; body: BodyId; capacity: number
  frames: string[]; state: 'loaded' | 'rewound' | 'developed'; dev?: DevParams
}
export interface DevParams {
  developer: 'mq' | 'coffee' | 'lab'; minutes: number; tempC: number
  agitation: number; pushStops?: number
}
export interface FrameMeta { exposureEV: number; accidents: string[]; w: number; h: number }
export interface LatentImage {
  w: number; h: number; data: Uint8Array /* RGB8, §5.7 */
  formatMm: [number, number]; ir: boolean
}
export interface DevelopedFrame { w: number; h: number; negative: ImageData; positive: ImageData }

/** A place on screen (architecture §5.5). */
export interface Screen { enter(): void; exit(): void; update(dt: number): void; dispose(): void }

/** Progress, per lensbench.md §8 (`ar:lensbench:progress`). */
export type TagId = 'T01' | 'T02' | 'T03' | 'T04' | 'T05'
export interface Progress {
  v: 1
  onboarded: boolean
  spareKey: boolean
  unlocked: string[]
  tags: Partial<Record<TagId, { done: boolean; frameId: string | null; attempts: number }>>
  accidents: Record<string, string>
  textSeed: number
  settings: { audio: boolean; haptics: boolean; quality: QualityTier | 'auto' }
}

export interface AppState {
  place: Place
  camera: CameraSpec
  /** focus extension, mm (0 = ∞) */
  ext: number
  /** set f-number */
  fNumber: number
  /** set speed in seconds; 0 = B */
  shutterS: number
  timeOfDay: number
  worldT: number
  frozen: boolean
  standpoint: StandpointId
  pos: [number, number, number]
  yaw: number
  pitch: number
  tripod: boolean
  mirrorLocked: boolean
  rollId: string | null
  /** frames used on the loaded roll (advance moves the counter) */
  cocked: boolean
  progress: Progress
  selectedFrame: string | null
}

export type { LensDesign, LensProfile }
