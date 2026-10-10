// Full-text search over the records (GDD §5.9): tokeniser, inverted index, 1–2 word AND queries,
// oldest first, at most 5 shown plus the total count.
import { DOCS, type Doc } from '../data/docs'

const STOP = new Set('THE A AN OF TO AND IN ON AT BY FOR IS WAS IT I SHE HE HER HIS NO NOT WITH AS FROM THAT THIS BE ARE HAD HAVE BUT OR SO WE YOU'.split(' '))
const SPLIT = /[\s,;:()!?—]+/

function normalise(s: string): string {
  return s.toUpperCase().replace(/[‘’`´]/g, "'").replace(/["“”]/g, '').replace(/\[\[[^\]]*\]\]/g, ' ')
}

/** Canonical form of one raw token: trailing 'S and plural S stripped, trailing . ' - / trimmed. */
export function stem(t: string): string {
  let s = t.replace(/^[.'\-/]+|[.'\-/]+$/g, '')
  if (s.endsWith("'S")) s = s.slice(0, -2)
  if (s.length > 3 && s.endsWith('S') && !s.endsWith('SS') && /[A-Z]S$/.test(s)) s = s.slice(0, -1)
  return s
}

/** Query tokens (no part splitting). */
export function queryTokens(q: string): string[] {
  return normalise(q).split(SPLIT).map(stem).filter((t) => t.length > 0)
}

/** Index tokens of a text: each token, plus every part split on . - / ' */
function indexTokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of normalise(text).split(SPLIT)) {
    if (!raw) continue
    const t = stem(raw)
    if (t) out.add(t)
    if (/[.\-/']/.test(raw)) for (const p of raw.split(/[.\-/']+/)) { const s = stem(p); if (s) out.add(s) }
  }
  return out
}

export function docText(d: Doc): string {
  return [d.id, d.type, d.headline, ...d.body, ...d.margin.map((m) => m.text)].join(' ')
}

const index = new Map<string, Set<string>>()
const byId = new Map<string, Doc>()
for (const d of DOCS) {
  byId.set(d.id, d)
  for (const t of indexTokens(docText(d))) {
    let s = index.get(t)
    if (!s) index.set(t, (s = new Set()))
    s.add(d.id)
  }
}
const order = [...DOCS].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((d) => d.id)

export type SearchStatus = 'ok' | 'none' | 'everything' | 'tooMany' | 'empty' | 'help' | 'close'
export interface SearchResult { status: SearchStatus; q: string; tokens: string[]; count: number; ids: string[]; shown: string[] }

export function getDoc(id: string): Doc | undefined { return byId.get(id) }

export function search(qRaw: string): SearchResult {
  const q = qRaw.trim().replace(/\s+/g, ' ').toUpperCase()
  const base = { q, tokens: [] as string[], count: 0, ids: [] as string[], shown: [] as string[] }
  if (!q) return { ...base, status: 'empty' }
  if (q === 'HELP') return { ...base, status: 'help' }
  if (/^CLOSE\s+03-0417$/.test(q)) return { ...base, status: 'close' }
  const tokens = queryTokens(q)
  if (tokens.length > 2) return { ...base, tokens, status: 'tooMany' }
  if (tokens.length === 0) return { ...base, status: 'empty' }
  let ids: string[] | null = null
  for (const t of tokens) {
    const set = index.get(t)
    if (STOP.has(t) || (set && set.size > 25)) return { ...base, tokens, status: 'everything' }
    const list = set ? order.filter((id) => set.has(id)) : []
    ids = ids ? ids.filter((id) => list.includes(id)) : list
  }
  const all = ids ?? []
  return { q, tokens, status: all.length ? 'ok' : 'none', count: all.length, ids: all, shown: all.slice(0, 5) }
}

export const ALL_DOC_IDS = order
