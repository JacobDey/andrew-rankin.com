// Bridge from @shared/optics (the Lens Bench glass) to the photo renderer: a LensProfile becomes the
// lens-dependent half of a PhotoSpec. Type-only import: this file adds no runtime dependency on optics.

import type { LensProfile } from '@shared/optics'
import type { CameraSpec, DeepPartial } from './spec.ts'

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x)

/**
 * Maps a computed LensProfile onto a PhotoSpec patch (merge it over your body and film with `resolveSpec`):
 *  - EFL, N and the 64x64 pupil mask become focal length, f-number and the drawn aperture;
 *  - distortion k1/k2 carry over; lateral CA is red scale minus blue scale;
 *  - longitudinal CA and Petzval field curvature (millimetres at the image) become dioptres at the corner;
 *  - swirl (tangential stretch 1 + 1.5 |P EFL|) becomes astigmatism;
 *  - the barrel's cat's-eye offsets d(r) are fitted by a line through the origin: the renderer shifts the rim by
 *    `vignetting * field * rimRadius`, so `vignetting` is the slope of d against field radius;
 *  - transmission, veiling glare, ghosts and the spherical-aberration glow carry over.
 * `base` is merged beneath: fields it sets (for example a different `format`) are respected where the profile
 * has no opinion, and its `maxAperture` is kept (the lens may be stopped down from its widest).
 */
export function photoSpecFromProfile(p: LensProfile, base: DeepPartial<CameraSpec> = {}): DeepPartial<CameraSpec> {
  const fw = p.format.w
  const fh = p.format.h
  const halfDiagMm = 0.5 * Math.hypot(fw, fh)
  const efl = Math.max(1, p.efl)

  // vignetting: slope of the cat's-eye offset against normalised field radius
  let num = 0
  let den = 0
  const n = p.catsEye.length
  for (let i = 0; i < n; i++) {
    const r = i / Math.max(1, n - 1)
    num += p.catsEye[i] * r
    den += r * r
  }
  const vignetting = den > 0 ? clamp(num / den, 0, 1.5) : 0

  // focus-surface error in dioptres (1/m): image-side shift dv (mm) maps to dv / v^2 with v ~ EFL
  const toDpt = (dvMm: number): number => (dvMm / (efl * efl)) * 1000
  const petzvalCornerMm = -0.5 * p.petzval * halfDiagMm * halfDiagMm
  const fieldCurvature = toDpt(petzvalCornerMm)
  const longitudinalCA = toDpt(p.longCA[0] - p.longCA[2])
  const astigmatism = clamp(0.75 * Math.abs(p.petzval * efl), 0, 0.9)

  let ghostSum = 0
  for (const g of p.ghosts) ghostSum += g.amp
  const ghosts = clamp(ghostSum * 20, 0, 1)
  const glow = clamp((8 * p.saBlurMm) / halfDiagMm, 0, 0.45)

  const mask = p.pupilMask && p.pupilMask.length >= 64 * 64 && !p.pinhole ? { size: 64, data: p.pupilMask } : undefined
  const out: DeepPartial<CameraSpec> = {
    ...base,
    format: base.format ?? { width: fw, height: fh },
    focalLength: efl,
    fNumber: Math.max(0.5, p.fNumber),
    maxAperture: base.maxAperture ?? Math.max(0.5, p.fNumber),
    aperture: {
      ...(base.aperture ?? {}),
      blades: p.blades,
      rotation: base.aperture?.rotation ?? 0,
      curvature: mask ? 1 : base.aperture?.curvature ?? 1,
      ...(mask ? { mask } : {}),
    },
    lens: {
      ...(base.lens ?? {}),
      transmittance: clamp(p.transmission, 0.05, 1),
      vignetting,
      distortionK1: p.distortion.k1,
      distortionK2: p.distortion.k2,
      lateralCA: p.lateralCA[0] - p.lateralCA[2],
      longitudinalCA,
      fieldCurvature,
      astigmatism,
      veilingGlare: clamp(p.glare, 0, 0.3),
      ghosts,
      glow,
    },
  }
  return out
}
