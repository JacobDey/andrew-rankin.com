// games/plates/main.ts — the page: shell, WebGL2 check, the app with its real factories, window.__game.
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import { mountShell, guardStartup, hasWebGL2, showNoWebGL, type Shell } from '@shared/ui'
import { flags, installGameApi, markReady } from '@shared/core'
import { writeHubNote } from '@shared/storage'
import type { PlateId } from './contracts'
import { createApp } from './app'
import { createWetBench } from './bench/wetBench'
import { createPlateLibrary } from './content/library'
import { createLightTable } from './inspect/lightTable'
import { createReturnBook } from './ui/book'
import { mountGallery } from './content/gallery'
import { platesTestApi } from './test/api'
import { FALLBACK, md } from './story/text'

const stage = document.getElementById('stage') as HTMLElement
const f = flags()
const q = new URLSearchParams(location.search)

void guardStartup(stage, async () => {
  let shell: Shell | null = null
  if (f.embed !== 'poster') {
    try {
      shell = mountShell({
        slug: 'plates',
        helpOnFirstVisit: !f.test,
        help: {
          intro: 'Develop each glass plate under the ruby lamp, read it on the canary light table, and fill in the Board’s Return.',
          controls: [
            { action: 'Rock a tray', mouse: 'drag on the focused tray', touch: 'drag', keys: 'hold Space' },
            { action: 'Carry a plate', mouse: 'click it, then click where it goes', touch: 'drag', keys: '' },
            { action: 'Next bath', mouse: 'double-click the plate', touch: 'double-tap' },
            { action: 'Move between stations', mouse: 'Shelf · Trays · Table', touch: 'swipe the wall', keys: 'A / D, 1 2 3' },
            { action: 'Velvet, eyes, loupe', mouse: 'the bar under the plate', touch: 'the bar', keys: 'V, Q W E, X, Z' },
            { action: 'The Return', mouse: 'the book', touch: 'Return', keys: 'R' },
          ],
          tips: ['Stop when the eighth square shows.', 'Red prints black.', 'Look with one eye, then the other.'],
        },
      })
    } catch (e) { console.debug('[plates] shell', e) }
  }
  if (q.get('gallery') === '1') {
    installGameApi('plates', 'plates@1', { state: () => ({ gallery: true }) })
    await mountGallery(stage)
    markReady()
    return
  }
  if (!hasWebGL2() && !f.force) {
    const extra = document.createElement('p'); extra.innerHTML = md(FALLBACK)
    showNoWebGL(stage, { title: 'Ruby Sector', extra })
    installGameApi('plates', 'plates@1', { state: () => ({ webgl: false }) })
    markReady()
    return
  }
  const quality: 'low' | 'full' = (q.get('q') === 'full' || q.get('quality') === 'high') ? 'full' : (f.test || q.get('q') === 'low' || f.quality === 'low' || navigator.hardwareConcurrency <= 4 || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) ? 'low' : 'full'
  const app = await createApp({
    stage, shell,
    createWetBench, createPlateLibrary,
    createLightTable: (ctx, bench) => createLightTable(ctx, bench as never, undefined),
    createReturnBook: (ctx, bench, table, root) => createReturnBook(ctx, bench as never, table as never, root),
    test: f.test, quality, seed: String(f.seed ?? (f.test ? 'test' : 'gaunt')), fresh: f.fresh || f.embed === 'poster', reset: f.reset,
  })
  installGameApi('plates', 'plates@1', platesTestApi(app))
  // direct setup for screenshots: ?plate=p07&P=40&fix=1&inspect=1[&velvet=1][&eye=R]; ?solve=1
  const plate = q.get('plate') as PlateId | null
  if (plate) {
    const api = window.__game as unknown as ReturnType<typeof platesTestApi>
    await api.openBundle(app.lib.meta(plate).bundle)
    if (q.has('P')) api.develop(plate, Number(q.get('P')))
    if (q.get('fix') === '1') api.fix(plate)
    if (q.get('inspect') === '1') await api.inspect(plate, { velvet: q.get('velvet') === '1' ? 1 : 0, eye: (q.get('eye') as 'L' | 'R' | null) ?? 'both' })
  }
  if (q.get('solve') === '1') app.book.model.solveAll()
  if (f.embed === 'poster') await (window.__game as unknown as { poster(): Promise<void> }).poster()
  requestAnimationFrame(() => { markReady(); try { writeHubNote('plates', app.book.model.status().persons ? `${app.book.model.status().persons}/10 named` : 'in the developer') } catch { /* ignore */ } })
})
