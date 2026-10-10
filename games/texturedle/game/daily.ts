// Daily schedule (texturedle.md §3.5). Day number = whole local days since
// EPOCH + 1, computed once at load. Days 1–30 follow the Nettle Lane walk;
// after that (or earlier, when fewer recipes exist) a deterministic shuffle of
// the pool. Andrew's mailbox is always Day 1. The poster recipe is never chosen.

import { mulberry32, hashString } from '@shared/core'

export const EPOCH = '2026-10-09'

export function dayNumber(now: Date = new Date()): number {
  const [y, m, d] = EPOCH.split('-').map(Number)
  const e = new Date(y, m - 1, d)
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(1, Math.round((t.getTime() - e.getTime()) / 86400000) + 1)
}

export function dateForDay(day: number): Date {
  const [y, m, d] = EPOCH.split('-').map(Number)
  return new Date(y, m - 1, d + day - 1)
}

export function recipeForDay(day: number, walk: readonly string[], pool: readonly string[]): { recipeId: string; seed: number } {
  const n = Math.max(1, day)
  if (n <= Math.min(30, walk.length)) return { recipeId: walk[n - 1], seed: 1 }
  const list = pool.length ? pool : walk
  const k = n - Math.min(30, walk.length) - 1
  const cycle = Math.floor(k / list.length)
  const order = [...list]
  const r = mulberry32(hashString('texturedle' + cycle))
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t }
  // never repeat within 20 days across the cycle seam
  if (cycle > 0 && order.length > 20) {
    const prev = [...list]
    const r2 = mulberry32(hashString('texturedle' + (cycle - 1)))
    for (let i = prev.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); const t = prev[i]; prev[i] = prev[j]; prev[j] = t }
    const tail = new Set(prev.slice(-20))
    order.sort((a, b) => Number(tail.has(a)) - Number(tail.has(b)))
  }
  return { recipeId: order[k % order.length], seed: 1 + cycle }
}

const HABITAT_TEASER: Record<string, string> = {
  drive: 'the drive', yard: 'the yard', garden: 'the garden', hall: 'the hall', kitchen: 'the kitchen', studio: 'the studio', darkroom: 'the basement',
}
export function teaser(scene: string | undefined): string {
  return scene ? `Tomorrow: something from ${HABITAT_TEASER[scene] ?? 'the house'}.` : 'Tomorrow: something new.'
}
