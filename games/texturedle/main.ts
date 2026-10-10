// Texturedle page wiring (texturedle-integrate). A short file on purpose:
// the spine (game/app.ts) takes every other package's factory as a parameter.
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import './style.css'
import { mountShell, guardStartup, hasWebGL2, showNoWebGL } from '@shared/ui'
import { flags } from '@shared/core'
import { startTexturedle, HELP } from './game/app'
import { createBench } from './sim/bench'
import { createRenderer } from './render/renderer'
import { createAudio } from './audio/engine'

const stage = document.getElementById('stage') as HTMLElement
const shell = mountShell({ slug: 'texturedle', help: HELP, helpOnFirstVisit: false, returnFocus: () => stage.focus() })

void guardStartup(stage, async () => {
  if (!hasWebGL2() && !flags().force) {
    showNoWebGL(stage)
    return
  }
  await startTexturedle({ stage, shell, createBench, createRenderer, createAudio })
})
