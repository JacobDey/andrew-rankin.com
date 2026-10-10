// Main-thread side of the bake worker: bakeSurface() / bakeMaps(), with an inline fallback when a worker
// is unavailable (or setBakeMode('inline')) and for recipe objects that are not in the registry.
import { bakeSync, mapsFromBake, defaultSizeMm } from './baker'
import { getRecipe, isRegistered } from './recipes'
import type { BakeOptions, SurfaceBake, SurfaceMaps, SurfaceRecipe } from './types'
import type { BakeRequest, BakeResponse } from './bake.worker'

let mode: 'auto' | 'inline' = 'auto'
let worker: Worker | null = null
let failed = false
let nextId = 1
const pending = new Map<number, { resolve: (r: BakeResponse) => void; reject: (e: Error) => void }>()

/** 'inline' forces main-thread baking (tests, tools); 'auto' uses the worker when there is one. */
export function setBakeMode(m: 'auto' | 'inline'): void {
  mode = m
}

function getWorker(): Worker | null {
  if (mode === 'inline' || failed || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    const w = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (ev: MessageEvent<BakeResponse>) => {
      const p = pending.get(ev.data.id)
      if (!p) return
      pending.delete(ev.data.id)
      if (ev.data.error) p.reject(new Error(ev.data.error))
      else p.resolve(ev.data)
    }
    w.onerror = (ev) => {
      failed = true
      worker = null
      for (const [, p] of pending) p.reject(new Error(`bake worker failed: ${ev.message}`))
      pending.clear()
    }
    worker = w
    return w
  } catch {
    failed = true
    return null
  }
}

function request(kind: 'bake' | 'maps', recipeId: string, opts: BakeOptions): Promise<BakeResponse> | null {
  const w = getWorker()
  if (!w) return null
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, kind, recipeId, opts } satisfies BakeRequest)
  })
}

/** Bake a recipe at a given ratio and resolution (in the worker when possible). */
export async function bakeSurface(recipe: SurfaceRecipe, opts: BakeOptions): Promise<SurfaceBake> {
  if (isRegistered(recipe)) {
    const p = request('bake', recipe.id, opts)
    if (p) {
      try {
        const r = await p
        if (r.bake) return r.bake
      } catch (e) {
        if (!failed) throw e
      }
    }
  }
  return bakeSync(recipe, opts)
}

/** Maps for a 3D prop (a mailbox, a panel): albedo, normal, ORM, height. Runs in the worker. */
export async function bakeMaps(recipeId: string, o: { sizeMm: number; res: number; seed?: number; ratio?: number }): Promise<SurfaceMaps> {
  const opts: BakeOptions = { ratio: o.ratio ?? 1, res: o.res, physRes: 64, seed: o.seed, sizeMm: o.sizeMm, maps: true }
  const p = request('maps', recipeId, opts)
  if (p) {
    try {
      const r = await p
      if (r.maps) return r.maps
    } catch (e) {
      if (!failed) throw e
    }
  }
  return mapsFromBake(bakeSync(getRecipe(recipeId), opts))
}

export { defaultSizeMm }
