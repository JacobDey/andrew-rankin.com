# @shared/ui and @shared/games

The chrome: the film-strip shell, tokens, buttons, dialogs, toasts, loader, fallback cards, help datasheet, icons, grease pencil, grain. Plain DOM and CSS, no three, hub-safe. Owner: shared-platform. Spec: `docs/design/art-direction.md` §3-§11, `docs/design/hub.md` §9-§10, `docs/architecture.md` §4.3. `src/shared/games.ts` is the registry (pure data).

## Page recipe

```ts
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import { mountShell, guardStartup, hasWebGL2, showNoWebGL, showLoader, toast } from '@shared/ui'

const stage = document.getElementById('stage')!          // <main id="stage" class="ar-stage" tabindex="-1">
const shell = mountShell({ slug: 'darkroom', actions: [...], help: {...}, returnFocus: () => stage.focus() })
await guardStartup(stage, async () => {
  if (!hasWebGL2() && !flags().force) return showNoWebGL(stage)
  const loader = showLoader(stage, { label: 'Mixing chemistry…' })
  // ... boot ...
  await loader.done(); markReady()
})
```

`mountShell` reads the registry (title, frame, accent, scheme), sets `data-game` if the page lacks it, applies the scheme lock (`data-scheme-lock` and `data-theme`), calls `Audio.arm()`, installs grain (unless `data-grain="off"`) and the grease filter, publishes `--ar-shell-total`, and opens help once after the game calls `markReady()`. In `?embed=poster` it sets `<html data-embed="poster">`, builds the bar hidden (`display: none`), puts the stage at `inset: 0`, and skips audio and help. With `?test=1` help does not open by itself.

## What is exported (`@shared/ui`)

`mountShell` `mountHubShell` `shouldGameIgnoreKey` (types `ShellAction` `HelpContent` `ShellOptions` `Shell`) · `toast` `announce` · `showLoader` · `hasWebGL2` `showNoWebGL` `showCrashCard` `guardStartup` · `getTheme` `setTheme` `onThemeChange` `schemeLock` `prefersReducedMotion` `THEME_BOOT_SCRIPT` · `openDialog` `confirmDialog` · `bindRange` `createSwitch` `createSegmented` · `openMenu` · `openHelp` · `ICONS` `iconSvg` `IconName` · `circlePath` `underlinePath` `checkPath` `arrowPath` `starPath` `cropMarksPath` `questionPath` `drawStroke` `ensureGreaseFilter` · `installGrain`.
CSS classes (prefix `ar-`): `.ar-btn` (+ `--primary --secondary --ghost --on-film --icon --sm --lg`), `.ar-switch`, `.ar-seg`, `input.ar-range`, `.ar-panel`, `.ar-dialog`, `.ar-toast`, `.ar-edge`, `kbd`, `.ar-stage` (+ `--under-shell`), `.ar-skip`, `.visually-hidden`. Tokens: `--ar-*`, `--game-accent`, `--game-accent-lit`.

## Additions and deviations

- Additive exports: `liveRegion()` (the shared polite region), `attachTooltip` / `hideTooltip` (film-black tooltips), `.ar-edge`, `.ar-mono`, `.ar-range-wrap`, `.ar-drop-hover` (a `hoverClass` for `onFileDrop`). `openHelp(slug, content, { onClose })` takes an optional third argument.
- Types for the shell API are defined in `shell.ts` and re-exported from the barrel. Scheme and overflow behaviour follow hub.md §9.4-9.5: phones (under 768 px) show only help, sound and More (all game actions, Lights and Fullscreen fold in); wider bars fold the least important actions (highest `priority` number, default = array index) into More until the bar fits, keeping the title at its natural width (112-240 px).
- **Lights button** shows the icon and label of the theme it switches **to**: `safelight` and "Lights off" while the page is light, `lights` and "Lights on" while it is dark. It exists only when the registry scheme is `auto` and the page has no `data-scheme-lock`.
- Fullscreen: while fullscreen the bar auto-hides and `<html data-fullscreen>` is set; `base.css` then gives `.ar-stage` `inset: 0`. Auto-hide dispatches a `window` event `ar:shellvisibility` (`detail.hidden`). The stage never resizes for auto-hide alone: use `.ar-stage--under-shell` if you want full-bleed.
- Back plays `advance`, is a normal link (middle-click works), and `confirmLeave()` returning a message turns a plain left click into a Stay / Leave datasheet.
- `mountHubShell` finds the page's wordmark through `[data-hub-wordmark]`, else `main h1`, else the first `h1` outside the shell, and slides "Andrew Rankin" into the bar when it scrolls out of view.
- `showCrashCard` logs the error with `console.error` (it is a real failure; the harness will report it). `showNoWebGL` and `showCrashCard` read the title and frame from `<html data-game>`.
- Fonts are the Fontsource packages (R1 is done): Archivo `wdth.css`, Fraunces `full.css` + `full-italic.css`, Plex Mono 400/500/600, Caveat `wght.css`. No third-party requests.
- `tokens.css` is the art-direction §4.1 block verbatim plus `:root[data-motion="reduce"]` and the `[data-embed="poster"]` rules. `base.css` includes `@view-transition { navigation: auto }` and the six `#stage` `view-transition-name`s (no preference for motion only).
- `@shared/ui` imports the **lean audio entry** (`@shared/audio/core`), so the hub never pays for the sound library. If you need `uiSound` in hub code, import it from `@shared/audio/core` (16 KB gz for shell + core + storage + audio core + CSS 8 KB gz measured; the full `@shared/audio` barrel adds about 15 KB gz).

## `@shared/games`

`GameSlug` `GreaseMark` `GameInfo` `SITE` `GAMES` `gameBySlug`. Entries are architecture Appendix A, which overrides hub.md §10 (so plates is "Ruby Sector" and studio is "Sunny 16"); `SITE.repoUrl` is set to the GitHub repo (R5 is done). All six start `status: 'developing'`.

## Acceptance

`/src/shared/ui/dev/` is a fake game page (`?game=<slug>`; `?view=` is one of `toast error dialog confirm custom loader nowebgl crash menu autohide hub`; `?embed=poster`, `?theme=`, `?confirm=1`). `__game.selftest()` (7 layout and a11y checks) and `__game.interact()` (15 checks: help, `?` key, sound and lights persistence, one toast at a time, toggle actions, `confirmLeave`) both pass. Shots in `shots/shared-ui/`.

```
node scripts/shoot.mjs "/src/shared/ui/dev/index.html?game=darkroom" --out shots/shared-ui/desktop-dark.png
node scripts/shoot.mjs "/src/shared/ui/dev/index.html?game=studio&view=dialog" --mobile --out shots/shared-ui/mobile-dialog.png
node scripts/shoot.mjs "/src/shared/ui/dev/index.html?game=texturedle&view=menu" --mobile --out shots/shared-ui/mobile-menu.png
node scripts/shoot.mjs "/src/shared/ui/dev/index.html?game=darkroom&embed=poster" --out shots/shared-ui/poster.png
node scripts/shoot.mjs "/src/shared/ui/dev/index.html?game=studio&confirm=1" --eval "__game.interact().then(r => r.ok)"
```
