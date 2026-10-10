// The grease-pencil layer on each frame (hub.md §5): the red activation circle, the permanent
// yellow mark and note (drawn once, when the frame first comes into view), and the white progress
// note (§8.5). Everything is aria-hidden SVG and spans, sized in px from the cell (1u = width / 38).

import type { GameInfo } from '@shared/games'
import { circlePath, checkPath, arrowPath, starPath, cropMarksPath, questionPath, underlinePath, drawStroke, prefersReducedMotion } from '@shared/ui'
import { mulberry32, hashString } from '@shared/core'

const SVGNS = 'http://www.w3.org/2000/svg'

export interface FrameMarks {
  readonly el: HTMLElement
  layout(): void
  showCircle(seed: string, animate: boolean): void
  hideCircle(): void
  drawPermanent(animate: boolean): Promise<void>
  setProgress(p: { note: string; at: number } | null): void
  permanentDrawn(): boolean
}

function path(cls: string): SVGPathElement {
  const p = document.createElementNS(SVGNS, 'path')
  p.setAttribute('class', cls)
  return p
}

function revealText(el: HTMLElement, animate: boolean): void {
  el.dataset.shown = ''
  if (!animate || prefersReducedMotion() || typeof el.animate !== 'function') return
  el.animate([{ clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% -5% -20% 0)' }], {
    duration: 520,
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fill: 'none',
  })
}

export function createFrameMarks(article: HTMLElement, info: GameInfo): FrameMarks {
  const el = document.createElement('div')
  el.className = 'hub-marks'
  el.setAttribute('aria-hidden', 'true')
  const svg = document.createElementNS(SVGNS, 'svg')
  const circle = path('hub-circle')
  circle.dataset.off = ''
  const perm = path('hub-perm')
  perm.style.visibility = 'hidden'
  const prog = path('hub-prog')
  svg.append(perm, prog, circle)
  const note = document.createElement('span')
  note.className = 'hub-note'
  note.textContent = info.greaseNote
  const progNote = document.createElement('span')
  progNote.className = 'hub-note hub-note--prog'
  const ring = document.createElement('span')
  ring.className = 'hub-ring'
  el.append(svg, note, progNote, ring)
  article.append(el)

  const rnd = mulberry32(hashString(`note:${info.slug}`))
  const noteRot = -4 + rnd() * 7
  let circleSeed: string = info.slug
  let circleOn = false
  let permDrawn = false
  let progress: { note: string; at: number } | null = null

  const strip = article.querySelector<HTMLElement>('.hub-strip')!
  const title = article.querySelector<HTMLElement>('.hub-title a')!

  function geom(): { u: number; ix: number; iy: number; iw: number; ih: number; dy: number } {
    const w = article.clientWidth
    const u = w / 38
    const dy = parseFloat(getComputedStyle(strip).getPropertyValue('--dy')) || 0
    return { u, ix: u, iy: 5.5 * u + dy, iw: 36 * u, ih: 24 * u, dy }
  }

  function placeNote(n: HTMLElement, x: number, y: number, rot: number, anchor: 'left' | 'right' = 'left'): void {
    n.style.left = `${x}px`
    n.style.top = `${y}px`
    n.style.transformOrigin = anchor === 'left' ? '0 50%' : '100% 50%'
    n.style.transform = `translate(${anchor === 'right' ? '-100%' : '0'}, -50%) rotate(${rot}deg)`
  }

  function layoutCircle(): void {
    const { u, ix, iy, iw, ih } = geom()
    circle.setAttribute('d', circlePath({ x: ix - 0.4 * u, y: iy - 0.6 * u, w: iw + 0.8 * u, h: ih + 1.2 * u }, circleSeed))
    circle.style.strokeWidth = `${Math.max(3, 0.45 * u)}px`
  }

  function layoutPerm(): void {
    const { u, ix, iy, iw, ih } = geom()
    const sw = Math.max(3, 0.42 * u)
    perm.style.strokeWidth = `${sw}px`
    let d = ''
    switch (info.greaseMark) {
      case 'question': {
        const s = 9.5 * u
        d = translatePath(questionPath(s, info.slug), ix - 2.6 * u, iy - 4.2 * u)
        placeNote(note, ix + 12.4 * u, 2.9 * u, noteRot)
        break
      }
      case 'check': {
        const s = (7 * u) / 32
        d = scalePath(checkPath(info.slug), s, ix + iw - 4.6 * u, iy - 4.4 * u)
        placeNote(note, ix + iw - 1.2 * u, iy + 3.4 * u, noteRot, 'right')
        break
      }
      case 'star': {
        const r = 3.6 * u
        d = translatePath(starPath(r, info.slug), ix + iw - r - 0.4 * u, iy - r - 0.8 * u)
        placeNote(note, ix + iw - 1.6 * u, iy + 5.2 * u, noteRot, 'right')
        break
      }
      case 'crop': {
        d = cropMarksPath({ x: ix + 2 * u, y: iy + 2 * u, w: iw - 4 * u, h: ih - 4 * u }, info.slug)
        placeNote(note, ix + 24.2 * u, iy + ih + 3.3 * u, noteRot)
        break
      }
      case 'arrow': {
        const from: [number, number] = [ix + 31 * u, iy + ih + 3.4 * u]
        const to: [number, number] = [ix + 22 * u, iy + 13 * u]
        d = arrowPath(from, to, info.slug)
        placeNote(note, from[0] - 1 * u, from[1] + 0.2 * u, noteRot, 'right')
        break
      }
      case 'underline': {
        const ar = article.getBoundingClientRect()
        const tr = title.getBoundingClientRect()
        const x = tr.left - ar.left
        const y = tr.bottom - ar.top + 2
        const tw = tr.width
        d = translatePath(underlinePath(tw, info.slug), x, y + 1) + translatePath(underlinePath(tw * 0.92, `${info.slug}:2`), x + tw * 0.04, y + 5.5)
        const room = ar.width - (x + tw)
        if (room > 13 * u) placeNote(note, x + tw + 1.4 * u, tr.top - ar.top + tr.height * 0.45, noteRot)
        else placeNote(note, ix + iw - 1.2 * u, iy + ih + 3.1 * u, noteRot, 'right')
        break
      }
    }
    perm.setAttribute('d', d)
  }

  function layoutProgress(): void {
    if (!progress) {
      prog.setAttribute('d', '')
      progNote.textContent = ''
      delete progNote.dataset.shown
      return
    }
    const { u, iy, ih } = geom()
    const old = Date.now() - progress.at > 60 * 24 * 3600 * 1000
    prog.toggleAttribute('data-old', old)
    progNote.toggleAttribute('data-old', old)
    const y0 = iy + ih + 1.9 * u
    const x0 = 4.4 * u
    const hgt = 2.6 * u
    let d = ''
    const r = mulberry32(hashString(`tally:${info.slug}`))
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * 0.75 * u + (r() - 0.5) * 0.2 * u
      d += `M${x.toFixed(1)} ${(y0 + (r() - 0.5) * 0.3 * u).toFixed(1)}l${((r() - 0.5) * 0.3 * u).toFixed(1)} ${hgt.toFixed(1)}`
    }
    d += `M${(x0 - 0.5 * u).toFixed(1)} ${(y0 + hgt * 0.8).toFixed(1)}L${(x0 + 3 * u).toFixed(1)} ${(y0 + hgt * 0.2).toFixed(1)}`
    prog.setAttribute('d', d)
    prog.style.strokeWidth = `${Math.max(2, 0.3 * u)}px`
    progNote.textContent = progress.note
    placeNote(progNote, x0 + 4 * u, y0 + hgt * 0.55, -1.5)
    progNote.dataset.shown = ''
  }

  return {
    el,
    layout() {
      layoutCircle()
      if (permDrawn) layoutPerm()
      layoutProgress()
    },
    showCircle(seed, animate) {
      circleSeed = seed
      layoutCircle()
      delete circle.dataset.off
      circleOn = true
      if (animate) void drawStroke(circle, { ms: 480 })
      else {
        circle.style.strokeDasharray = 'none'
        circle.style.strokeDashoffset = '0'
      }
    },
    hideCircle() {
      if (!circleOn) return
      circleOn = false
      circle.dataset.off = ''
    },
    async drawPermanent(animate) {
      if (permDrawn) return
      permDrawn = true
      layoutPerm()
      perm.style.visibility = 'visible'
      if (animate) {
        await drawStroke(perm, { ms: 620 })
        revealText(note, true)
      } else {
        perm.style.strokeDasharray = 'none'
        revealText(note, false)
      }
    },
    setProgress(p) {
      progress = p
      layoutProgress()
    },
    permanentDrawn: () => permDrawn,
  }
}

/** Offsets every absolute coordinate pair in a path made only of M/L/C/Q/h commands. */
function translatePath(d: string, dx: number, dy: number): string {
  return transformPath(d, 1, dx, dy)
}

function scalePath(d: string, s: number, dx: number, dy: number): string {
  return transformPath(d, s, dx, dy)
}

function transformPath(d: string, s: number, dx: number, dy: number): string {
  const out: string[] = []
  const re = /([MLCQhvHVZz])([^MLCQhvHVZz]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    const cmd = m[1]!
    const nums = (m[2]!.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
    if (cmd === 'h' || cmd === 'v') {
      out.push(cmd + nums.map((n) => (n * s).toFixed(2)).join(' '))
    } else if (cmd === 'H') {
      out.push(cmd + nums.map((n) => (n * s + dx).toFixed(2)).join(' '))
    } else if (cmd === 'V') {
      out.push(cmd + nums.map((n) => (n * s + dy).toFixed(2)).join(' '))
    } else if (cmd === 'Z' || cmd === 'z') {
      out.push(cmd)
    } else {
      const parts: string[] = []
      for (let i = 0; i + 1 < nums.length; i += 2) parts.push(`${(nums[i]! * s + dx).toFixed(2)} ${(nums[i + 1]! * s + dy).toFixed(2)}`)
      out.push(cmd + parts.join(' '))
    }
  }
  return out.join('')
}

export { transformPath }
