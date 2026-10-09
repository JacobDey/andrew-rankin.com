// Main-thread helper: bake in a worker when possible, fall back to inline.
import { bakeSurface } from './surface'
import type { BakeOptions, SurfaceBake } from './surface'
import { RECIPES } from './recipes'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (b: SurfaceBake) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (worker) return worker
  try {
    worker = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<{ id: number; bake?: SurfaceBake; error?: string }>) => {
      const p = pending.get(ev.data.id)
      if (!p) return
      pending.delete(ev.data.id)
      if (ev.data.bake) p.resolve(ev.data.bake)
      else p.reject(new Error(ev.data.error ?? 'bake failed'))
    }
    return worker
  } catch {
    return null
  }
}

export function bakeAsync(recipe: string, options: BakeOptions, params: Record<string, number> = {}, inline = false): Promise<SurfaceBake> {
  const w = inline ? null : getWorker()
  if (!w) {
    const make = RECIPES[recipe]
    return Promise.resolve(bakeSurface(make(params), options))
  }
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, recipe, params, options })
  })
}
