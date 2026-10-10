// The DOM HUD over the stage (studio.md §7.2): time chip + scrubber, pocket + frame counter, camera button,
// cable-release bulb, tape-note slot, overview room tags, the transition fade, and a station tray.
import type { RoomId } from '../core/contracts'

export interface Hud {
  el: HTMLElement
  fade: HTMLElement
  tray: HTMLElement
  note(text: string, ms?: number): void
  setTime(h: number): void
  onScrub(cb: (h: number) => void): void
  setFrames(left: number | null, total: number | null): void
  setPocket(n: number): void
  setCableRelease(visible: boolean): void
  cameraButton: HTMLButtonElement
  bulb: HTMLButtonElement
  tags: Record<'yard' | 'workshop' | 'hall' | 'darkroom', HTMLButtonElement>
  houseButton: HTMLButtonElement
  setRoom(r: RoomId): void
  setHidden(on: boolean): void
}

export function fmtTime(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60 + 1e-6)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (text !== undefined) e.textContent = text
  parent?.appendChild(e)
  return e
}

export function createHud(stage: HTMLElement): Hud {
  const root = el('div', 'st-hud', stage)
  const fade = el('div', 'st-fade', stage)
  // time chip + scrubber
  const chipWrap = el('div', 'st-chipwrap', root)
  const chip = el('button', 'st-chip', chipWrap)
  chip.type = 'button'
  chip.setAttribute('aria-label', 'Time of day')
  const scrub = el('input', 'st-scrub ar-range', chipWrap) as HTMLInputElement
  scrub.type = 'range'
  scrub.min = '4.5'
  scrub.max = '23.5'
  scrub.step = '0.0167'
  scrub.setAttribute('aria-label', 'Time of day')
  scrub.hidden = true
  chip.addEventListener('click', () => {
    scrub.hidden = !scrub.hidden
  })
  let scrubCb: (h: number) => void = () => {}
  scrub.addEventListener('input', () => scrubCb(Number(scrub.value)))
  // pocket + frames
  const pocketWrap = el('div', 'st-pocketwrap', root)
  const pocket = el('div', 'st-pocket', pocketWrap)
  pocket.setAttribute('aria-label', 'Pocket')
  const frames = el('div', 'st-frames', pocketWrap)
  // camera button
  const cameraButton = el('button', 'st-cambtn', root)
  cameraButton.type = 'button'
  cameraButton.setAttribute('aria-label', 'Raise the camera (C)')
  cameraButton.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  // cable release bulb
  const bulb = el('button', 'st-bulb', root)
  bulb.type = 'button'
  bulb.setAttribute('aria-label', 'Cable release (B; hold for Bulb, long-press for the self-timer)')
  bulb.innerHTML = '<span class="st-bulb-dot"></span><span class="st-bulb-label">release</span>'
  bulb.hidden = true
  // tape note
  const tape = el('div', 'st-tape', root)
  tape.hidden = true
  // station tray (rooms put their controls here)
  const tray = el('div', 'st-tray', root)
  // overview tags
  const mkTag = (label: string) => {
    const b = el('button', 'st-tag', root, label)
    b.type = 'button'
    return b
  }
  const tags = { yard: mkTag('▸ YARD'), workshop: mkTag('▸ WORKSHOP'), hall: mkTag('▸ KITCHEN'), darkroom: mkTag('▸ DARKROOM') }
  const houseButton = el('button', 'st-housebtn', root)
  houseButton.type = 'button'
  houseButton.setAttribute('aria-label', 'House overview (Tab)')
  houseButton.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 11l9-7 9 7M6 9.5V20h12V9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>House</span>'

  let noteTimer = 0
  return {
    el: root, fade, tray, cameraButton, bulb, tags, houseButton,
    note(text, ms = 6000) {
      tape.textContent = text
      tape.hidden = false
      clearTimeout(noteTimer)
      if (ms > 0) noteTimer = window.setTimeout(() => (tape.hidden = true), ms)
    },
    setTime(h) {
      chip.textContent = fmtTime(h)
      if (document.activeElement !== scrub) scrub.value = String(h)
    },
    onScrub(cb) {
      scrubCb = cb
    },
    setFrames(left, total) {
      frames.textContent = left === null || total === null ? '' : `${left}/${total}`
      frames.hidden = left === null
    },
    setPocket(n) {
      pocket.textContent = n > 0 ? `${n} ${n === 1 ? 'roll' : 'rolls'}` : ''
      pocket.hidden = n === 0
      pocket.classList.toggle('st-pocket--full', n > 0)
    },
    setCableRelease(v) {
      bulb.hidden = !v
    },
    setRoom(r) {
      root.dataset.room = r
      for (const [k, b] of Object.entries(tags)) b.hidden = r !== 'overview' || k === ''
      houseButton.hidden = r === 'overview'
    },
    setHidden(on) {
      root.hidden = on
    },
  }
}

/** Position overview tags from projected anchors (called per frame). */
export function placeTag(b: HTMLElement, x: number, y: number, visible: boolean): void {
  const W = b.parentElement?.clientWidth ?? 1e4
  const half = (b.offsetWidth || 110) / 2 + 6
  x = Math.max(half, Math.min(W - half, x))
  b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`
  b.style.visibility = visible ? 'visible' : 'hidden'
}
