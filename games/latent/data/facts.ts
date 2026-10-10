// Fact groups and the ending rules (GDD §5.10, story bible §7.7).
import type { FactId } from '../core/types'
import { ENDING } from './text'

export const GROUPS = {
  ARSON: ['KDL_TANNERY', 'KDL_NEG', 'CANS_TANNERY', 'CAN_TANNERY', 'HEEL_TANNERY'],
  MURDER: ['KDL_PLANT', 'HEEL_PLANT', 'STAIRWELL_FIRE'],
  CORRUPTION: ['ENVELOPE_LANTERN', 'CLAIM_PAID', 'GD_BRIEFCASE', 'KDL_LANTERN', 'HALE_FACE', 'HALE_SAW'],
  MINA: ['MINA_1987', 'CURSIVE_LABEL'],
} satisfies Record<string, FactId[]>

export interface EnvelopePrint { facts: FactId[]; roll: number; frame: number }
export interface EndingText { atwell: string; clippings: { h: string; d: string }[]; fax: string; faxCursive: boolean; headstone: string | null; last: string }

export function evaluateFile(prints: EnvelopePrint[], totalNegatives: number): EndingText {
  const facts = new Set<FactId>(prints.flatMap((p) => p.facts))
  const any = (ids: readonly FactId[]) => ids.some((f) => facts.has(f))
  const ARSON = any(GROUPS.ARSON)
  const MURDER = any(GROUPS.MURDER)
  const CORRUPTION = any(GROUPS.CORRUPTION)
  const HALE_LINK = [...facts].some((f) => f.startsWith('KDL_')) || facts.has('HEEL_PARTY')
  const IDENTITY = facts.has('HEIGHT_MARKS') || facts.has('HEIGHT_MARKS_2') || facts.has('WATCH_M') || (facts.has('HORIZON_RUTH') && facts.has('HORIZON_MINA'))
  const MINA = any(GROUPS.MINA)
  const ATWELL_LINE = prints.some((p) => p.roll === 7 && (p.frame === 9 || p.frame === 10))
  const c = ENDING.clippings
  const clippings: { h: string; d: string }[] = []
  if (HALE_LINK && MURDER) clippings.push(c.murder)
  else if (HALE_LINK && ARSON) clippings.push(c.arson)
  else if (CORRUPTION) clippings.push(c.corruption)
  else clippings.push(c.none)
  if (IDENTITY) clippings.push(c.identity)
  if (MINA) clippings.push(c.mina)
  const fax = MINA ? ENDING.faxMina : IDENTITY ? ENDING.faxIdentity : ENDING.faxPlain
  return {
    atwell: ATWELL_LINE ? ENDING.fileAtwellDock : ENDING.fileAtwell,
    clippings, fax, faxCursive: true,
    headstone: IDENTITY ? ENDING.headstone : null,
    last: ENDING.last(totalNegatives, totalNegatives),
  }
}

export function evaluatePurge(totalNegatives: number): EndingText {
  return { atwell: '', clippings: [ENDING.clippings.medal], fax: ENDING.faxPurge, faxCursive: true, headstone: null, last: ENDING.last(totalNegatives, 1) }
}
