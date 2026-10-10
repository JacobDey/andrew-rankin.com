// Icon set (art-direction §8): 24x24 grid, rendered at 20px, stroke 1.75, round caps and joins.

export type IconName =
  | 'back'
  | 'sheet'
  | 'help'
  | 'sound'
  | 'sound-off'
  | 'lights'
  | 'safelight'
  | 'fullscreen'
  | 'more'
  | 'close'
  | 'save'
  | 'load'
  | 'reset'
  | 'download'
  | 'loupe'
  | 'import'

const p = (d: string, extra = ''): string => `<path d="${d}"${extra}/>`

/** Inner SVG markup on the 24x24 grid. */
export const ICONS: Record<IconName, string> = {
  back: p('M19 12H5') + p('M11 6l-6 6 6 6'),
  sheet:
    '<rect x="3" y="5" width="18" height="14" rx="1.5"/>' +
    p('M3 8.5h18M3 15.5h18') +
    p('M6.5 6.75h0M10.5 6.75h0M14.5 6.75h0M18.5 6.75h0M6.5 17.25h0M10.5 17.25h0M14.5 17.25h0M18.5 17.25h0'),
  help: '<circle cx="12" cy="12" r="9"/>' + p('M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.7v.4') + p('M12 17h0'),
  sound: p('M4 9.5h3.5L12 6v12l-4.5-3.5H4z') + p('M15.5 9a4.2 4.2 0 0 1 0 6') + p('M18 6.5a7.6 7.6 0 0 1 0 11'),
  'sound-off': p('M4 9.5h3.5L12 6v12l-4.5-3.5H4z') + p('M16 9.5l5 5M21 9.5l-5 5'),
  lights: p('M9 18h6M10 21h4') + p('M12 3a6 6 0 0 0-3.6 10.8c.6.5.6 1.2.6 2.2h6c0-1 0-1.7.6-2.2A6 6 0 0 0 12 3z'),
  safelight:
    p('M9 18h6M10 21h4') +
    p('M12 3a6 6 0 0 0-3.6 10.8c.6.5.6 1.2.6 2.2h6c0-1 0-1.7.6-2.2A6 6 0 0 0 12 3z') +
    p('M12 7v3', ' stroke="var(--ar-accent)"'),
  fullscreen: p('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  more: p('M5 12h0M12 12h0M19 12h0', ' stroke-width="2.5"'),
  close: p('M6 6l12 12M18 6 6 18'),
  save: '<rect x="5" y="7" width="11" height="13" rx="1.5"/>' + p('M8 4.5h5V7H8z') + p('M16 10h4v6h-4'),
  load: p('M4 7h6l2 2h8v10H4z'),
  reset: p('M4 12a8 8 0 1 0 2.4-5.7') + p('M4 4v4h4'),
  download: p('M12 4v10') + p('M8 10l4 4 4-4') + p('M4 16v4h16v-4'),
  loupe: p('M7 20h10l-1.6-8H8.6z') + '<ellipse cx="12" cy="9.5" rx="5" ry="2.5"/>',
  import: p('M12 20V10') + p('M8 14l4-4 4 4') + p('M4 8V4h16v4'),
}

/** A complete inline <svg> string. Decorative unless `title` is given. */
export function iconSvg(name: IconName, o: { size?: number; title?: string; className?: string } = {}): string {
  const size = o.size ?? 20
  const cls = o.className ? ` class="${o.className}"` : ''
  const a11y = o.title ? ` role="img" aria-label="${o.title.replace(/"/g, '&quot;')}"` : ' aria-hidden="true" focusable="false"'
  const title = o.title ? `<title>${o.title.replace(/</g, '&lt;')}</title>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"${cls}${a11y} ` +
    `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${title}${ICONS[name]}</svg>`
  )
}
