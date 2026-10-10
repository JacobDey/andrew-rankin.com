// games/plates/ui/dryingLine.ts — the top band: a cord with 6 manual pegs and 3 auto pegs. Prints hang
// and sway (phi'' = -(g/0.06) sin phi - 1.5 phi'), kicked by waves. Click an empty peg to pin; double-click
// a print to go back to it; drag a print down to take it off the line.
import { DRYING } from '../story/text'

export interface LinePrint { index: number; auto: boolean; thumb: ImageData | null }
export interface DryingLine {
  el: HTMLElement
  set(prints: (LinePrint | null)[]): void
  kick(s: number): void
  update(dt: number, frozen: boolean): void
  note(text: string | null): void
  onPin: ((slot: number) => void) | null
  onRestore: ((index: number) => void) | null
  onRemove: ((index: number) => void) | null
  onCog: (() => void) | null
}

export function createDryingLine(root: HTMLElement): DryingLine {
  const el = document.createElement('div'); el.className = 'pl-line'
  el.innerHTML = '<div class="pl-line-cord"></div><div class="pl-line-note" hidden></div><button type="button" class="pl-chrome-btn pl-cog" aria-label="Settings">⚙</button>'
  root.appendChild(el)
  const pegs: HTMLButtonElement[] = []
  const phi = new Float32Array(9), vphi = new Float32Array(9)
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pl-peg'
    b.style.left = `calc(${4 + i * 9.4}%)`
    b.title = DRYING.empty; b.setAttribute('aria-label', i < 6 ? `Peg ${i + 1}: ${DRYING.empty}` : `Auto peg ${i - 5}`)
    el.appendChild(b); pegs.push(b)
    let y0 = 0, down = false
    b.addEventListener('pointerdown', (e) => { y0 = e.clientY; down = true })
    b.addEventListener('pointerup', (e) => { if (down && e.clientY - y0 > 30 && b.dataset.has) line.onRemove?.(i); down = false })
    b.addEventListener('click', () => { if (!b.dataset.has && i < 6) line.onPin?.(i) })
    b.addEventListener('dblclick', () => { if (b.dataset.has) line.onRestore?.(i) })
  }
  const noteEl = el.querySelector('.pl-line-note') as HTMLElement
  el.querySelector('.pl-cog')?.addEventListener('click', () => line.onCog?.())
  const line: DryingLine = {
    el, onPin: null, onRestore: null, onRemove: null, onCog: null,
    set(prints) {
      prints.forEach((p, i) => {
        const b = pegs[i]
        b.innerHTML = ''
        if (!p) { delete b.dataset.has; b.title = i < 6 ? DRYING.empty : ''; return }
        b.dataset.has = '1'; b.title = DRYING.print
        b.setAttribute('aria-label', `${p.auto ? 'Auto print' : 'Print ' + (i + 1)}. ${DRYING.print}`)
        const c = document.createElement('canvas'); c.width = 40; c.height = 30
        if (p.thumb) c.getContext('2d')?.putImageData(p.thumb, 0, 0)
        b.appendChild(c)
        if (p.auto) b.insertAdjacentHTML('beforeend', `<span class="pl-auto">${DRYING.auto}</span>`)
      })
    },
    kick(s) { for (let i = 0; i < 9; i++) vphi[i] += (0.6 + 0.4 * Math.sin(i * 2.3)) * s * 1.2 },
    update(dt, frozen) {
      for (let i = 0; i < 9; i++) {
        if (frozen) { phi[i] = 0; vphi[i] = 0 } else {
          const sub = Math.max(1, Math.ceil(dt * 120)), h = dt / sub
          for (let s = 0; s < sub; s++) { vphi[i] += (-(9.81 / 0.06) * Math.sin(phi[i]) - 1.5 * vphi[i]) * h; phi[i] += vphi[i] * h }
        }
        pegs[i].style.transform = `rotate(${(phi[i] * 180) / Math.PI}deg)`
      }
    },
    note(text) { noteEl.hidden = !text; noteEl.textContent = text ?? '' },
  }
  return line
}
