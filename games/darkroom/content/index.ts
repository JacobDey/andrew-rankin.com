import type { DarkroomContent, Negative } from '../types'
import { buildNegative, NEGATIVE_LIST } from './negatives'
import { prep } from './prep'
import { buildProps } from './props'

export function createContent(seed = 7): DarkroomContent {
  const negs = new Map<string, Negative>()
  for (const n of NEGATIVE_LIST) negs.set(n.id, buildNegative(n.id, seed))
  const props = buildProps()
  return {
    getNegative: (id) => negs.get(id),
    listNegatives: () => [...negs.values()],
    addNegative: (n) => { negs.set(n.id, n) },
    prep,
    props,
  }
}
export { NEGATIVE_LIST } from './negatives'
