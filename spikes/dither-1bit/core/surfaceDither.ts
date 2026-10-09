import * as THREE from 'three'
import type { SurfaceDitherUniforms } from './OneBitPass.ts'
import { toneGLSL } from './shaders.ts'

/**
 * Surface-anchored grain: a material thresholds its own lit colour against the shared
 * threshold map in its UV space ("the dither is the emulsion": grains stuck to the
 * glass / paper, never swimming, flipping one by one as density rises).
 *
 * The material subtracts 0.5 from alpha to flag "already 1-bit" (alpha 0.5, or
 * 0.5 - n/256 with a line ID); OneBitPass's composite then
 * only applies a 0.5 threshold (and outlines) there. When a grain would be smaller
 * than `maxFootprint` screen pixels the material falls back to continuous tone and the
 * pass's global dither takes over, so the far view never aliases into moire.
 */
export interface SurfaceDitherOptions {
  /** Grains across U and V (a quarter plate per plates-craft.md: [744, 960]). */
  cells: [number, number]
  /** Use surface grain while one grain spans <= this many grains per pixel (1 = grain >= 1px). */
  maxFootprint?: number
  /** Decorrelates tiles of the threshold map and separates different plates. */
  seed?: number
}

export interface SurfaceDitherHandle {
  uSdCells: THREE.IUniform<THREE.Vector2>
  uSdMaxFoot: THREE.IUniform<number>
  uSdSeed: THREE.IUniform<number>
}

export const sdVertexPars = /* glsl */ `
varying vec2 vSdUv;
`
export const sdVertexMain = /* glsl */ `
vSdUv = uv;
`

export const sdFragmentPars = /* glsl */ `
varying vec2 vSdUv;
uniform sampler2D tNoise;
uniform int uNoiseSize;
uniform vec3 uLuma;
${toneGLSL}
uniform vec2 uSdCells;
uniform float uSdMaxFoot;
uniform int uSdSeed;

uint sdHash(ivec2 t) {
  uint h = uint(t.x) * 374761393u + uint(t.y) * 668265263u + uint(uSdSeed) * 1274126177u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
`

/** Runs after the material has produced gl_FragColor (lit, linear). */
export const sdFragmentMain = /* glsl */ `
{
  vec2 sdCell = vSdUv * uSdCells;
  vec2 sdFw = fwidth(sdCell);
  if (max(sdFw.x, sdFw.y) < uSdMaxFoot) {
    float sdT = toneMap(dot(max(gl_FragColor.rgb, vec3(0.0)), uLuma));
    int s = uNoiseSize;
    ivec2 c = ivec2(floor(sdCell));
    ivec2 tileId = ivec2(floor(vec2(c) / float(s)));
    uint h = sdHash(tileId);
    ivec2 m = (((c + ivec2(int(h & 255u), int((h >> 8u) & 255u))) % s) + s) % s;
    float sdTh = (texelFetch(tNoise, m, 0).r * 255.0 + 0.5) / 256.0;
    // Flag "already 1-bit" by moving alpha into [0.25, 0.5]: 1 - n/256 -> 0.5 - n/256,
    // so a line ID written before (lineId.ts) survives and grain/no-grain regions of
    // one material don't get a seam between them.
    gl_FragColor = vec4(vec3(sdT > sdTh ? 1.0 : 0.0), gl_FragColor.a - 0.5);
  }
}
`

export function makeSurfaceDitherHandle(opts: SurfaceDitherOptions): SurfaceDitherHandle {
  return {
    uSdCells: { value: new THREE.Vector2(opts.cells[0], opts.cells[1]) },
    uSdMaxFoot: { value: opts.maxFootprint ?? 1 },
    uSdSeed: { value: opts.seed ?? 0 },
  }
}

/** Inject the surface-dither chunks into a built-in material's shader (inside onBeforeCompile). */
export function injectSurfaceDither(
  shader: THREE.WebGLProgramParametersWithUniforms,
  shared: SurfaceDitherUniforms,
  handle: SurfaceDitherHandle,
): void {
  Object.assign(shader.uniforms, shared, handle)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${sdVertexPars}`)
    .replace('#include <uv_vertex>', `#include <uv_vertex>\n${sdVertexMain}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${sdFragmentPars}`)
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${sdFragmentMain}`)
}

/**
 * Patch any built-in lit material (Lambert, Standard, Phong, Basic) so it grains itself.
 * Returns the handle (cells / footprint / seed uniforms) for live tweaking.
 */
export function applySurfaceDither(
  material: THREE.Material,
  shared: SurfaceDitherUniforms,
  opts: SurfaceDitherOptions,
): SurfaceDitherHandle {
  const handle = makeSurfaceDitherHandle(opts)
  const prev = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer)
    injectSurfaceDither(shader, shared, handle)
  }
  const prevKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => prevKey() + '|sd1'
  material.needsUpdate = true
  return handle
}
