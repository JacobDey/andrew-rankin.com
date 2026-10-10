import type * as THREE from 'three'

/**
 * Artist-controlled seam lines ("line IDs").
 *
 * Depth and normal edges miss coplanar contacts: abutting deck planks, a print lying
 * flat in a tray, a label on a bottle. A material patched here writes a small integer
 * ID into the scene buffer's ALPHA channel (no extra render target, no extra pass);
 * OneBitPass draws a 1 px line wherever the ID changes between depth-connected
 * neighbours (outline.ids = true).
 *
 * Encoding: alpha = 1 - n/256, n in 1..63 (0 = no ID, alpha 1). Exact in RGBA16F and
 * distinct in SRGB8_ALPHA8 (the LDR fallback). Surface-dithered texels (surfaceDither.ts)
 * shift that down by 0.5 (0.5 - n/256), keeping their ID. IDs only need to differ
 * between neighbours, so reuse them freely (id % 63 + 1).
 *
 *   applyLineId(material, { id: 7 })                // whole material
 *   applyLineId(material, { attribute: 'lineId' })  // per-vertex (merged static meshes)
 *
 * Not for transparent materials (their alpha is opacity).
 */
export interface LineIdOptions {
  /** Constant ID 1..63 for the whole material. */
  id?: number
  /** Name of a float vertex attribute holding per-vertex IDs (0..63). */
  attribute?: string
}

export interface LineIdHandle {
  uLineId: THREE.IUniform<number>
}

export const LINE_ID_MAX = 63

export function lineIdToAlpha(id: number): number {
  const n = id <= 0 ? 0 : ((Math.round(id) - 1) % LINE_ID_MAX) + 1
  return 1 - n / 256
}

export function applyLineId(material: THREE.Material, opts: LineIdOptions): LineIdHandle {
  const handle: LineIdHandle = { uLineId: { value: opts.id ?? 0 } }
  const attr = opts.attribute
  const prev = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer)
    shader.uniforms.uLineId = handle.uLineId
    if (attr) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float ${attr};\nflat varying float vLineId;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLineId = ${attr};`)
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uLineId;\n${attr ? 'flat varying float vLineId;' : ''}`)
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
{
  float lid = ${attr ? 'vLineId' : 'uLineId'};
  float n = lid <= 0.0 ? 0.0 : mod(floor(lid + 0.5) - 1.0, 63.0) + 1.0;
  gl_FragColor.a = 1.0 - n / 256.0;
}`,
      )
  }
  const prevKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => prevKey() + (attr ? `|lid:${attr}` : '|lid')
  material.needsUpdate = true
  return handle
}
