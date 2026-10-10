// Photo adapter (architecture §5.5): ShotRecord → PhotoScene + photo spec + pose track → capture,
// then H (lux·s) → the §5.7 log2 latent. Scene radiance is in kcd/m² (radianceScale 1000, §3.2).
import * as THREE from 'three'
import { computeProfile, focusDistanceM, type LensProfile } from '@shared/optics'
import { PhotoRenderer as CorePhoto, type CameraPose, type PhotoScene, type DeepPartial, type PhotoSpec } from '@shared/photo'
import type { GLCore } from '../core/gl'
import type { FrameRecord, LatentImage, ShotRecord } from '../core/types'
import { BODIES, FILTERS, SHUTTERS, STOCKS, H0 } from '../core/catalog'
import type { World } from '../street/world/world'
import { encodeH } from '../film/develop'

export interface PhotoRenderer { render(f: FrameRecord, onProgress?: (p: number) => void): Promise<LatentImage>; busy(): boolean }

export function photoSpecFor(shot: ShotRecord, p: LensProfile): DeepPartial<PhotoSpec> {
  const body = BODIES[shot.camera.body]
  const sh = SHUTTERS[shot.camera.shutter]
  const stock = STOCKS[shot.camera.stock]
  const [fw, fh] = body.format
  const f = p.efl
  const lca = p.longCA[0] - p.longCA[2]
  const halfDiag = Math.hypot(fw, fh) / 2
  const dvCorner = -0.5 * p.petzval * halfDiag * halfDiag
  const isFP = sh.travel > 0
  const pin = p.pinhole
  return {
    format: { width: fw, height: fh },
    focalLength: f,
    fNumber: shot.fNumber,
    maxAperture: shot.fNumber,
    focusDistance: pin ? Infinity : focusDistanceM(f, shot.ext),
    shutter: Math.max(1e-4, shot.shutterS),
    iso: stock.iso,
    shutterType: isFP ? 'focal-plane' : 'leaf',
    curtainTravel: isFP ? sh.travel : 0.012,
    curtainDirection: sh.dir === 'left' ? 'left' : 'up',
    leafRamp: shot.camera.shutter === 'cap' ? 0.09 : 0.0015 * Math.max(0.2, (f / shot.fNumber) / 24),
    aperture: {
      blades: shot.camera.lens.stop.kind === 'iris' ? shot.camera.lens.stop.blades : 0,
      rotation: 0,
      curvature: shot.camera.lens.stop.kind === 'iris' ? shot.camera.lens.stop.roundness : 1,
      mask: shot.camera.lens.stop.kind === 'card' ? { size: 64, data: p.pupilMask } : null,
    },
    lens: {
      transmittance: p.transmission,
      vignetting: pin ? 0 : Math.max(0, Math.min(1, 1 - p.vignette[15])),
      naturalVignetting: pin ? 1 : Math.max(0.4, Math.min(1, 1 / Math.max(0.5, p.pupilMag))),
      distortionK1: pin ? 0 : p.distortion.k1,
      distortionK2: pin ? 0 : p.distortion.k2,
      lateralCA: pin ? 0 : p.lateralCA[0] - p.lateralCA[2],
      longitudinalCA: pin ? 0 : (lca / (f * f)) * 1000,
      fieldCurvature: pin ? 0 : (dvCorner / (f * f)) * 1000,
      astigmatism: pin ? 0 : Math.max(0, Math.min(1, Math.abs(p.petzval * f) * 0.8)),
      veilingGlare: p.glare,
      ghosts: Math.min(1, p.glare / 0.06),
      glow: pin ? 0 : Math.max(0, Math.min(0.35, (p.saBlurMm / (halfDiag / 750)) * 0.08)),
      diffraction: true,
      starStrength: 1,
    },
    film: { grainSize: 8, granularity: 0, color: true, reciprocityP: stock.p },
  }
}

export interface RenderTier { samples: number; longEdge: number; flare: boolean; probe: boolean; shadowEvery: number }
export function tierFor(q: GLCore['quality']): RenderTier {
  if (q === 'desktop') return { samples: 32, longEdge: 1280, flare: true, probe: true, shadowEvery: 4 }
  if (q === 'phone') return { samples: 16, longEdge: 896, flare: true, probe: false, shadowEvery: 4 }
  return { samples: 4, longEdge: 384, flare: false, probe: false, shadowEvery: 4 }
}

export function createPhotoRenderer(gl: GLCore, world: World): PhotoRenderer & { core: CorePhoto; tier: RenderTier } {
  const core = new CorePhoto(gl.renderer)
  let busy = false
  const tier = tierFor(gl.quality)
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const poseFrom = (pos: [number, number, number], yaw: number, pitch: number): CameraPose => ({
    position: new THREE.Vector3(pos[0], pos[1], pos[2]),
    quaternion: new THREE.Quaternion().setFromEuler(euler.set(pitch, yaw, 0, 'YXZ')),
  })
  async function renderShot(shot: ShotRecord): Promise<{ H: Float32Array; w: number; h: number }> {
    const body = BODIES[shot.camera.body]
    const p = computeProfile(shot.camera.lens, { w: body.format[0], h: body.format[1] }, 'full')
    const spec = photoSpecFor(shot, p)
    const scene: PhotoScene = {
      scene: world.scene,
      setTime(time: number) { world.setTimeOfDay(shot.timeOfDay); world.update(time) },
    }
    const n = shot.track.length / 2
    const at = (tRel: number) => {
      const x = Math.max(0, Math.min(n - 1, tRel * shot.trackHz))
      const i = Math.floor(x), fr = x - i, j = Math.min(n - 1, i + 1)
      return [shot.track[i * 2] * (1 - fr) + shot.track[j * 2] * fr, shot.track[i * 2 + 1] * (1 - fr) + shot.track[j * 2 + 1] * fr]
    }
    const [y0, p0] = at(0)
    const res = await core.capture(scene, spec, {
      pose: poseFrom(shot.pos, y0, p0),
      poseAt: (tRel: number) => { const [y, pp] = at(tRel); return poseFrom(shot.pos, y, pp) },
      time0: shot.worldT0,
      samples: tier.samples,
      longEdge: tier.longEdge,
      sliceMs: gl.quality === 'test' ? Infinity : 8,
      grain: false,
      flare: tier.flare,
      glareProbe: tier.probe,
      shadowEvery: tier.shadowEvery,
      readback: true,
      seed: shot.seed,
      near: 0.05,
      far: 3000,
      radianceScale: 1000,
    })
    const X = res.latent
    const w = res.width, h = res.height
    const H = new Float32Array(w * h * 3)
    if (X) {
      const k = res.meta.exposure.hPerUnit
      const ft = FILTERS[shot.camera.filter].t
      for (let i = 0; i < w * h; i++) {
        H[i * 3] = Math.max(0, X[i * 4]) * k * ft[0]
        H[i * 3 + 1] = Math.max(0, X[i * 4 + 1]) * k * ft[1]
        H[i * 3 + 2] = Math.max(0, X[i * 4 + 2]) * k * ft[2]
      }
    }
    return { H, w, h }
  }
  return {
    core, tier,
    busy: () => busy,
    async render(f: FrameRecord, onProgress?: (p: number) => void): Promise<LatentImage> {
      busy = true
      try {
        let acc: Float32Array | null = null
        let w = 0, h = 0
        for (let s = 0; s < f.shots.length; s++) {
          const r = await renderShot(f.shots[s])
          if (!acc || r.w !== w || r.h !== h) { acc = r.H; w = r.w; h = r.h } else for (let i = 0; i < acc.length; i++) acc[i] += r.H[i]
          onProgress?.((s + 1) / f.shots.length)
        }
        const body = BODIES[f.shots[0].camera.body]
        const data = new Uint8Array(w * h * 3)
        if (acc) for (let i = 0; i < acc.length; i++) data[i] = encodeH(acc[i] || H0 * 1e-4)
        return { w, h, data, formatMm: [body.format[0], body.format[1]], ir: false }
      } finally {
        busy = false
      }
    },
  }
}
