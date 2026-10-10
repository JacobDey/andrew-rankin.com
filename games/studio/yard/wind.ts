// One wind field drives audio and physics (studio.md §5.4):
// w(t) = 1.5 + 1.2·fbm(0.15 t) m/s from 250° (WSW) ± 15° drift; gusts travel across the yard at 4 m/s.
import * as THREE from 'three'
import { fbm1 } from '@shared/core'

export interface Wind {
  speed(x: number, z: number, t: number): number
  dir(t: number, out?: THREE.Vector3): THREE.Vector3 // unit vector the wind blows toward
  vec(x: number, z: number, t: number, out: THREE.Vector3): THREE.Vector3
}

export function createWind(seed: number): Wind {
  const D2R = Math.PI / 180
  const dirAt = (t: number, out = new THREE.Vector3()) => {
    const fromDeg = 250 + 15 * fbm1(0.05 * t, { seed: seed + 3, octaves: 3 })
    const toAz = (fromDeg + 180) * D2R // azimuth 0 = north (+z), clockwise toward +x
    return out.set(Math.sin(toAz), 0, Math.cos(toAz))
  }
  const base = (t: number) => Math.max(0, 1.5 + 1.2 * fbm1(0.15 * t, { seed: seed + 1, octaves: 4 }))
  const tmp = new THREE.Vector3()
  const w: Wind = {
    speed(x, z, t) {
      dirAt(t, tmp)
      const lag = (x * tmp.x + z * tmp.z) / 4
      return base(t - lag)
    },
    dir: dirAt,
    vec(x, z, t, out) {
      dirAt(t, out)
      return out.multiplyScalar(w.speed(x, z, t))
    },
  }
  return w
}
