// games/texturedle/contracts.ts (I0): texturedle.md §11.2, verbatim, with the
// architecture §5.1 overrides. Surface types come from the surface façade,
// which re-exports @shared/surface (or its local stand-in until it lands).

import type { RGB, SurfaceRuntime, SurfaceRecipe } from './glue/surface'
export type { RGB, SurfaceRuntime, SurfaceRecipe } from './glue/surface'

export interface RatioSpec {
  label: string; m: number; fovMm: [number, number]; nEff: number; dofMm: number
  ev: number; timeScale: number; fps: number; scaleBarMm: number; title: string
}

// Exactly §3.2. Full-frame 36 × 24 mm, marked f/8, c = 0.03 mm.
export const RATIOS: readonly RatioSpec[] = [
  { label: '5:1', m: 5, fovMm: [7.2, 4.8], nEff: 48, dofMm: 0.115, ev: 5.2, timeScale: 0.0696, fps: 430, scaleBarMm: 1, title: 'Fingertip Oracle' },
  { label: '4:1', m: 4, fovMm: [9, 6], nEff: 40, dofMm: 0.15, ev: 4.6, timeScale: 0.0778, fps: 390, scaleBarMm: 2, title: 'Loupe Legend' },
  { label: '3:1', m: 3, fovMm: [12, 8], nEff: 32, dofMm: 0.213, ev: 4.0, timeScale: 0.0899, fps: 330, scaleBarMm: 2, title: 'Sharp Eye' },
  { label: '2:1', m: 2, fovMm: [18, 12], nEff: 24, dofMm: 0.36, ev: 3.2, timeScale: 0.11, fps: 270, scaleBarMm: 5, title: 'Close Enough' },
  { label: '1:1', m: 1, fovMm: [36, 24], nEff: 16, dofMm: 0.96, ev: 2.0, timeScale: 0.156, fps: 190, scaleBarMm: 10, title: "Arm's Length" },
  { label: '1:2', m: 0.5, fovMm: [72, 48], nEff: 12, dofMm: 2.88, ev: 1.2, timeScale: 0.22, fps: 140, scaleBarMm: 20, title: 'Squinter' },
]
export const MISS_TITLE = 'Back to the Drawer'

export type Vec2 = { x: number; y: number }
export type ClothKind = 'lens' | 'burlap'
export interface MarbleState {
  where: 'dish' | 'held' | 'plate' | 'falling' | 'returning'
  pos: [number, number, number]; vel: [number, number, number]; quat: [number, number, number, number]; grounded: boolean; dirt: number
}
export interface ClothState {
  kind: ClothKind; where: 'tray' | 'held' | 'plate'; n: number; swatchMm: number
  pos: Float32Array; flipped: boolean; residue: Uint8ClampedArray; rubbing: Uint8ClampedArray; fibres: Float32Array
}
export interface BenchState {
  tilt: Vec2; tiltVel: Vec2; marble: MarbleState; cloths: Record<ClothKind, ClothState>
  grains: { count: number; data: Float32Array /* x,y,z,size,r,g,b,rot */ }; simTime: number
}
export type BenchEvent =
  | { t: 'impact'; x: number; y: number; speed: number; energyUJ: number; layer: number; by: 'marble' | 'tap' }
  | { t: 'slip'; cloth: ClothKind; count: number; power: number }
  | { t: 'snag'; x: number; y: number } | { t: 'snagRelease'; x: number; y: number; s: number }
  | { t: 'layerRevealed'; layer: number; x: number; y: number; by: ClothKind }
  | { t: 'residue'; cloth: ClothKind; rgb: RGB; alpha: number; kind: string }
  | { t: 'avalanche'; volume: number } | { t: 'offEdge'; side: 'l' | 'r' | 't' | 'b' }
  | { t: 'shake' } | { t: 'settled'; x: number; y: number; inPit: boolean } | { t: 'pop'; x: number; y: number }
export interface ProbeStats {
  tiltMax: number; lampSwept: number; bounces: number; maxImpact: number; rollJitterRms: number
  levelDrift: Vec2 | null; channelFrac: number; wiped: Record<ClothKind, number>; slipMuK: Record<ClothKind, number>
  snags: number; layersRevealed: number[]; residue: Record<ClothKind, { rgb: RGB; alpha: number; kind: string }>
  pileTurned: number; avalanche: number; polishDrop: number
}
export interface AudioContacts {
  marble: { x: number; y: number; vx: number; vy: number; load: number } | null
  cloths: Array<{ kind: ClothKind; x: number; y: number; vx: number; vy: number; load: number; slipPower: number }>
}
export interface Bench {
  setSurface(rt: SurfaceRuntime, ratio: RatioSpec, keepMarble: boolean): void
  setTiltTarget(deg: Vec2): void; tap(x: number, y: number): void; shake(): void
  marbleGrab(x: number, y: number): boolean; marbleMove(x: number, y: number): void
  marbleRelease(vxWall: number, vyWall: number): void; marbleDrop(x: number, y: number, hMm: number): void
  clothGrab(k: ClothKind, x: number, y: number, press?: number): boolean; clothMove(x: number, y: number, press?: number): void
  clothPin(x: number, y: number): void; clothRelease(): void; clothFlip(k: ClothKind): void; resetProbes(): void
  step(dtWall: number): void // fixed 1/60 accumulator inside
  readonly state: BenchState; readonly stats: ProbeStats
  drainEvents(out: BenchEvent[]): BenchEvent[]; contacts(): AudioContacts
}
export type CreateBench = (seed: number) => Bench
export interface ViewState {
  ratio: RatioSpec; portrait: boolean; tilt: Vec2
  lamp: { azDeg: number; elDeg: number; mode: 'rake' | 'ring' }; focus: { zMm: number; peaking: boolean }
  bench: BenchState; reducedMotion: boolean; timeWall: number; dust: boolean
}
export interface FrameHit { x: number; y: number; inside: boolean; bezelDeg: number | null; focusRing: boolean }
export interface Renderer {
  readonly kind: 'webgl2' | 'canvas2d'
  setSurface(rt: SurfaceRuntime): void // subscribes to rt.onDirty
  render(view: ViewState): void
  clientToFrame(cx: number, cy: number): FrameHit; frameToClient(x: number, y: number): { cx: number; cy: number }
  mmPerPx(): number; setQuality(q: 'high' | 'low'): void; resize(): void
  playReveal(recipe: SurfaceRecipe, opts: { reducedMotion: boolean }): Promise<void>; endReveal(): void
  snapshot(): Promise<Blob>; stats(): { ms: number; calls: number; tris: number }; dispose(): void
}
export type CreateRenderer = (canvas: HTMLCanvasElement, opts: { quality: 'high' | 'low'; force2d?: boolean }) => Renderer
export type UiSoundName = 'iris' | 'detent' | 'ratchet' | 'tile' | 'stamp' | 'shutter' | 'dish' | 'thunk'
export interface AudioEngine {
  unlock(): Promise<void>; setSurface(rt: SurfaceRuntime): void
  update(c: AudioContacts): void; event(e: BenchEvent): void; ui(name: UiSoundName): void
  setRoomTone(on: boolean): void; onCaption(cb: (text: string) => void): () => void
}
export type CreateAudio = () => AudioEngine
