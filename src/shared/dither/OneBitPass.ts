import * as THREE from 'three'
import { getThresholdMap, type PatternName } from './noise'
import { hexToRgb, resolvePalette, LUMA, type Palette, type PaletteName } from './palettes'
import { blitFrag, compositeFrag, fullscreenVert, geomFrag } from './shaders'
import { getSharedSurfaceUniforms, setSharedSurfaceUniforms } from './surfaceDither'

/**
 * Where the dither threshold pattern is anchored.
 * - 'sphere': gnomonic cube map of directions from an anchor (setDitherAnchor). Centred
 *             on the camera: locked to the world under ROTATION. Centred on an anchor
 *             point (AnchorTracker, uses depth): locked under rotation AND translation
 *             near the anchor. 1:1 texel:pixel at the anchor; cleanest blue noise. Default.
 * - 'world':  to surfaces (triplanar, octave cross-fade). Stable under any motion but
 *             grainier (texels 1-2 px) and breathes a little as depth changes.
 * - 'screen': to the glass. Classic, swims on every camera move. Baseline only.
 * - 'none':   hard threshold at 0.5 (posterised; debug).
 */
export type DitherMode = 'sphere' | 'world' | 'screen' | 'none'
export type DebugView = 'final' | 'tone' | 'edges' | 'normals' | 'split'

export interface OutlineOptions {
  enabled: boolean
  /** 'auto' draws ink lines on lit surfaces and light lines in shadow (the Obra Dinn trick). */
  color: 'auto' | 'ink' | 'light'
  /** Silhouette step, relative part: a line where the surface behind a pixel lies more
   *  than max(depthAbsolute, depthTolerance * distance) beyond that pixel's plane. */
  depthTolerance: number
  /** Silhouette step, absolute part in metres (the smallest step that draws a line). */
  depthAbsolute: number
  /** Crease lines where adjacent face normals differ by more than this (degrees). */
  creaseAngle: number
  /** No lines beyond this view distance (m). */
  maxDistance: number
  /** In 'auto', tones below this get light lines. */
  autoThreshold: number
  /** Draw seams where the material line ID changes (see lineId.ts). */
  ids: boolean
}

export interface ToneOptions {
  /** Linear multiplier before the curve. */
  exposure: number
  /** Extended-Reinhard white point (linear value that maps to 1). 0 = hard clip. */
  whitePoint: number
  /** 1 = physically linear dot density; ~1.6-2.2 = perceptual coverage (brighter mids). */
  gamma: number
  contrast: number
  bias: number
  /** Luminance weights (see LUMA: rec709, plate, ortho). */
  luma: readonly [number, number, number]
}

export interface OneBitOptions {
  palette?: PaletteName | Palette
  /** Integer upscale factor, or 'auto' to land near `targetLongSide` internal pixels. */
  pixelScale?: number | 'auto'
  /** For 'auto': internal pixels on the long side (640 = 640x360 at 16:9). */
  targetLongSide?: number
  ditherMode?: DitherMode
  pattern?: PatternName
  noiseSize?: number
  noiseSeed?: number
  outline?: boolean | Partial<OutlineOptions>
  tone?: Partial<ToneOptions>
  /** Render the scene into RGBA16F when the GPU can (keeps highlights for exposure). */
  hdr?: boolean
  /** World mode: level-0 texel size in metres and a log2 LOD bias. */
  world?: { texel?: number; lodBias?: number }
}

/** Uniforms a material can share to dither itself in its own UV space (surfaceDither.ts). */
export interface SurfaceDitherUniforms {
  tNoise: THREE.IUniform<THREE.Texture>
  uNoiseSize: THREE.IUniform<number>
  uExposure: THREE.IUniform<number>
  uWhite: THREE.IUniform<number>
  uGamma: THREE.IUniform<number>
  uContrast: THREE.IUniform<number>
  uBias: THREE.IUniform<number>
  uLuma: THREE.IUniform<THREE.Vector3>
}

export interface OneBitReadback {
  width: number
  height: number
  /** RGBA8 rows bottom-up: R = bit (0/255), G = outline (0/255), B = tone 0..255. */
  rgba: Uint8Array
}

export interface PassTimings {
  scene: number
  geom: number
  composite: number
  blit: number
  total: number
}

const MODE_ID: Record<DitherMode, number> = { none: 0, screen: 1, sphere: 2, world: 3 }
const VIEW_ID: Record<DebugView, number> = { final: 0, tone: 1, edges: 2, normals: 3, split: 4 }

const DEFAULT_OUTLINE: OutlineOptions = {
  enabled: true,
  color: 'auto',
  depthTolerance: 0.004,
  depthAbsolute: 0.012,
  creaseAngle: 35,
  maxDistance: 30,
  autoThreshold: 0.18,
  ids: true,
}
const DEFAULT_TONE: ToneOptions = { exposure: 1, whitePoint: 6, gamma: 1.4, contrast: 1.5, bias: 0, luma: LUMA.rec709 }

function makeFullscreenTriangle(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  return g
}

/**
 * Obra-Dinn-style 1-bit post process for a WebGLRenderer.
 *
 *   const pass = new OneBitPass(renderer, { palette: 'bone', pixelScale: 'auto', ditherMode: 'sphere' })
 *   camera.aspect = pass.aspect            // after resize: keeps texels square and 1:1
 *   pass.render(scene, camera)             // instead of renderer.render(scene, camera)
 *
 * Pipeline (all at internal resolution except the blit):
 *   scene -> sceneRT(+depth) -> geom (normals from depth) -> composite (tone, threshold,
 *   outlines) -> bitsRT -> blit (integer nearest upscale + palette) -> canvas
 */
export class OneBitPass {
  readonly renderer: THREE.WebGLRenderer
  /** Last profile when `profile` is true (ms, CPU-side, forced sync after each stage). */
  timings: PassTimings = { scene: 0, geom: 0, composite: 0, blit: 0, total: 0 }
  profile = false
  debugView: DebugView = 'final'
  /** Split position for debugView 'split' (0..1 of the width). */
  split = 0.5

  private sceneRT: THREE.WebGLRenderTarget
  private geomRT: THREE.WebGLRenderTarget
  private bitsRT: THREE.WebGLRenderTarget
  private noiseTex: THREE.DataTexture
  private fsScene = new THREE.Scene()
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private fsMesh: THREE.Mesh
  private geomMat: THREE.ShaderMaterial
  private compMat: THREE.ShaderMaterial
  private blitMat: THREE.ShaderMaterial
  private bufSize = new THREE.Vector2()
  private _scale = 1
  private _w = 0
  private _h = 0
  private pixelScale: number | 'auto'
  private targetLongSide: number
  private pattern: PatternName
  private noiseSize: number
  private noiseSeed: number
  private outline: OutlineOptions
  private tone: ToneOptions
  private _mode: DitherMode
  private palette: Palette
  private nextPalette: Palette | null = null
  private transitionFrames = 0
  private transitionStep = 0
  private anchorInv = new THREE.Matrix3()
  private anchorPos = new THREE.Vector3()
  private anchorInvB = new THREE.Matrix3()
  private anchorPosB = new THREE.Vector3()
  private anchorFrames = 0
  private anchorStep = 0
  private tmpQ = new THREE.Quaternion()
  private tmpM4 = new THREE.Matrix4()
  readonly surface: SurfaceDitherUniforms
  readonly hdr: boolean

  constructor(renderer: THREE.WebGLRenderer, opts: OneBitOptions = {}) {
    this.renderer = renderer
    this.pixelScale = opts.pixelScale ?? 'auto'
    this.targetLongSide = opts.targetLongSide ?? 640
    this.pattern = opts.pattern ?? 'bluenoise'
    this.noiseSize = opts.noiseSize ?? 64
    this.noiseSeed = opts.noiseSeed ?? 1
    this._mode = opts.ditherMode ?? 'sphere'
    this.palette = resolvePalette(opts.palette ?? 'bone')
    this.outline = {
      ...DEFAULT_OUTLINE,
      ...(typeof opts.outline === 'boolean' ? { enabled: opts.outline } : opts.outline ?? {}),
    }
    this.tone = { ...DEFAULT_TONE, ...(opts.tone ?? {}) }

    const ext = renderer.extensions
    this.hdr = (opts.hdr ?? true) && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))

    const depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      colorSpace: this.hdr ? THREE.NoColorSpace : THREE.SRGBColorSpace,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      depthTexture,
    })
    const rt8 = () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.UnsignedByteType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: false,
      })
    this.geomRT = rt8()
    this.bitsRT = rt8()

    this.noiseTex = this.buildNoiseTexture()

    const shared = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTanHalf: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
    }
    this.geomMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: geomFrag,
      uniforms: { ...shared, tDepth: { value: depthTexture } },
      depthTest: false,
      depthWrite: false,
    })
    this.surface = {
      tNoise: { value: this.noiseTex },
      uNoiseSize: { value: this.noiseSize },
      uExposure: { value: this.tone.exposure },
      uWhite: { value: this.tone.whitePoint },
      uGamma: { value: this.tone.gamma },
      uContrast: { value: this.tone.contrast },
      uBias: { value: this.tone.bias },
      uLuma: { value: new THREE.Vector3(...this.tone.luma) },
    }
    setSharedSurfaceUniforms(this.surface)
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: compositeFrag,
      uniforms: {
        ...shared,
        ...this.surface,
        tColor: { value: this.sceneRT.texture },
        tGeom: { value: this.geomRT.texture },
        uMode: { value: MODE_ID[this._mode] },
        uCamRot: { value: new THREE.Matrix3() },
        uCamPos: { value: new THREE.Vector3() },
        uAnchorInv: { value: this.anchorInv },
        uAnchorPos: { value: this.anchorPos },
        uAnchorInvB: { value: this.anchorInvB },
        uAnchorPosB: { value: this.anchorPosB },
        uAnchorMix: { value: 1 },
        uAnchorPosOn: { value: false },
        uSphereScale: { value: 300 },
        uHalfShift: { value: new THREE.Vector2() },
        uScreenOffset: { value: new THREE.Vector2(0, 0) },
        uWorldTexel: { value: opts.world?.texel ?? 0.0015 },
        uWorldLodBias: { value: opts.world?.lodBias ?? 0.25 },
        uOutline: { value: this.outline.enabled },
        uDepthTol: { value: this.outline.depthTolerance },
        uDepthAbs: { value: this.outline.depthAbsolute },
        uCreaseCos: { value: Math.cos((this.outline.creaseAngle * Math.PI) / 180) },
        uOutlineMaxDist: { value: this.outline.maxDistance },
        uLineColor: { value: 0 },
        uAutoLine: { value: this.outline.autoThreshold },
        uIdLines: { value: this.outline.ids },
      },
      depthTest: false,
      depthWrite: false,
    })
    this.blitMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: blitFrag,
      uniforms: {
        tBits: { value: this.bitsRT.texture },
        tGeom: { value: this.geomRT.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2() },
        uScale: { value: 1 },
        uInkA: { value: new THREE.Vector3() },
        uLightA: { value: new THREE.Vector3() },
        uInkB: { value: new THREE.Vector3() },
        uLightB: { value: new THREE.Vector3() },
        uMix: { value: 0 },
        uView: { value: 0 },
        uSplit: { value: 0.5 },
      },
      depthTest: false,
      depthWrite: false,
    })
    this.fsMesh = new THREE.Mesh(makeFullscreenTriangle(), this.geomMat)
    this.fsMesh.frustumCulled = false
    this.fsScene.add(this.fsMesh)

    this.setOutline(this.outline)
    this.applyPalette()
    this.syncSize()
  }

  // ---------------------------------------------------------------- settings

  get ditherMode(): DitherMode { return this._mode }
  /** Internal (dither) resolution and the integer upscale factor. */
  get width(): number { return this._w }
  get height(): number { return this._h }
  get scale(): number { return this._scale }
  /** Aspect of the internal buffer: set camera.aspect to this to keep texels 1:1. */
  get aspect(): number { return this._w / this._h }

  setDitherMode(mode: DitherMode): void {
    this._mode = mode
    this.compMat.uniforms.uMode.value = MODE_ID[mode]
  }

  setPattern(pattern: PatternName): void {
    if (pattern === this.pattern) return
    this.pattern = pattern
    const old = this.noiseTex
    this.noiseTex = this.buildNoiseTexture()
    this.surface.tNoise.value = this.noiseTex
    old.dispose()
  }
  getPattern(): PatternName { return this.pattern }

  /**
   * Palette swap. frames > 0 runs a Bayer cross-dissolve over that many rendered frames
   * (plates-craft.md: "hard cuts with a three-frame Bayer cross-dissolve").
   */
  setPalette(p: PaletteName | Palette, frames = 0): void {
    const next = resolvePalette(p)
    if (frames <= 0) {
      this.palette = next
      this.nextPalette = null
      this.transitionFrames = 0
    } else {
      if (this.nextPalette) this.palette = this.nextPalette
      this.nextPalette = next
      this.transitionFrames = frames
      this.transitionStep = 0
    }
    this.applyPalette()
  }
  getPalette(): Palette { return this.nextPalette ?? this.palette }

  setPixelScale(scale: number | 'auto', targetLongSide = this.targetLongSide): void {
    this.pixelScale = scale
    this.targetLongSide = targetLongSide
    this.syncSize()
  }

  setOutline(o: boolean | Partial<OutlineOptions>): void {
    this.outline = { ...this.outline, ...(typeof o === 'boolean' ? { enabled: o } : o) }
    const u = this.compMat.uniforms
    u.uOutline.value = this.outline.enabled
    u.uDepthTol.value = this.outline.depthTolerance
    u.uDepthAbs.value = this.outline.depthAbsolute
    u.uCreaseCos.value = Math.cos((this.outline.creaseAngle * Math.PI) / 180)
    u.uOutlineMaxDist.value = this.outline.maxDistance
    u.uLineColor.value = this.outline.color === 'auto' ? 0 : this.outline.color === 'ink' ? 1 : 2
    u.uAutoLine.value = this.outline.autoThreshold
    u.uIdLines.value = this.outline.ids
  }
  getOutline(): OutlineOptions { return { ...this.outline } }

  setTone(t: Partial<ToneOptions>): void {
    this.tone = { ...this.tone, ...t }
    this.surface.uExposure.value = this.tone.exposure
    this.surface.uWhite.value = this.tone.whitePoint
    this.surface.uGamma.value = this.tone.gamma
    this.surface.uContrast.value = this.tone.contrast
    this.surface.uBias.value = this.tone.bias
    this.surface.uLuma.value.set(...this.tone.luma)
  }
  getTone(): ToneOptions { return { ...this.tone } }

  setWorld(w: { texel?: number; lodBias?: number }): void {
    if (w.texel !== undefined) this.compMat.uniforms.uWorldTexel.value = w.texel
    if (w.lodBias !== undefined) this.compMat.uniforms.uWorldLodBias.value = w.lodBias
  }

  /**
   * Sphere-mode anchor: orientation (world) and, optionally, a centre point.
   *
   * - Orientation: with the camera facing along it, texels are exactly 1:1 with pixels;
   *   the further the camera turns away, the more the cube face is foreshortened.
   * - Position (optional): centre the sphere on a fixed point and the pattern is glued
   *   to surfaces under translation too (uses the depth buffer). Without it, the sphere
   *   is centred on the camera (classic: stable under rotation only).
   * - dissolveFrames > 0: Bayer-dissolve from the previous anchor over that many frames
   *   instead of popping (use when re-anchoring while the camera is moving).
   *
   * See AnchorTracker (anchor.ts) for an automatic policy. null = world axes, camera centre.
   */
  setDitherAnchor(q: THREE.Quaternion | null, pos: THREE.Vector3 | null = null, dissolveFrames = 0): void {
    if (dissolveFrames > 0) {
      this.anchorInvB.copy(this.anchorInv)
      this.anchorPosB.copy(this.compMat.uniforms.uAnchorPosOn.value ? this.anchorPos : (this.compMat.uniforms.uCamPos.value as THREE.Vector3))
      this.anchorFrames = dissolveFrames
      this.anchorStep = 0
      this.compMat.uniforms.uAnchorMix.value = 0
    } else {
      this.anchorFrames = 0
      this.compMat.uniforms.uAnchorMix.value = 1
    }
    if (!q) this.anchorInv.identity()
    else {
      this.tmpQ.copy(q).invert()
      this.anchorInv.setFromMatrix4(this.tmpM4.makeRotationFromQuaternion(this.tmpQ))
    }
    this.compMat.uniforms.uAnchorPosOn.value = !!pos
    if (pos) this.anchorPos.copy(pos)
  }

  /** Screen-mode only: shift the pattern by whole pixels (e.g. "boil" every N frames). */
  setScreenOffset(x: number, y: number): void {
    this.compMat.uniforms.uScreenOffset.value.set(Math.round(x), Math.round(y))
  }

  // ---------------------------------------------------------------- rendering

  /** Recompute the internal size from the renderer's drawing buffer. Cheap; called by render(). */
  syncSize(): boolean {
    this.renderer.getDrawingBufferSize(this.bufSize)
    const bw = Math.max(1, Math.floor(this.bufSize.x))
    const bh = Math.max(1, Math.floor(this.bufSize.y))
    const s =
      this.pixelScale === 'auto'
        ? Math.max(1, Math.round(Math.max(bw, bh) / this.targetLongSide))
        : Math.max(1, Math.floor(this.pixelScale))
    const w = Math.ceil(bw / s)
    const h = Math.ceil(bh / s)
    const changed = w !== this._w || h !== this._h || s !== this._scale
    if (changed) {
      this._w = w
      this._h = h
      this._scale = s
      this.sceneRT.setSize(w, h)
      this.geomRT.setSize(w, h)
      this.bitsRT.setSize(w, h)
    }
    const res = this.compMat.uniforms.uRes.value as THREE.Vector2
    res.set(w, h)
    this.blitMat.uniforms.uRes.value.set(w, h)
    this.blitMat.uniforms.uScale.value = s
    // Centre the overflow of ceil() so cropping is symmetric.
    this.blitMat.uniforms.uOffset.value.set(-Math.floor((w * s - bw) / 2), -Math.floor((h * s - bh) / 2))
    this.compMat.uniforms.uHalfShift.value.set(w % 2 ? 0.5 : 0, h % 2 ? 0.5 : 0)
    return changed
  }

  /**
   * Render `scene` through `camera` as 1-bit into `target` (null = the canvas).
   * Call instead of renderer.render(). Restores the renderer's target and clear state.
   */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, target: THREE.WebGLRenderTarget | null = null): void {
    const r = this.renderer
    const t0 = this.profile ? performance.now() : 0
    let t1 = t0
    const lap = (key: keyof PassTimings, rt: THREE.WebGLRenderTarget | null) => {
      if (!this.profile) return
      this.syncGPU(rt)
      const now = performance.now()
      this.timings[key] = now - t1
      t1 = now
    }
    this.syncSize()

    const prevTarget = r.getRenderTarget()
    const prevAutoClear = r.autoClear
    const prevClearAlpha = r.getClearAlpha()

    // 1. Lit scene at internal resolution. Alpha must clear to 1: alpha carries the
    //    line ID (1 - n/256) and the "pre-dithered surface" flag (shifted down by 0.5).
    r.setClearAlpha(1)
    r.autoClear = true
    r.setRenderTarget(this.sceneRT)
    r.render(scene, camera)
    r.autoClear = false
    lap('scene', this.sceneRT)

    // Camera uniforms (matrixWorld is fresh after render()).
    const P = camera.projectionMatrix.elements
    const tanX = 1 / P[0]
    const tanY = 1 / P[5]
    for (const m of [this.geomMat, this.compMat]) {
      m.uniforms.uTanHalf.value.set(tanX, tanY)
      m.uniforms.uNear.value = camera.near
      m.uniforms.uFar.value = camera.far
      m.uniforms.uRes.value.set(this._w, this._h)
    }
    const cu = this.compMat.uniforms
    ;(cu.uCamRot.value as THREE.Matrix3).setFromMatrix4(camera.matrixWorld)
    ;(cu.uCamPos.value as THREE.Vector3).setFromMatrixPosition(camera.matrixWorld)
    cu.uSphereScale.value = this._h / (2 * tanY)

    // 2. Normals + packed depth.
    this.fsMesh.material = this.geomMat
    r.setRenderTarget(this.geomRT)
    r.render(this.fsScene, this.fsCam)
    lap('geom', this.geomRT)

    // 3. Tone, threshold, outlines.
    if (this.anchorFrames > 0) {
      this.anchorStep++
      const mix = this.anchorStep / (this.anchorFrames + 1)
      if (mix >= 1) { this.anchorFrames = 0; cu.uAnchorMix.value = 1 } else cu.uAnchorMix.value = mix
    }
    this.fsMesh.material = this.compMat
    r.setRenderTarget(this.bitsRT)
    r.render(this.fsScene, this.fsCam)
    lap('composite', this.bitsRT)

    // 4. Upscale + palette.
    this.stepTransition()
    const bu = this.blitMat.uniforms
    bu.uView.value = VIEW_ID[this.debugView]
    bu.uSplit.value = this.split
    this.fsMesh.material = this.blitMat
    r.setRenderTarget(target)
    r.render(this.fsScene, this.fsCam)
    lap('blit', target)

    r.setRenderTarget(prevTarget)
    r.autoClear = prevAutoClear
    r.setClearAlpha(prevClearAlpha)
    if (this.profile) this.timings.total = performance.now() - t0
  }

  /** Read the internal 1-bit buffer (R = bit, G = outline, B = tone). Synchronous GPU read. */
  readBits(out?: Uint8Array): OneBitReadback {
    const n = this._w * this._h * 4
    const rgba = out && out.length === n ? out : new Uint8Array(n)
    this.renderer.readRenderTargetPixels(this.bitsRT, 0, 0, this._w, this._h, rgba)
    return { width: this._w, height: this._h, rgba }
  }

  /** The internal targets, for games that want to reuse them (e.g. a CRT mesh). */
  get targets(): { scene: THREE.WebGLRenderTarget; geom: THREE.WebGLRenderTarget; bits: THREE.WebGLRenderTarget } {
    return { scene: this.sceneRT, geom: this.geomRT, bits: this.bitsRT }
  }

  dispose(): void {
    if (getSharedSurfaceUniforms() === this.surface) setSharedSurfaceUniforms(null)
    this.sceneRT.depthTexture?.dispose()
    this.sceneRT.dispose()
    this.geomRT.dispose()
    this.bitsRT.dispose()
    this.noiseTex.dispose()
    this.geomMat.dispose()
    this.compMat.dispose()
    this.blitMat.dispose()
    this.fsMesh.geometry.dispose()
  }

  // ---------------------------------------------------------------- internals

  private buildNoiseTexture(): THREE.DataTexture {
    const bytes = getThresholdMap(this.pattern, this.noiseSize, this.noiseSeed)
    const tex = new THREE.DataTexture(bytes, this.noiseSize, this.noiseSize, THREE.RedFormat, THREE.UnsignedByteType)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.generateMipmaps = false
    tex.unpackAlignment = 1
    tex.needsUpdate = true
    return tex
  }

  private applyPalette(): void {
    const u = this.blitMat.uniforms
    const a = this.palette
    const b = this.nextPalette ?? this.palette
    u.uInkA.value.set(...hexToRgb(a.ink))
    u.uLightA.value.set(...hexToRgb(a.light))
    u.uInkB.value.set(...hexToRgb(b.ink))
    u.uLightB.value.set(...hexToRgb(b.light))
    u.uMix.value = 0
  }

  private stepTransition(): void {
    if (!this.nextPalette) return
    this.transitionStep++
    if (this.transitionStep > this.transitionFrames) {
      this.palette = this.nextPalette
      this.nextPalette = null
      this.applyPalette()
      return
    }
    this.blitMat.uniforms.uMix.value = this.transitionStep / (this.transitionFrames + 1)
  }

  private syncBuf = new Uint8Array(4)
  private syncBuf16 = new Uint16Array(4)
  private syncGPU(rt: THREE.WebGLRenderTarget | null): void {
    if (rt) {
      if (rt === this.sceneRT && this.hdr) {
        // Half-float target: read one texel as HALF_FLOAT (falls back to finish()).
        try { this.renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, this.syncBuf16) } catch { this.renderer.getContext().finish() }
        return
      }
      this.renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, this.syncBuf)
    } else {
      const gl = this.renderer.getContext()
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.syncBuf)
    }
  }
}
