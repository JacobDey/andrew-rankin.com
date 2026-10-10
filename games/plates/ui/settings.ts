// games/plates/ui/settings.ts — the settings sheet: Sound, Reduced motion, Hurry the chemistry,
// Read the Return in Bone, Start again (with confirmation), and the credits.
import { SETTINGS, CREDITS } from '../story/text'

export interface SettingsState { sound: boolean; reduced: boolean; hurry: boolean; bone: boolean }
export interface SettingsSheet { el: HTMLElement; toggle(): void; sync(s: SettingsState): void; readonly open: boolean }

export function createSettings(root: HTMLElement, on: { change(k: keyof SettingsState, v: boolean): void; restart(): void }): SettingsSheet {
  const el = document.createElement('div'); el.className = 'pl-settings'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Settings')
  const keys: [keyof SettingsState, string][] = [['sound', SETTINGS.sound], ['reduced', SETTINGS.reduced], ['hurry', SETTINGS.hurry], ['bone', SETTINGS.bone]]
  el.innerHTML = `${keys.map(([k, l]) => `<button type="button" class="pl-chrome-btn" data-k="${k}" aria-pressed="false">${l}</button>`).join('')}
    <button type="button" class="pl-chrome-btn" data-restart>${SETTINGS.restart}</button>
    <div class="pl-confirm" hidden><p><em>${SETTINGS.restartQ}</em></p><button type="button" class="pl-chrome-btn" data-wipe>${SETTINGS.wipe}</button> <button type="button" class="pl-chrome-btn" data-keep>${SETTINGS.keep}</button></div>
    <div class="pl-credits">${CREDITS.map((c) => `<p>${c}</p>`).join('')}</div>`
  root.appendChild(el)
  let state: SettingsState = { sound: true, reduced: false, hurry: false, bone: false }
  const confirm = el.querySelector('.pl-confirm') as HTMLElement
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return
    if (b.dataset.k) { const k = b.dataset.k as keyof SettingsState; state = { ...state, [k]: !state[k] }; sheet.sync(state); on.change(k, state[k]) }
    else if (b.hasAttribute('data-restart')) confirm.hidden = false
    else if (b.hasAttribute('data-keep')) confirm.hidden = true
    else if (b.hasAttribute('data-wipe')) { confirm.hidden = true; on.restart() }
  })
  const sheet: SettingsSheet = {
    el, get open() { return !el.hidden },
    toggle() { el.hidden = !el.hidden; confirm.hidden = true },
    sync(s) { state = s; el.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(state[b.dataset.k as keyof SettingsState]))) },
  }
  return sheet
}
