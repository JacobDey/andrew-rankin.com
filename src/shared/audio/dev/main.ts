// Shared audio harness: every registered id with a play button, plus __game.selftest():
//   - every Appendix B id is registered
//   - every one-shot renders offline to finite samples without clipping; ui.* stay quiet and short
//   - every loop renders, stays finite, and starts and stops without steps (after the engine's fades)
//   - nothing sounds before a gesture (no AudioContext exists)
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import { Audio, getAudio, type LoopHandle, type SoundDef } from '@shared/audio'
import { analyze, renderOffline } from '../analysis'
import { installGameApi, markReady, nextFrame } from '@shared/core'
import { registerSounds as darkroom } from '../../../../games/darkroom/sounds'
import { registerSounds as plates } from '../../../../games/plates/sounds'
import { registerSounds as latent } from '../../../../games/latent/sounds'
import { registerSounds as lensbench } from '../../../../games/lensbench/sounds'
import { registerSounds as studio } from '../../../../games/studio/sounds'

for (const r of [darkroom, plates, latent, lensbench, studio]) r()
Audio.arm()

/** Appendix B, verbatim: the ids every game may call. */
const APPENDIX_B: string[] = [
  ...'room.tone yard.wind yard.birds yard.sprinkler yard.crickets yard.cicadas yard.chimes shutter.leaf shutter.focal film.advance film.click film.rewind bellows focus.ring aperture.detent selftimer flash.charge flash.pop geiger timer.tick timer.clock timer.beep timer.bell timer.wind enlarger.switch enlarger.hum safelight.buzz safelight.chain roomlight.start liquid.slosh liquid.lap liquid.pour liquid.drip paper.flop paper.peel paper.crinkle kbd.key typewriter.key typewriter.bell typewriter.return terminal.beep terminal.seek crt.degauss crt.whine printer.dotmatrix radio.chatter ship.creak sea.wavehit sea.waves ship.hull bell.fog glass.chord impact marble.clack marble.roll cloth.rustle'.split(' '),
  ...'darkroom.room-tone darkroom.safelight-on darkroom.safelight-hum darkroom.pull-chain darkroom.guard darkroom.switch darkroom.fluorescent-start darkroom.fluorescent-hum darkroom.slosh darkroom.lap darkroom.tray-land darkroom.drip darkroom.paper-grab darkroom.paper-dunk darkroom.timer-tick darkroom.timer-wind darkroom.timer-bell darkroom.enlarger-on darkroom.enlarger-fan darkroom.pour darkroom.brush darkroom.hairdryer darkroom.uv-hum darkroom.tap darkroom.bloom darkroom.pencil darkroom.radio'.split(' '),
  ...'plates.clack plates.plop plates.drip plates.glass plates.tink plates.fixChord plates.stamp plates.pen plates.paper plates.fog plates.unwrap plates.palette plates.pin plates.restore plates.lampSwing plates.wick plates.snap plates.wave plates.sea plates.slosh plates.flame plates.fizz plates.fogBell plates.arrival'.split(' '),
  ...'latent.key latent.seek latent.tape latent.chain-clink latent.clunk latent.bag-zip latent.bag-tick latent.kink latent.glug latent.rap latent.lid latent.timer-tick latent.timer-bell latent.enlarger-hum latent.relay latent.slosh latent.lap latent.tok latent.drip latent.fog-hiss latent.stamp latent.cluster latent.room latent.compressor latent.phone-ring latent.squelch latent.fax'.split(' '),
  ...'lensbench.leaf lensbench.cloth-fp lensbench.metal-fp lensbench.roller lensbench.cap lensbench.escapement lensbench.advance lensbench.rewind lensbench.detent lensbench.rub lensbench.clink lensbench.creak lensbench.ping lensbench.needle lensbench.chime lensbench.pour lensbench.glug lensbench.tick lensbench.bell lensbench.stamp lensbench.street lensbench.courier-bell lensbench.clock-bell lensbench.achromat'.split(' '),
  ...'studio.cicadas studio.crickets studio.wind studio.chime studio.sprinkler-tsk studio.sprinkler-return studio.spray studio.leaf studio.drop studio.focal studio.cap studio.selftimer studio.wind-on studio.thock studio.bellows studio.needle studio.swing-creak studio.sparrows studio.flutter studio.bark studio.pant studio.impact studio.screen-door studio.stairs studio.glug studio.lid studio.fixer-pour studio.tray-slosh studio.enlarger-hum studio.mail-truck'.split(' '),
]

const status = document.getElementById('status') as HTMLElement
const app = document.getElementById('app') as HTMLElement
const loops = new Map<string, LoopHandle>()

function build(): void {
  const groups = new Map<string, SoundDef[]>()
  for (const d of Audio.list()) {
    const g = groups.get(d.group) ?? []
    g.push(d)
    groups.set(d.group, g)
  }
  for (const [name, defs] of groups) {
    const h = document.createElement('h2')
    h.textContent = name
    app.appendChild(h)
    for (const d of defs) {
      const row = document.createElement('span')
      row.className = 'row'
      const b = document.createElement('button')
      b.className = 'ar-btn ar-btn--secondary'
      b.textContent = d.kind === 'loop' ? 'Loop' : 'Play'
      b.dataset.id = d.id
      b.addEventListener('click', () => {
        if (d.kind === 'loop') {
          const cur = loops.get(d.id)
          if (cur && !cur.stopped) {
            cur.stop()
            loops.delete(d.id)
            b.textContent = 'Loop'
          } else {
            loops.set(d.id, Audio.loop(d.id))
            b.textContent = 'Stop'
          }
        } else Audio.play(d.id)
        status.textContent = Audio.ready ? `${d.id}` : 'Audio is locked until a gesture lands.'
      })
      const c = document.createElement('code')
      c.textContent = d.id
      row.append(b, c)
      app.appendChild(row)
    }
  }
}
build()

interface Check {
  id: string
  ok: boolean
  detail?: string
}

const SR = 44100
const UI_BUS = 0.55
const MASTER = 0.7 // default volume
/** Static estimate of the output compressor (threshold -18 dB, ratio 4). */
const afterCompressor = (db: number): number => (db > -18 ? -18 + (db + 18) / 4 : db)

/** Largest jump between consecutive 16-sample block means (a step or click, not noise) in [from, to) seconds. */
function maxStep(ch: Float32Array, from: number, to: number): number {
  const B = 16
  let prev: number | null = null
  let worst = 0
  const a = Math.max(0, Math.floor(from * SR))
  const z = Math.min(ch.length, Math.floor(to * SR))
  for (let i = a; i + B <= z; i += B) {
    let m = 0
    for (let j = 0; j < B; j++) m += ch[i + j] as number
    m /= B
    if (prev !== null) worst = Math.max(worst, Math.abs(m - prev))
    prev = m
  }
  return worst
}

async function selftest(): Promise<{ ok: boolean; counts: Record<string, number>; failures: Check[]; levels: Record<string, number> }> {
  const failures: Check[] = []
  const counts = { registered: Audio.list().length, oneShots: 0, loops: 0, appendixB: APPENDIX_B.length }
  const levels: Record<string, number> = {}
  const fail = (id: string, detail: string): void => {
    failures.push({ id, ok: false, detail })
  }

  // 1. nothing before a gesture
  if (getAudio() !== null || Audio.context !== null) fail('gesture', 'an AudioContext exists before any gesture')

  // 2. every Appendix B id is registered
  for (const id of APPENDIX_B) if (!Audio.has(id)) fail(id, 'not registered')

  // 3. render everything offline
  for (const d of Audio.list()) {
    try {
      if (d.kind === 'oneshot') {
        counts.oneShots++
        const r = await renderOffline(d, {}, { sampleRate: SR })
        const st = analyze(r.buffer)
        levels[d.id] = Math.round(st.peakDb * 10) / 10
        if (st.nan) fail(d.id, 'NaN samples')
        else if (st.clipped) fail(d.id, `clips (${st.peakDb.toFixed(1)} dBFS)`)
        else if (st.peak < 0.0005) fail(d.id, `silent (${st.peakDb.toFixed(1)} dBFS)`)
        if (d.id.startsWith('ui.')) {
          const after = afterCompressor(st.peakDb + 20 * Math.log10(UI_BUS * MASTER))
          if (after > -12) fail(d.id, `ui peak ${after.toFixed(1)} dBFS after the compressor (limit -12)`)
          if (st.dur > 1) fail(d.id, `ui lasts ${st.dur.toFixed(2)} s (limit 1)`)
        }
      } else {
        counts.loops++
        const r = await renderOffline(d, {}, { sampleRate: SR, dur: 2.5 })
        const st = analyze(r.buffer)
        levels[d.id] = Math.round(st.rmsDb * 10) / 10
        if (st.nan) fail(d.id, 'NaN samples')
        else if (st.clipped) fail(d.id, `clips (${st.peakDb.toFixed(1)} dBFS)`)
        else if (st.peak < 0.00005) fail(d.id, `silent (${st.peakDb.toFixed(1)} dBFS)`)
        // the engine fades a loop in over 80 ms and out over 250 ms; model that and look for steps at both ends
        const ch = r.buffer.getChannelData(0).slice()
        for (let i = 0; i < ch.length; i++) {
          const t = i / SR
          const fin = Math.min(1, t / 0.08)
          ch[i] = (ch[i] as number) * fin
        }
        const startStep = maxStep(ch, 0, 0.03)
        const endStep = maxStep(ch, 2.5 - 0.02, 2.5)
        if (startStep > 0.2) fail(d.id, `start click ${startStep.toFixed(2)}`)
        if (endStep > 0.2) fail(d.id, `stop click ${endStep.toFixed(2)}`)
      }
    } catch (e) {
      fail(d.id, `render threw: ${String(e)}`)
    }
  }
  return { ok: failures.length === 0, counts, failures, levels }
}

installGameApi('shared:audio', 'shared-audio@1', {
  state: () => ({ ready: Audio.ready, registered: Audio.list().length, muted: Audio.muted, stats: Audio.stats() }),
  selftest,
  ids: () => Audio.list().map((d) => d.id),
  play: (id: string, params?: Record<string, number>) => !!Audio.play(id, params),
  Audio,
})
void nextFrame().then(() => markReady())
