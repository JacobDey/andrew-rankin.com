import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import { mountShell, guardStartup, hasWebGL2, showNoWebGL, showLoader } from '@shared/ui'
import { applyResetFlag } from '@shared/storage'
import { flags, detectTier } from '@shared/core'
import './studio.css'
import { registerSounds } from './sounds'
import { bootStudio } from './core/boot'
import type { QualityName } from './core/contracts'

const stage = document.getElementById('stage') as HTMLElement
registerSounds()

const shell = mountShell({
  slug: 'studio',
  help: {
    intro: 'A little house for making photographs. Build a camera in the garage, shoot the yard, print in the basement.',
    controls: [
      { action: 'Spin house', mouse: 'Drag', touch: 'Drag', keys: '← →' },
      { action: 'Grab and throw', mouse: 'Drag a toy, let go moving', touch: 'Drag and flick' },
      { action: 'Drag the sun', mouse: 'Drag the ring in the sky', touch: 'Drag the ring', keys: '[ ]' },
      { action: 'Raise camera', mouse: 'Camera button', touch: 'Camera button', keys: 'C' },
      { action: 'Focus', mouse: 'Wheel or focus strip', touch: 'Drag the strip', keys: 'W S' },
      { action: 'Fire', mouse: 'Hold the button, let go', touch: 'Hold, let go', keys: 'Hold Space' },
      { action: 'Wind on', mouse: 'Wind button', keys: 'R' },
      { action: 'Rock the tray', mouse: 'Drag the tray', touch: 'Drag the tray', keys: '↑ ↓' },
    ],
    tips: ['Loud shutters scare the sparrows.', 'Long exposures erase moving things.', 'Later light, longer exposure.', 'Fire twice without winding.'],
  },
  returnFocus: () => stage.focus(),
})

function qualityOf(): QualityName {
  const q = flags().get('quality') ?? flags().get('q')
  if (q === 'high' || q === 'low' || q === 'test') return q
  const t = detectTier()
  return t === 'test' ? 'test' : t === 'high' ? 'high' : 'low'
}

void guardStartup(stage, async () => {
  if (!hasWebGL2() && !flags().force) {
    showNoWebGL(stage)
    return
  }
  await applyResetFlag('studio')
  const loader = showLoader(stage, { label: 'Mixing chemistry' })
  await bootStudio({ stage, shell, quality: qualityOf(), seed: flags().seed ?? 16, loader })
  await loader.done()
})
