// GPU material generator.
//
//   Fields  (optional) recipe.fields[i](uv) -> RGBA32F each. Heavy noise is split into small
//           programs because shader compile cost is strongly superlinear in program size
//           (ANGLE/D3D11 measured: 8 noise calls 0.8 s, 32 calls 5.5 s, 64 calls 18 s), and
//           separate programs can compile in parallel. The surface pass reads them with an
//           exact texelFetch at its own pixel: F0() .. F3().
//   Pass A  "surface"  recipe(uv) -> MRT [RGBA32F: height mm, rough, metal, layer]
//                                       [RGBA16F: linear albedo, loose]
//   Pass B  "derive"   reads pass A with texelFetch -> MRT
//                      [SRGB8_A8 albedo] [RGBA8 normal + h/relief] [RGBA8 ORM + layer] [RGBA16F height, curvature, AO, loose]
//
// Pass A targets are pooled per size (transient); pass B targets belong to the
// returned MaterialMaps and are freed by maps.dispose().

import * as THREE from 'three'
import { TOOLKIT_GLSL } from './glsl/toolkit'
import { preprocessGlsl } from './glsl/preprocess'
import { RECIPES } from './recipes/index'
import type { RecipeDef } from './recipes/index'
import { getMaterialInfo, registerMaterialInfo } from './catalog'
import type { MaterialInfo } from './types'
import type { GenerateOptions, MaterialMaps, Region } from './types'

const VERT = /* glsl */ `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const SURFACE_MAIN = /* glsl */ `
uniform vec2 uOrigin;
layout(location = 0) out vec4 oData;
layout(location = 1) out vec4 oAlbedo;
void main() {
  vec2 uv = uOrigin + gl_FragCoord.xy * uPx;
  Surface s = surface(uv);
  oData = vec4(s.height, clamp(s.rough, 0.02, 1.0), clamp(s.metal, 0.0, 1.0), clamp(s.layer, 0.0, 1.0));
  oAlbedo = vec4(clamp(s.albedo, 0.0, 1.0), clamp(s.loose, 0.0, 1.0));
}
`

/** Extra fractal octaves compiled into the "zoom" program variant (see toolkit fbm()). */
export const ZOOM_EXTRA_OCTAVES = 4

const FIELD_MAIN = /* glsl */ `
uniform vec2 uOrigin;
layout(location = 0) out vec4 oField;
void main() {
  vec2 uv = uOrigin + gl_FragCoord.xy * uPx;
  oField = field(uv);
}
`

const fieldAccessors = (n: number) =>
  Array.from({ length: n }, (_, i) => `uniform sampler2D uF${i};\nvec4 F${i}() { return texelFetch(uF${i}, ivec2(gl_FragCoord.xy), 0); }`).join('\n')

const DERIVE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D tData;
uniform sampler2D tAlb;
uniform int uSize;
uniform bool uWrap;
uniform float uTexelMm;
uniform float uTileMm;
uniform float uRelief;
uniform float uAoRadiusMm;
uniform float uCurvRadiusMm;
layout(location = 0) out vec4 oAlbedo;
layout(location = 1) out vec4 oNormal;
layout(location = 2) out vec4 oOrm;
layout(location = 3) out vec4 oHeight;

ivec2 tc(ivec2 p) {
  if (uWrap) return (p + uSize * 64) % uSize; // both operands non-negative: well defined
  return clamp(p, ivec2(0), ivec2(uSize - 1));
}
float H(ivec2 p) { return texelFetch(tData, tc(p), 0).r; }
uint ihash(uvec2 v) { v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; v.x += v.y * 1664525u; return v.x; }

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 d = texelFetch(tData, p, 0);
  float h = d.r;

  // Sobel gradient in real units (mm per mm)
  float tl = H(p + ivec2(-1, 1)), t = H(p + ivec2(0, 1)), tr = H(p + ivec2(1, 1));
  float l = H(p + ivec2(-1, 0)), r = H(p + ivec2(1, 0));
  float bl = H(p + ivec2(-1, -1)), b = H(p + ivec2(0, -1)), br = H(p + ivec2(1, -1));
  float dx = ((tr + 2.0 * r + br) - (tl + 2.0 * l + bl)) / (8.0 * uTexelMm);
  float dy = ((tl + 2.0 * t + tr) - (bl + 2.0 * b + br)) / (8.0 * uTexelMm);
  vec3 n = normalize(vec3(-dx, -dy, 1.0));

  // curvature (negative Laplacian, 1/mm, + = convex) at a fixed physical radius
  int rc = max(1, int(floor(uCurvRadiusMm / uTexelMm + 0.5)));
  float rcm = float(rc) * uTexelMm;
  float lap = (H(p + ivec2(rc, 0)) + H(p - ivec2(rc, 0)) + H(p + ivec2(0, rc)) + H(p - ivec2(0, rc)) - 4.0 * h) / (rcm * rcm);
  float curv = -lap;

  // horizon-based AO: 8 directions x 6 radii doubling from uAoRadiusMm
  float jit = float(ihash(uvec2(p)) & 255u) / 256.0;
  float occ = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = (float(k) + jit) * 0.78539816;
    vec2 dir = vec2(cos(a), sin(a));
    float maxTan = 0.0;
    float rmm = uAoRadiusMm * (0.75 + 0.5 * jit);
    for (int s = 0; s < 6; s++) {
      vec2 off = dir * (rmm / uTexelMm);
      ivec2 q = p + ivec2(floor(off + 0.5));
      float dist = max(length(vec2(q - p)) * uTexelMm, uTexelMm);
      maxTan = max(maxTan, (H(q) - h) / dist);
      rmm *= 2.0;
    }
    occ += maxTan / sqrt(1.0 + maxTan * maxTan);
  }
  float ao = clamp(1.0 - occ / 8.0, 0.0, 1.0);
  ao = ao * ao;

  vec4 alb = texelFetch(tAlb, p, 0);
  oAlbedo = vec4(alb.rgb, alb.a);
  oNormal = vec4(n * 0.5 + 0.5, clamp(h / uRelief, 0.0, 1.0));
  oOrm = vec4(ao, d.g, d.b, d.a);
  oHeight = vec4(h, curv, ao, alb.a);
}
`

interface PassA {
  rt: THREE.WebGLRenderTarget
  size: number
}

export interface GeneratorCaps {
  floatTargets: boolean
  halfFloatTargets: boolean
  floatLinear: boolean
  maxTextureSize: number
  renderer: string
}

/** Detects what the GPU can do (float render targets are required). */
export function getGeneratorCaps(renderer: THREE.WebGLRenderer): GeneratorCaps {
  const gl = renderer.getContext() as WebGL2RenderingContext
  const ext = renderer.extensions
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    floatTargets: ext.has('EXT_color_buffer_float'),
    halfFloatTargets: ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'),
    floatLinear: ext.has('OES_texture_float_linear'),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
  }
}

/**
 * Add a material at runtime: catalog metadata plus its GLSL recipe (single string or
 * { fields, surface }). Lets a game ship its own surfaces without editing this library.
 */
export function registerMaterial(info: MaterialInfo, recipe: RecipeDef): void {
  registerMaterialInfo(info)
  RECIPES[info.id] = recipe
}

function recipeOf(id: string): RecipeDef {
  const recipe = RECIPES[id]
  if (!recipe) throw new Error(`No recipe for material "${id}"`)
  return recipe
}
/** Number of field passes a recipe uses (0 for single-pass recipes). */
export function fieldCount(id: string): number {
  const r = recipeOf(id)
  return typeof r === 'string' ? 0 : r.fields.length
}
/** Full GLSL source of a recipe's surface pass (useful for debugging / shader caches). */
export function buildSurfaceShader(id: string): string {
  const r = recipeOf(id)
  if (typeof r === 'string') return preprocessGlsl(TOOLKIT_GLSL + '\n' + r + '\n' + SURFACE_MAIN)
  return preprocessGlsl(TOOLKIT_GLSL + '\n' + fieldAccessors(r.fields.length) + '\n' + r.surface + '\n' + SURFACE_MAIN)
}
/** Full GLSL source of field pass i of a multi-pass recipe. */
export function buildFieldShader(id: string, i: number): string {
  const r = recipeOf(id)
  if (typeof r === 'string' || !r.fields[i]) throw new Error(`Material "${id}" has no field ${i}`)
  // fields chain: field i may read fields 0..i-1 (e.g. a domain warp computed once)
  return preprocessGlsl(TOOLKIT_GLSL + '\n' + fieldAccessors(i) + '\n' + r.fields[i] + '\n' + FIELD_MAIN)
}

export class MaterialGenerator {
  readonly renderer: THREE.WebGLRenderer
  readonly caps: GeneratorCaps
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private mesh: THREE.Mesh
  private programs = new Map<string, THREE.RawShaderMaterial>()
  private derive: THREE.RawShaderMaterial
  private pool = new Map<number, PassA>()
  private fieldPool = new Map<number, THREE.WebGLRenderTarget[]>()

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.caps = getGeneratorCaps(renderer)
    if (!this.caps.halfFloatTargets) {
      throw new Error('Material generator needs EXT_color_buffer_float or EXT_color_buffer_half_float (WebGL2).')
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    this.derive = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: DERIVE_FRAG,
      uniforms: {
        tData: { value: null },
        tAlb: { value: null },
        uSize: { value: 1 },
        uWrap: { value: true },
        uTexelMm: { value: 1 },
        uTileMm: { value: 1 },
        uRelief: { value: 1 },
        uAoRadiusMm: { value: 0.1 },
        uCurvRadiusMm: { value: 0.1 },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    })
    this.mesh = new THREE.Mesh(geo, this.derive)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }

  /** pass = -1 for the surface pass, i >= 0 for field pass i */
  /** pass = -1 for the surface pass, i >= 0 for field pass i; zoom = the extra-octave variant */
  private program(id: string, pass = -1, zoom = false): THREE.RawShaderMaterial {
    const key = (pass < 0 ? id : `${id}#${pass}`) + (zoom ? '@zoom' : '')
    let m = this.programs.get(key)
    if (!m) {
      const uniforms: Record<string, THREE.IUniform> = {
        uSeed: { value: 1 },
        uTileMm: { value: 10 },
        uPx: { value: 1 / 512 },
        uOrigin: { value: new THREE.Vector2() },
      }
      const readable = pass < 0 ? fieldCount(id) : pass   // fields chain: pass i reads 0..i-1
      for (let i = 0; i < readable; i++) uniforms[`uF${i}`] = { value: null }
      m = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: pass < 0 ? buildSurfaceShader(id) : buildFieldShader(id, pass),
        defines: zoom ? { EXTRA_OCT: ZOOM_EXTRA_OCTAVES } : {},
        uniforms,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending,
      })
      m.name = `material:${key}`
      this.programs.set(key, m)
    }
    return m
  }

  /**
   * Compile (and cache) all of a recipe's programs ahead of time. They are submitted together,
   * so with KHR_parallel_shader_compile the driver can build them concurrently.
   */
  async precompile(id: string, zoom = false): Promise<number> {
    const t0 = performance.now()
    const mats = [...Array.from({ length: fieldCount(id) }, (_, i) => this.program(id, i, zoom)), this.program(id, -1, zoom)]
    const todo = mats.filter((m) => !(m.userData as { compiled?: boolean }).compiled)
    if (!todo.length) return 0
    const scene = new THREE.Scene()
    for (const m of todo) {
      const mesh = new THREE.Mesh(this.mesh.geometry, m)
      mesh.frustumCulled = false
      scene.add(mesh)
    }
    await this.renderer.compileAsync(scene, this.camera)
    for (const m of todo) {
      // surface a GLSL error as an exception instead of silently baking garbage
      const prog = (this.renderer.properties.get(m) as { currentProgram?: { diagnostics?: { runnable: boolean; fragmentShader?: { log: string } } } }).currentProgram
      if (prog?.diagnostics && !prog.diagnostics.runnable) {
        throw new Error(`Material "${m.name}" failed to compile: ${prog.diagnostics.fragmentShader?.log ?? 'see console'}`)
      }
      ;(m.userData as { compiled?: boolean }).compiled = true
    }
    return performance.now() - t0
  }

  private fieldTargets(size: number, n: number): THREE.WebGLRenderTarget[] {
    let list = this.fieldPool.get(size)
    if (!list) { list = []; this.fieldPool.set(size, list) }
    while (list.length < n) {
      const rt = new THREE.WebGLRenderTarget(size, size, {
        depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        type: this.caps.floatTargets ? THREE.FloatType : THREE.HalfFloatType, format: THREE.RGBAFormat,
      })
      rt.texture.name = `field${list.length}`
      list.push(rt)
    }
    return list
  }

  private passA(size: number): PassA {
    let p = this.pool.get(size)
    if (!p) {
      const rt = new THREE.WebGLRenderTarget(size, size, {
        count: 2,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: this.caps.floatTargets ? THREE.FloatType : THREE.HalfFloatType,
        format: THREE.RGBAFormat,
      })
      rt.textures[1].type = THREE.HalfFloatType
      rt.textures[0].name = 'passA.data'
      rt.textures[1].name = 'passA.albedo'
      p = { rt, size }
      this.pool.set(size, p)
    }
    return p
  }

  /** Free pooled intermediate targets (call after a burst of generation on low-memory devices). */
  trim(): void {
    for (const p of this.pool.values()) p.rt.dispose()
    this.pool.clear()
    for (const l of this.fieldPool.values()) for (const rt of l) rt.dispose()
    this.fieldPool.clear()
  }

  dispose(): void {
    this.trim()
    for (const m of this.programs.values()) m.dispose()
    this.programs.clear()
    this.derive.dispose()
    this.mesh.geometry.dispose()
  }

  async generate(id: string, opts: GenerateOptions = {}): Promise<MaterialMaps> {
    const info = getMaterialInfo(id)
    if ((this.renderer.getContext() as WebGL2RenderingContext).isContextLost()) {
      throw new Error('WebGL context lost: rebuild the renderer and the generator (getGenerator) before baking again.')
    }
    const size = Math.max(16, Math.min(opts.size ?? 1024, this.caps.maxTextureSize))
    const seed = (opts.seed ?? 1) >>> 0
    const region: Region = opts.region ?? { x: 0, y: 0, w: 1 }
    const mip = opts.mipmaps ?? true
    const tileable = Number.isInteger(region.x) && Number.isInteger(region.y) && Number.isInteger(region.w) && region.w >= 1
    const t0 = performance.now()
    // sub-tile regions (racking in) use the zoom variant: extra octaves where they are resolvable
    const zoom = opts.detail === 'zoom' || ((opts.detail ?? 'auto') === 'auto' && region.w < 1)
    const compileMs = await this.precompile(id, zoom)

    const r = this.renderer
    const prevTarget = r.getRenderTarget()
    const prevAutoClear = r.autoClear
    r.autoClear = false

    const tGpu0 = performance.now()
    const texelUv = region.w / size
    // ---- field passes (multi-pass recipes)
    const nf = fieldCount(id)
    const fields = nf ? this.fieldTargets(size, nf) : []
    for (let i = 0; i < nf; i++) {
      const fm = this.program(id, i, zoom)
      for (let k = 0; k < i; k++) fm.uniforms[`uF${k}`].value = fields[k].texture
      fm.uniforms.uSeed.value = seed
      fm.uniforms.uTileMm.value = info.tileMm
      fm.uniforms.uPx.value = texelUv
      ;(fm.uniforms.uOrigin.value as THREE.Vector2).set(region.x, region.y)
      this.mesh.material = fm
      r.setRenderTarget(fields[i])
      r.render(this.scene, this.camera)
    }
    // ---- pass A
    const a = this.passA(size)
    const mat = this.program(id, -1, zoom)
    for (let i = 0; i < nf; i++) mat.uniforms[`uF${i}`].value = fields[i].texture
    mat.uniforms.uSeed.value = seed
    mat.uniforms.uTileMm.value = info.tileMm
    mat.uniforms.uPx.value = texelUv
    ;(mat.uniforms.uOrigin.value as THREE.Vector2).set(region.x, region.y)
    this.mesh.material = mat
    r.setRenderTarget(a.rt)
    r.render(this.scene, this.camera)

    // ---- pass B
    const wrap = tileable ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
    const minF = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
    const out = new THREE.WebGLRenderTarget(size, size, {
      count: 4,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: mip,
      minFilter: minF,
      magFilter: THREE.LinearFilter,
      wrapS: wrap,
      wrapT: wrap,
      anisotropy: opts.anisotropy ?? 4,
    })
    const [albedo, normal, orm, height] = out.textures
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.name = `${id}.albedo`
    normal.name = `${id}.normal`
    orm.name = `${id}.orm`
    height.name = `${id}.height`
    height.type = THREE.HalfFloatType
    for (const t of out.textures) { t.generateMipmaps = mip; t.minFilter = minF; t.wrapS = wrap; t.wrapT = wrap }

    const texelMm = (info.tileMm * region.w) / size
    const du = this.derive.uniforms
    du.tData.value = a.rt.textures[0]
    du.tAlb.value = a.rt.textures[1]
    du.uSize.value = size
    du.uWrap.value = tileable
    du.uTexelMm.value = texelMm
    du.uTileMm.value = info.tileMm
    du.uRelief.value = info.reliefMm
    du.uAoRadiusMm.value = Math.max(texelMm, info.reliefMm * 0.12)
    du.uCurvRadiusMm.value = Math.max(texelMm, info.tileMm * 0.004)
    this.mesh.material = this.derive
    r.setRenderTarget(out)
    r.render(this.scene, this.camera)

    // restore state BEFORE any await: other code (a render loop) may run while we wait on readbacks
    r.setRenderTarget(prevTarget)
    r.autoClear = prevAutoClear

    let gpuMs = performance.now() - tGpu0
    let readbackMs = 0
    let heightData: Float32Array | undefined
    let heightRange: [number, number] | undefined
    if (opts.readback) {
      const tr = performance.now()
      const buf = new Float32Array(size * size * 4)
      if (opts.finish) r.readRenderTargetPixels(a.rt, 0, 0, size, size, buf, undefined, 0)
      else await r.readRenderTargetPixelsAsync(a.rt, 0, 0, size, size, buf, undefined, 0)
      heightData = new Float32Array(size * size)
      let lo = Infinity, hi = -Infinity
      for (let i = 0; i < heightData.length; i++) {
        const v = buf[i * 4]
        heightData[i] = v
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      heightRange = [lo, hi]
      readbackMs = performance.now() - tr
    }
    let albedoData: Uint8Array | undefined
    if (opts.readbackAlbedo) {
      const tr = performance.now()
      albedoData = new Uint8Array(size * size * 4)
      if (opts.finish) r.readRenderTargetPixels(out, 0, 0, size, size, albedoData, undefined, 0)
      else await r.readRenderTargetPixelsAsync(out, 0, 0, size, size, albedoData, undefined, 0)
      readbackMs += performance.now() - tr
    }
    if (opts.finish && !opts.readback && !opts.readbackAlbedo) {
      const px = new Uint8Array(4)
      r.readRenderTargetPixels(out, 0, 0, 1, 1, px, undefined, 1)
      gpuMs = performance.now() - tGpu0
    }

    return {
      id, info, size, seed, region, texelMm,
      albedo, normal, orm, roughness: orm, height,
      heightData, heightRange, albedoData,
      timings: { compileMs, gpuMs, readbackMs, totalMs: performance.now() - t0 },
      dispose: () => out.dispose(),
    }
  }
}

const generators = new WeakMap<THREE.WebGLRenderer, MaterialGenerator>()

/** The shared generator for a renderer (programs and scratch targets are cached on it). */
export function getGenerator(renderer: THREE.WebGLRenderer): MaterialGenerator {
  let g = generators.get(renderer)
  if (!g) { g = new MaterialGenerator(renderer); generators.set(renderer, g) }
  return g
}

/**
 * Bake one material. Same (id, seed, region) gives the same surface on every device.
 *
 *   const maps = await generateMaterial(renderer, 'rusty-mailbox', { size: 1024, seed: 7, readback: true })
 *   mesh.material = new THREE.MeshStandardMaterial()
 *   applyMapsToStandardMaterial(mesh.material, maps)
 *   ...
 *   maps.dispose()
 */
export function generateMaterial(renderer: THREE.WebGLRenderer, id: string, opts: GenerateOptions = {}): Promise<MaterialMaps> {
  return getGenerator(renderer).generate(id, opts)
}
