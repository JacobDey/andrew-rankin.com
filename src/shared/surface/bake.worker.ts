// Web Worker entry: bakes a registered recipe off the main thread and transfers the typed arrays back.
import { bakeSync, bakeTransferables, mapsFromBake } from './baker'
import { getRecipe } from './recipes'
import type { BakeOptions, SurfaceBake, SurfaceMaps } from './types'

export interface BakeRequest {
  id: number
  kind: 'bake' | 'maps'
  recipeId: string
  opts: BakeOptions
}
export type BakeResponse = { id: number; bake?: SurfaceBake; maps?: SurfaceMaps; error?: string }

const ctx = self as unknown as { onmessage: ((ev: MessageEvent<BakeRequest>) => void) | null; postMessage(m: unknown, t?: Transferable[]): void }
ctx.onmessage = (ev) => {
  const { id, kind, recipeId, opts } = ev.data
  try {
    const bake = bakeSync(getRecipe(recipeId), kind === 'maps' ? { ...opts, maps: true } : opts)
    if (kind === 'maps') {
      const maps = mapsFromBake(bake)
      ctx.postMessage({ id, maps } satisfies BakeResponse, [maps.albedo.buffer, maps.normal.buffer, maps.orm.buffer, maps.height.buffer])
    } else {
      ctx.postMessage({ id, bake } satisfies BakeResponse, bakeTransferables(bake))
    }
  } catch (e) {
    ctx.postMessage({ id, error: String((e as Error)?.message ?? e) } satisfies BakeResponse)
  }
}
