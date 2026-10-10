// games/plates/story/returnModel.ts — the Return: persons confirmed in pairs, findings singly with a
// valid citation, the Sector as a set of four (Where only by reading the pane), sealing (story §8).
import type { ReturnModel, ReturnStatus, PersonAnswer, FindingId, PlateId } from '../contracts'
import { PERSONS, FINDINGS, SECTOR_TRUTH, personCorrect, findingCorrect } from './truth'

export interface StampEvent { kind: 'persons' | 'finding' | 'sector' | 'found'; ids: string[] }
export interface PlatesReturn extends ReturnModel {
  reveal(fig: number): void
  person(fig: number): PersonAnswer
  personConfirmed(fig: number): boolean
  finding(f: FindingId): { verdict: 'stands' | 'withdraw' | null; plate: PlateId | null; confirmed: boolean }
  sector(): { when: string | null; who: string | null; why: string | null; found: boolean; accounted: boolean }
  onStamp: ((e: StampEvent) => void) | null
  onChange: (() => void) | null
}

export function createReturnModel(): PlatesReturn {
  const revealed = new Set<number>()
  const persons = new Map<number, PersonAnswer & { at: number; ok: boolean }>()
  const findings = new Map<FindingId, { verdict: 'stands' | 'withdraw' | null; plate: PlateId | null; ok: boolean }>()
  const sector = { when: null as string | null, who: null as string | null, why: null as string | null, found: false, accounted: false }
  let editClock = 0, sealed = false, ending: ReturnStatus['ending'] = null
  const stamp = (e: StampEvent) => { m.onStamp?.(e) }
  const changed = () => m.onChange?.()

  function checkPairs(): void {
    const pending = [...persons.entries()].filter(([fig, a]) => !a.ok && personCorrect(fig, a)).sort((a, b) => a[1].at - b[1].at)
    while (pending.length >= 2) {
      const pair = pending.splice(0, 2)
      for (const [, a] of pair) a.ok = true
      stamp({ kind: 'persons', ids: pair.map(([fig]) => String(fig)) })
    }
  }
  function checkSector(): void {
    if (sector.accounted) return
    if (sector.found && sector.when === SECTOR_TRUTH.when && sector.who === SECTOR_TRUTH.who && sector.why === SECTOR_TRUTH.why) {
      sector.accounted = true
      stamp({ kind: 'sector', ids: ['when', 'where', 'who', 'why'] })
    }
  }
  const m: PlatesReturn = {
    onStamp: null, onChange: null,
    reveal(fig) { if (!revealed.has(fig)) { revealed.add(fig); changed() } },
    visibleFigures() { return [...revealed].sort((a, b) => a - b) },
    person(fig) { const a = persons.get(fig); return { name: a?.name ?? null, fate: a?.fate ?? null, agent: a?.agent ?? null } },
    personConfirmed(fig) { return !!persons.get(fig)?.ok },
    setPerson(fig, a) {
      const cur = persons.get(fig)
      if (cur?.ok) return
      persons.set(fig, { ...a, at: ++editClock, ok: false })
      checkPairs(); changed()
    },
    finding(f) { const x = findings.get(f); return { verdict: x?.verdict ?? null, plate: x?.plate ?? null, confirmed: !!x?.ok } },
    setFinding(f, verdict, plate) {
      const cur = findings.get(f)
      if (cur?.ok) return
      const ok = findingCorrect(f, verdict, plate)
      findings.set(f, { verdict, plate, ok })
      if (ok) stamp({ kind: 'finding', ids: [f] })
      changed()
    },
    sector() { return { ...sector } },
    setSector(q, v) { if (sector.accounted) return; sector[q] = v; checkSector(); changed() },
    markFound() { if (!sector.found) { sector.found = true; stamp({ kind: 'found', ids: ['where'] }); checkSector(); changed() } },
    status() {
      return {
        persons: [...persons.values()].filter((a) => a.ok).length,
        findings: [...findings.values()].filter((f) => f.ok).length,
        sector: sector.accounted, found: sector.found, sealed, ending,
      }
    },
    solveAll() {
      for (const p of PERSONS) { revealed.add(p.fig); if (!persons.get(p.fig)?.ok) persons.set(p.fig, { name: p.name, fate: p.fate, agent: p.agent, at: ++editClock, ok: false }) }
      checkPairs()
      for (const f of FINDINGS) m.setFinding(f.id, f.verdict, f.plates[0])
      sector.when = SECTOR_TRUTH.when; sector.who = SECTOR_TRUTH.who; sector.why = SECTOR_TRUTH.why
      checkSector(); changed()
    },
    seal(named) {
      sealed = true
      ending = sector.accounted ? (named ? 'A' : 'B') : 'C'
      changed()
      return m.status()
    },
    serialize() {
      return { v: 1, revealed: [...revealed], persons: [...persons.entries()], findings: [...findings.entries()], sector: { ...sector }, editClock, sealed, ending }
    },
    load(d) {
      if (!d || typeof d !== 'object') return
      const o = d as { revealed?: number[]; persons?: [number, PersonAnswer & { at: number; ok: boolean }][]; findings?: [FindingId, { verdict: 'stands' | 'withdraw' | null; plate: PlateId | null; ok: boolean }][]; sector?: typeof sector; editClock?: number; sealed?: boolean; ending?: ReturnStatus['ending'] }
      revealed.clear(); for (const f of o.revealed ?? []) revealed.add(f)
      persons.clear(); for (const [k, v] of o.persons ?? []) persons.set(k, v)
      findings.clear(); for (const [k, v] of o.findings ?? []) findings.set(k, v)
      if (o.sector) Object.assign(sector, o.sector)
      editClock = o.editClock ?? 0; sealed = !!o.sealed; ending = o.ending ?? null
      changed()
    },
  }
  return m
}
