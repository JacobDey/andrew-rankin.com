// O.'s postcards (studio.md §3.2): P1–P8 predicates on ShotRecord ground truth, the mailbox panel, replies
// (✓, ★ or one grease note naming the worst miss), packages, the mail-truck sequence and accidental completion.
import { Audio, uiSound } from '@shared/audio'
import { openDialog } from '@shared/ui'
import type { Engine } from '../core/engine'
import type { Studio } from '../core/boot'
import type { PrintMeta, ShotRecord, SubjectMeasure } from '../core/contracts'
import type { PrintRecord } from '../darkroom/darkroom'
import type { Hall } from './hall'
import { POSTCARD_IDS } from '../core/store'
import { POSTCARD_TEXT, UNLOCKS, REPLIES } from './copy'
import { PART_NAMES } from '../camera/spec'

export type Mark = 'miss' | 'check' | 'star'
export interface Verdict { pass: boolean; star: boolean; note: string }
export interface Postcards {
  evaluate(id: string, rec: ShotRecord | null, o?: { pinned?: boolean; rho?: number }): Verdict
  mail(printId: string, id: string, o?: { instant?: boolean }): Promise<Mark>
  openPanel(): Promise<void>
  states(): Record<string, string>
  unlockAll(): void
  open(): string[]
}

const PROPS = /^(ball\d*|bucket|can|crate)$/

function sub(r: ShotRecord, id: string): SubjectMeasure | undefined {
  return r.subjects?.find((s) => s.id === id)
}
function ex(s: SubjectMeasure | undefined, k: string): number {
  return s?.extra?.[k] ?? 0
}

/** Quality ★ rule for the postcard's target subject (§5.13). */
function quality(r: ShotRecord, s: SubjectMeasure | undefined, rho: number, skipBlur = false): boolean {
  if (!s) return false
  const over = Math.abs(r.exposure.overStops + 1.2 * Math.log2(Math.max(0.1, rho)))
  return (skipBlur || s.blurPx <= 3) && s.defocusPx <= 3 && over <= 1.3 && s.coverage >= 0.04 && s.inFrame >= 0.9
}

export function evaluateCard(id: string, r: ShotRecord | null, o: { pinned?: boolean; rho?: number } = {}): Verdict {
  const rho = o.rho ?? 1
  if (id === 'P1') return { pass: !!o.pinned, star: false, note: o.pinned ? '' : 'Fridge, please.' }
  if (!r || !r.subjects) return { pass: false, star: false, note: 'Nothing on it.' }
  switch (id) {
    case 'P2': {
      const d = sub(r, 'dot')
      const cov = ex(d, 'pathCoverage')
      const vis = d?.visibility ?? 1
      if (cov < 0.5) return { pass: false, star: false, note: 'Show me more of the yard.' }
      if (vis >= 0.12) return { pass: false, star: false, note: 'Dot is still here.' }
      return { pass: true, star: r.exposure && Math.abs(r.exposure.overStops) <= 1.3, note: '' }
    }
    case 'P3': {
      const s = sub(r, 'sprinkler')
      const b = ex(s, 'dropBlurPx')
      const c = ex(s, 'sprayCoverage')
      if (c < 0.05) return { pass: false, star: false, note: 'Where is the water?' }
      if (b > 3) return { pass: false, star: false, note: `water still moving · ${Math.round(b)} px` }
      return { pass: true, star: quality(r, s, rho, true), note: '' }
    }
    case 'P4': {
      const s = sub(r, 'sprinkler')
      const b = ex(s, 'dropBlurPx')
      if (ex(s, 'sprayCoverage') < 0.02) return { pass: false, star: false, note: 'Where is the water?' }
      if (b < 40) return { pass: false, star: false, note: `water too sharp · ${Math.round(b)} px` }
      if (r.shakePx > 1.5) return { pass: false, star: false, note: `the camera moved · ${r.shakePx.toFixed(1)} px` }
      return { pass: true, star: quality(r, s, rho, true), note: '' }
    }
    case 'P5': {
      const s = sub(r, 'lantern')
      const t = ex(s, 'trailPx')
      if (r.sunElevDeg >= 2) return { pass: false, star: false, note: 'After dark, please.' }
      if (t < 1500) return { pass: false, star: false, note: `a short line · ${Math.round(t)} px` }
      return { pass: true, star: true, note: '' }
    }
    case 'P6': {
      let best: SubjectMeasure | undefined
      for (const s of r.subjects) {
        if (!PROPS.test(s.id)) continue
        const vy = typeof s.stateMid.vy === 'number' ? s.stateMid.vy : 0
        if (vy <= -2 && s.blurPx <= 4 && s.inFrame >= 0.9) return { pass: true, star: quality(r, s, rho), note: '' }
        if (!best || vy < ((best.stateMid.vy as number) ?? 0)) best = s
      }
      if (!best || ((best.stateMid.vy as number) ?? 0) > -2) return { pass: false, star: false, note: 'Nothing was falling.' }
      return { pass: false, star: false, note: best.blurPx > 4 ? `a blur · ${Math.round(best.blurPx)} px` : 'half out of frame' }
    }
    case 'P7': {
      const s = sub(r, 'mailbox')
      if (!s || s.coverage < 0.6) return { pass: false, star: false, note: `closer · ${Math.round((s?.coverage ?? 0) * 100)} %` }
      if (s.defocusPx > 3) return { pass: false, star: false, note: `focus ${r.focusM.toFixed(1)} m, box ${s.distanceM.toFixed(1)} m` }
      return { pass: true, star: quality(r, s, rho), note: '' }
    }
    case 'P8': {
      const s = sub(r, 'swing')
      const ang = s ? (s.stateMid.angleAbs as number) ?? 0 : 0
      const om = s ? (s.stateMid.omegaAbs as number) ?? 9 : 9
      if (!s || s.inFrame < 0.5) return { pass: false, star: false, note: 'Where is the swing?' }
      if (ang < 0.3) return { pass: false, star: false, note: 'Swing it higher.' }
      if (om > 0.1 || s.blurPx > 3) return { pass: false, star: false, note: s.defocusPx > 3 ? `focus ${r.focusM.toFixed(1)} m, swing ${s.distanceM.toFixed(1)} m` : `not the top · ${s.blurPx.toFixed(0)} px` }
      return { pass: true, star: quality(r, s, rho), note: '' }
    }
  }
  return { pass: false, star: false, note: '' }
}

export function installPostcards(e: Engine, st: Studio, hall: Hall): Postcards {
  const { store } = st
  const house = store.house
  const pcs = house.postcards
  for (const id of POSTCARD_IDS) if (!pcs[id]) pcs[id] = { state: id === 'P1' ? 'open' : 'unissued', misses: 0 }
  const metaOf = async (id: string) => (await store.get<PrintRecord>('print:' + id))?.meta ?? null
  const rhoOf = (m: PrintMeta | null) => (m as (PrintMeta & { rho?: number }) | null)?.rho ?? 1

  const unlock = (id: string) => {
    const u = UNLOCKS[id]
    if (!u) return
    for (const p of u.parts) if (!house.owned.includes(p)) {
      house.owned.push(p)
      e.bus.emit('part:unlocked', { partId: p })
    }
    if (u.parts.includes('bucket6')) st.yard.props.addCrateAndBalls()
    store.saveHouse({ owned: house.owned })
    if (u.parts.length) st.shell.toast(`A package: ${u.label}.`)
  }
  const issueNext = (delayMs: number) => {
    const open = POSTCARD_IDS.filter((p) => pcs[p].state === 'open')
    if (open.length >= 2) return
    const next = POSTCARD_IDS.find((p) => pcs[p].state === 'unissued')
    if (!next) return
    const go = () => {
      if (pcs[next].state !== 'unissued') return
      pcs[next].state = 'open'
      Audio.play('studio.mail-truck', {})
      st.yard.mailbox.setFlag(false)
      st.yard.mailbox.glow.pulse(true)
      store.saveHouse({ postcards: pcs })
      // accidental completion: a print that already fits arrives pre-answered
      void (async () => {
        for (const pid of house.prints) {
          const m = await metaOf(pid)
          if (!m) continue
          const v = evaluateCard(next, m.record, { rho: rhoOf(m), pinned: house.fridge.includes(pid) })
          if (v.pass) {
            pcs[next] = { state: v.star ? 'star' : 'check', misses: 0, printId: pid }
            hall.marks.set(pid, `"${POSTCARD_TEXT[next].text}" ${v.star ? '★' : '✓'}`)
            store.saveHouse({ postcards: pcs })
            st.shell.toast(REPLIES.preAnswered)
            unlock(next)
            issueNext(delayMs)
            return
          }
        }
      })()
    }
    if (delayMs <= 0) go()
    else window.setTimeout(go, delayMs)
  }

  const answer = (id: string, printId: string, v: Verdict): Mark => {
    const mark: Mark = v.pass ? (v.star ? 'star' : 'check') : 'miss'
    if (v.pass) {
      pcs[id] = { state: mark === 'star' ? 'star' : 'check', misses: pcs[id].misses, printId }
      hall.marks.set(printId, `"${POSTCARD_TEXT[id].text}" ${mark === 'star' ? '★' : '✓'}`)
      if (mark === 'star') uiSound('bell')
      else uiSound('develop')
      unlock(id)
      issueNext(e.quality.transitions ? 8000 : 0)
      if (id === 'P8') st.shell.toast(REPLIES.final)
    } else {
      pcs[id].misses++
      if (pcs[id].misses >= 2) st.hud.note(POSTCARD_TEXT[id].hint, 9000)
    }
    store.saveHouse({ postcards: pcs })
    e.bus.emit('postcard:answered', { id, mark })
    return mark
  }

  // P1: any print pinned to the fridge
  hall.onPinned = (pid) => {
    if (pcs.P1.state === 'open') {
      const v = evaluateCard('P1', null, { pinned: true })
      answer('P1', pid, v)
    }
  }
  // accidental completion on open cards: a small grease ✓ in the corner
  const prevOnPrint = null
  void prevOnPrint

  const api: Postcards = {
    evaluate: (id, rec, o) => evaluateCard(id, rec, o),
    async mail(printId, id, o = {}) {
      const m = await metaOf(printId)
      if (pcs[id]?.state === 'unissued') pcs[id].state = 'open'
      const v = evaluateCard(id, m?.record ?? null, { rho: rhoOf(m), pinned: house.fridge.includes(printId) })
      st.yard.mailbox.setFlag(true)
      Audio.play('ui.thunk', {})
      if (!o.instant && e.quality.transitions) await new Promise((res) => setTimeout(res, 6000))
      st.yard.mailbox.setFlag(false)
      const mark = answer(id, printId, v)
      if (!o.instant) {
        const t = POSTCARD_TEXT[id]
        openDialog({
          edge: 'POSTCARD · ▸06',
          title: "O.'s reply",
          body: `<div class="st-postcard" style="width:auto"><small>${id}</small>${t.text}<div class="st-mark">${mark === 'star' ? '★' : mark === 'check' ? '✓' : ''}</div></div>${mark === 'miss' ? `<p class="st-grease" style="margin-top:12px">${v.note}</p>` : ''}`,
          actions: [{ id: 'ok', label: 'Back to the yard', kind: 'primary' }],
        })
      }
      return mark
    },
    async openPanel() {
      st.yard.mailbox.glow.pulse(false)
      Audio.play('studio.screen-door', { })
      const body = document.createElement('div')
      const cards = document.createElement('div')
      cards.className = 'st-cards'
      let selCard: string | null = null
      let selPrint: string | null = null
      const open = POSTCARD_IDS.filter((p) => pcs[p].state === 'open')
      const done = POSTCARD_IDS.filter((p) => pcs[p].state === 'check' || pcs[p].state === 'star')
      for (const id of [...open, ...done]) {
        const c = document.createElement('button')
        c.type = 'button'
        c.className = 'st-postcard'
        const s = pcs[id].state
        c.innerHTML = `<small>${id} · ${s === 'open' ? 'OPEN' : 'ANSWERED'}</small>${POSTCARD_TEXT[id].text}<span class="st-mark">${s === 'star' ? '★' : s === 'check' ? '✓' : ''}</span>`
        c.disabled = s !== 'open'
        c.addEventListener('click', () => {
          selCard = id
          for (const x of cards.children) x.setAttribute('aria-pressed', String(x === c))
          sendB.disabled = !(selCard && selPrint)
        })
        cards.appendChild(c)
      }
      body.appendChild(cards)
      const thumbs = document.createElement('div')
      thumbs.className = 'st-thumbs'
      if (!house.prints.length) thumbs.innerHTML = '<p class="st-empty">No prints yet. The darkroom is downstairs.</p>'
      for (const pid of house.prints.slice(0, 24)) {
        const pr = await store.get<PrintRecord>('print:' + pid)
        if (!pr) continue
        const b = document.createElement('button')
        b.type = 'button'
        const im = document.createElement('img')
        im.src = URL.createObjectURL(pr.image)
        im.alt = 'Print'
        b.appendChild(im)
        b.addEventListener('click', () => {
          selPrint = pid
          for (const x of thumbs.children) x.setAttribute('aria-pressed', String(x === b))
          sendB.disabled = !(selCard && selPrint)
        })
        thumbs.appendChild(b)
      }
      body.appendChild(thumbs)
      const sendB = document.createElement('button')
      void sendB
      const dlg = openDialog({
        edge: 'MAILBOX · 16',
        title: open.length ? 'Postcards from O.' : 'The mailbox is empty',
        body,
        wide: true,
        actions: [
          {
            id: 'send', label: 'Raise the flag', kind: 'primary',
            onSelect: () => {
              if (!selCard || !selPrint) {
                st.shell.toast('Pick a card and a print.')
                return false
              }
              void api.mail(selPrint, selCard)
              return true
            },
          },
          { id: 'close', label: 'Close' },
        ],
      })
      void dlg
    },
    states() {
      const out: Record<string, string> = {}
      for (const id of POSTCARD_IDS) out[id] = pcs[id].state
      return out
    },
    unlockAll() {
      for (const p of Object.keys(PART_NAMES)) if (!house.owned.includes(p)) house.owned.push(p)
      for (const id of POSTCARD_IDS) if (pcs[id].state === 'unissued') pcs[id].state = 'open'
      st.yard.props.addCrateAndBalls()
      store.saveHouse({ owned: house.owned, postcards: pcs })
    },
    open: () => POSTCARD_IDS.filter((p) => pcs[p].state === 'open'),
  }
  st.yard.onMailbox = () => void api.openPanel()
  if (POSTCARD_IDS.some((p) => pcs[p].state === 'open') && pcs.P1.state !== 'open') st.yard.mailbox.glow.pulse(true)
  if (house.owned.includes('bucket6')) st.yard.props.addCrateAndBalls()
  return api
}
