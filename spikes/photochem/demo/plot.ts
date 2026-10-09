// Tiny DPR-aware canvas plotting for the curves tab. Lines, bars, axes, legend.

export interface Series {
  label: string
  color: string
  points: [number, number][]
  dash?: number[]
  width?: number
}

export interface PlotOpts {
  title: string
  xLabel: string
  yLabel: string
  xRange: [number, number]
  yRange: [number, number]
  xTicks?: number[]
  yTicks?: number[]
  xFmt?: (v: number) => string
  yFmt?: (v: number) => string
  legend?: boolean
  logY?: boolean
  notes?: string[]
}

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

export function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.aspectRatio = `${cssW} / ${cssH}`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

export function plot(canvas: HTMLCanvasElement, series: Series[], o: PlotOpts, cssW = 560, cssH = 340): void {
  const ctx = setupCanvas(canvas, cssW, cssH)
  const fg = css('--ink', '#efe6da')
  const muted = css('--muted', '#9c8f80')
  const grid = css('--grid', 'rgba(255,255,255,0.08)')
  ctx.clearRect(0, 0, cssW, cssH)
  const L = 52
  const R = o.legend ? 150 : 16
  const T = 30
  const B = 40
  const W = cssW - L - R
  const H = cssH - T - B
  const ylog = !!o.logY
  const ty = (v: number) => (ylog ? Math.log10(Math.max(1e-12, v)) : v)
  const [x0, x1] = o.xRange
  const [y0, y1] = [ty(o.yRange[0]), ty(o.yRange[1])]
  const X = (x: number) => L + ((x - x0) / (x1 - x0)) * W
  const Y = (y: number) => T + H - ((ty(y) - y0) / (y1 - y0)) * H
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillStyle = fg
  ctx.fillText(o.title, L, 18)
  ctx.font = '11px system-ui, sans-serif'
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  ctx.fillStyle = muted
  const xt = o.xTicks ?? niceTicks(x0, x1, 6)
  const ytk = o.yTicks ?? (ylog ? [] : niceTicks(o.yRange[0], o.yRange[1], 5))
  for (const v of xt) {
    ctx.beginPath()
    ctx.moveTo(X(v), T)
    ctx.lineTo(X(v), T + H)
    ctx.stroke()
    const s = o.xFmt ? o.xFmt(v) : fmt(v)
    ctx.fillText(s, X(v) - ctx.measureText(s).width / 2, T + H + 14)
  }
  for (const v of ytk) {
    ctx.beginPath()
    ctx.moveTo(L, Y(v))
    ctx.lineTo(L + W, Y(v))
    ctx.stroke()
    const s = o.yFmt ? o.yFmt(v) : fmt(v)
    ctx.fillText(s, L - 6 - ctx.measureText(s).width, Y(v) + 4)
  }
  ctx.fillText(o.xLabel, L + W / 2 - ctx.measureText(o.xLabel).width / 2, cssH - 8)
  ctx.save()
  ctx.translate(12, T + H / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(o.yLabel, -ctx.measureText(o.yLabel).width / 2, 0)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.rect(L, T, W, H)
  ctx.clip()
  for (const s of series) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.width ?? 1.8
    ctx.setLineDash(s.dash ?? [])
    ctx.beginPath()
    s.points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))))
    ctx.stroke()
  }
  ctx.restore()
  ctx.setLineDash([])
  if (o.legend) {
    let ly = T + 4
    for (const s of series) {
      if (!s.label) continue
      ctx.strokeStyle = s.color
      ctx.lineWidth = 2.5
      ctx.setLineDash(s.dash ?? [])
      ctx.beginPath()
      ctx.moveTo(L + W + 12, ly + 5)
      ctx.lineTo(L + W + 30, ly + 5)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = fg
      ctx.fillText(s.label, L + W + 36, ly + 9)
      ly += 15
    }
  }
  if (o.notes) {
    ctx.fillStyle = muted
    let ny = T + 14
    for (const n of o.notes) {
      ctx.fillText(n, L + 8, ny)
      ny += 14
    }
  }
}

/** Horizontal bar chart with a log axis (safe times). */
export function barsLog(canvas: HTMLCanvasElement, rows: { label: string; value: number; color: string; text: string }[], title: string, range: [number, number], ticks: { v: number; s: string }[], cssW = 560, cssH = 340): void {
  const ctx = setupCanvas(canvas, cssW, cssH)
  const fg = css('--ink', '#efe6da')
  const muted = css('--muted', '#9c8f80')
  const grid = css('--grid', 'rgba(255,255,255,0.08)')
  ctx.clearRect(0, 0, cssW, cssH)
  const L = 170
  const R = 64
  const T = 30
  const B = 26
  const W = cssW - L - R
  const H = cssH - T - B
  const lx = (v: number) => L + ((Math.log10(v) - Math.log10(range[0])) / (Math.log10(range[1]) - Math.log10(range[0]))) * W
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillStyle = fg
  ctx.fillText(title, 8, 18)
  ctx.font = '11px system-ui, sans-serif'
  ctx.strokeStyle = grid
  for (const t of ticks) {
    ctx.beginPath()
    ctx.moveTo(lx(t.v), T)
    ctx.lineTo(lx(t.v), T + H)
    ctx.stroke()
    ctx.fillStyle = muted
    ctx.fillText(t.s, lx(t.v) - ctx.measureText(t.s).width / 2, T + H + 14)
  }
  const bh = H / rows.length
  rows.forEach((r, i) => {
    const y = T + i * bh
    ctx.fillStyle = muted
    ctx.fillText(r.label, 8, y + bh * 0.62)
    ctx.fillStyle = r.color
    const x = Math.max(L, Math.min(L + W, lx(Math.max(range[0], r.value))))
    ctx.fillRect(L, y + bh * 0.2, x - L, bh * 0.6)
    ctx.fillStyle = fg
    ctx.fillText(r.text, Math.min(x + 6, L + W + 4), y + bh * 0.62)
  })
}

function fmt(v: number): string {
  if (Math.abs(v) >= 100 || Number.isInteger(v)) return String(Math.round(v * 100) / 100)
  return v.toFixed(Math.abs(v) < 1 ? 2 : 1)
}

export function niceTicks(a: number, b: number, n: number): number[] {
  const span = b - a
  const step0 = span / n
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step)
  return out
}
