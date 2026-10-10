// games/plates/story/truth.ts — the answer key (plates-story.md §8) and validators.
import type { SoulId, FateId, FindingId, PlateId, PersonAnswer } from '../contracts'
import { SECTOR_Q } from './text'

export interface PersonTruth { fig: number; plate: PlateId; name: SoulId; fate: FateId; agent: SoulId | null }
export const PERSONS: PersonTruth[] = [
  { fig: 1, plate: 'p01', name: 'saul', fate: 'survived', agent: null },
  { fig: 2, plate: 'p01', name: 'amos', fate: 'survived', agent: null },
  { fig: 3, plate: 'p01', name: 'nell', fate: 'survived', agent: null },
  { fig: 4, plate: 'p01', name: 'keturah', fate: 'survived', agent: null },
  { fig: 5, plate: 'p01', name: 'davy', fate: 'drownedSaving', agent: 'shilling' },
  { fig: 6, plate: 'p09', name: 'hosken', fate: 'mast', agent: null },
  { fig: 7, plate: 'p09', name: 'rype', fate: 'drowned', agent: null },
  { fig: 8, plate: 'p11', name: 'abery', fate: 'rescuedBy', agent: 'saul' },
  { fig: 9, plate: 'p11', name: 'ottilie', fate: 'survived', agent: null },
  { fig: 10, plate: 'p10', name: 'shilling', fate: 'rescuedBy', agent: 'davy' },
]
export const FIG_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export interface FindingTruth { id: FindingId; verdict: 'stands' | 'withdraw'; plates: PlateId[] }
export const FINDINGS: FindingTruth[] = [
  { id: 'f1', verdict: 'withdraw', plates: ['p05', 'p07', 'p12'] },
  { id: 'f2', verdict: 'withdraw', plates: ['p08'] },
  { id: 'f3', verdict: 'withdraw', plates: ['p09', 'p10'] },
  { id: 'f4', verdict: 'withdraw', plates: ['p11'] },
  { id: 'f5', verdict: 'stands', plates: ['p09', 'p10'] },
]
export const SECTOR_TRUTH = { when: SECTOR_Q.when.options[1], who: 'nell', why: SECTOR_Q.why.options[1] }

export function personCorrect(fig: number, a: PersonAnswer): boolean {
  const t = PERSONS[fig - 1]
  if (!t || a.name !== t.name || a.fate !== t.fate) return false
  return t.agent === null ? true : a.agent === t.agent
}
export function findingCorrect(f: FindingId, verdict: 'stands' | 'withdraw' | null, plate: PlateId | null): boolean {
  const t = FINDINGS.find((x) => x.id === f)
  return !!t && verdict === t.verdict && plate !== null && t.plates.includes(plate)
}
