// Persistence (texturedle.md §8, architecture §3.8): localStorage 'ar:texturedle:save'
// (SaveV1 JSON) through @shared/storage, plus the hub note. Physics state is
// deliberately not saved: the surface "rests" overnight.

import { local, writeHubNote } from '@shared/storage'
import { storageDisabled } from '@shared/core'
import type { Chip } from './notes'

export interface Settings {
  captions: boolean; haptics: boolean; gyro: boolean; hard: boolean
  tiles: 'standard' | 'contrast'; roomTone: boolean; quality: 'auto' | 'high' | 'low'
}
export interface DayRecord {
  recipeId: string; status: 'playing' | 'solved' | 'lost'; mode: 'normal' | 'hard'
  guesses: string[]; ratioIndex: number; evidence: string[]
  probes: { tilt: boolean; marble: boolean; lens: boolean; burlap: boolean }
  secret: boolean; finishedAt?: string; archive?: boolean
  /** additive: chip texts so the notes read the same after a reload */
  notes?: Chip[]
}
export interface SaveV1 {
  v: 1
  firstSeen: string
  settings: Settings
  onboarding: { beats: number }
  days: Record<number, DayRecord>
  stats: { played: number; solved: number; histogram: number[]; streak: number; bestStreak: number; lastSolvedDay: number; secrets: string[]; blower: boolean }
}

export function defaultSave(reducedMotion: boolean): SaveV1 {
  return {
    v: 1,
    firstSeen: new Date().toISOString().slice(0, 10),
    settings: { captions: reducedMotion, haptics: true, gyro: false, hard: false, tiles: 'standard', roomTone: true, quality: 'auto' },
    onboarding: { beats: 0 },
    days: {},
    stats: { played: 0, solved: 0, histogram: [0, 0, 0, 0, 0, 0, 0], streak: 0, bestStreak: 0, lastSolvedDay: 0, secrets: [], blower: false },
  }
}

const store = local('texturedle')

export function loadSave(reducedMotion: boolean): { save: SaveV1; persistent: boolean } {
  const d = defaultSave(reducedMotion)
  if (storageDisabled()) return { save: d, persistent: false }
  try {
    const s = store.get<SaveV1 | null>('save', null)
    if (s && s.v === 1) {
      s.settings = { ...d.settings, ...s.settings }
      s.stats = { ...d.stats, ...s.stats }
      s.onboarding = s.onboarding ?? { beats: 0 }
      s.days = s.days ?? {}
      return { save: s, persistent: store.persistent }
    }
  } catch { /* corrupt or blocked: start fresh */ }
  return { save: d, persistent: store.persistent }
}

export function writeSave(s: SaveV1): void {
  if (storageDisabled()) return
  try { store.set('save', s) } catch { /* private mode: no persistence */ }
}

export function clearSave(): void {
  try { store.del('save') } catch { /* ignore */ }
}

export function hubNote(text: string): void {
  if (storageDisabled()) return
  try { writeHubNote('texturedle', text) } catch { /* ignore */ }
}
