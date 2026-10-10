// No-WebGL2 and crash cards (art-direction §7.9) plus the start-up guard.

import { GAMES, gameBySlug, type GameSlug } from '../games'

let glOk: boolean | null = null

/** True when a WebGL2 context can be created (cached). */
export function hasWebGL2(): boolean {
  if (glOk !== null) return glOk
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    glOk = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    glOk = false
  }
  return glOk
}

function currentSlug(): GameSlug | null {
  const g = document.documentElement.getAttribute('data-game')
  return GAMES.some((x) => x.slug === g) ? (g as GameSlug) : null
}

function frameLabel(): string {
  const slug = currentSlug()
  return slug ? `▸${String(gameBySlug(slug).frame).padStart(2, '0')}` : '▸00'
}

function gameTitle(override?: string): string {
  if (override) return override
  const slug = currentSlug()
  return slug ? gameBySlug(slug).title : 'This game'
}

function card(stage: HTMLElement, edge: string, title: string, body: string, build: (actions: HTMLElement, bodyEl: HTMLElement) => void): HTMLElement {
  stage.querySelector('.ar-card-wrap')?.remove()
  const wrap = document.createElement('div')
  wrap.className = 'ar-card-wrap'
  const c = document.createElement('section')
  c.className = 'ar-card'
  c.setAttribute('role', 'alert')
  c.innerHTML = '<div class="ar-card__head"><div class="ar-film-bg" aria-hidden="true"></div><span class="ar-edge"></span></div><div class="ar-card__body"><h2 class="ar-card__title"></h2><p></p><div class="ar-card__actions"></div></div>'
  ;(c.querySelector('.ar-card__head .ar-edge') as HTMLElement).textContent = edge
  ;(c.querySelector('.ar-card__title') as HTMLElement).textContent = title
  ;(c.querySelector('.ar-card__body p') as HTMLElement).textContent = body
  build(c.querySelector('.ar-card__actions') as HTMLElement, c.querySelector('.ar-card__body') as HTMLElement)
  wrap.appendChild(c)
  stage.appendChild(wrap)
  return wrap
}

function link(label: string, href: string, kind: 'primary' | 'secondary'): HTMLAnchorElement {
  const a = document.createElement('a')
  a.className = `ar-btn ar-btn--${kind}`
  a.href = href
  a.textContent = label
  return a
}

/**
 * "This one needs a graphics boost." with Contact sheet and Try anyway (reloads with ?force=1).
 * `extra` is appended to the card body (e.g. a game's records-only fallback button).
 */
export function showNoWebGL(stage: HTMLElement, o: { title?: string; extra?: HTMLElement } = {}): void {
  const t = gameTitle(o.title)
  card(
    stage,
    `${frameLabel()} · NO SIGNAL`,
    'This one needs a graphics boost.',
    `${t} runs on WebGL 2, which this browser has switched off or doesn't support. A recent Chrome, Edge, Firefox or Safari will work, or try turning on hardware acceleration in your browser settings.`,
    (actions, body) => {
      actions.appendChild(link('Contact sheet', '/', 'primary'))
      const again = document.createElement('a')
      again.className = 'ar-btn ar-btn--secondary'
      const u = new URL(location.href)
      u.searchParams.set('force', '1')
      again.href = u.pathname + u.search + u.hash
      again.textContent = 'Try anyway'
      actions.appendChild(again)
      if (o.extra) body.appendChild(o.extra)
    },
  )
}

/** "The film jammed." with Reload and Contact sheet, and the error message for the curious. */
export function showCrashCard(stage: HTMLElement, err: unknown, o: { title?: string } = {}): void {
  const t = gameTitle(o.title)
  const msg = err instanceof Error ? (err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : `${err.name}: ${err.message}`) : String(err)
  card(stage, `${frameLabel()} · FILM JAMMED`, 'The film jammed.', `Something went wrong while ${t} was loading. Reloading usually unjams it.`, (actions, body) => {
    const reload = document.createElement('button')
    reload.type = 'button'
    reload.className = 'ar-btn ar-btn--primary'
    reload.textContent = 'Reload'
    reload.addEventListener('click', () => location.reload())
    actions.append(reload, link('Contact sheet', '/', 'secondary'))
    const d = document.createElement('details')
    const s = document.createElement('summary')
    s.textContent = 'What happened'
    const pre = document.createElement('pre')
    pre.textContent = msg
    d.append(s, pre)
    body.appendChild(d)
  })
  console.error('[startup] crash:', err)
}

/** Run a game's start-up; on any throw or rejection show the crash card instead of a blank page. */
export async function guardStartup(stage: HTMLElement, start: () => Promise<void> | void): Promise<void> {
  try {
    await start()
  } catch (e) {
    showCrashCard(stage, e)
  }
}
