// Darkroom page wiring (architecture §3.4). The shared chrome is loaded through
// glue/platform.ts so the page still runs while shared modules are in flight.
import.meta.glob('/src/shared/ui/fonts.ts', { eager: true })
import.meta.glob('/src/shared/ui/tokens.css', { eager: true })
import.meta.glob('/src/shared/ui/base.css', { eager: true })
import './ui/darkroom.css'
import { initPlatform } from './glue/platform'
import { startDarkroom, HELP } from './game'

const stage = document.getElementById('stage') as HTMLElement
const actions: { id: string; label: string; icon: string; shortcut?: string; priority: number; onSelect(): void }[] = []
const bridge: Record<string, () => void> = {}
for (const [id, label, icon, shortcut, pri] of [
  ['save', 'Pin', 'save', 'Ctrl+S', 1], ['load', 'Logbook', 'load', 'N', 2], ['import', 'Import', 'import', undefined, 3], ['reset', 'Start fresh', 'reset', undefined, 4],
] as const) actions.push({ id, label, icon, shortcut, priority: pri, onSelect: () => bridge[id]?.() })

async function boot() {
  const platform = await initPlatform({ actions, help: HELP, helpOnFirstVisit: false, returnFocus: () => stage.focus({ preventScroll: true }) })
  try {
    if (!platform.hasWebGL2() && new URLSearchParams(location.search).get('force') !== '1') {
      platform.showNoWebGL(stage)
      platform.installApi({ state: () => ({ mode: 'none' }), mode: () => 'none' })
      platform.markReady()
      return
    }
    await startDarkroom({ stage, platform, bridge })
  } catch (e) {
    console.debug('[darkroom] start failed', e)
    platform.showCrash(stage, e)
    throw e
  }
}
void boot()
