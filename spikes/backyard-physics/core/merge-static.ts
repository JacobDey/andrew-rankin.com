/**
 * mergeStatic(): bake every static mesh under a root into one mesh per material, to cut draw
 * calls (the backyard drops from ~420 to ~120; each draw call is paid again in the shadow pass).
 *
 * "Static" = a plain Mesh with a standard/lambert/phong material that is not inside a subtree
 * you exclude (physics-bound props, animated parts) and not instanced/skinned/points.
 */
import { BufferGeometry, Group, Mesh, Object3D, type Material } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export interface MergeStats {
  before: number
  after: number
  merged: number
}

export function mergeStatic(root: Group, exclude: Set<Object3D>): MergeStats {
  root.updateMatrixWorld(true)
  const buckets = new Map<string, { mat: Material; cast: boolean; receive: boolean; geos: BufferGeometry[]; meshes: Mesh[] }>()
  let before = 0
  const visit = (o: Object3D) => {
    if (exclude.has(o)) return
    const m = o as Mesh
    if (m.isMesh && !(m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh && !(m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      const mat = m.material as Material
      before++
      const ok =
        !Array.isArray(m.material) &&
        (mat.type === 'MeshStandardMaterial' || mat.type === 'MeshLambertMaterial' || mat.type === 'MeshPhongMaterial') &&
        !o.userData.noMerge &&
        m.visible
      if (ok) {
        const g = m.geometry
        const attrs = Object.keys(g.attributes).sort().join(',')
        const key = `${mat.uuid}|${attrs}|${m.castShadow}|${m.receiveShadow}`
        let b = buckets.get(key)
        if (!b) {
          b = { mat, cast: m.castShadow, receive: m.receiveShadow, geos: [], meshes: [] }
          buckets.set(key, b)
        }
        const baked = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m.matrixWorld)
        // Keep only the attributes every member shares.
        for (const name of Object.keys(baked.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) baked.deleteAttribute(name)
        baked.morphAttributes = {}
        b.geos.push(baked)
        b.meshes.push(m)
      }
    }
    for (const c of [...o.children]) visit(c)
  }
  visit(root)

  let merged = 0
  const out = new Group()
  out.name = 'static-merged'
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) {
      for (const g of b.geos) g.dispose()
      continue
    }
    const geo = mergeGeometries(b.geos, false)
    for (const g of b.geos) g.dispose()
    if (!geo) continue
    geo.computeBoundingSphere()
    const mesh = new Mesh(geo, b.mat)
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    mesh.matrixAutoUpdate = false
    out.add(mesh)
    for (const m of b.meshes) {
      m.removeFromParent()
      merged++
    }
  }
  root.add(out)
  let after = 0
  root.traverse((o) => {
    if ((o as Mesh).isMesh) after++
  })
  return { before, after, merged }
}

/**
 * Merge the child meshes of one physics-bound prop by material, in the prop's local frame,
 * so a 25-plank picnic table is 1 draw call instead of 25. Children marked noMerge stay.
 */
export function mergePropChildren(prop: Object3D): number {
  const buckets = new Map<string, { mat: Material; cast: boolean; receive: boolean; geos: BufferGeometry[]; meshes: Mesh[] }>()
  prop.updateMatrixWorld(true)
  const inv = prop.matrixWorld.clone().invert()
  prop.traverse((o) => {
    const m = o as Mesh
    if (o === prop || !m.isMesh || o.userData.noMerge || Array.isArray(m.material)) return
    // Skip anything that moves relative to the prop (named sub-groups like the sprinkler tube).
    for (let p = o.parent; p && p !== prop; p = p.parent) if (p.userData.animated) return
    const mat = m.material as Material
    const attrs = Object.keys(m.geometry.attributes).sort().join(',')
    const key = `${mat.uuid}|${attrs}|${m.castShadow}|${m.receiveShadow}`
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { mat, cast: m.castShadow, receive: m.receiveShadow, geos: [], meshes: [] }))
    const local = inv.clone().multiply(m.matrixWorld)
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(local)
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name)
    b.geos.push(g)
    b.meshes.push(m)
  })
  let removed = 0
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) {
      for (const g of b.geos) g.dispose()
      continue
    }
    const geo = mergeGeometries(b.geos, false)
    for (const g of b.geos) g.dispose()
    if (!geo) continue
    const mesh = new Mesh(geo, b.mat)
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    prop.add(mesh)
    for (const m of b.meshes) {
      m.removeFromParent()
      removed++
    }
    removed--
  }
  return removed
}
