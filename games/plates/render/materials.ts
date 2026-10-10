// games/plates/render/materials.ts — room materials that write (luminance, flag, material id) for the
// 1-bit post pass (GDD §7.1): R = Lambert luminance, G = pre-dithered flag (0 here), B = id/255.
import * as THREE from 'three'
import { BAYER_GLSL } from './dither'

let nextId = 1
export function newMatId(): number { nextId = (nextId % 250) + 1; return nextId }

export function roomMat(grey: number, o: { id?: number; map?: THREE.Texture; emissive?: number; side?: THREE.Side } = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(grey, grey, grey), map: o.map ?? null, side: o.side ?? THREE.FrontSide })
  if (o.emissive) m.emissive = new THREE.Color(o.emissive, o.emissive, o.emissive)
  const id = { value: (o.id ?? newMatId()) / 255 }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMatId = id
    sh.fragmentShader = 'uniform float uMatId;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\n  gl_FragColor = vec4(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, uMatId, 1.0);')
  }
  m.customProgramCacheKey = () => 'pl-room'
  m.userData.matId = id
  return m
}

/** Canvas-drawn label texture (in-world text drawn at low resolution, later thresholded by the post). */
export function labelTexture(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  if (x) draw(x)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false
  return t
}

export const PREDITHER_HEAD = /* glsl */ `
${BAYER_GLSL}
uniform float uMatId;
uniform float uLum;
`
