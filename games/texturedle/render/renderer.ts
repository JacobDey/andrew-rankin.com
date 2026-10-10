// WebGL2 specimen renderer (texturedle.md §5.8, §7.1, §7.3, §11.4).
// Plate-space Z-up stage group under a fixed top-down camera and a fixed lamp;
// the stage rotates by the tilt. Height is R32F (texelFetch, manual bilinear),
// albedo/ORM are RGBA8 with GPU mips so depth of field is a mip-LOD bias.

import * as THREE from 'three'
import type { Renderer, ViewState, FrameHit, SurfaceRuntime, SurfaceRecipe, ClothKind } from '../contracts'
import { PLATE_VS, PLATE_FS, MARBLE_VS, MARBLE_FS, CLOTH_VS, CLOTH_FS, GRAIN_VS, GRAIN_FS } from './shaders'
import { createReveal, type Reveal } from './reveal'

const FOV_DEG = 20

export interface RendererExtras {
  /** the bench publishes loose-layer changes through this */
  setLoose(data: Float32Array | null, res: number, version: number, rgb: [number, number, number]): void
  readonly canvas: HTMLCanvasElement
  setExposure(e: number): void
  /** world z of a plate point after tilt (for autofocus) */
  focusZAt(x: number, y: number, tilt: { x: number; y: number }): number
}

export function createRenderer(canvas: HTMLCanvasElement, opts: { quality: 'high' | 'low'; force2d?: boolean; test?: boolean }): Renderer & RendererExtras {
  let quality = opts.quality
  const gl = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
  gl.outputColorSpace = THREE.SRGBColorSpace
  gl.toneMapping = THREE.AgXToneMapping
  gl.toneMappingExposure = 1.0
  gl.setClearColor(0x0d0d0f, 1)
  const dprFor = (q: 'high' | 'low') => (opts.test ? 1 : q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1)
  gl.setPixelRatio(dprFor(quality))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0d0d0f)
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1.5, 0.5, 2000)
  camera.up.set(0, 1, 0)
  const stage = new THREE.Group()
  scene.add(stage)

  let rt: SurfaceRuntime | null = null
  let unsub: (() => void) | null = null
  let res = 4
  let size = 7.632
  let mpt = 0.0075
  // textures
  let hTex = new THREE.DataTexture(new Float32Array(16), 4, 4, THREE.RedFormat, THREE.FloatType)
  let aTex = new THREE.DataTexture(new Uint8Array(64), 4, 4, THREE.RGBAFormat)
  let oTex = new THREE.DataTexture(new Uint8Array(64), 4, 4, THREE.RGBAFormat)
  let lTex = new THREE.DataTexture(new Float32Array(16), 4, 4, THREE.RedFormat, THREE.FloatType)
  let lVersion = -1
  let looseRgb: [number, number, number] = [0.4, 0.15, 0.05]
  let dirtyH = false, dirtyA = false, dirtyO = false
  let lastUpload = 0
  let exposure = 1.45

  const stageMat3 = new THREE.Matrix3()
  const lampW = new THREE.Vector3()
  const lampP = new THREE.Vector3()
  const common = {
    uHeight: { value: hTex as THREE.Texture }, uRes: { value: 4 }, uSize: { value: size },
    uLampW: { value: lampW }, uLampP: { value: lampP }, uRing: { value: 0 }, uStage: { value: stageMat3 }, uExposure: { value: 1 },
  }
  const plateMat = new THREE.ShaderMaterial({
    vertexShader: PLATE_VS, fragmentShader: PLATE_FS,
    uniforms: {
      ...common,
      uAlbedo: { value: aTex as THREE.Texture }, uOrm: { value: oTex as THREE.Texture }, uLoose: { value: lTex as THREE.Texture },
      uLooseOn: { value: 0 }, uLooseRes: { value: 4 }, uLooseRgb: { value: new THREE.Vector3(0.4, 0.15, 0.05) },
      uFocusZ: { value: 0 }, uM: { value: 5 }, uN: { value: 8 }, uMmPerTexel: { value: mpt }, uSteps: { value: quality === 'high' ? 16 : 8 },
      uMarble: { value: new THREE.Vector4(0, 0, 0, 0) }, uFrame: { value: new THREE.Vector2(7.2, 4.8) }, uSeed: { value: 0 },
      uAniso: { value: 0 }, uPeak: { value: 0 },
    },
  })
  let plateGeo = new THREE.PlaneGeometry(1, 1, 2, 2)
  const plate = new THREE.Mesh(plateGeo, plateMat)
  plate.frustumCulled = false
  stage.add(plate)

  // marble
  const marbleMat = new THREE.ShaderMaterial({
    vertexShader: MARBLE_VS, fragmentShader: MARBLE_FS, transparent: true,
    uniforms: {
      ...common,
      uAlbedo: plateMat.uniforms.uAlbedo, uCenter: { value: new THREE.Vector3() }, uR: { value: 1.5 }, uCamP: { value: new THREE.Vector3() },
      uSurfZ: { value: 0 }, uDirt: { value: 0 }, uDirtRgb: { value: new THREE.Vector3(0.4, 0.15, 0.05) }, uFade: { value: 1 },
    },
  })
  const marble = new THREE.Mesh(new THREE.SphereGeometry(1.5 * 1.02, 48, 32), marbleMat)
  marble.frustumCulled = false
  marble.renderOrder = 3
  stage.add(marble)

  // cloths
  interface ClothView { mesh: THREE.Mesh; geo: THREE.BufferGeometry; n: number; res: THREE.BufferAttribute; mat: THREE.ShaderMaterial }
  const cloths: Partial<Record<ClothKind, ClothView>> = {}
  function clothView(kind: ClothKind, n: number): ClothView {
    const old = cloths[kind]
    if (old && old.n === n) return old
    if (old) { stage.remove(old.mesh); old.geo.dispose() }
    const geo = new THREE.PlaneGeometry(1, 1, n - 1, n - 1)
    // PlaneGeometry vertex order is row-major from the top; remap so vertex k = sim particle k (row 0 = bottom)
    const pos = new Float32Array(n * n * 3)
    const uvs = new Float32Array(n * n * 2)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; uvs[k * 2] = i / (n - 1); uvs[k * 2 + 1] = j / (n - 1) }
    const idx: number[] = []
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1
      idx.push(a, b, d, a, d, c)
    }
    geo.setIndex(idx)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3))
    const resA = new THREE.BufferAttribute(new Float32Array(n * n * 4), 4)
    geo.setAttribute('aResidue', resA)
    const mat = new THREE.ShaderMaterial({
      vertexShader: CLOTH_VS, fragmentShader: CLOTH_FS, side: THREE.DoubleSide,
      uniforms: {
        uLampW: { value: lampW }, uRing: common.uRing, uKind: { value: kind === 'burlap' ? 1 : 0 }, uSwatch: { value: 2 },
        uBase: { value: kind === 'burlap' ? new THREE.Vector3(0.5, 0.36, 0.19) : new THREE.Vector3(0.52, 0.58, 0.64) },
        uExposure: common.uExposure, uFlipped: { value: 0 },
      },
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = kind === 'burlap' ? 2 : 1
    stage.add(mesh)
    const v: ClothView = { mesh, geo, n, res: resA, mat }
    cloths[kind] = v
    return v
  }

  // grains
  const grainMat = new THREE.ShaderMaterial({ vertexShader: GRAIN_VS, fragmentShader: GRAIN_FS, uniforms: { uLampW: { value: lampW }, uExposure: common.uExposure } })
  const grainGeo = new THREE.TetrahedronGeometry(0.6, 0)
  grainGeo.scale(1, 1, 0.45)
  const grains = new THREE.InstancedMesh(grainGeo, grainMat, 2000)
  grains.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3)
  grains.count = 0
  grains.frustumCulled = false
  stage.add(grains)
  const gm = new THREE.Matrix4(), gq = new THREE.Quaternion(), gs = new THREE.Vector3(), gp = new THREE.Vector3(), ge = new THREE.Euler()

  let reveal: Reveal | null = null
  let revealing = false
  let frameW = 7.2, frameH = 4.8
  let cssW = 1, cssH = 1
  let lastMs = 0

  function resize(): void {
    const r = canvas.getBoundingClientRect()
    cssW = Math.max(1, r.width)
    cssH = Math.max(1, r.height)
    gl.setSize(cssW, cssH, false)
    camera.aspect = cssW / cssH
    camera.updateProjectionMatrix()
    reveal?.resize(cssW / cssH)
  }

  function uploadTextures(now: number, force: boolean): void {
    if (!rt) return
    if (!force && now - lastUpload < 120) return
    if (!(dirtyH || dirtyA || dirtyO)) return
    lastUpload = now
    if (dirtyH) { hTex.needsUpdate = true; dirtyH = false }
    if (dirtyA) { aTex.needsUpdate = true; dirtyA = false }
    if (dirtyO) { oTex.needsUpdate = true; dirtyO = false }
  }

  function setSurface(next: SurfaceRuntime): void {
    if (unsub) unsub()
    rt = next
    const b = next.bake
    res = b.res; size = b.sizeMm; mpt = b.mmPerTexel
    hTex.dispose(); aTex.dispose(); oTex.dispose()
    hTex = new THREE.DataTexture(b.height, res, res, THREE.RedFormat, THREE.FloatType)
    hTex.minFilter = hTex.magFilter = THREE.NearestFilter
    hTex.generateMipmaps = false
    hTex.needsUpdate = true
    aTex = new THREE.DataTexture(b.albedo, res, res, THREE.RGBAFormat)
    aTex.colorSpace = THREE.SRGBColorSpace
    aTex.generateMipmaps = true
    aTex.minFilter = THREE.LinearMipmapLinearFilter
    aTex.magFilter = THREE.LinearFilter
    aTex.anisotropy = 4
    aTex.needsUpdate = true
    oTex = new THREE.DataTexture(b.orm, res, res, THREE.RGBAFormat)
    oTex.generateMipmaps = true
    oTex.minFilter = THREE.LinearMipmapLinearFilter
    oTex.magFilter = THREE.LinearFilter
    oTex.needsUpdate = true
    common.uHeight.value = hTex
    common.uRes.value = res
    common.uSize.value = size
    plateMat.uniforms.uAlbedo.value = aTex
    plateMat.uniforms.uOrm.value = oTex
    plateMat.uniforms.uMmPerTexel.value = mpt
    plateMat.uniforms.uAniso.value = next.recipe.aniso?.strength ?? 0
    const seg = quality === 'high' ? 256 : 128
    plateGeo.dispose()
    plateGeo = new THREE.PlaneGeometry(size, size, seg, seg)
    plate.geometry = plateGeo
    unsub = next.onDirty((_r, what) => {
      if (what === 'height') dirtyH = true
      else if (what === 'albedo') dirtyA = true
      else if (what === 'orm') dirtyO = true
    })
    lVersion = -1
  }

  const vTmp = new THREE.Vector3()
  const camP = new THREE.Vector3()
  const invStage = new THREE.Matrix4()

  function applyTilt(t: { x: number; y: number }): void {
    // +x edge goes down for θx > 0; +y edge goes down for θy > 0
    stage.rotation.set((-t.y * Math.PI) / 180, (t.x * Math.PI) / 180, 0, 'XYZ')
    stage.updateMatrixWorld(true)
  }

  function render(view: ViewState): void {
    const t0 = performance.now()
    if (revealing && reveal) {
      reveal.render(gl, view.timeWall)
      lastMs = performance.now() - t0
      return
    }
    const ratio = view.ratio
    frameW = view.portrait ? ratio.fovMm[1] : ratio.fovMm[0]
    frameH = view.portrait ? ratio.fovMm[0] : ratio.fovMm[1]
    // camera: top-down, 20° vertical FOV, framing the frame rect exactly
    const aspect = cssW / cssH
    const halfH = Math.max(frameH / 2, frameW / 2 / aspect)
    const dist = halfH / Math.tan(((FOV_DEG / 2) * Math.PI) / 180)
    camera.position.set(0, 0, dist)
    camera.near = dist * 0.3
    camera.far = dist * 3
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    applyTilt(view.tilt)
    stageMat3.setFromMatrix4(stage.matrixWorld)
    // lamp: fixed in world space
    const az = (view.lamp.azDeg * Math.PI) / 180, el = (view.lamp.elDeg * Math.PI) / 180
    lampW.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el))
    invStage.copy(stage.matrixWorld).invert()
    lampP.copy(lampW).applyMatrix3(new THREE.Matrix3().setFromMatrix4(invStage)).normalize()
    common.uRing.value = view.lamp.mode === 'ring' ? 1 : 0
    common.uExposure.value = exposure
    plateMat.uniforms.uFocusZ.value = view.focus.zMm
    plateMat.uniforms.uM.value = ratio.m
    plateMat.uniforms.uN.value = 8
    plateMat.uniforms.uSteps.value = quality === 'high' ? 16 : 8
    ;(plateMat.uniforms.uFrame.value as THREE.Vector2).set(frameW, frameH)
    plateMat.uniforms.uPeak.value = view.focus.peaking ? 1 : 0
    // marble
    const ms = view.bench.marble
    const showM = ms.where === 'plate' || ms.where === 'held'
    marble.visible = showM
    if (showM) {
      (marbleMat.uniforms.uCenter.value as THREE.Vector3).set(ms.pos[0], ms.pos[1], ms.pos[2])
      camP.copy(camera.position).applyMatrix4(invStage)
      ;(marbleMat.uniforms.uCamP.value as THREE.Vector3).copy(camP)
      marbleMat.uniforms.uSurfZ.value = rt ? sampleH(ms.pos[0], ms.pos[1]) : 0
      marbleMat.uniforms.uDirt.value = ms.dirt
      ;(plateMat.uniforms.uMarble.value as THREE.Vector4).set(ms.pos[0], ms.pos[1], ms.pos[2], 1.5)
    } else (plateMat.uniforms.uMarble.value as THREE.Vector4).set(0, 0, 0, 0)
    // cloths
    for (const k of ['lens', 'burlap'] as ClothKind[]) {
      const cs = view.bench.cloths[k]
      const v = clothView(k, cs.n)
      v.mesh.visible = cs.where !== 'tray'
      if (!v.mesh.visible) continue
      v.mat.uniforms.uSwatch.value = cs.swatchMm
      v.mat.uniforms.uFlipped.value = cs.flipped ? 1 : 0
      const pa = v.geo.getAttribute('position') as THREE.BufferAttribute
      ;(pa.array as Float32Array).set(cs.pos)
      pa.needsUpdate = true
      v.geo.computeVertexNormals()
      const ra = v.res.array as Float32Array
      for (let i = 0; i < cs.n * cs.n; i++) {
        ra[i * 4] = cs.residue[i * 4] / 255; ra[i * 4 + 1] = cs.residue[i * 4 + 1] / 255; ra[i * 4 + 2] = cs.residue[i * 4 + 2] / 255; ra[i * 4 + 3] = cs.residue[i * 4 + 3] / 255
      }
      v.res.needsUpdate = true
    }
    // grains
    const gd = view.bench.grains
    grains.count = gd.count
    const ic = grains.instanceColor!
    for (let i = 0; i < gd.count; i++) {
      const o = i * 8
      gp.set(gd.data[o], gd.data[o + 1], gd.data[o + 2])
      ge.set(gd.data[o + 7], gd.data[o + 7] * 0.7, gd.data[o + 7] * 1.3)
      gq.setFromEuler(ge)
      gs.setScalar(gd.data[o + 3])
      gm.compose(gp, gq, gs)
      grains.setMatrixAt(i, gm)
      ic.setXYZ(i, gd.data[o + 4], gd.data[o + 5], gd.data[o + 6])
    }
    grains.instanceMatrix.needsUpdate = true
    ic.needsUpdate = true
    plateMat.uniforms.uSeed.value = opts.test ? 0 : (view.timeWall * 60) % 97
    uploadTextures(performance.now(), false)
    gl.render(scene, camera)
    lastMs = performance.now() - t0
  }

  function sampleH(x: number, y: number): number {
    if (!rt) return 0
    const b = rt.bake
    const i = Math.min(b.res - 1, Math.max(0, Math.floor((x + b.sizeMm / 2) / b.mmPerTexel)))
    const j = Math.min(b.res - 1, Math.max(0, Math.floor((y + b.sizeMm / 2) / b.mmPerTexel)))
    return b.height[j * b.res + i]
  }

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const planeHit = new THREE.Vector3()

  const api: Renderer & RendererExtras = {
    kind: 'webgl2',
    canvas,
    setSurface,
    render,
    clientToFrame(cx, cy): FrameHit {
      const r = canvas.getBoundingClientRect()
      const lx = cx - r.left, ly = cy - r.top
      const inside = lx >= 0 && ly >= 0 && lx <= r.width && ly <= r.height
      let bezelDeg: number | null = null
      if (!inside) {
        const dx = Math.max(r.left - cx, 0, cx - r.right), dy = Math.max(r.top - cy, 0, cy - r.bottom)
        if (Math.hypot(dx, dy) <= 28) bezelDeg = (Math.atan2(-(cy - (r.top + r.height / 2)), cx - (r.left + r.width / 2)) * 180) / Math.PI
      }
      ndc.set((lx / r.width) * 2 - 1, -(ly / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      // intersect the tilted plate plane z = 0 (plate space)
      const o = ray.ray.origin.clone().applyMatrix4(invStage)
      const d = ray.ray.direction.clone().transformDirection(invStage)
      const t = d.z !== 0 ? -o.z / d.z : 0
      planeHit.copy(o).addScaledVector(d, t)
      return { x: planeHit.x, y: planeHit.y, inside, bezelDeg, focusRing: false }
    },
    frameToClient(x, y) {
      const r = canvas.getBoundingClientRect()
      vTmp.set(x, y, sampleH(x, y)).applyMatrix4(stage.matrixWorld).project(camera)
      return { cx: r.left + ((vTmp.x + 1) / 2) * r.width, cy: r.top + ((1 - vTmp.y) / 2) * r.height }
    },
    mmPerPx: () => frameH / cssH,
    setQuality(q) {
      if (q === quality) return
      quality = q
      gl.setPixelRatio(dprFor(q))
      resize()
      if (rt) setSurface(rt)
    },
    resize,
    async playReveal(recipe: SurfaceRecipe, o) {
      if (!reveal) reveal = createReveal()
      reveal.resize(cssW / cssH)
      reveal.setDecal(aTex)
      revealing = true
      await reveal.play(recipe, o.reducedMotion)
    },
    endReveal() { revealing = false; reveal?.stop() },
    snapshot() {
      return new Promise<Blob>((resolve) => {
        gl.render(scene, camera)
        canvas.toBlob((b) => resolve(b ?? new Blob()), 'image/png')
      })
    },
    stats: () => ({ ms: lastMs, calls: gl.info.render.calls, tris: gl.info.render.triangles }),
    dispose() { unsub?.(); gl.dispose() },
    setLoose(data, r, version, rgb) {
      looseRgb = rgb
      ;(plateMat.uniforms.uLooseRgb.value as THREE.Vector3).set(rgb[0], rgb[1], rgb[2])
      if (!data) { plateMat.uniforms.uLooseOn.value = 0; return }
      plateMat.uniforms.uLooseOn.value = 1
      plateMat.uniforms.uLooseRes.value = r
      if (lTex.image.width !== r || lTex.image.data !== data) {
        lTex.dispose()
        lTex = new THREE.DataTexture(data, r, r, THREE.RedFormat, THREE.FloatType)
        lTex.minFilter = lTex.magFilter = THREE.NearestFilter
        plateMat.uniforms.uLoose.value = lTex
        lTex.needsUpdate = true
        lVersion = version
      } else if (version !== lVersion) {
        lVersion = version
        lTex.needsUpdate = true
      }
      void looseRgb
    },
    setExposure(e) { exposure = e },
    focusZAt(x, y, t) {
      applyTilt(t)
      vTmp.set(x, y, sampleH(x, y)).applyMatrix4(stage.matrixWorld)
      return vTmp.z
    },
  }
  resize()
  return api
}
