import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import { mountShell, guardStartup, hasWebGL2, showNoWebGL, showLoader } from '@shared/ui'
import { applyResetFlag } from '@shared/storage'
import { flags, detectTier } from '@shared/core'
import './lensbench.css'
import type { QualityTier } from './core/types'
import { createGLCore } from './core/gl'
import { startLensBench } from './core/app'
import { createWorld } from './street/world/world'
import { createBenchScreen } from './bench/bench-screen'
import { createStreetScreen } from './street/street-screen'
import { createTankScreen } from './shop/tank-screen'
import { createLightboxScreen } from './shop/lightbox-screen'
import { createPhotoRenderer } from './photo/photo-renderer'
import { registerSounds } from './sounds'

const stage = document.getElementById('stage') as HTMLElement
registerSounds()

const shell = mountShell({
  slug: 'lensbench',
  help: {
    intro: 'Build a camera on the bench, carry it down to Lantern Street, shoot, develop, and pin the print to a neighbour’s repair tag.',
    controls: [
      { action: 'Places', mouse: 'Tabs', keys: '1 2 3 4' },
      { action: 'Slide glass', mouse: 'Drag the puck', touch: 'Drag', keys: 'Shift = fine' },
      { action: 'Bend a surface', mouse: 'Drag a brass rim handle' },
      { action: 'Diameter / aperture', mouse: 'Wheel over puck / iris', touch: 'Long-press for glass', keys: '[ ]' },
      { action: 'Look / walk', mouse: 'Drag the view', touch: 'Right drag / left stick', keys: 'WASD' },
      { action: 'Focus', mouse: 'Wheel or focus strip', keys: 'Q E' },
      { action: 'Meter, then fire', mouse: 'Hold the release, let go', touch: 'Hold the release', keys: 'Hold Space' },
      { action: 'Wind on / rewind', mouse: 'Lever / ⟲', keys: 'F / R' },
    ],
    tips: ['Q.’s spare key (top bar) unlocks every drawer.', 'The Blur Budget on the lightbox says what blurred the picture and how to fix it.'],
  },
  returnFocus: () => stage.focus(),
})

function tierOf(): QualityTier {
  const t = detectTier()
  return t === 'test' ? 'test' : t === 'high' ? 'desktop' : 'phone'
}

void guardStartup(stage, async () => {
  if (!hasWebGL2() && !flags().force) { showNoWebGL(stage); return }
  await applyResetFlag('lensbench')
  const loader = showLoader(stage, { label: 'Grinding glass' })
  const q = tierOf()
  const gl = createGLCore(stage, q)
  loader.progress(0.3)
  const world = await createWorld(q)
  loader.progress(0.8)
  await startLensBench({ stage, shell, gl, world, createBenchScreen, createStreetScreen, createTankScreen, createLightboxScreen, createPhotoRenderer })
  await loader.done()
})
