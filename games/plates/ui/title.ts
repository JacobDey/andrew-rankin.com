// games/plates/ui/title.ts — the title screen (Bone): a dithered tower in a storm, its lantern showing a
// dark wedge; RUBY SECTOR; Begin (which unlocks audio and rings the fog bell).
import { TITLE } from '../story/text'
import { bayer8 } from '../render/dither'

export function showTitle(root: HTMLElement, onBegin: () => void): HTMLElement {
  const el = document.createElement('div'); el.className = 'pl-title'
  const c = document.createElement('canvas'); c.width = 240; c.height = 150
  const x = c.getContext('2d')
  if (x) {
    const g = x.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#666'); g.addColorStop(1, '#1a1a1a')
    x.fillStyle = g; x.fillRect(0, 0, 240, 150)
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.moveTo(150, 46); x.lineTo(240, 10); x.lineTo(240, 80); x.closePath(); x.fill()
    x.fillStyle = 'rgba(0,0,0,0.85)'; x.beginPath(); x.moveTo(150, 46); x.lineTo(240, 34); x.lineTo(240, 58); x.closePath(); x.fill()
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.moveTo(150, 46); x.lineTo(30, 20); x.lineTo(20, 70); x.closePath(); x.fill()
    x.fillStyle = '#0d0d0d'; x.beginPath(); x.moveTo(138, 150); x.lineTo(141, 52); x.lineTo(159, 52); x.lineTo(163, 150); x.fill()
    x.fillRect(136, 50, 28, 3); x.fillStyle = '#eee'; x.fillRect(143, 40, 14, 10); x.fillStyle = '#0d0d0d'; x.fillRect(141, 36, 18, 4)
    x.beginPath(); x.moveTo(90, 150); x.lineTo(120, 128); x.lineTo(185, 124); x.lineTo(220, 150); x.fill()
    x.fillStyle = '#333'; x.fillRect(0, 134, 240, 16)
    x.strokeStyle = 'rgba(255,255,255,0.25)'
    for (let i = 0; i < 90; i++) { const rx = (i * 53) % 240, ry = (i * 29) % 140; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 2, ry + 7); x.stroke() }
    const d = x.getImageData(0, 0, 240, 150)
    for (let y = 0; y < 150; y++) for (let xx = 0; xx < 240; xx++) {
      const k = (y * 240 + xx) * 4, on = d.data[k] / 255 > bayer8(xx, y)
      d.data[k] = on ? 233 : 25; d.data[k + 1] = on ? 225 : 22; d.data[k + 2] = on ? 207 : 19; d.data[k + 3] = 255
    }
    x.putImageData(d, 0, 0)
  }
  el.appendChild(c)
  const inner = document.createElement('div'); inner.className = 'pl-title-inner'
  inner.innerHTML = `<h1>${TITLE.title}</h1><p class="pl-sub">${TITLE.sub}</p><button type="button">${TITLE.begin}</button><p class="pl-small">${TITLE.small}</p>`
  el.appendChild(inner)
  root.appendChild(el)
  const b = inner.querySelector('button') as HTMLButtonElement
  b.addEventListener('click', () => { el.remove(); onBegin() })
  setTimeout(() => b.focus({ preventScroll: true }), 50)
  return el
}
