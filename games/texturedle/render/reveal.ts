// The reveal diorama (texturedle.md §3.1 step 6, §7.2, §11.4.6): a separate
// scene, built lazily. A 3.5 s ease-in-out dolly from the specimen-equivalent
// pose to a 3/4 view of the prop at dusk. Props are primitives; the specimen
// spot uses the baked albedo as a decal. Bespoke mailbox (MUST) + panel.

import * as THREE from 'three'
import type { SurfaceRecipe } from '../contracts'

export interface Reveal {
  play(recipe: SurfaceRecipe, reducedMotion: boolean): Promise<void>
  render(gl: THREE.WebGLRenderer, t: number): void
  resize(aspect: number): void
  setDecal(tex: THREE.Texture): void
  stop(): void
}

const SKY_VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`
const SKY_FS = /* glsl */ `varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 low = vec3(1.0, 0.55, 0.3);
  vec3 mid = vec3(0.45, 0.32, 0.42);
  vec3 top = vec3(0.07, 0.09, 0.2);
  vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h));
  c = mix(c, top, smoothstep(0.15, 0.7, h));
  float sun = pow(max(dot(normalize(vDir), normalize(vec3(-0.8, 0.14, -0.55))), 0.0), 300.0);
  c += vec3(1.0, 0.75, 0.45) * sun * 4.0;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function createReveal(): Reveal {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1.5, 0.01, 200)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false }))
  scene.add(sky)
  // low warm sun at 8°, a cool sky fill
  const sun = new THREE.DirectionalLight(0xffb070, 4.6)
  sun.position.set(-8, 1.2, -5.5)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(0x9aa0d0, 0x4a3628, 1.7))
  const amb = new THREE.AmbientLight(0x605060, 0.7)
  scene.add(amb)

  // ground: a gravel drive disc
  const gcan = document.createElement('canvas')
  gcan.width = gcan.height = 256
  const g2 = gcan.getContext('2d')!
  g2.fillStyle = '#6b6358'
  g2.fillRect(0, 0, 256, 256)
  let s = 1234567
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296)
  for (let i = 0; i < 2600; i++) {
    const v = 70 + Math.floor(rnd() * 90)
    g2.fillStyle = `rgb(${v + 10},${v + 4},${v - 6})`
    g2.beginPath()
    g2.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 2.2, 0, 6.3)
    g2.fill()
  }
  const gtex = new THREE.CanvasTexture(gcan)
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping
  gtex.repeat.set(10, 10)
  gtex.colorSpace = THREE.SRGBColorSpace
  const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const grass = new THREE.Mesh(new THREE.RingGeometry(3.2, 40, 64), new THREE.MeshStandardMaterial({ color: 0x2f4a26, roughness: 1 }))
  grass.rotation.x = -Math.PI / 2
  grass.position.set(0, 0.002, 0)
  grass.scale.set(1, 1, 1)
  scene.add(grass)

  const props = new THREE.Group()
  scene.add(props)
  const decalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.1 })
  const green = new THREE.MeshStandardMaterial({ color: 0x3e5b44, roughness: 0.6, metalness: 0.2 })
  const rust = new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.95 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb02a1e, roughness: 0.5, metalness: 0.2 })
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.6 })

  // the spot on the lid the specimen came from (units: metres; mailbox ~ 0.48 m long)
  const spot = new THREE.Vector3()
  function buildMailbox(): void {
    props.clear()
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.09), wood)
    post.position.set(0, 0.525, 0)
    props.add(post)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.16), wood)
    arm.position.set(0, 1.07, 0)
    props.add(arm)
    // box: rectangular lower body + half-cylinder lid (axis along z)
    const W = 0.17, Hb = 0.13, L = 0.48
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hb, L), green)
    body.position.set(0, 1.09 + Hb / 2, 0)
    props.add(body)
    // half-cylinder lid, axis along the box (z): after rotation.x = π/2 a vertex at θ sits at (r sinθ, −r cosθ, y)
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, L, 40, 1, false, Math.PI / 2, Math.PI), green)
    lid.rotation.x = Math.PI / 2
    lid.position.set(0, 1.09 + Hb, 0)
    props.add(lid)
    // rust blooms on the lid
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.012 + rnd() * 0.02, 12), rust)
      const a = (rnd() - 0.5) * 2.4
      const z = (rnd() - 0.5) * L * 0.9
      b.position.set(Math.sin(a) * (W / 2 + 0.001), 1.09 + Hb + Math.cos(a) * (W / 2 + 0.001), z)
      b.lookAt(b.position.x * 2, (b.position.y - 1.09 - Hb) * 2 + 1.09 + Hb, z)
      props.add(b)
    }
    // the specimen decal, 6 mm off the crown
    const dec = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), decalMat)
    const a0 = 0.05
    dec.position.set(Math.sin(a0) * (W / 2 + 0.0015), 1.09 + Hb + Math.cos(a0) * (W / 2 + 0.0015), 0.06)
    dec.lookAt(dec.position.x * 3, (dec.position.y - 1.09 - Hb) * 3 + 1.09 + Hb, 0.06)
    props.add(dec)
    spot.copy(dec.position)
    // door (front, +z) and the red flag up
    const door = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, Hb * 0.95 + W / 2, 0.006), green)
    door.position.set(0, 1.09 + (Hb + W / 2) / 2, L / 2 + 0.003)
    props.add(door)
    const flagPole = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.2, 0.012), red)
    flagPole.position.set(W / 2 + 0.01, 1.09 + Hb + 0.05, -0.08)
    props.add(flagPole)
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.09), red)
    flag.position.set(W / 2 + 0.012, 1.09 + Hb + 0.12, -0.04)
    props.add(flag)
    // an 18 % grey card leaning on the post
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.004), grey)
    card.position.set(0.09, 0.13, 0.12)
    card.rotation.set(-0.25, -0.5, 0.05)
    props.add(card)
  }
  function buildPanel(): void {
    props.clear()
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.8 }))
    panel.position.set(0, 0.6, 0)
    props.add(panel)
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), decalMat)
    dec.position.set(0, 0.62, 0.0165)
    props.add(dec)
    spot.copy(dec.position)
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), wood)
    stand.position.set(0, 0.15, 0)
    props.add(stand)
  }

  let t0 = -1
  let dur = 3.5
  let resolveFn: (() => void) | null = null
  const from = new THREE.Vector3(), to = new THREE.Vector3(), look = new THREE.Vector3(), lookTo = new THREE.Vector3()
  let playing = false

  return {
    play(recipe, reducedMotion) {
      if (recipe.reveal.prop === 'mailbox') buildMailbox()
      else buildPanel()
      dur = reducedMotion ? 0.15 : 3.5
      // specimen-equivalent pose: looking straight down at the spot from ~5 cm
      from.copy(spot).add(new THREE.Vector3(0, 0.05, 0.0001))
      to.set(-0.85, 1.38, 2.05)
      look.copy(spot)
      lookTo.set(0.18, 0.92, 0)
      t0 = -1
      playing = true
      return new Promise<void>((r) => { resolveFn = r })
    },
    render(gl, t) {
      if (t0 < 0) t0 = t
      const u = Math.min(1, (t - t0) / dur)
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
      camera.position.lerpVectors(from, to, e)
      const lk = new THREE.Vector3().lerpVectors(look, lookTo, e)
      camera.lookAt(lk)
      camera.fov = 20 + 20 * e
      camera.updateProjectionMatrix()
      const prevTM = gl.toneMapping
      gl.toneMapping = THREE.AgXToneMapping
      gl.render(scene, camera)
      gl.toneMapping = prevTM
      if (u >= 1 && playing) {
        playing = false
        const r = resolveFn
        resolveFn = null
        r?.()
      }
    },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix() },
    setDecal(tex) { decalMat.map = tex; decalMat.needsUpdate = true },
    stop() { playing = false; resolveFn?.(); resolveFn = null },
  }
}
