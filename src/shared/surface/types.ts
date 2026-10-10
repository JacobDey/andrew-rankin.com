// @shared/surface types (texturedle.md section 11.2 block "src/shared/surface/types.ts (A)", verbatim),
// plus the additions in architecture.md section 4.11 and a few additive members (marked "additive").
//
// Coordinates: specimen millimetres, origin at the specimen centre, +x right, +y up. Texel (i, j) of any bake
// grid is centred at x = -size/2 + (i + 0.5) * size/res, y likewise; row j = 0 is the bottom (v = 0), like a GPU texture.

export type RGB = [number, number, number] // linear 0..1
export type Field = (x: number, y: number) => number // specimen mm
export type ProbeKind = 'marble' | 'lens' | 'burlap'
export type PropKind = 'mailbox' | 'sheet-box' | 'panel' | 'slab' | 'drape' | 'sphere' | 'disc' | 'mat' | 'cylinder'

/** A colour function: writes linear RGB into `out` (additive: the kit's palette()/tint() build these). */
export type AlbedoFn = (x: number, y: number, out: RGB) => RGB

/** Number or field: operands of the kit combinators (additive). */
export type FieldLike = Field | number

export interface WorleyOpts {
  cell: number
  jitter?: number
  out?: 'f1' | 'f2' | 'edge' | 'id'
  salt?: number
}

export interface RecipeKit {
  seed: number
  convexity(): Field
  cavity(): Field
  hex(s: string): RGB

  // ---- primitives (section 6.1). All lengths are mm. Unless noted a primitive's output is unitless.
  /** Gradient-noise fbm, about [-1, 1]. `scale` = feature size (mm). `warp` = domain-warp amplitude (mm). */
  fbm(o: { scale: number; oct?: number; gain?: number; lac?: number; warp?: number; salt?: number; stretch?: [number, number] }): Field
  /** Ridged multifractal in [0, 1]. */
  ridged(o: { scale: number; oct?: number; gain?: number; lac?: number; salt?: number; stretch?: [number, number] }): Field
  /** Cellular noise. out: 'f1' / 'f2' distances in mm, 'edge' = (f2 - f1) in mm, 'id' = cell hash in [0, 1). */
  worley(o: WorleyOpts): Field
  /** Periodic stripes across `angleDeg` direction (stripes run ALONG that angle), value 0..1. */
  stripes(o: { period: number; angleDeg: number; profile?: 'sine' | 'tri' | 'square' | 'wale'; warp?: FieldLike; salt?: number }): Field
  /** Woven yarn relief 0..1 (1 = yarn crown). warp/weft are yarn pitches (mm). */
  weave(o: { warp: number; weft: number; kind?: 'plain' | 'twill3x1' | 'loop'; yarnRelief?: number }): Field
  /** Hex lattice of domes: height in mm (profile 'dome' | 'cone' | 'flat'). */
  hexDomes(o: { cell: number; radius: number; height: number; profile?: 'dome' | 'cone' | 'flat' }): Field
  /** Crack network (worley edges): depth in `depth` units where within `width` of a cell border, `curl` lifts plate edges. */
  cracks(o: { cell: number; width: number; depth: number; curl?: number; jitter?: number; salt?: number }): Field
  /** Random blobs: jittered cells, radius in [a, b] mm, `density` 0..1 = fraction of cells with a blob, height in `height` units. */
  blobs(o: { cell: number; r: [number, number]; density: number; height: number; salt?: number }): Field
  /** n random scratches inside a window of `extentMm` (default 60): returns a 0..1 mask (1 = scratch core). */
  scratches(o: { n: number; len: [number, number]; width: [number, number]; arcAbout?: [number, number]; dirDeg?: number; dirSpread?: number; salt?: number; extentMm?: number }): Field
  /** Concentric grooves about `centre`: V profile of `depth` units, `pitch` mm apart. `melody` modulates depth per groove. */
  grooves(o: { centre: [number, number]; pitch: number; depth: number; melody?: (index: number) => number }): Field
  /** Smooth annulus mask 0..1 about `centre`. */
  ring(o: { centre: [number, number]; r: number; width: number }): Field
  /** Single-stroke engraved text mask 0..1. `at` = lower-left corner (mm), `size` = cap height (mm), `stroke` = stroke width (mm). */
  glyph(o: { text: string; at: [number, number]; size: number; stroke: number }): Field
  /** Max of `src` sampled upstream along dirDeg for lenMm (linear decay): tear-drop streaks. */
  streak(o: { src: Field; dirDeg: number; lenMm: number; samples?: number }): Field

  // ---- combinators
  add(...f: FieldLike[]): Field
  sub(a: FieldLike, b: FieldLike): Field
  mul(...f: FieldLike[]): Field
  max(...f: FieldLike[]): Field
  min(...f: FieldLike[]): Field
  mix(a: FieldLike, b: FieldLike, t: FieldLike): Field
  /** smoothstep(e0, e1, f) */
  smooth(f: FieldLike, e0: number, e1: number): Field
  clamp(f: FieldLike, lo: number, hi: number): Field
  /** f * s + offset */
  scale(f: FieldLike, s: number, offset?: number): Field
  /** Rotate the domain by deg about (cx, cy). */
  rotate(f: Field, deg: number, cx?: number, cy?: number): Field
  /** Domain warp by a (dx, dy) field pair, or by fbm noise of the given scale and amplitude (mm). */
  warp(f: Field, w: { dx: Field; dy: Field } | { scale: number; amp: number; salt?: number }): Field

  // ---- colour
  /** Piecewise-linear gradient (in linear light) over t in [0, 1]; stops are [t, '#RRGGBB']. */
  palette(stops: [number, string][], t: Field): AlbedoFn
  /** Multiply `base` by (1 + amt * field) (brightness variation), clamped to 0..1.5. */
  tint(base: AlbedoFn, field: Field, amt: number): AlbedoFn
  /** A constant colour. */
  solid(hex: string): AlbedoFn
  /** Per-texel blend of two colour functions by t in [0, 1] (additive). */
  blend(a: AlbedoFn, b: AlbedoFn, t: Field): AlbedoFn

  // ---- additive helpers
  /** Evaluate `f` once per grid cell over the bake extent and interpolate: use for low-frequency fields shared by many layers. */
  cache(f: Field, cellMm: number): Field
  /** Remember the last (x, y) evaluation: layers that all read the same field at one texel pay once. */
  memo(f: Field): Field
  /** Seeded random stream for placing discrete features. */
  rng(salt?: number): () => number
}

export interface BenchEventLike { t: string; x?: number; y?: number; speed?: number; by?: string; layer?: number } // structural subset of BenchEvent
export interface SecretHit { id: string; x: number; y: number } // D marks the day's secret found, B/C play the effect

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
  modes?: Array<[fHz: number, t60: number, gain: number]>
  rattle?: boolean
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
  pool: boolean // false for the poster recipe
  build(k: RecipeKit): { substrate: LayerSpec; layers: LayerSpec[]; looseInitUm?: Field; blisterMask?: Field }
  secretHook?(e: BenchEventLike, rt: SurfaceRuntime): SecretHit | null // main thread
}

export interface ContactField { res: number; cellMm: number; radiusMm: number; data: Float32Array }

export interface SurfaceBake {
  recipeId: string; ratio: number; seed: number
  sizeMm: number; res: number; mmPerTexel: number // square bake
  height: Float32Array; heightMips: Float32Array[] // mm, includes form. heightMips[k] is level k + 1 (res/2, res/4, ... down to 4 texels)
  albedo: Uint8Array; orm: Uint8Array // RGBA8 each. albedo: sRGB, A = pile/sheen mask. orm: R AO, G roughness, B metalness, A anisotropy strength
  topLayer: Uint8Array; layerT: Uint16Array // layerT: layer-major, index layer * res^2 + texel, in um (layer 0 = substrate)
  physRes: number; loose: Float32Array | null // um
  contact: Record<ProbeKind, ContactField>; snag: Float32Array // snag has the burlap contact field's resolution
  audioRes: number; audioHeight: Float32Array // high-passed mm
  phys: MaterialPhys[] // per layer index
  ms: number
  /** Additive: number of layers (substrate + layers). */
  nLayers: number
}

export interface TexRect { x0: number; y0: number; x1: number; y1: number } // texels
export interface ContactSample { d: number; nx: number; ny: number; nz: number; layer: number }

export interface SurfaceRuntime {
  readonly bake: SurfaceBake; readonly recipe: SurfaceRecipe
  contactAt(p: ProbeKind, x: number, y: number, out: ContactSample): ContactSample
  materialAt(x: number, y: number): MaterialPhys
  residueAt(x: number, y: number): { rgb: RGB; rate: number; kind: string } | null
  snagAt(x: number, y: number): number
  abradeBatch(splats: Float32Array, n: number): { revealed: number[]; removed: RGB[] } // x,y,rMm,depthUm
  polishBatch(splats: Float32Array, n: number): void
  takeLoose(x: number, y: number, rMm: number, um: number): number
  editHeight(x: number, y: number, rMm: number, fn: (h: number, d: number) => number): void // pops, cracks
  markLooseDirty(r: TexRect): void
  onDirty(cb: (r: TexRect, what: 'height' | 'albedo' | 'orm' | 'loose') => void): () => void
  /** Additive: the recipe's built layers and masks (lazy, cached): secret hooks read `blisterMask` here. */
  fields(): ReturnType<SurfaceRecipe['build']>
}

export interface BakeOptions {
  ratio: number
  res: number
  physRes: number
  seed?: number
  /** Square side in mm. Default 1.06 * 36 / ratio (the frame's long side, so either orientation fits). */
  sizeMm?: number
  /** Additive: render maps only (no contact fields, snag, audio height, mips): thumbnails and 3D props. */
  maps?: boolean
}

/** 3D-prop maps (architecture 4.11). */
export interface SurfaceMaps {
  sizeMm: number
  res: number
  albedo: Uint8Array // RGBA8 sRGB
  normal: Uint8Array // RGBA8 tangent space, OpenGL convention
  orm: Uint8Array // R AO, G roughness, B metalness, A 255
  height: Float32Array // mm
}

export interface RecipeInfo { id: string; no: number; name: string; pool: boolean }
