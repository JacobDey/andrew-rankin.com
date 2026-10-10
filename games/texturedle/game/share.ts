// Spoiler-free share text (texturedle.md §3.4): tiles and probes only.

import type { Tile } from './guess'
import type { DayRecord } from './save'
import { RATIOS, MISS_TITLE } from '../contracts'

export function shareText(day: number, rec: DayRecord, rows: Tile[][], contrast: boolean): string {
  const no = String(day).padStart(3, '0')
  const hard = rec.mode === 'hard' ? '*' : ''
  const solved = rec.status === 'solved'
  const n = rec.guesses.length
  const head = solved
    ? `TEXTUREDLE No.${no} · ${n}/6${hard} · ${RATIOS[rec.ratioIndex].label} ${RATIOS[rec.ratioIndex].title}`
    : `TEXTUREDLE No.${no} · X/6${hard} · ${MISS_TITLE}`
  const hit = contrast ? '🟦' : '🟩'
  const near = contrast ? '🟧' : '🟨'
  const grid = rows.map((r) => r.map((t) => (t.state === 'hit' ? hit : t.state === 'near' ? near : '⬛')).join('')).join('\n')
  const p = rec.probes
  const glyphs = [p.tilt ? '👁' : '', p.marble ? '🔮' : '', p.lens ? '🧣' : '', p.burlap ? '🪢' : '', rec.secret ? '✨' : ''].filter(Boolean)
  const eyes = !p.marble && !p.lens && !p.burlap && !p.tilt ? '👁 Eyes only' : glyphs.join(' ')
  return `${head}\n${grid}\n${eyes} · andrew-rankin.com/games/texturedle`
}
