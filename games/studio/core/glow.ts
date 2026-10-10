// Outline glow: an inverted hull on the eye-only layer (studio.md §4.1). Objects never scale or squash.
import * as THREE from 'three'
import { LAYER_EYE } from './engine'

const VERT = /* glsl */ `
uniform float uWidth;
void main() {
  vec3 p = position + normal * uWidth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
void main() { gl_FragColor = vec4(uColor, uAlpha); }
`

const shared = {
  uColor: { value: new THREE.Color(0x78cb97) },
  uAlpha: { value: 0.75 },
}

export interface Glow {
  set(on: boolean): void
  pulse(on: boolean): void
  readonly on: boolean
}

const pulsing = new Set<THREE.ShaderMaterial>()
let pulseT = 0
export function tickGlow(dt: number): void {
  pulseT += dt
  const a = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(pulseT * Math.PI * 0.8))
  for (const m of pulsing) m.uniforms.uAlpha.value = a
}

/** Adds hull children to every mesh under `root`. width in metres. */
export function addGlow(root: THREE.Object3D, width = 0.012): Glow {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uWidth: { value: width }, uColor: shared.uColor, uAlpha: { value: 0.75 } },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  })
  mat.toneMapped = false
  const hulls: THREE.Mesh[] = []
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !(o as THREE.Mesh).userData.noGlow && !(o as THREE.Mesh).userData.isHull) meshes.push(o as THREE.Mesh)
  })
  for (const m of meshes) {
    const geo = m.geometry as THREE.BufferGeometry
    if (!geo.attributes.normal) continue
    const hull = new THREE.Mesh(geo, mat)
    hull.userData.isHull = true
    hull.layers.set(LAYER_EYE)
    hull.visible = false
    hull.renderOrder = 2
    hull.raycast = () => {}
    m.add(hull)
    hulls.push(hull)
  }
  let on = false
  let pul = false
  const apply = () => {
    const vis = on || pul
    for (const h of hulls) h.visible = vis
    if (pul && !on) pulsing.add(mat)
    else {
      pulsing.delete(mat)
      mat.uniforms.uAlpha.value = 0.8
    }
  }
  return {
    set(v) {
      on = v
      apply()
    },
    pulse(v) {
      pul = v
      apply()
    },
    get on() {
      return on || pul
    },
  }
}
