// O.'s masking-tape notes (darkroom.md §6.4): appear on first focus, tap to peel.
import type { DarkroomBus } from '../events'
import { flags, localStore, type Platform } from '../glue/platform'
import type { StationId, View } from '../types'
import { h } from './dom'

interface NoteDef { id: string; text: string; anchor: string | [number, number, number]; dy?: number; dx?: number }
const STATION_NOTES: Record<StationId, NoteDef[]> = {
  prep: [{ id: 'prep', text: 'Invert first. Flip for contact.', anchor: 'prep', dy: -60 }],
  enlarger: [{ id: 'enlarger', text: 'Test strip first. Always.', anchor: 'enlargerHead', dy: -30 }, { id: 'easel', text: 'Your hand dodges best. Keep moving.', anchor: 'easel', dy: 40 }],
  trays: [{ id: 'dev', text: '60–90 s. Wait for the highlights.', anchor: [2.66, 0.2, 0.01] }, { id: 'stop', text: '10 s. Vinegar smell = fine.', anchor: [3.10, 0.2, 0.01] }, { id: 'fix', text: '30 s in fix, then lights.', anchor: [3.54, 0.2, 0.01] }],
  sink: [{ id: 'wash', text: '2 min. Fixer left in goes yellow.', anchor: [4.40, 0.2, 0.01] }, { id: 'peroxide', text: 'One drop. Watch.', anchor: 'peroxide', dy: -40 }],
  iron: [{ id: 'bottleB', text: "Ferri-CYANIDE. Not cyanide. It's fine.", anchor: 'bottleB', dy: -50 }, { id: 'beaker', text: 'Equal parts. Like pond water.', anchor: 'beaker', dy: 30 }],
  window: [{ id: 'uvbox', text: 'Wait for bronze in the shadows.', anchor: 'uvbox', dy: -60 }],
}

export interface Notes { firstRun(): void; station(id: StationId): void; update(dark?: boolean): void; show(n: NoteDef): void }

export function createNotes(stage: HTMLElement, view: View, _platform: Platform, bus: DarkroomBus): Notes {
  const layer = h('div', { className: 'dr-notes' })
  stage.appendChild(layer)
  const seen = new Set<string>(localStore.get<string[]>('notes', []))
  const live = new Map<string, { def: NoteDef; el: HTMLElement }>()
  const quiet = flags().embed === 'poster'
  const save = () => localStore.set('notes', [...seen])
  const peel = (id: string) => { const n = live.get(id); if (!n) return; n.el.classList.add('is-peeled'); setTimeout(() => n.el.remove(), 260); live.delete(id); seen.add(id); save() }
  const notes: Notes = {
    show(def) {
      if (quiet || seen.has(def.id) || live.has(def.id)) return
      const el = h('button', { className: 'dr-note', type: 'button', textContent: def.text, 'aria-label': `Note from O.: ${def.text} (tap to peel)` })
      el.style.setProperty('--rot', `${((def.id.length * 37) % 9) - 4}deg`)
      el.addEventListener('click', (e) => { e.stopPropagation(); peel(def.id) })
      layer.appendChild(el)
      live.set(def.id, { def, el })
    },
    firstRun() {
      notes.show({ id: 'rock', text: 'rock me', anchor: 'trayRim:dev', dy: 18, dx: -90 })
      const pull = h('div', { className: 'dr-pull', textContent: 'pull' })
      stage.querySelector('.dr-switchplate')?.appendChild(pull)
      const off = bus.on('chain', () => { pull.remove(); off() })
      bus.on('light', (e) => {
        if (e.id === 'room' && e.on) notes.show({ id: 'line', text: 'Everything goes on the line. Especially the bad ones.', anchor: 'line', dy: 40 })
      })
      bus.on('fog', () => notes.show({ id: 'fog', text: 'you too, huh.', anchor: [2.66, 0.32, 0.01] }))
    },
    station(id) { for (const d of STATION_NOTES[id]) notes.show(d) },
    update(dark = false) {
      layer.classList.toggle('is-dark', dark)
      for (const { def, el } of live.values()) {
        const p = view.project(def.anchor)
        el.hidden = !p.visible
        if (p.visible) el.style.transform = `translate(${Math.round(p.x + (def.dx ?? 0))}px, ${Math.round(p.y + (def.dy ?? 0))}px) translate(-50%, -50%) rotate(var(--rot))`
      }
    },
  }
  bus.on('discover', () => { /* the notebook is the logbook's job */ })
  return notes
}
