// games/plates/inspect/pane.ts — the Sector III pane on the light table: dark ruby glass, the Board's
// etch along one long edge (B.S.L. · GAUNT ROCK · SECTOR III) and a small chip at one corner.
import * as THREE from 'three'

export const PANE_W = 610, PANE_H = 508            // 12 × 10 in, lying long side horizontal
export const PANE_ETCH_RECT = { x: 150, y: 470, w: 320, h: 20 }

export function paneTexture(): { tex: THREE.DataTexture; w: number; h: number } {
  const c = document.createElement('canvas'); c.width = PANE_W; c.height = PANE_H
  const x = c.getContext('2d', { willReadFrequently: true })
  const data = new Uint8Array(PANE_W * PANE_H)
  if (x) {
    x.fillStyle = '#000'; x.fillRect(0, 0, PANE_W, PANE_H)
    // the glass edge (light rim), a faint bevel band
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(2, 2, PANE_W - 4, PANE_H - 4)
    x.strokeStyle = '#404040'; x.lineWidth = 10; x.strokeRect(12, 12, PANE_W - 24, PANE_H - 24)
    // a few streaks of reflected canary light across the dark glass (dithered greys)
    const gr = x.createLinearGradient(0, 0, PANE_W, PANE_H)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)')
    x.fillStyle = gr; x.fillRect(20, 20, PANE_W - 40, PANE_H - 40)
    // the etch: frosted, along the bottom long edge
    x.fillStyle = '#fff'; x.font = 'bold 13px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
    x.fillText('B.S.L. · GAUNT ROCK · SECTOR III', PANE_ETCH_RECT.x + PANE_ETCH_RECT.w / 2, PANE_ETCH_RECT.y + 14)
    // chip at the lower-left corner, the shape of a screw head
    x.fillStyle = '#fff'; x.beginPath(); x.arc(6, PANE_H - 6, 9, -Math.PI / 2, 0); x.lineTo(6, PANE_H - 6); x.fill()
    const d = x.getImageData(0, 0, PANE_W, PANE_H).data
    for (let i = 0; i < data.length; i++) data[i] = d[i * 4]
  }
  const tex = new THREE.DataTexture(data, PANE_W, PANE_H, THREE.RedFormat, THREE.UnsignedByteType)
  tex.flipY = false; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false
  tex.needsUpdate = true
  return { tex, w: PANE_W, h: PANE_H }
}
