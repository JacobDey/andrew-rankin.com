import * as THREE from 'three'
import type { SurfaceDitherUniforms } from './OneBitPass'
import {
  makeSurfaceDitherHandle,
  sdFragmentMain,
  sdFragmentPars,
  sdVertexMain,
  sdVertexPars,
  type SurfaceDitherHandle,
  type SurfaceDitherOptions,
} from './surfaceDither'

/**
 * A lit sheet of paper (or a glass plate) whose image comes up as it develops.
 *
 * Development model, per texel, first-order kinetics:
 *   T     = final reflectance at "normal" development (the image's linear luminance)
 *   R(p)  = T ^ p                       p = develop progress, 0 = blank, 1 = normal, >1 = over
 * so shadows (small T) darken first and highlights last, exactly the order a print
 * comes up in the tray. Over-development keeps darkening (T^2 at p = 2). Fog greys the
 * whole sheet in proportion to development. A negative uses T = 1 - luminance.
 *
 * With `grain`, the sheet dithers itself in UV space (surfaceDither.ts): each grain has
 * a fixed threshold, so as R(p) falls the grains flip to ink one by one, in place.
 */
export interface DevelopingPrintOptions {
  image: THREE.Texture
  /** Paper / base albedo (linear-ish multiplier on R). */
  paper?: THREE.ColorRepresentation
  negative?: boolean
  develop?: number
  fog?: number
  /** Floor on T so the deepest black still reads as paper texture when lit hard. */
  dmax?: number
  grain?: (SurfaceDitherOptions & { uniforms: SurfaceDitherUniforms }) | null
}

export class DevelopingPrintMaterial extends THREE.MeshLambertMaterial {
  readonly print: {
    uPrintImage: THREE.IUniform<THREE.Texture>
    uDevelop: THREE.IUniform<number>
    uFog: THREE.IUniform<number>
    uNegative: THREE.IUniform<number>
    uDmax: THREE.IUniform<number>
  }
  readonly grain: SurfaceDitherHandle | null
  private grainShared: SurfaceDitherUniforms | null

  constructor(opts: DevelopingPrintOptions) {
    super({ color: opts.paper ?? 0xf2ede2 })
    this.print = {
      uPrintImage: { value: opts.image },
      uDevelop: { value: opts.develop ?? 0 },
      uFog: { value: opts.fog ?? 0 },
      uNegative: { value: opts.negative ? 1 : 0 },
      uDmax: { value: opts.dmax ?? 0.012 },
    }
    this.grain = opts.grain ? makeSurfaceDitherHandle(opts.grain) : null
    this.grainShared = opts.grain ? opts.grain.uniforms : null
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.print)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${sdVertexPars}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${sdVertexMain}`)
      let frag = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
${this.grain ? sdFragmentPars : 'varying vec2 vSdUv;'}
uniform sampler2D uPrintImage;
uniform float uDevelop;
uniform float uFog;
uniform float uNegative;
uniform float uDmax;`,
        )
        .replace(
          '#include <map_fragment>',
          `{
  vec3 img = texture2D(uPrintImage, vSdUv).rgb;
  float L = dot(img, vec3(0.2126, 0.7152, 0.0722));
  float T = clamp(mix(L, 1.0 - L, uNegative), uDmax, 1.0);
  float R = pow(T, max(uDevelop, 0.0));
  R *= 1.0 - 0.3 * uFog * min(uDevelop, 2.0);
  diffuseColor.rgb *= R;
}`,
        )
      if (this.grain && this.grainShared) {
        Object.assign(shader.uniforms, this.grainShared, this.grain)
        frag = frag.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${sdFragmentMain}`)
      }
      shader.fragmentShader = frag
    }
  }

  customProgramCacheKey(): string {
    return 'developing-print|' + (this.grain ? 'grain' : 'plain')
  }

  get develop(): number { return this.print.uDevelop.value }
  set develop(v: number) { this.print.uDevelop.value = v }
  /** Chemical fog (not scene fog: Material.fog is three's own flag). */
  get chemFog(): number { return this.print.uFog.value }
  set chemFog(v: number) { this.print.uFog.value = v }

  setImage(tex: THREE.Texture): void {
    this.print.uPrintImage.value = tex
  }
}
