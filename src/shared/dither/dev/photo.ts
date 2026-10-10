/**
 * A procedural continuous-tone "photograph" (no assets): a lighthouse on a sea stack,
 * soft sky, waves, a sail, a period caption and lens vignetting. Fine detail on
 * purpose (rail, windows, caption) so the 1-bit legibility test has something to lose.
 */
export function makePhotoCanvas(w = 640, h = 480, seed = 7): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)

  // Sky: blue-sensitive plates render it near white; keep a gentle gradient.
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62)
  sky.addColorStop(0, '#d9dde0')
  sky.addColorStop(1, '#f4f1e8')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  // Clouds: soft grey puffs.
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w
    const y = h * (0.06 + rnd() * 0.3)
    const r = 30 + rnd() * 70
    const cg = g.createRadialGradient(x, y, 0, x, y, r)
    cg.addColorStop(0, 'rgba(150,150,155,0.35)')
    cg.addColorStop(1, 'rgba(150,150,155,0)')
    g.fillStyle = cg
    g.beginPath()
    g.ellipse(x, y, r * 1.8, r * 0.6, 0, 0, Math.PI * 2)
    g.fill()
  }

  // Sea: darker toward the bottom, with wave strokes.
  const horizon = h * 0.6
  const sea = g.createLinearGradient(0, horizon, 0, h)
  sea.addColorStop(0, '#7d8487')
  sea.addColorStop(1, '#3b4043')
  g.fillStyle = sea
  g.fillRect(0, horizon, w, h - horizon)
  g.lineWidth = 2
  for (let row = 0; row < 26; row++) {
    const y = horizon + 4 + row * row * 0.32 + row * 2
    g.strokeStyle = `rgba(230,230,225,${0.12 + 0.25 * (row / 26)})`
    g.beginPath()
    for (let x = -10; x < w + 10; x += 6) {
      const yy = y + Math.sin(x * (0.05 - row * 0.0012) + row * 1.7) * (1 + row * 0.25)
      if (x < 0) g.moveTo(x, yy)
      else g.lineTo(x, yy)
    }
    g.stroke()
  }

  // Sea stack (rock) with a lit face.
  g.fillStyle = '#2a2826'
  g.beginPath()
  g.moveTo(w * 0.52, horizon + 40)
  g.lineTo(w * 0.56, horizon - 30)
  g.lineTo(w * 0.62, horizon - 52)
  g.lineTo(w * 0.74, horizon - 48)
  g.lineTo(w * 0.8, horizon - 20)
  g.lineTo(w * 0.86, horizon + 44)
  g.closePath()
  g.fill()
  g.fillStyle = '#6b6660'
  g.beginPath()
  g.moveTo(w * 0.56, horizon - 30)
  g.lineTo(w * 0.62, horizon - 52)
  g.lineTo(w * 0.66, horizon - 50)
  g.lineTo(w * 0.62, horizon + 10)
  g.lineTo(w * 0.55, horizon + 30)
  g.closePath()
  g.fill()
  // Surf at the foot.
  g.fillStyle = 'rgba(245,245,240,0.85)'
  for (let i = 0; i < 40; i++) {
    g.beginPath()
    g.arc(w * (0.5 + rnd() * 0.4), horizon + 34 + rnd() * 14, 2 + rnd() * 5, 0, Math.PI * 2)
    g.fill()
  }

  // Tower: tapered, white with a dark band, lit from the left.
  const cx = w * 0.68
  const base = horizon - 50
  const top = h * 0.16
  const bw = 34
  const tw = 22
  const tower = g.createLinearGradient(cx - bw, 0, cx + bw, 0)
  tower.addColorStop(0, '#f6f3ec')
  tower.addColorStop(0.55, '#d8d3c8')
  tower.addColorStop(1, '#8e8a83')
  g.fillStyle = tower
  g.beginPath()
  g.moveTo(cx - bw, base)
  g.lineTo(cx - tw, top)
  g.lineTo(cx + tw, top)
  g.lineTo(cx + bw, base)
  g.closePath()
  g.fill()
  g.fillStyle = '#26221e'
  const band = (y0: number, y1: number) => {
    const k0 = (y0 - top) / (base - top)
    const k1 = (y1 - top) / (base - top)
    const w0 = tw + (bw - tw) * k0
    const w1 = tw + (bw - tw) * k1
    g.beginPath()
    g.moveTo(cx - w0, y0)
    g.lineTo(cx + w0, y0)
    g.lineTo(cx + w1, y1)
    g.lineTo(cx - w1, y1)
    g.closePath()
    g.fill()
  }
  band(top + (base - top) * 0.38, top + (base - top) * 0.55)
  // Windows.
  g.fillStyle = '#1b1916'
  for (let i = 0; i < 4; i++) g.fillRect(cx - 3, top + 30 + i * 46, 6, 11)
  // Gallery + lantern room.
  g.fillStyle = '#1e1c19'
  g.fillRect(cx - 30, top - 4, 60, 6)
  g.strokeStyle = '#1e1c19'
  g.lineWidth = 1.2
  for (let i = 0; i <= 12; i++) {
    g.beginPath()
    g.moveTo(cx - 30 + i * 5, top - 4)
    g.lineTo(cx - 30 + i * 5, top - 14)
    g.stroke()
  }
  g.fillRect(cx - 30, top - 15, 60, 2)
  g.fillStyle = '#fbf7e8'
  g.fillRect(cx - 14, top - 38, 28, 24)
  g.strokeStyle = '#1e1c19'
  g.lineWidth = 2
  g.strokeRect(cx - 14, top - 38, 28, 24)
  g.beginPath()
  g.moveTo(cx, top - 38)
  g.lineTo(cx, top - 14)
  g.stroke()
  g.fillStyle = '#1e1c19'
  g.beginPath()
  g.moveTo(cx - 18, top - 38)
  g.lineTo(cx, top - 56)
  g.lineTo(cx + 18, top - 38)
  g.closePath()
  g.fill()
  // Beam haze.
  const beam = g.createLinearGradient(cx, top - 26, 0, top - 60)
  beam.addColorStop(0, 'rgba(255,255,250,0.55)')
  beam.addColorStop(1, 'rgba(255,255,250,0)')
  g.fillStyle = beam
  g.beginPath()
  g.moveTo(cx - 12, top - 30)
  g.lineTo(0, top - 110)
  g.lineTo(0, top + 30)
  g.closePath()
  g.fill()

  // A gaff-rigged boat on the left.
  const bx = w * 0.2
  const by = horizon + 26
  g.fillStyle = '#1f1d1a'
  g.beginPath()
  g.moveTo(bx - 40, by)
  g.lineTo(bx + 46, by)
  g.lineTo(bx + 34, by + 12)
  g.lineTo(bx - 30, by + 12)
  g.closePath()
  g.fill()
  g.fillStyle = '#ece7da'
  g.beginPath()
  g.moveTo(bx, by - 4)
  g.lineTo(bx, by - 92)
  g.lineTo(bx + 38, by - 70)
  g.lineTo(bx + 40, by - 4)
  g.closePath()
  g.fill()
  g.fillStyle = '#c9c2b2'
  g.beginPath()
  g.moveTo(bx - 3, by - 4)
  g.lineTo(bx - 3, by - 80)
  g.lineTo(bx - 34, by - 6)
  g.closePath()
  g.fill()
  g.strokeStyle = '#1f1d1a'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(bx, by)
  g.lineTo(bx, by - 98)
  g.stroke()

  // Gulls.
  g.strokeStyle = '#2b2925'
  g.lineWidth = 2
  for (const [x, y, k] of [[0.36, 0.18, 1], [0.42, 0.24, 0.8], [0.31, 0.27, 0.7]] as const) {
    g.beginPath()
    g.moveTo(w * x - 10 * k, h * y)
    g.quadraticCurveTo(w * x - 4 * k, h * y - 7 * k, w * x, h * y)
    g.quadraticCurveTo(w * x + 4 * k, h * y - 7 * k, w * x + 10 * k, h * y)
    g.stroke()
  }

  // Lens vignette (cos^4 falloff).
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.fillStyle = vg
  g.fillRect(0, 0, w, h)

  // Caption strip, scratched into the emulsion.
  g.fillStyle = '#f2eee4'
  g.font = `bold ${Math.round(h * 0.075)}px Georgia, 'Times New Roman', serif`
  g.textBaseline = 'alphabetic'
  g.fillText('No. 7', w * 0.05, h * 0.94)
  g.font = `${Math.round(h * 0.05)}px Georgia, 'Times New Roman', serif`
  g.fillText('CAUL ROCK  NOV. 1879', w * 0.3, h * 0.935)
  return c
}

/** Draws an imported image (any aspect) centred and cropped into a w x h canvas. */
export function coverCanvas(img: CanvasImageSource & { width: number; height: number }, w = 640, h = 480): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const k = Math.max(w / img.width, h / img.height)
  const dw = img.width * k
  const dh = img.height * k
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return c
}
