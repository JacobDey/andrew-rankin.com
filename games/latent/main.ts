// games/latent/main.ts: the page. Shell, the game, sounds, window.__game, and the records-only fallback.
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import './style.css'
import { mountShell, guardStartup, openDialog, confirmDialog, createSwitch, type Shell } from '@shared/ui'
import { flags, markReady } from '@shared/core'
import { applyResetFlag } from '@shared/storage'
import { registerSounds } from './sounds'
import { S, flushSave, loadSlot0, newGame, autosave } from './core/state'
import { createGame } from './glue/game'
import { installTestApi } from './debug/testApi'
import { loadFonts } from './frames/frameStore'
import { recordsOnly } from './glue/recordsOnly'

const stage = document.getElementById('stage') as HTMLElement
const f = flags()

void guardStartup(stage, async () => {
  await applyResetFlag('latent').catch(() => false)
  loadSlot0()
  if (f.test) S.save.settings.screenshotMode = true
  let shell: Shell | null = null
  if (f.embed !== 'poster') {
    try {
      shell = mountShell({
        slug: 'latent',
        helpOnFirstVisit: !f.test,
        actions: [
          { id: 'settings', label: 'Settings', icon: 'more', shortcut: 'M', priority: 1, onSelect: () => openSettings() },
          { id: 'new', label: 'New night', icon: 'reset', priority: 2, onSelect: () => { void confirmDialog('Start the night again? Slot 0 is cleared and the line is emptied.', { title: 'New night', ok: 'Start again' }).then((ok) => { if (ok) { newGame(); void flushSave().then(() => location.reload()) } }) } },
        ],
        help: {
          intro: 'Search the records one or two words at a time, develop the rolls in the carton, and print what nobody looked at. Every print can give you a word to search.',
          controls: [
            { action: 'Switch station', mouse: 'the rail at the bottom', touch: 'tap the rail', keys: '1 2 3 4, Tab' },
            { action: 'Search', mouse: 'type, Enter', touch: 'tap the screen, type', keys: 'Enter, ↑ ↓, Esc' },
            { action: 'Lights', mouse: 'drag the bead chain down', touch: 'drag the chain', keys: 'L' },
            { action: 'Print', mouse: 'Paper, then Expose; drag the easel to crop, the head to enlarge, the knob to focus', touch: 'the chips under the easel', keys: 'Space, F, X, Shift+0–5, + −, , .' },
            { action: 'Dodge or burn', mouse: 'hold the pointer over the easel while the lamp is on', touch: 'finger on the easel', keys: 'Z wand, C card, wheel = height' },
            { action: 'Rock the tray', mouse: 'drag the tray', touch: 'drag the tray', keys: 'W S Q E' },
            { action: 'Load film', mouse: 'Open the bag, then alternate left and right', touch: 'tap left and right halves', keys: 'B, Space, ↓, ← →, Q' },
            { action: 'Ring the desk', mouse: 'the phone', touch: 'Desk on the rail', keys: 'P' },
          ],
          tips: ['The first print is already in the easel.', 'Five results, oldest first. Narrow with a second word.', 'Burn highlights, dodge shadows, and wait for it.', 'Type CLOSE 03-0417 when you are done.'],
        },
      })
    } catch (e) { console.debug('[latent] shell', e) }
  }
  registerSounds()
  const canvasOk = !!document.createElement('canvas').getContext('2d')
  if ((!canvasOk || new URLSearchParams(location.search).get('records') === '1') && !f.force) { recordsOnly(stage); markReady(); return }
  await loadFonts()
  const game = createGame(stage)
  installTestApi(game)
  game.app.go(S.save.tutorialDone ? S.station : 'darkroom')
  game.app.resize()
  game.app.start()
  window.addEventListener('pagehide', () => { void flushSave() })
  document.addEventListener('visibilitychange', () => { if (document.hidden) void flushSave() })
  requestAnimationFrame(() => requestAnimationFrame(() => markReady()))

  function openSettings(): void {
    const body = document.createElement('div')
    body.className = 'li-settings'
    const st = S.save.settings
    const sw = (label: string, k: 'steadyHands' | 'bagLights' | 'reducedMotion' | 'highContrast') => body.append(createSwitch({ label, checked: st[k], onChange: (on) => { st[k] = on; autosave(); game.app.applyPalette() } }))
    sw('Steady hands', 'steadyHands'); sw('Lights in the bag', 'bagLights'); sw('Reduced motion', 'reducedMotion'); sw('High contrast', 'highContrast')
    const ts = document.createElement('button'); ts.type = 'button'; ts.className = 'li-chip'
    const label = () => `Terminal text ×${st.textSize}`
    ts.textContent = label()
    ts.addEventListener('click', () => { st.textSize = st.textSize === 1 ? 1.5 : st.textSize === 1.5 ? 2 : 1; ts.textContent = label(); autosave() })
    body.append(ts)
    openDialog({ edge: 'LATENT IMAGE · ▸04', title: 'Settings', body })
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !(e.target instanceof HTMLInputElement) && !e.ctrlKey && !e.metaKey && !e.altKey) openSettings() })
  void shell
})
