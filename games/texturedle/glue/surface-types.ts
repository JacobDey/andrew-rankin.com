// Local copy of the frozen @shared/surface types (texturedle.md §11.2, block A).
// Used only until src/shared/surface lands; then glue/surface.ts re-exports the
// shared module and this file can go. Types only: no runtime code.

export type RGB = [number, number, number] // linear 0..1
export type Field = (x: number, y: number) => number // specimen mm
export type ProbeKind = 'marble' | 'lens' | 'burlap'
export type PropKind = 'mailbox' | 'sheet-box' | 'panel' | 'slab' | 'drape' | 'sphere' | 'disc' | 'mat' | 'cylinder'
export interface RecipeKit { seed: number; convexity(): Field; cavity(): Field; hex(s: string): RGB }
export interface BenchEventLike { t: string; x?: number; y?: number; speed?: number; by?: string; layer?: number }
export interface SecretHit { id: string; x: number; y: number }
export interface MaterialPhys {
  hardness: number; muS: number; muK: number; restitution: number; rollResist: number
  metalness: number; roughness: number; roughnessMin?: number; polish?: number
  residue?: { rgb: RGB; rate: number; kind: 'powder' | 'grease' | 'wet' | 'dye' | 'flake' | 'lint' }
  soft?: { sinkMm: number; recoverS: number }
}
export interface LayerSpec {
  name: string; colourName: string; phys: MaterialPhys
  thicknessUm: Field; reliefUm?: Field; albedo: (x: number, y: number, out: RGB) => RGB; roughness?: Field
}
export type FormSpec =
  | { kind: 'plane' }
  | { kind: 'cylinder'; radiusMm: number; axisDeg: number; crownOffsetMm: [number, number]; concave?: boolean }
  | { kind: 'sphere'; radiusMm: number; edge: 'void' }
export interface BodySpec {
  preset: 'hollow-sheet' | 'solid-stone' | 'board' | 'pane' | 'ceramic' | 'tube' | 'rubber-ball' | 'fruit' | 'soft'
  modes?: Array<[fHz: number, t60: number, gain: number]>; rattle?: boolean
}
export interface SurfaceRecipe {
  id: string; no: number; atlasId: string; name: string; binomial: string
  orientation: 'floor' | 'wall' | 'ceiling'; form: FormSpec; body: BodySpec
  aniso?: { dirDeg: number; strength: number }; periodicMm?: number[]; streakDirDeg?: number
  loose?: { rgb: RGB; reposeDeg: number; grain: 'dust' | 'sand' | 'flake' | 'crumb' }
  pile?: { dirDeg: number }
  tell: string; secret: { id: string; text: string }
  card: { title: string; caption: string; exif: string }
  reveal: { prop: PropKind; scene: 'drive' | 'yard' | 'garden' | 'hall' | 'kitchen' | 'studio' | 'darkroom' }
  pool: boolean
  build(k: RecipeKit): { substrate: LayerSpec; layers: LayerSpec[]; looseInitUm?: Field; blisterMask?: Field }
  secretHook?(e: BenchEventLike, rt: SurfaceRuntime): SecretHit | null
}
export interface ContactField { res: number; cellMm: number; radiusMm: number; data: Float32Array }
export interface SurfaceBake {
  recipeId: string; ratio: number; seed: number
  sizeMm: number; res: number; mmPerTexel: number
  height: Float32Array; heightMips: Float32Array[]
  albedo: Uint8Array; orm: Uint8Array
  topLayer: Uint8Array; layerT: Uint16Array
  physRes: number; loose: Float32Array | null
  contact: Record<ProbeKind, ContactField>; snag: Float32Array
  audioRes: number; audioHeight: Float32Array
  phys: MaterialPhys[]
  ms: number
}
export interface TexRect { x0: number; y0: number; x1: number; y1: number }
export interface ContactSample { d: number; nx: number; ny: number; nz: number; layer: number }
export interface SurfaceRuntime {
  readonly bake: SurfaceBake; readonly recipe: SurfaceRecipe
  contactAt(p: ProbeKind, x: number, y: number, out: ContactSample): ContactSample
  materialAt(x: number, y: number): MaterialPhys
  residueAt(x: number, y: number): { rgb: RGB; rate: number; kind: string } | null
  snagAt(x: number, y: number): number
  abradeBatch(splats: Float32Array, n: number): { revealed: number[]; removed: RGB[] }
  polishBatch(splats: Float32Array, n: number): void
  takeLoose(x: number, y: number, rMm: number, um: number): number
  editHeight(x: number, y: number, rMm: number, fn: (h: number, d: number) => number): void
  markLooseDirty(r: TexRect): void
  onDirty(cb: (r: TexRect, what: 'height' | 'albedo' | 'orm' | 'loose') => void): () => void
}
