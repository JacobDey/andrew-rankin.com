// The Tank (lensbench.md §4.4, §5.10 "Tank timing", §7 "Tank"): ~30 s of real time/temperature/
// agitation development. 1 real second = 20 process seconds.
import type { DevParams, RollRecord, Screen } from '../core/types'
import type { App } from '../core/app'
import { STOCKS } from '../core/catalog'
import { sfx } from '../audio/audio'

const STEPS = ['Load', 'Developer', 'Develop', 'Stop', 'Fix', 'Wash', 'Hang'] as const

export interface TankScreen extends Screen { develop(o?: Partial<DevParams>): Promise<string[]> }

export function createTankScreen(root: HTMLElement, app: App): TankScreen {
  root.classList.add('lb-tank')
  root.innerHTML = `
    <ol class="lb-timeline">${STEPS.map((s) => `<li>${s}</li>`).join('')}</ol>
    <div class="lb-tank-body">
      <div class="lb-chart-card"><div class="lb-h">Q.'s chart</div><div class="lb-chart-rows"></div></div>
      <div class="lb-sink">
        <div class="lb-tankcan" role="button" tabindex="0" aria-label="Invert the tank"><div class="lb-lid"></div><div class="lb-lamp"></div></div>
        <div class="lb-tank-msg" aria-live="polite"></div>
        <div class="lb-tank-actions">
          <button class="lb-chip primary" data-a="pour">Pour developer</button>
          <button class="lb-chip" data-a="invert">Invert (Space)</button>
          <button class="lb-chip" data-a="drain">Pour out</button>
          <button class="lb-chip" data-a="next">Next step</button>
        </div>
        <div class="lb-lab" hidden><label><input type="radio" name="push" value="0" checked> normal</label><label><input type="radio" name="push" value="1"> push 1</label><label><input type="radio" name="push" value="-1"> pull 1</label><button class="lb-chip primary" data-a="lab">Send to the lab</button></div>
      </div>
      <div class="lb-instruments">
        <label class="lb-thermo"><span>Temp</span><input type="range" min="16" max="26" step="0.5" value="20" aria-label="Developer temperature"><output>20 °C</output></label>
        <svg class="lb-timer" viewBox="0 0 100 100" aria-label="Process timer"><circle cx="50" cy="50" r="44" fill="#f4f1ea" stroke="#17181A" stroke-width="4"/><line class="lb-timer-hand" x1="50" y1="50" x2="50" y2="12" stroke="#d8432c" stroke-width="3"/><text x="50" y="72" text-anchor="middle" class="lb-timer-txt">0:00</text></svg>
      </div>
    </div>`
  const msg = root.querySelector('.lb-tank-msg') as HTMLElement
  const steps = [...root.querySelectorAll<HTMLLIElement>('.lb-timeline li')]
  const thermo = root.querySelector('.lb-thermo input') as HTMLInputElement
  const thermoOut = root.querySelector('.lb-thermo output') as HTMLOutputElement
  const hand = root.querySelector('.lb-timer-hand') as SVGLineElement
  const txt = root.querySelector('.lb-timer-txt') as SVGTextElement
  const can = root.querySelector('.lb-tankcan') as HTMLElement
  const lamp = root.querySelector('.lb-lamp') as HTMLElement
  const chartRows = root.querySelector('.lb-chart-rows') as HTMLElement
  const lab = root.querySelector('.lb-lab') as HTMLElement

  let active = false
  let phase = 0 // index in STEPS
  let procS = 0 // process seconds in the developer
  let running = false
  let prompts = 0, answered = 0
  let lastPrompt = -1, promptAt = -1
  let roll: RollRecord | null = null
  let busy = false

  const pending = () => [...app.store.rolls.values()].filter((r) => r.state === 'rewound')
  function render() {
    roll = pending()[0] ?? null
    steps.forEach((li, i) => { li.classList.toggle('done', i < phase); li.classList.toggle('now', i === phase) })
    thermoOut.textContent = `${thermo.value} °C`
    const m = Math.floor(procS / 60), s = Math.floor(procS % 60)
    txt.textContent = `${m}:${String(s).padStart(2, '0')}`
    hand.setAttribute('transform', `rotate(${(procS / 60) * 36} 50 50)`)
    chartRows.innerHTML = Object.values(STOCKS).filter((x) => x.id !== 'ir820' && x.id !== 'nightjar1600').map((x) => `<div><span>${x.name}</span><b>${x.colour ? 'lab' : `${Math.floor(x.normalMin)}:${String(Math.round((x.normalMin % 1) * 60)).padStart(2, '0')}`}</b></div>`).join('')
    if (!roll) { msg.textContent = app.store.roll()?.frames.length ? 'Rewind the roll on the street (⟲) to develop it.' : 'No film to develop. Go and shoot something.'; lab.hidden = true; return }
    const st = STOCKS[roll.stock]
    lab.hidden = !st.colour
    const unrendered = roll.frames.filter((id) => app.store.frames.get(id)?.status === 'exposed').length
    if (busy) return
    msg.textContent = st.colour ? `${st.name}: colour goes to the lab in an envelope.` :
      phase === 0 ? `${st.name}, ${roll.frames.length} frame${roll.frames.length > 1 ? 's' : ''}. Normal: ${st.normalMin} min at 20 °C.${unrendered ? ` (${unrendered} still in the camera’s memory)` : ''}` :
      phase === 2 ? (running ? 'Developing. Invert when the lamp blinks.' : 'Developer poured.') : phase >= 3 && phase < 6 ? `${STEPS[phase]}: tap Next step.` : ''
  }

  async function finish(dev: DevParams): Promise<string[]> {
    const r = roll ?? pending()[0]
    if (!r) return []
    busy = true
    msg.textContent = 'Hanging to dry…'
    const ids = await app.developRoll(r.id, dev, (p) => { msg.textContent = `Rendering the latent images… ${Math.round(p * 100)}%` })
    busy = false
    phase = 6
    sfx.bell()
    msg.textContent = `${ids.length} frame${ids.length === 1 ? '' : 's'} on the line. To the lightbox.`
    render()
    app.pulseTab('lightbox')
    phase = 0; procS = 0
    return ids
  }

  function devParams(): DevParams {
    return { developer: 'mq', minutes: procS / 60, tempC: Number(thermo.value), agitation: prompts ? answered / prompts : 1 }
  }
  function invert() {
    if (!running) return
    sfx.glug()
    can.classList.remove('flip'); void can.offsetWidth; can.classList.add('flip')
    if (promptAt >= 0 && performance.now() - promptAt < 1500) { answered++; promptAt = -1; lamp.classList.remove('on') }
  }
  root.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a
    if (!a) return
    sfx.unlock()
    if (!roll) return
    if (a === 'pour' && phase <= 1) { phase = 2; running = true; procS = 0; prompts = 0; answered = 0; lastPrompt = 0; sfx.pour(); render() }
    else if (a === 'invert') invert()
    else if (a === 'drain' && phase === 2) { running = false; phase = 3; sfx.pour(); render() }
    else if (a === 'next' && phase >= 3 && phase < 6) {
      phase++
      sfx.pour()
      render()
      if (phase === 6) void finish(devParams())
    } else if (a === 'lab') {
      const push = Number((root.querySelector('input[name="push"]:checked') as HTMLInputElement | null)?.value ?? 0)
      void finish({ developer: 'lab', minutes: 0, tempC: 20, agitation: 1, pushStops: push })
    }
  })
  can.addEventListener('pointerdown', () => invert())
  thermo.addEventListener('input', () => render())
  const onKey = (e: KeyboardEvent) => {
    if (!active) return
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); invert() }
    else if (e.code === 'Enter') (root.querySelector(phase <= 1 ? '[data-a="pour"]' : phase === 2 ? '[data-a="drain"]' : '[data-a="next"]') as HTMLButtonElement | null)?.click()
  }
  window.addEventListener('keydown', onKey)

  return {
    develop: async (o?: Partial<DevParams>) => {
      roll = pending()[0] ?? null
      if (!roll) return []
      const st = STOCKS[roll.stock]
      const dev: DevParams = st.colour ? { developer: 'lab', minutes: 0, tempC: 20, agitation: 1, pushStops: o?.pushStops ?? 0 }
        : { developer: o?.developer ?? 'mq', minutes: o?.minutes ?? st.normalMin, tempC: o?.tempC ?? 20, agitation: o?.agitation ?? 1, pushStops: o?.pushStops }
      phase = 2; procS = dev.minutes * 60
      render()
      return finish(dev)
    },
    enter() { active = true; root.hidden = false; render() },
    exit() { active = false; root.hidden = true },
    update(dt: number) {
      if (!active) return
      if (running) {
        procS += dt * 20
        const minute = Math.floor(procS / 60)
        if (minute > lastPrompt) { lastPrompt = minute; prompts++; promptAt = performance.now(); lamp.classList.add('on'); sfx.tick() }
        if (promptAt >= 0 && performance.now() - promptAt > 1500) { promptAt = -1; lamp.classList.remove('on') }
        render()
      }
    },
    dispose() { window.removeEventListener('keydown', onKey) },
  }
}
