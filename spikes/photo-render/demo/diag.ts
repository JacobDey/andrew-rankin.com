// Diagnostic scenes: make lens character visible at a glance.
import * as THREE from 'three'
import type { PhotoScene } from '../core/index.ts'

/**
 * A grid of small bright points far behind the focus plane, on black. Out of focus, every point
 * becomes an image of the (vignetted, warped) pupil at that field position: blade polygons, cat's
 * eyes towards the corners, Petzval swirl, colour fringes, ghosts and stars.
 */
export function bokehField(distance = 30, cols = 9, rows = 6, spreadDeg = 34): PhotoScene {
  const scene = new THREE.Scene()
  const geo = new THREE.SphereGeometry(0.01 * distance * 0.05, 8, 6)
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4e5, 4e5, 4e5) })
  const mesh = new THREE.InstancedMesh(geo, mat, cols * rows)
  let i = 0
  const tanX = Math.tan(((spreadDeg / 2) * Math.PI) / 180)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols - 0.5) * 2 * tanX * distance
      const y = (((r + 0.5) / rows - 0.5) * 2 * tanX * distance * rows) / cols * 1.5
      mesh.setMatrixAt(i++, new THREE.Matrix4().makeTranslation(x, y, -distance))
    }
  scene.add(mesh)
  // a dim grey backdrop so veiling glare is visible as a lift of the blacks
  const back = new THREE.Mesh(new THREE.PlaneGeometry(distance * 6, distance * 6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.5, 0.5, 0.5) }))
  back.position.z = -distance * 1.5
  scene.add(back)
  return { scene }
}
