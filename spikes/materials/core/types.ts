import type * as THREE from 'three'

/** Texturedle Atlas families (texturedle-game.md section 4). */
export type Family =
  | 'metal'
  | 'wood-bark'
  | 'stone-ceramic'
  | 'textile'
  | 'hide-hair'
  | 'polymer'
  | 'paper-card'
  | 'plant-food'

/** Texturedle Atlas habitats. */
export type Habitat =
  | 'kitchen'
  | 'wardrobe'
  | 'home'
  | 'workshop'
  | 'street-yard'
  | 'wild'
  | 'play-sport'
  | 'creature'

/** 1..5 scale used by the Atlas tiles (hardness, grain, wear) and difficulty. */
export type Scale5 = 1 | 2 | 3 | 4 | 5

/** What the object sounds like when the marble is dropped on it (modal-synth preset). */
export type BodyPreset =
  | 'hollow-sheet-metal'
  | 'heavy-metal'
  | 'thin-metal'
  | 'stone'
  | 'ceramic'
  | 'wood'
  | 'fabric'
  | 'rubber'
  | 'hollow-rubber'
  | 'plastic'
  | 'foam'
  | 'fruit'
  | 'leaf'
  | 'glass'
  | 'earth'

/** Physical hints for the probes (marble, cloths). Values are tuned for play, not lab-exact. */
export interface PhysicsHints {
  /** static / kinetic friction against a cloth swatch */
  muS: number
  muK: number
  /** marble restitution on this surface */
  restitution: number
  /** rolling-resistance coefficient for the marble */
  rolling: number
  /** colour a cloth picks up when rubbed (sRGB hex), or null */
  residue: string | null
  /** how much residue transfers per stroke, 0..1 */
  residueAmount: number
  body: BodyPreset
}

export interface MaterialInfo {
  id: string
  /** display name, sentence case */
  name: string
  /** accepted guesses besides the name (lowercase, any order of words) */
  aliases: string[]
  /** 1 = everyone gets it at 5:1, 5 = expert */
  difficulty: Scale5
  family: Family
  habitat: Habitat
  hardness: Scale5
  grain: Scale5
  wear: Scale5
  /** physical width of one generated (tileable) tile, millimetres */
  tileMm: number
  /** approximate peak-to-valley relief of the height map, millimetres */
  reliefMm: number
  physics: PhysicsHints
  /** one-line museum label (one real fact) */
  label: string
}

/** A rectangle in tile-UV units. {x:0,y:0,w:1} is exactly one tile (seamless). */
export interface Region {
  x: number
  y: number
  w: number
}

export interface GenerateOptions {
  /** output resolution in pixels (square). Default 1024. */
  size?: number
  /** uint32 seed. Same seed => same surface on every device. Default 1. */
  seed?: number
  /** which part of the material to bake, in tile UV. Default the whole tile {0,0,1}. */
  region?: Region
  /** also read the full-precision height (mm) back to the CPU. Default false. */
  readback?: boolean
  /** also read the sRGB albedo back as RGBA8 (thumbnails, share cards, 2D-canvas previews). Default false. */
  readbackAlbedo?: boolean
  /** block until the GPU has finished (benchmarks only). Default false. */
  finish?: boolean
  /**
   * 'zoom' compiles a variant with up to 4 extra fractal octaves that appear only where they are
   * resolvable, so racked-in region bakes show finer structure. 'auto' (default) uses it when
   * region.w < 1. Large-scale structure is identical either way.
   */
  detail?: 'auto' | 'base' | 'zoom'
  /** build mip chains on the output textures. Default true. */
  mipmaps?: boolean
  /** anisotropic filtering level applied to output textures. Default 4. */
  anisotropy?: number
}

export interface GenerateTimings {
  compileMs: number
  /** CPU time spent issuing the two passes (+ GPU time when a sync readback ran) */
  gpuMs: number
  readbackMs: number
  totalMs: number
}

export interface MaterialMaps {
  id: string
  info: MaterialInfo
  size: number
  seed: number
  region: Region
  /** millimetres per texel */
  texelMm: number
  /** sRGB albedo. A = loose material amount (rust dust, grit) 0..1 */
  albedo: THREE.Texture
  /** tangent-space normal map (OpenGL / three.js convention, +Y = +V). A = height / reliefMm */
  normal: THREE.Texture
  /** glTF-style ORM: R = ambient occlusion, G = roughness, B = metalness, A = top-layer code */
  orm: THREE.Texture
  /** same texture object as `orm` (three.js reads roughness from G and metalness from B) */
  roughness: THREE.Texture
  /** RGBA16F: R = height in mm, G = curvature (1/mm, + convex), B = AO, A = loose */
  height: THREE.Texture
  /** size*size heights in mm, row-major, row 0 = V 0 (bottom). Present when readback was requested. */
  heightData?: Float32Array
  /** min/max of heightData when present */
  heightRange?: [number, number]
  /** size*size*4 sRGB RGBA8 albedo, row 0 = V 0 (bottom). Present when readbackAlbedo was requested. */
  albedoData?: Uint8Array
  timings: GenerateTimings
  dispose(): void
}
