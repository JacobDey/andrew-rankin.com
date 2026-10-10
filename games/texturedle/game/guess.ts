// Guess matching and the five-tile feedback (texturedle.md §3.3).

import { ATLAS, atlasEntry, normalizeGuess, type AtlasEntry, type Family, type Habitat } from './atlas'

export type TileState = 'hit' | 'near' | 'miss'
export interface Tile { key: 'family' | 'habitat' | 'hardness' | 'grain' | 'wear'; state: TileState; dir?: 'up' | 'down'; label: string }

const FAMILY_NEAR: Array<[Family, Family]> = [['metal', 'stone'], ['textile', 'animal'], ['wood', 'paper'], ['wood', 'plant'], ['polymer', 'textile']]
const HABITAT_NEAR: Array<[Habitat, Habitat]> = [
  ['kitchen', 'home'], ['wardrobe', 'home'], ['home', 'workshop'], ['home', 'play'], ['workshop', 'street'],
  ['street', 'garden'], ['garden', 'wild'], ['kitchen', 'garden'], ['play', 'street'],
]
const pairNear = <T>(list: Array<[T, T]>, a: T, b: T) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

const index = new Map<string, string>()
for (const e of ATLAS) for (const n of [e.name, e.id.replace(/-/g, ' '), ...e.aliases]) {
  const k = normalizeGuess(n)
  if (!index.has(k)) index.set(k, e.id)
}

/** Exact match on the name or an alias (with a forgiving plural). */
export function resolveGuess(text: string): AtlasEntry | null {
  const k = normalizeGuess(text)
  if (!k) return null
  const id = index.get(k) ?? (k.endsWith('s') ? index.get(k.slice(0, -1)) : undefined) ?? (k.endsWith('es') ? index.get(k.slice(0, -2)) : undefined)
  return id ? atlasEntry(id) ?? null : null
}

function damerau(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d: number[][] = []
  for (let i = 0; i <= a.length; i++) { d.push(new Array(b.length + 1).fill(0)); d[i][0] = i }
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1)
      d[i][j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}

/** "Did you mean …?" (Damerau-Levenshtein ≤ 2). */
export function suggest(text: string): AtlasEntry | null {
  const k = normalizeGuess(text)
  if (k.length < 3) return null
  let best: string | null = null
  let bd = 3
  for (const [n, id] of index) {
    const d = damerau(k, n, 2)
    if (d < bd) { bd = d; best = id }
  }
  return best && bd <= 2 ? atlasEntry(best) ?? null : null
}

/** Autocomplete: prefix and word matches, entries first then aliases. */
export function complete(text: string, limit = 8): AtlasEntry[] {
  const k = normalizeGuess(text)
  if (!k) return []
  const scored: Array<[number, AtlasEntry]> = []
  for (const e of ATLAS) {
    let s = 0
    const nm = normalizeGuess(e.name)
    if (nm.startsWith(k)) s = 3
    else if (nm.split(' ').some((w) => w.startsWith(k))) s = 2
    else if (e.aliases.some((a) => normalizeGuess(a).startsWith(k))) s = 1.5
    else if (e.aliases.some((a) => normalizeGuess(a).split(' ').some((w) => w.startsWith(k)))) s = 1
    if (s > 0) scored.push([s, e])
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))
  return scored.slice(0, limit).map((x) => x[1])
}

function ordinal(key: Tile['key'], g: number, a: number, names: string[]): Tile {
  if (g === a) return { key, state: 'hit', label: names[g] }
  return { key, state: Math.abs(g - a) === 1 ? 'near' : 'miss', dir: a > g ? 'up' : 'down', label: names[g] }
}

export function feedback(guess: AtlasEntry, answer: AtlasEntry, names: { family: string; habitat: string; hd: string[]; gr: string[]; wr: string[] }): Tile[] {
  return [
    { key: 'family', state: guess.family === answer.family ? 'hit' : pairNear(FAMILY_NEAR, guess.family, answer.family) ? 'near' : 'miss', label: names.family },
    { key: 'habitat', state: guess.habitat === answer.habitat ? 'hit' : pairNear(HABITAT_NEAR, guess.habitat, answer.habitat) ? 'near' : 'miss', label: names.habitat },
    ordinal('hardness', guess.hardness, answer.hardness, names.hd),
    ordinal('grain', guess.grain, answer.grain, names.gr),
    ordinal('wear', guess.wear, answer.wear, names.wr),
  ]
}

/** Would `cand` have produced exactly these tiles against the guesses so far? (easy-mode narrowing) */
export function consistent(cand: AtlasEntry, history: Array<{ guess: AtlasEntry; tiles: Tile[] }>): boolean {
  const n = { family: '', habitat: '', hd: [], gr: [], wr: [] } as unknown as Parameters<typeof feedback>[2]
  const blank = ['', '', '', '', '', '']
  n.hd = blank; n.gr = blank; n.wr = blank
  for (const h of history) {
    const f = feedback(h.guess, cand, n)
    for (let i = 0; i < 5; i++) if (f[i].state !== h.tiles[i].state || f[i].dir !== h.tiles[i].dir) return false
  }
  return true
}

export function tileGlyph(t: Tile): string {
  const g = t.state === 'hit' ? '●' : t.state === 'near' ? '◐' : '○'
  return g + (t.dir === 'up' ? '↑' : t.dir === 'down' ? '↓' : '')
}
