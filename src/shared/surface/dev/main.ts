// Dev page for @shared/surface: a library contact sheet (every recipe, lit), a 5:1 close view, and selftest().
import { installGameApi, markReady } from '@shared/core/testapi'
import {
  bakeMaps, bakeSurface, createRuntime, getRecipe, listRecipes, shadeMaps, thumbnail, defaultSizeMm,
  type ContactSample, type SurfaceBake,
} from '@shared/surface'

const sheet = document.getElementById('sheet')!
const logEl = document.getElementById('log')!
const big = document.getElementById('big') as HTMLCanvasElement
const az = document.getElementById('az') as HTMLInputElement
const params = new URLSearchParams(location.search)
const TH = params.get('test') === '1' ? 128 : 192

const timings: Record<string, number> = {}
function log(s: string): void {
  logEl.textContent += s + '\n'
}

const tiles = new Map<string, HTMLCanvasElement>()
for (const r of listRecipes()) {
  const fig = document.createElement('figure')
  const c = document.createElement('canvas')
  c.width = TH
  c.height = TH
  const cap = document.createElement('figcaption')
  cap.textContent = `${r.no ? String(r.no).padStart(3, '0') : 'poster'} · ${r.name}`
  fig.append(c, cap)
  sheet.append(fig)
  tiles.set(r.id, c)
  fig.addEventListener('click', () => { void showBig(r.id) })
}

async function fillSheet(): Promise<void> {
  for (const r of listRecipes()) {
    const t0 = performance.now()
    const img = await thumbnail(r.id, TH, Number(az.value))
    timings[`thumb:${r.id}`] = performance.now() - t0
    tiles.get(r.id)!.getContext('2d')!.putImageData(img, 0, 0)
  }
}

async function showBig(id: string): Promise<void> {
  document.getElementById('bigname')!.textContent = id
  const maps = await bakeMaps(id, { sizeMm: defaultSizeMm(5), res: 512, ratio: 5, seed: 1 })
  const data = shadeMaps(maps, Number(az.value), 15)
  big.getContext('2d')!.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, 512, 512), 0, 0)
}

az.addEventListener('input', () => {
  document.getElementById('azv')!.textContent = az.value
})
az.addEventListener('change', () => { void fillSheet() })

// ---------------------------------------------------------------- selftest
interface Check { name: string; ok: boolean; info?: string }

function hashBytes(a: Uint8Array | Float32Array): number {
  let h = 2166136261
  const b = new Uint8Array(a.buffer, a.byteOffset, Math.min(a.byteLength, 1 << 20))
  for (let i = 0; i < b.length; i += 7) h = Math.imul(h ^ b[i], 16777619)
  return h >>> 0
}

async function selftest(): Promise<{ pass: boolean; checks: Check[]; timings: Record<string, number> }> {
  const checks: Check[] = []
  const add = (name: string, ok: boolean, info?: string): void => { checks.push({ name, ok, info }) }
  const recipes = listRecipes()
  add('recipes 001-010 and the poster are registered', recipes.length >= 11 && recipes.filter((r) => r.pool).length >= 10 && recipes.some((r) => !r.pool), `${recipes.length} recipes`)

  // 1. the mailbox thumbnail reads as green chalky paint, rust blisters and orange streaks running right
  {
    const t0 = performance.now()
    const th = await thumbnail('rusty-mailbox', 256)
    timings.mailboxThumb256 = performance.now() - t0
    const d = th.data
    let green = 0
    let orange = 0
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      n++
      if (g > r * 1.03 && g >= b * 0.95 && g > 28) green++
      if (r > g * 1.35 && r > b * 1.9 && r > 60) orange++
    }
    add('mailbox thumbnail: mostly green paint', green / n > 0.4, `${(100 * green / n).toFixed(0)}% green`)
    add('mailbox thumbnail: rust orange present', orange / n > 0.03 && orange / n < 0.5, `${(100 * orange / n).toFixed(1)}% orange`)
    // streak direction: tint changes slower along +x than along y (run-off runs right)
    const maps = await bakeMaps('rusty-mailbox', { sizeMm: defaultSizeMm(2), res: 256, ratio: 2, seed: 1 })
    const rec = getRecipe('rusty-mailbox')
    void rec
    let dx = 0
    let dy = 0
    let cnt = 0
    const a = maps.albedo
    const res = 256
    const tint = (i: number, j: number): number => { const k = (j * res + i) * 4; return (a[k] - a[k + 2]) / (a[k] + a[k + 2] + 8) }
    for (let j = 8; j < res - 8; j += 2) for (let i = 8; i < res - 8; i += 2) {
      const k = (j * res + i) * 4
      if (!(a[k + 1] > a[k] * 1.0 && a[k + 1] > a[k + 2] * 0.9)) continue // enamel pixels only
      dx += Math.abs(tint(i + 6, j) - tint(i, j))
      dy += Math.abs(tint(i, j + 6) - tint(i, j))
      cnt++
    }
    add('mailbox stains run along +x (tint varies less along x than y)', cnt > 1000 && dx < dy, `dx ${(dx / cnt).toFixed(4)} vs dy ${(dy / cnt).toFixed(4)}`)
  }

  // 2. every recipe bakes without NaN and with a plausible image
  {
    let bad = ''
    for (const r of recipes) {
      const t0 = performance.now()
      const b = await bakeSurface(getRecipe(r.id), { ratio: 3, res: 128, physRes: 64 })
      timings[`bake128:${r.id}`] = performance.now() - t0
      let nan = 0
      let lum = 0
      for (let k = 0; k < b.height.length; k++) if (!Number.isFinite(b.height[k])) nan++
      for (let k = 0; k < b.albedo.length; k += 4) lum += (b.albedo[k] + b.albedo[k + 1] + b.albedo[k + 2]) / 765
      lum /= b.height.length
      for (const kind of ['marble', 'burlap', 'lens'] as const) for (let k = 0; k < b.contact[kind].data.length; k += 5) if (!Number.isFinite(b.contact[kind].data[k])) nan++
      for (let k = 0; k < b.snag.length; k++) if (!Number.isFinite(b.snag[k])) nan++
      if (nan || lum < 0.04 || lum > 0.97) bad += ` ${r.id}(nan ${nan}, lum ${lum.toFixed(2)})`
    }
    add('every recipe bakes without NaN (plausible brightness)', bad === '', bad || `${recipes.length} recipes at 128 px`)
  }

  // 3. mailbox bake: contact fields and the snag map are sane
  let bake5: SurfaceBake | null = null
  {
    const rec = getRecipe('rusty-mailbox')
    const t0 = performance.now()
    bake5 = await bakeSurface(rec, { ratio: 5, res: 512, physRes: 128 })
    timings.mailbox512 = performance.now() - t0
    const rt = createRuntime(bake5, rec)
    const s: ContactSample = { d: 0, nx: 0, ny: 0, nz: 0, layer: 0 }
    let below = 0
    let nonUnit = 0
    let hmin = Infinity
    let hmax = -Infinity
    for (const v of bake5.height) { if (v < hmin) hmin = v; if (v > hmax) hmax = v }
    const size = bake5.sizeMm
    for (let q = 0; q < 300; q++) {
      const x = ((q * 0.6180339) % 1 - 0.5) * size * 0.9
      const y = ((q * 0.7548776) % 1 - 0.5) * size * 0.9
      const i = Math.floor((x / size + 0.5) * bake5.res)
      const j = Math.floor((y / size + 0.5) * bake5.res)
      const h = bake5.height[j * bake5.res + i]
      for (const kind of ['marble', 'burlap', 'lens'] as const) {
        rt.contactAt(kind, x, y, s)
        if (s.d < h - 0.02) below++ // D_r(p) is never below the surface (up to the pooling cell)
        if (s.d > hmax + 0.01 || Math.abs(Math.hypot(s.nx, s.ny, s.nz) - 1) > 1e-3) nonUnit++
      }
    }
    add('contact fields: D never below H, within the height range, unit normals', below === 0 && nonUnit === 0, `below ${below}, bad ${nonUnit}`)
    let smax = 0
    let smean = 0
    for (const v of bake5.snag) { smean += v; if (v > smax) smax = v }
    smean /= bake5.snag.length
    add('snag map in [0, 1] with sharp edges snagging', smax > 0.1 && smax <= 1 && smean < 0.5, `max ${smax.toFixed(2)}, mean ${smean.toFixed(3)}`)
    add('bake shapes (layers, mips, audio, loose)', bake5.nLayers === 8 && bake5.heightMips.length > 3 && bake5.audioHeight.length === bake5.audioRes ** 2 && bake5.loose?.length === 128 * 128, `layers ${bake5.nLayers}, mips ${bake5.heightMips.length}`)
    let left = 0
    let right = 0
    const rs = bake5.res
    for (let j = 0; j < rs; j += 4) for (let i = 0; i < rs / 10; i++) { left += bake5.height[j * rs + i]; right += bake5.height[j * rs + rs - 1 - i] }
    const cnt = (rs / 4) * (rs / 10)
    add('mailbox arch: the lid falls toward +x (the marble drifts right)', (left - right) / cnt > 0.2, `left - right = ${((left - right) / cnt).toFixed(3)} mm`)
  }

  // 4. abrasion reveals layers; carryFrom keeps a scrubbed patch visible from 5:1 to 4:1
  {
    const rec = getRecipe('rusty-mailbox')
    const b = bake5!
    const rt = createRuntime(b, rec)
    // find an enamel texel near the centre
    let px = 0
    let py = 0
    let found = false
    const size = b.sizeMm
    for (let r = 0; r < 120 && !found; r += 3) for (let a = 0; a < 6.28 && !found; a += 0.5) {
      const x = Math.cos(a) * r * 0.02
      const y = Math.sin(a) * r * 0.02
      const i = Math.floor((x / size + 0.5) * b.res)
      const j = Math.floor((y / size + 0.5) * b.res)
      if (b.topLayer[j * b.res + i] === 3 && b.layerT[3 * b.res * b.res + j * b.res + i] > 40) { px = x; py = y; found = true }
    }
    add('found enamel to scrub', found, `at ${px.toFixed(2)}, ${py.toFixed(2)} mm`)
    let dirtyKinds = 0
    const off = rt.onDirty(() => { dirtyKinds++ })
    const splats = new Float32Array(4 * 6)
    for (let s = 0; s < 6; s++) { splats[s * 4] = px; splats[s * 4 + 1] = py; splats[s * 4 + 2] = 0.5; splats[s * 4 + 3] = 20 }
    const revealed = new Set<number>()
    let removedColours = 0
    for (let pass = 0; pass < 6; pass++) {
      const r = rt.abradeBatch(splats, 6)
      r.revealed.forEach((l) => revealed.add(l))
      removedColours += r.removed.length
    }
    off()
    const i = Math.floor((px / size + 0.5) * b.res)
    const j = Math.floor((py / size + 0.5) * b.res)
    const topNow = b.topLayer[j * b.res + i]
    add('abrasion removes the enamel and reveals a lower layer', topNow < 3 && revealed.size > 0 && removedColours > 0 && dirtyKinds >= 3, `top ${topNow}, revealed [${[...revealed]}]`)
    const rec4 = rec
    const bake4 = await bakeSurface(rec4, { ratio: 4, res: 512, physRes: 128 })
    const rt4 = createRuntime(bake4, rec4, rt)
    const i4 = Math.floor((px / bake4.sizeMm + 0.5) * bake4.res)
    const j4 = Math.floor((py / bake4.sizeMm + 0.5) * bake4.res)
    const top4 = bake4.topLayer[j4 * bake4.res + i4]
    const fresh = await bakeSurface(rec4, { ratio: 4, res: 512, physRes: 128 })
    const topFresh = fresh.topLayer[j4 * fresh.res + i4]
    add('carryFrom keeps the scrubbed patch from 5:1 to 4:1', top4 === topNow && topFresh === 3 && rt4.materialAt(px, py) === bake4.phys[topNow], `5:1 top ${topNow}, 4:1 carried ${top4}, 4:1 fresh ${topFresh}`)
    // polish, loose, height edits
    rt.polishBatch(new Float32Array([px, py, 0.4, 0.5]), 1)
    rt.takeLoose(px, py, 1, 10)
    rt.editHeight(px, py, 0.3, (h, d) => h - 0.02 * (1 - d / 0.3))
    add('polish, loose and height edits run', true)
  }

  // 5. determinism, maps for props, timings
  {
    const rec = getRecipe('dried-mud-rut')
    const a = await bakeSurface(rec, { ratio: 3, res: 128, physRes: 64, seed: 7 })
    const b = await bakeSurface(rec, { ratio: 3, res: 128, physRes: 64, seed: 7 })
    const c = await bakeSurface(rec, { ratio: 3, res: 128, physRes: 64, seed: 8 })
    add('same seed, same bake; another seed differs', hashBytes(a.height) === hashBytes(b.height) && hashBytes(a.height) !== hashBytes(c.height) && hashBytes(a.albedo) === hashBytes(b.albedo))
    const t0 = performance.now()
    const m = await bakeMaps('rusty-mailbox', { sizeMm: 300, res: 256 })
    timings.bakeMaps256 = performance.now() - t0
    let a255 = true
    for (let k = 3; k < m.orm.length; k += 4) if (m.orm[k] !== 255) { a255 = false; break }
    add('bakeMaps: albedo, normal, ORM (A 255) and height at the right sizes', m.albedo.length === 256 * 256 * 4 && m.normal.length === 256 * 256 * 4 && m.height.length === 256 * 256 && a255 && m.sizeMm === 300)
  }

  const pass = checks.every((c) => c.ok)
  return { pass, checks, timings: Object.fromEntries(Object.entries(timings).filter(([k]) => !k.startsWith('thumb:')).map(([k, v]) => [k, Math.round(v)])) }
}

async function bench(): Promise<Record<string, number>> {
  const rec = getRecipe('rusty-mailbox')
  const out: Record<string, number> = {}
  for (const [res, key] of [[512, 'mailbox512'], [1024, 'mailbox1024']] as const) {
    const t0 = performance.now()
    await bakeSurface(rec, { ratio: 5, res, physRes: 256 })
    out[key] = Math.round(performance.now() - t0)
  }
  log(`bake timings (ms): ${JSON.stringify(out)}`)
  return out
}
document.getElementById('bench')!.addEventListener('click', () => { void bench() })

installGameApi('shared:surface', 'surface@1', {
  state: () => ({ recipes: listRecipes().map((r) => r.id), timings }),
  selftest,
  bench,
  /** Fill the contact sheet (thumbnails of every recipe). */
  async sheet(): Promise<number> {
    const t0 = performance.now()
    await fillSheet()
    return Math.round(performance.now() - t0)
  },
  showBig,
})

void (async () => {
  await fillSheet()
  await showBig('rusty-mailbox')
  markReady()
})()
