// @shared/core/gfx harness: renderer, render targets, read-back, data textures, disposal.
import * as THREE from 'three'
import {
  createRenderer, fitRenderer, fullscreenTriangle, createRT, floatCaps, readRTPixels, dataTexture, toHalfFloatArray, disposeDeep, snapshotCanvas,
} from '@shared/core/gfx'
import { installGameApi, markReady, nextFrame, detectTier, probeGL } from '@shared/core'

interface Check {
  name: string
  ok: boolean
  detail?: string
}

async function selftest(): Promise<{ ok: boolean; results: Check[] }> {
  const out: Check[] = []
  const t = (name: string, ok: boolean, detail?: string): void => {
    out.push({ name, ok, detail })
  }
  const view = document.getElementById('view') as HTMLElement
  const canvas = document.createElement('canvas')
  view.appendChild(canvas)
  const tier = detectTier()
  const renderer = createRenderer(canvas, { tier, preserveDrawingBuffer: false })
  let resized = ''
  const stop = fitRenderer(renderer, view, (w, h) => {
    resized = `${w}x${h}`
  })
  t('createRenderer: WebGL2, sRGB output, no tone mapping', renderer.capabilities.isWebGL2 && renderer.outputColorSpace === THREE.SRGBColorSpace && renderer.toneMapping === THREE.NoToneMapping)
  t('createRenderer: DPR capped by tier', renderer.getPixelRatio() <= (tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1))
  t('fitRenderer sizes the drawing buffer to the element', resized === '320x198' || resized === '320x200' || /^320x/.test(resized), resized)

  const caps = floatCaps(renderer)
  const gl = renderer.getContext() as WebGL2RenderingContext
  const info = probeGL(gl)
  t('floatCaps agree with probeGL', !!info && info.floatRT === caps.floatRT && info.halfFloatRT === caps.halfFloatRT && info.floatBlend === caps.floatBlend, JSON.stringify(caps))

  // render a flat colour into an RT with the fullscreen triangle
  const scene = new THREE.Scene()
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const mat = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Vector4(0.25, 0.5, 0.75, 1) } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform vec4 c; void main(){ gl_FragColor = c; }',
    depthTest: false,
    depthWrite: false,
  })
  const tri = new THREE.Mesh(fullscreenTriangle(), mat)
  tri.frustumCulled = false
  scene.add(tri)
  const rt8 = createRT(8, 4, { filter: 'nearest' })
  renderer.setRenderTarget(rt8)
  renderer.render(scene, cam)
  renderer.setRenderTarget(null)
  const px8 = (await readRTPixels(renderer, rt8)) as Uint8Array
  t('readRTPixels (async) returns RGBA8 of the right size', px8 instanceof Uint8Array && px8.length === 8 * 4 * 4 && Math.abs((px8[0] as number) - 64) <= 1 && Math.abs((px8[1] as number) - 128) <= 1 && Math.abs((px8[2] as number) - 191) <= 1, Array.from(px8.slice(0, 4)).join())
  const px8b = (await readRTPixels(renderer, rt8, { async: false })) as Uint8Array
  t('readRTPixels sync path matches', px8b.length === px8.length && px8b[0] === px8[0] && px8b[5] === px8[5])

  if (caps.floatRT) {
    const rtF = createRT(4, 4, { type: THREE.FloatType, filter: 'nearest' })
    mat.uniforms.c!.value.set(1.5, -0.25, 3, 1)
    renderer.setRenderTarget(rtF)
    renderer.render(scene, cam)
    renderer.setRenderTarget(null)
    const pf = (await readRTPixels(renderer, rtF)) as Float32Array
    t('float RT round-trips values beyond [0,1]', pf instanceof Float32Array && Math.abs((pf[0] as number) - 1.5) < 1e-4 && Math.abs((pf[1] as number) + 0.25) < 1e-4 && Math.abs((pf[2] as number) - 3) < 1e-4, Array.from(pf.slice(0, 3)).join())
    const rtH = createRT(4, 4, { type: THREE.HalfFloatType, filter: 'nearest' })
    renderer.setRenderTarget(rtH)
    renderer.render(scene, cam)
    renderer.setRenderTarget(null)
    const ph = (await readRTPixels(renderer, rtH)) as Float32Array
    t('half-float RT reads back as Float32Array', ph instanceof Float32Array && Math.abs((ph[0] as number) - 1.5) < 1e-2, String(ph[0]))
    rtF.dispose()
    rtH.dispose()
  } else t('float RT unsupported here (skipped)', true)

  const rtD = createRT(4, 4, { depth: 'texture' })
  t('createRT with a depth texture', rtD.depthTexture instanceof THREE.DepthTexture && rtD.depthBuffer === true)
  const rtM = createRT(16, 16, { mipmaps: true })
  t('createRT with mipmaps', rtM.texture.generateMipmaps === true && rtM.texture.minFilter === THREE.LinearMipmapLinearFilter)

  const dt8 = dataTexture(new Uint8Array([1, 2, 3]), 3, 1, { format: 'r', type: 'u8', filter: 'nearest' })
  const dtF = dataTexture(new Float32Array(2 * 2 * 4), 2, 2, { format: 'rgba', type: 'f32', repeat: true })
  const dtH = dataTexture(toHalfFloatArray(new Float32Array([1, 2, 0.5, 4])), 2, 1, { format: 'rg', type: 'f16' })
  t('dataTexture builds R8, RGBA32F and RG16F textures', dt8.format === THREE.RedFormat && dt8.unpackAlignment === 1 && dtF.type === THREE.FloatType && dtF.wrapS === THREE.RepeatWrapping && dtH.type === THREE.HalfFloatType && dtH.format === THREE.RGFormat)
  t('toHalfFloatArray', THREE.DataUtils.fromHalfFloat(toHalfFloatArray(new Float32Array([2.5]))[0] as number) === 2.5)

  // sample the data texture in a shader to prove the upload is valid
  const rtS = createRT(3, 1, { filter: 'nearest' })
  const smat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: dt8 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).r * 255.0 / 3.0, 0.0, 0.0, 1.0); }',
    depthTest: false,
  })
  const sscene = new THREE.Scene()
  const smesh = new THREE.Mesh(fullscreenTriangle(), smat)
  smesh.frustumCulled = false
  sscene.add(smesh)
  renderer.setRenderTarget(rtS)
  renderer.render(sscene, cam)
  renderer.setRenderTarget(null)
  const ps = (await readRTPixels(renderer, rtS)) as Uint8Array
  t('a 3x1 R8 data texture samples correctly (odd width, unpack alignment 1)', Math.abs((ps[0] as number) - 85) <= 2 && Math.abs((ps[4] as number) - 170) <= 2 && Math.abs((ps[8] as number) - 255) <= 2, `${ps[0]},${ps[4]},${ps[8]}`)

  // snapshot
  mat.uniforms.c!.value.set(0.9, 0.1, 0.1, 1)
  const blob = await snapshotCanvas(renderer, () => {
    renderer.setRenderTarget(null)
    renderer.render(scene, cam)
  })
  t('snapshotCanvas returns a PNG blob of the canvas', blob.type === 'image/png' && blob.size > 50, `${blob.size}`)

  // disposal
  let disposed = 0
  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.addEventListener('dispose', () => disposed++)
  const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1)
  tex.addEventListener('dispose', () => disposed++)
  const bm = new THREE.MeshBasicMaterial({ map: tex })
  bm.addEventListener('dispose', () => disposed++)
  const grp = new THREE.Group()
  grp.add(new THREE.Mesh(geo, bm))
  disposeDeep(grp)
  t('disposeDeep disposes geometry, material and its textures', disposed === 3, String(disposed))

  stop()
  for (const x of [rt8, rtD, rtM, rtS, dt8, dtF, dtH, mat, smat, tri.geometry, smesh.geometry]) x.dispose()
  t('errors() is empty', (window.__game as unknown as { errors(): string[] }).errors().length === 0, JSON.stringify((window.__game as unknown as { errors(): string[] }).errors()))
  const result = { ok: out.every((x) => x.ok), results: out }
  ;(document.getElementById('out') as HTMLElement).textContent = out.map((x) => `${x.ok ? 'ok  ' : 'FAIL'} ${x.name}${x.detail ? '  [' + x.detail + ']' : ''}`).join('\n')
  return result
}

installGameApi('shared:core:gfx', 'shared-core-gfx@1', { state: () => ({}), selftest })
void nextFrame().then(() => markReady())
