// Web Worker entry: bakes a surface recipe off the main thread and transfers
// the typed arrays back. Usage (Vite):
//   const w = new Worker(new URL('./core/bake.worker.ts', import.meta.url), { type: 'module' })
//   w.postMessage({ recipe: 'rusty-mailbox', options })
import { bakeSurface, bakeTransferables } from './surface'
import type { BakeOptions } from './surface'
import { RECIPES } from './recipes'

export interface BakeRequest {
  id: number
  recipe: string
  params?: Record<string, number>
  options: BakeOptions
}

self.onmessage = (ev: MessageEvent<BakeRequest>) => {
  const { id, recipe, params, options } = ev.data
  try {
    const make = RECIPES[recipe]
    if (!make) throw new Error(`unknown recipe ${recipe}`)
    const bake = bakeSurface(make(params ?? {}), options)
    ;(self as unknown as Worker).postMessage({ id, bake }, bakeTransferables(bake))
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ id, error: String(e) })
  }
}
