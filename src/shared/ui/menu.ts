// Overflow / context menu: a paper popover (art-direction §7.7).

import { iconSvg, type IconName } from './icons'
import { uiSound } from '../audio/core'

export interface MenuItem {
  id: string
  label: string
  icon?: IconName
  checked?: boolean
  disabled?: boolean
  onSelect(): void
}

let openMenuState: { close(): void } | null = null

/** Opens a menu below `anchor`, right-aligned to it. Arrow keys move, Esc closes and returns focus to the anchor. */
export function openMenu(anchor: HTMLElement, items: MenuItem[]): { close(): void } {
  openMenuState?.close()
  const menu = document.createElement('div')
  menu.className = 'ar-menu'
  menu.setAttribute('role', 'menu')
  const hasPopover = typeof menu.showPopover === 'function'
  if (hasPopover) menu.setAttribute('popover', 'manual')

  const buttons: HTMLButtonElement[] = []
  for (const it of items) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'ar-menu__item'
    b.setAttribute('role', it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem')
    if (it.checked !== undefined) b.setAttribute('aria-checked', String(it.checked))
    b.disabled = !!it.disabled
    b.innerHTML = (it.icon ? iconSvg(it.icon) : '') + '<span></span>'
    ;(b.querySelector('span') as HTMLElement).textContent = it.label
    if (it.checked) {
      const c = document.createElement('span')
      c.className = 'ar-menu__check'
      c.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'
      b.appendChild(c)
    }
    b.addEventListener('click', () => {
      close(false)
      it.onSelect()
    })
    buttons.push(b)
    menu.appendChild(b)
  }

  let closed = false
  function close(restoreFocus = true): void {
    if (closed) return
    closed = true
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', onResize)
    anchor.setAttribute('aria-expanded', 'false')
    if (hasPopover) {
      try {
        menu.hidePopover()
      } catch {
        /* already hidden */
      }
    }
    menu.remove()
    if (openMenuState === handle) openMenuState = null
    if (restoreFocus) anchor.focus({ preventScroll: true })
  }
  const onOutside = (e: Event): void => {
    const t = e.target as Node
    if (!menu.contains(t) && !anchor.contains(t)) close(false)
  }
  const onResize = (): void => close(false)
  const focusables = (): HTMLButtonElement[] => buttons.filter((b) => !b.disabled)
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    const list = focusables()
    if (!list.length) return
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') list[(i + 1) % list.length]!.focus()
    else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]!.focus()
    else if (e.key === 'Home') list[0]!.focus()
    else if (e.key === 'End') list[list.length - 1]!.focus()
    else if (e.key === 'Tab') {
      close(false)
      return
    } else return
    e.preventDefault()
    uiSound('tick')
  }

  document.body.appendChild(menu)
  if (hasPopover) menu.showPopover()
  // position: below the anchor, right edges aligned, clamped to the viewport
  const r = anchor.getBoundingClientRect()
  const mw = menu.offsetWidth
  const mh = menu.offsetHeight
  const left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw))
  let top = r.bottom + 6
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6)
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
  anchor.setAttribute('aria-expanded', 'true')
  document.addEventListener('pointerdown', onOutside, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', onResize)
  focusables()[0]?.focus({ preventScroll: true })

  const handle = { close: () => close() }
  openMenuState = handle
  return handle
}
