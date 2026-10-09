// Guess matching for "name this surface" games. Pure TS, no DOM.
//
// Normalizes the guess (case, punctuation, plurals, British spellings, filler
// words), then scores it against every name + alias with a token-aware fuzzy
// match that forgives one typo per ~5 letters.

import { CATALOG } from './catalog'
import type { MaterialInfo } from './types'

const FILLER = new Set(['a', 'an', 'the', 'of', 'some', 'piece', 'bit', 'on', 'from', 'my', 'old', 'its', 'it', 'is', 'surface', 'texture', 'material', 'close', 'up', 'closeup', 'macro'])

const SPELLING: Record<string, string> = {
  aluminium: 'aluminum', galvanised: 'galvanized', colour: 'color', grey: 'gray', jumper: 'sweater',
  tyre: 'tire', hessian: 'burlap', stainless: 'steel', lego: 'lego', legos: 'lego',
}

function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && /(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1)
  return w
}

/** lowercase, strip punctuation and filler, singularize, canonical spelling */
export function normalizeGuess(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .map((w) => SPELLING[w] ?? w)
    .map(singular)
}

export function levenshtein(a: string, b: string, max = 99): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** typo budget for a word of this length */
const budget = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2)

function wordMatch(a: string, b: string): number {
  if (a === b) return 1
  const d = levenshtein(a, b, 2)
  if (d <= budget(Math.min(a.length, b.length))) return 1 - 0.15 * d
  // compound words: "mailbox" vs "mail box" handled by phrase join below
  return 0
}

/** 0..1 similarity of two phrases (token-set with typo tolerance) */
export function phraseScore(guess: string[], target: string[]): number {
  if (!guess.length || !target.length) return 0
  const gj = guess.join(''), tj = target.join('')
  if (gj === tj) return 1
  const dj = levenshtein(gj, tj, 2)
  if (dj <= budget(Math.min(gj.length, tj.length))) return 1 - 0.1 * dj
  // every target word must be matched by some guess word (order-free)
  let sum = 0
  for (const t of target) {
    let best = 0
    for (const g of guess) best = Math.max(best, wordMatch(g, t))
    if (best === 0) return 0
    sum += best
  }
  const extra = Math.max(0, guess.length - target.length)
  return (sum / target.length) * (extra ? 0.85 : 1)
}

export interface GuessCandidate {
  id: string
  score: number
  /** the name or alias that matched best */
  matched: string
}

/** Rank catalog entries for a free-text guess. Highest score first, score >= minScore. */
export function resolveGuess(guess: string, list: readonly MaterialInfo[] = CATALOG, minScore = 0.6): GuessCandidate[] {
  const g = normalizeGuess(guess)
  const out: GuessCandidate[] = []
  for (const m of list) {
    let best = 0
    let matched = ''
    for (const phrase of [m.name, m.id.replace(/-/g, ' '), ...m.aliases]) {
      const s = phraseScore(g, normalizeGuess(phrase))
      if (s > best) { best = s; matched = phrase }
    }
    if (best >= minScore) out.push({ id: m.id, score: best, matched })
  }
  return out.sort((a, b) => b.score - a.score)
}

export interface GuessResult {
  correct: boolean
  score: number
  matched: string | null
  /** best catalog match for the guess, if any (may be a different material) */
  best: GuessCandidate | null
}

/** Is this guess an acceptable name for target? Fuzzy, alias-aware. */
export function matchGuess(guess: string, targetId: string, list: readonly MaterialInfo[] = CATALOG): GuessResult {
  const ranked = resolveGuess(guess, list, 0.6)
  const hit = ranked.find((c) => c.id === targetId)
  const best = ranked[0] ?? null
  // a shared alias ("pavement") counts for the target even if another entry scores the same
  const correct = !!hit && hit.score >= 0.8 && (!best || hit.score >= best.score - 1e-9)
  return { correct, score: hit?.score ?? 0, matched: hit?.matched ?? null, best }
}
