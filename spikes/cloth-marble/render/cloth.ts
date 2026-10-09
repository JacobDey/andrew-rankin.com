// Cloth rendering with GPU "conform": the sim grid (e.g. 64^2) is uploaded as
// a float texture; a denser render grid (e.g. 253^2) interpolates it and then
// lifts each vertex onto the cloth's own contact field D_r:
//
//   z = max(z_sim(uv), D_r(xy) + thickness)
//
// so the sheet hugs bumps finer than the sim spacing and bridges pits, and its
// shading takes the field's normal wherever it touches. Fine cloth (D_0.08)
// shows grain; rough cloth (D_0.6) only shows big forms, plus its own yarn
// relief (vertex-displaced plain weave). One extra pass writes cloth heights
// into the occluder map so cloths cast raking shadows.

import * as THREE from 'three'
import type { Cloth } from '../core/cloth'
import type { HeightField } from '../core/heightfield'
import { toHalf } from '../core/surface'
import { LIGHTING_FUNCS, LIGHTING_UNIFORMS } from './glsl'
import type { LightingUniforms } from './surface'

export interface FabricLook {
  color: THREE.Color
  /** second yarn colour (weft) */
  color2: THREE.Color
  /** yarns across the swatch (weave pitch = size / threads) */
  threads: number
  /** yarn relief displaced into geometry (mm) */
  relief: number
  /** 0..1 yarn width (1 = touching, < 1 = open weave with gaps) */
  yarn: number
  /** fine fragment-only weave for dense fabrics (threads across), 0 = off */
  fine: number
  /** sheen colour (fabric rim) */
  sheen: THREE.Color
  /** fuzz noise amount */
  fuzz: number
  /** spec roughness */
  rough: number
  /** let the surface show through weave gaps */
  holes: boolean
  /** diffuse wrap (soft fabrics scatter light round the terminator) */
  wrap: number
  /** how much of the diffuse follows the drape's big form vs the yarn detail */
  form: number
}

export const SILK_LOOK: FabricLook = {
  color: new THREE.Color('#8e9aa7'),
  color2: new THREE.Color('#8693a0'),
  threads: 0,
  relief: 0,
  yarn: 1,
  fine: 120,
  sheen: new THREE.Color('#dfe8f2').multiplyScalar(0.3),
  fuzz: 0.05,
  rough: 0.5,
  holes: false,
  wrap: 0.3,
  form: 0.45,
}

export const BURLAP_LOOK: FabricLook = {
  color: new THREE.Color('#9a7b52'),
  color2: new THREE.Color('#8a6c46'),
  threads: 15,
  relief: 0.16,
  yarn: 0.78,
  fine: 0,
  sheen: new THREE.Color('#e0c896').multiplyScalar(0.22),
  fuzz: 0.16,
  rough: 0.9,
  holes: true,
  wrap: 0.08,
  form: 0.7,
}

const WEAVE = /* glsl */ `
uniform float uThreads;
uniform float uYarn;
uniform float uRelief;
float whash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
// plain weave height in [0, 1] (0 = gap) and which yarn is visible (x: warp 1 / weft 0)
vec2 weave(vec2 uv) {
  vec2 g = uv * uThreads;
  vec2 c = floor(g);
  vec2 f = fract(g) - 0.5;
  // irregular yarns: width per yarn, slubs along it, slight wander
  float ww = uYarn * (0.8 + 0.35 * whash(c.x + 7.0)) * (0.9 + 0.2 * sin(g.y * 2.1 + c.x * 5.0));
  float wf = uYarn * (0.8 + 0.35 * whash(c.y + 91.0)) * (0.9 + 0.2 * sin(g.x * 1.7 + c.y * 3.0));
  float fx = f.x + 0.06 * sin(g.y * 0.9 + c.x * 1.3);
  float fy = f.y + 0.06 * sin(g.x * 0.8 + c.y * 2.1);
  float pw = sqrt(max(0.0, 1.0 - pow(fx * 2.0 / ww, 2.0)));
  float pf = sqrt(max(0.0, 1.0 - pow(fy * 2.0 / wf, 2.0)));
  float over = mod(c.x + c.y, 2.0);
  // top yarn arches over the crossing, the crossing yarn dives under it
  float hw = pw * (over > 0.5 ? 0.75 + 0.25 * cos(f.y * 6.283) : 0.45);
  float hf = pf * (over > 0.5 ? 0.45 : 0.75 + 0.25 * cos(f.x * 6.283));
  return hw > hf ? vec2(hw, 1.0) : vec2(hf, 0.0);
}
`

const VERT_COMMON = /* glsl */ `
uniform sampler2D uSimPos;
uniform sampler2D uSimNrm;
uniform float uN;
uniform sampler2D uConform;
uniform float uConformTexel;  // 1 / conform res
uniform float uThick;
uniform float uConformOn;
uniform float uSizeC;          // plate size (mm) for conform lookup
${WEAVE}

vec4 simFetch(sampler2D t, vec2 uv) {
  vec2 g = uv * (uN - 1.0);
  vec2 i0 = min(floor(g), vec2(uN - 2.0));
  vec2 f = g - i0;
  ivec2 i = ivec2(i0);
  vec4 a = texelFetch(t, i, 0);
  vec4 b = texelFetch(t, i + ivec2(1, 0), 0);
  vec4 c = texelFetch(t, i + ivec2(0, 1), 0);
  vec4 d = texelFetch(t, i + ivec2(1, 1), 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float conformH(vec2 p) { return texture(uConform, p / uSizeC + 0.5).r + uThick; }

// conformed position + normal for a render-grid uv; tu/tv = surface tangents
void clothSurface(vec2 uv, out vec3 pos, out vec3 nrm, out float touch, out float contact, out vec3 tu, out vec3 tv) {
  vec4 P = simFetch(uSimPos, uv);
  vec3 ns = simFetch(uSimNrm, uv).xyz;
  ns = normalize(ns + vec3(0.0, 0.0, 1e-5));
  float du = 1.0 / (uN - 1.0);
  tu = simFetch(uSimPos, uv + vec2(du * 0.5, 0.0)).xyz - simFetch(uSimPos, uv - vec2(du * 0.5, 0.0)).xyz;
  tv = simFetch(uSimPos, uv + vec2(0.0, du * 0.5)).xyz - simFetch(uSimPos, uv - vec2(0.0, du * 0.5)).xyz;
  float c = conformH(P.xy);
  touch = smoothstep(-0.05, 0.004, c - P.z) * uConformOn;
  pos = P.xyz;
  if (uConformOn > 0.5) pos.z = max(P.z, c);
  float e = uConformTexel * uSizeC;
  float hx = conformH(P.xy + vec2(e, 0.0)) - conformH(P.xy - vec2(e, 0.0));
  float hy = conformH(P.xy + vec2(0.0, e)) - conformH(P.xy - vec2(0.0, e));
  vec3 nc = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
  // the field normal is "up"-facing; keep the sheet's own orientation
  if (ns.z < 0.0) nc = -nc;
  nrm = normalize(mix(ns, nc, touch));
  // yarn relief: displace along the normal (top side up, bottom side down a bit)
  if (uRelief > 0.0) pos += nrm * (weave(uv).x - 0.5) * uRelief;
  contact = P.w;
}
`

export class ClothView {
  readonly mesh: THREE.Mesh
  readonly occMesh: THREE.Mesh
  readonly cloth: Cloth
  private posTex: THREE.DataTexture
  private nrmTex: THREE.DataTexture
  private posBuf: Float32Array
  private nrmBuf: Float32Array
  readonly conformTex: THREE.DataTexture
  readonly uniforms: Record<string, THREE.IUniform>

  constructor(cloth: Cloth, field: HeightField, lighting: LightingUniforms, look: FabricLook, subdiv: number, shadowSteps: number) {
    this.cloth = cloth
    const n = cloth.n
    this.posBuf = new Float32Array(n * n * 4)
    this.nrmBuf = new Float32Array(n * n * 4)
    this.posTex = new THREE.DataTexture(this.posBuf, n, n, THREE.RGBAFormat, THREE.FloatType)
    this.nrmTex = new THREE.DataTexture(this.nrmBuf, n, n, THREE.RGBAFormat, THREE.FloatType)
    for (const t of [this.posTex, this.nrmTex]) {
      t.magFilter = t.minFilter = THREE.NearestFilter
      t.generateMipmaps = false
      t.needsUpdate = true
    }
    // conform field as R16F (filterable everywhere WebGL2 runs)
    const half = new Uint16Array(field.data.length)
    for (let k = 0; k < half.length; k++) half[k] = toHalf(field.data[k])
    this.conformTex = new THREE.DataTexture(half, field.nx, field.ny, THREE.RedFormat, THREE.HalfFloatType)
    this.conformTex.magFilter = this.conformTex.minFilter = THREE.LinearFilter
    this.conformTex.generateMipmaps = false
    this.conformTex.wrapS = this.conformTex.wrapT = THREE.ClampToEdgeWrapping
    this.conformTex.needsUpdate = true

    // render grid: dense enough for ~6 vertices per yarn when the weave is displaced
    let M = (n - 1) * subdiv + 1
    if (look.relief > 0) M = Math.max(M, Math.ceil(look.threads * 6) + 1)
    const geo = new THREE.PlaneGeometry(1, 1, M - 1, M - 1)
    this.uniforms = {
      ...lighting,
      uSimPos: { value: this.posTex },
      uSimNrm: { value: this.nrmTex },
      uN: { value: n },
      uConform: { value: this.conformTex },
      uConformTexel: { value: 1 / field.nx },
      uThick: { value: cloth.p.thickness },
      uConformOn: { value: 1 },
      uSizeC: { value: field.sizeX },
      uColor: { value: look.color.clone() },
      uColor2: { value: look.color2.clone() },
      uSheen: { value: look.sheen.clone() },
      uThreads: { value: look.threads },
      uYarn: { value: look.yarn },
      uRelief: { value: look.relief },
      uFine: { value: look.fine },
      uFuzz: { value: look.fuzz },
      uRough: { value: look.rough },
      uHoles: { value: look.holes ? 1 : 0 },
      uWrap: { value: look.wrap },
      uForm: { value: look.form },
      uClothSize: { value: cloth.p.size },
      uDebug: { value: 0 },
    }
    const mat = new THREE.ShaderMaterial({
      defines: { SHADOW_STEPS: shadowSteps },
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        ${VERT_COMMON}
        varying vec3 vPos;
        varying vec3 vNrm;
        varying vec3 vTu;
        varying vec3 vTv;
        varying vec2 vUv;
        varying float vTouch;
        varying float vContact;
        varying float vState;
        void main() {
          vec3 p; vec3 nn; float touch; float contact; vec3 tu; vec3 tv;
          clothSurface(uv, p, nn, touch, contact, tu, tv);
          vPos = p; vNrm = nn; vUv = uv; vTouch = touch; vContact = contact;
          vTu = tu; vTv = tv;
          vState = simFetch(uSimNrm, uv).w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${LIGHTING_UNIFORMS}
        ${WEAVE}
        uniform vec3 uColor;
        uniform vec3 uColor2;
        uniform vec3 uSheen;
        uniform float uFine;
        uniform float uFuzz;
        uniform float uRough;
        uniform float uHoles;
        uniform float uWrap;
        uniform float uForm;
        uniform float uClothSize;
        uniform float uDebug;
        varying vec3 vPos;
        varying vec3 vNrm;
        varying vec3 vTu;
        varying vec3 vTv;
        varying vec2 vUv;
        varying float vTouch;
        varying float vContact;
        varying float vState;
        ${LIGHTING_FUNCS}
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec3 n = normalize(vNrm);
          vec3 nForm = n;   // the drape's large-scale normal, before yarn detail
          vec3 tu = normalize(vTu);
          vec3 tv = normalize(vTv);
          vec3 base = uColor;
          if (uThreads > 0.0) {
            // coarse weave: analytic-ish gradient of the yarn height in uv
            float e = 0.08 / uThreads;
            vec2 w = weave(vUv);
            float hx = weave(vUv + vec2(e, 0.0)).x - weave(vUv - vec2(e, 0.0)).x;
            float hy = weave(vUv + vec2(0.0, e)).x - weave(vUv - vec2(0.0, e)).x;
            float k = uRelief * uThreads / (uClothSize * 0.16) * 0.55;
            n = normalize(n - (tu * hx + tv * hy) * k);
            if (w.x < 0.04 && uHoles > 0.5) discard;
            // yarn colour: warp/weft differ, fibres streak along the yarn
            vec2 g = vUv * uThreads;
            float along = w.y > 0.5 ? g.y : g.x;
            float yid = w.y > 0.5 ? floor(g.x) : floor(g.y) + 50.0;
            float streak = vnoise(vec2(along * 9.0, yid * 3.7)) - 0.5;
            base = mix(uColor2, uColor, w.y) * (0.82 + 0.3 * streak + 0.18 * hash(vec2(yid, 3.0)));
            // yarn edges dive into shadow (cheap self-occlusion)
            base *= 0.45 + 0.55 * smoothstep(0.0, 0.6, w.x);
          }
          if (uFine > 0.0) {
            // dense fabric: fine weave ripples, faded out when sub-pixel
            vec2 g = vUv * uFine;
            float fw = fwidth(g.x) + fwidth(g.y);
            float amp = 1.0 - smoothstep(0.35, 0.8, fw);
            // knit-like loops, jittered so it reads as fibre, not graph paper
            vec2 j = vec2(vnoise(g * 0.37), vnoise(g.yx * 0.41 + 7.0)) - 0.5;
            vec2 s = vec2(sin((g.x + j.x * 0.8) * 6.283), sin((g.y + j.y * 0.8) * 6.283));
            n = normalize(n + (tu * s.x + tv * s.y) * 0.12 * amp);
            base *= 1.0 - 0.07 * amp * (0.5 + 0.5 * s.x * s.y);
            float fib = vnoise(vUv * vec2(1300.0, 160.0)) * vnoise(vUv * vec2(170.0, 1250.0));
            base *= 0.94 + 0.12 * fib;
          }
          float fz = vnoise(vUv * 420.0) - 0.5;
          base *= 1.0 + fz * uFuzz * 2.0;
          if (!gl_FrontFacing) { n = -n; nForm = -nForm; }
          vec3 V = normalize(uCam - vPos);
          // start past our own yarn relief: self-shadow only from real folds
          float sh = marchShadow(vPos + vec3(0.0, 0.0, 0.04 + uRelief * 0.5), 0.3);
          vec2 mt = marbleTerms(vPos, n);
          // part of the diffuse follows the drape's big form so ridges under the
          // sheet read through the weave (cloth is a soft diffuser at this scale)
          float nl = max((mix(dot(n, uL), dot(nForm, uL), uForm) + uWrap) / (1.0 + uWrap), 0.0);
          vec3 direct = (base / PI) * nl * uLightCol * sh * mt.x;
          direct += ggx(n, V, uL, uRough, vec3(0.03)) * max(dot(n, uL), 0.0) * uLightCol * sh * mt.x * 0.5;
          float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
          vec3 amb = mix(uGround, uSky, n.z * 0.5 + 0.5) * base * 1.4;
          vec3 col = direct + amb * mt.y + uSheen * rim * (0.3 + sh) * mt.y;
          // pressed fibres darken slightly (a hint of the rubbing)
          col *= 1.0 - 0.12 * clamp(vContact, 0.0, 1.0);
          if (uDebug > 1.5) col = nForm * 0.5 + 0.5;
          else if (uDebug > 0.5) {
            vec3 dc = vState > 1.5 ? vec3(1.0, 0.1, 0.1) : vState > 0.5 ? vec3(0.2, 0.9, 0.3) : vec3(1.0, 0.6, 0.1);
            col = mix(col, dc * 0.6, 0.6);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1

    // occluder pass: same surface, writes height into a float target
    const occMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        ${VERT_COMMON}
        varying float vH;
        varying vec2 vUv;
        void main() {
          vec3 p; vec3 nn; float touch; float contact; vec3 tu; vec3 tv;
          clothSurface(uv, p, nn, touch, contact, tu, tv);
          vH = p.z;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${WEAVE}
        uniform float uHoles;
        varying float vH;
        varying vec2 vUv;
        // R = height + 5 mm (so a cleared texel decodes to -5 mm), G = coverage
        void main() {
          if (uHoles > 0.5 && uThreads > 0.0 && weave(vUv).x < 0.04) discard;
          gl_FragColor = vec4(vH + 5.0, 1.0, 0.0, 1.0);
        }`,
    })
    occMat.toneMapped = false
    this.occMesh = new THREE.Mesh(geo, occMat)
    this.occMesh.frustumCulled = false
  }

  private uploaded = -1

  /** Upload the particle state if it changed since the last upload. */
  update(): void {
    if (this.uploaded === this.cloth.version) return
    this.uploaded = this.cloth.version
    this.cloth.packPositions(this.posBuf)
    this.cloth.packNormals(this.nrmBuf)
    this.posTex.needsUpdate = true
    this.nrmTex.needsUpdate = true
  }

  setDebug(on: boolean): void {
    this.uniforms.uDebug.value = on ? 1 : 0
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    ;(this.occMesh.material as THREE.Material).dispose()
    this.posTex.dispose()
    this.nrmTex.dispose()
    this.conformTex.dispose()
  }
}

/**
 * Top-down orthographic pass that rasterises cloth heights into a half-float
 * target covering the plate: R = height + 5 mm, G = coverage. Surface + cloth
 * shaders march against max(height, occluder) for raking shadows; the blurred
 * mip gives a cheap contact-AO under and around the sheets.
 */
export class Occluder {
  readonly target: THREE.WebGLRenderTarget
  readonly scene = new THREE.Scene()
  readonly camera: THREE.OrthographicCamera
  readonly ok: boolean

  constructor(renderer: THREE.WebGLRenderer, size: number, res: number) {
    const gl = renderer.getContext()
    this.ok = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
    this.target = new THREE.WebGLRenderTarget(res, res, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
    })
    const h = size / 2
    // looking straight down -z from above; nearest = highest cloth point
    this.camera = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 100)
    this.camera.position.set(0, 0, 50)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(0, 0, 0)
    this.scene.background = null
  }

  render(renderer: THREE.WebGLRenderer): void {
    const prevTarget = renderer.getRenderTarget()
    const prevClear = renderer.getClearColor(new THREE.Color())
    const prevAlpha = renderer.getClearAlpha()
    const prevTone = renderer.toneMapping
    renderer.toneMapping = THREE.NoToneMapping
    renderer.setRenderTarget(this.target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, false)
    renderer.render(this.scene, this.camera)
    renderer.setRenderTarget(prevTarget)
    renderer.setClearColor(prevClear, prevAlpha)
    renderer.toneMapping = prevTone
  }
}
