# Build report: hub (done)

The hub is built and verified. The landing page at / is the Roll 01 contact sheet, and /404.html is "Frame not found." index.html is complete static HTML: the intro, six frames with edge printing, DX bars, perforations and captions, the dictation card, the footer, the skip link and <noscript> posters. src/hub/main.ts layers the rest on top: the shell in hub mode, six procedural 2D-canvas previews driven by one adaptive rAF runner, black-and-white to colour on hover, focus or scroll-centre, grease-pencil circles, permanent marks and progress notes, annotations on the dictation card, the loupe (mouse and press-and-hold touch), UI sounds, a prefetch fallback, restoring the frame you came back from, the power-on flicker, the safelight Easter egg (M4) and the full window.__game debug API (hub.md §15). Also done: ?og=<slug|hub> and ?poster=<slug> modes, stand-in JPEGs in public/posters/*.jpg and public/og/{hub,6 games}.jpg (game pages' og:image now resolves), smoke step files, and src/hub/README.md. Verified by screenshots at 1440x900, 1280x800 and 390x844, in light, dark and reduced motion, with zero errors. The core loop walks end to end: hover activates the frame in colour, clicking lands on /games/<slug>/ and writes ar:hub:last. A hub-only production build into the scratchpad (since deleted) gave about 42 KB gzipped of JS on first load (core 19.1 + main 22.7; og is lazy at 1.5) and 11.7 KB of CSS, with no three or rapier.

## Works

- index.html: the static, accessible contact sheet. The frame markup is generated from the registry by src/hub/dev/render-frames.mjs; __game.lintRegistry() returns [] and syncRegistry() patches any drift at runtime
- Layout from container queries: 3, 2 or 1 columns; 1u = cell/38 geometry (35mm pitch), masked perforations, edge print, DX barcode, loupe-only edge jokes (even frames on top, odd frames as vertical side text), per-row hand-laid wobble and scissor-cut ends (seeded; off at 1 column and under reduced motion)
- First strip above the fold: at 1440x900 its bottom is at y=898; on a 390x844 phone frame 1 is fully visible (strip 504 to 781). No horizontal scroll at 390
- Previews (src/hub/previews/*): texturedle (relit height and normal maps, parallax, refracting marble, scale bar), darkroom (enamel tray, slosh wobble, highlight band, fern cyanotype developing, white-light wash), plates/Ruby Sector (strict 1-bit, stochastic development, velvet flip, magnifier on a face), latent (WINDOW typed, six negative strips, a dither print coming up, swinging ▸04A tag), lensbench (real 2D Snell trace, 3 wavelengths, iris f/2 to f/8, spot on the ground glass), studio (cutaway house, swaying tree, bouncing ball, flash under 25%, film path, print developing). Every draw is deterministic in t
- Runner: one rAF loop; idle 10 fps at 1/3 speed, active 30 fps; IntersectionObserver and hidden-tab pauses; DPR by state (1.5 idle, 2 active, 2.5x up to 1100 px under the loupe); adaptive degrade when p90 > 6 ms. Animation is held until all six previews are initialised. Live run in headless: ready in about 3 s, p90 3.9 ms, no degrade; bench() draw cost 0.2 to 2.4 ms per preview
- Activation: hover/focus on fine pointers, IntersectionObserver middle band (-42%) on touch; colour develop, red grease circle (fresh seed per visit), accent title underline, tick and develop sounds, pressed state, shutter and haptic on click, dictation-card checks drawn per frame
- Permanent yellow marks and notes for all six mark types; progress notes in white grease plus a tally (pencil grey when older than 60 days) and accessible 'Your progress: …' text; they update on storage events. Tested with ar:darkroom:hub and ar:texturedle:hub
- Loupe: a DOM clone of the exposed sheet with live canvas mirroring, eased motion, cast shadow, Alt+wheel magnification, hidden on scroll and blur, persisted ar:hub:loupe toggle synced to the shell button. Touch: a 350 ms hold opens it 100 px above the finger, drag moves it, release closes it and swallows the click, context menu suppressed during a hold, 10 ms haptic
- Keyboard: skip link first, Tab into frame links, arrow keys between frames (up/down in one column), focus ring around the image plus activation
- Light table: glow layer, diffuser grid, halo, power-on flicker (inline pre-paint script, once per session, light theme only, not under reduced motion); dark safelight crossfade; dark paper colours; safelight pull-chain egg (≥1024 px) with the loupe as an untinted torch
- Footer: repo link from SITE.repoUrl, Match my system, Sound on/off; edge print and credits
- Dictation card: verbatim text with visually hidden correction; grease circle and arrow on 'Cyanide' with the note placed in the nearest free line space; 'sp?' beside 'obrah dinn'; bracket plus "friend's request" note on item 6. Measured with the card's tilt lifted, and re-laid out on font load and reflow
- ?og=<slug|hub> 1200x630 and ?poster=<slug> 1200x800 compositions; public/posters/*.jpg (6) and public/og/*.jpg (7) generated with shoot.mjs
- 404.html with the shell in hub mode, a fogged frame, a drawn grease circle and a 'Contact sheet' primary button; no loupe button there
- window.__game: state, activate, freeze, loupeAt, setTheme, safelight, lintRegistry, bench, previewHash; ready = fonts loaded + all previews initialised; URL flags ?t= ?theme= ?motion= ?loupe=x,y ?og= ?poster=
- Forced-colours and reduced-motion CSS; view-transition-name frame-<slug> on each .hub-image (set to none inside the loupe clone)
- src/hub/test/smoke.steps.json and smoke.mobile.steps.json both pass with __game.errors() == []; tsc is clean for src/hub/**

## Missing

- Live peek iframes (hub.md §11.4, M4 stretch, behind a flag that defaults to off): not built
- Real game posters: public/posters/*.jpg are procedural stand-ins until scripts/posters.mjs (R3) captures the games; afterwards re-run the ?og= shots so the OG cards pick up the real posters
- Phase-2 retune of each preview against the finished games (hub.md §4.3), which needs the games to exist
- No Lighthouse or axe-core run was possible in this environment; accessibility was checked by structure, keyboard flow and contrast tokens only. Forced-colours mode was not checked by eye
- No docs/build handoff note: the brief named none and docs/ is off-limits; src/hub/README.md carries the equivalent

## Known bugs

- In dev only, the hub turns cross-document view transitions off (an injected @view-transition { navigation: none }). Vite injects each game page's CSS from JS, so the game page has not opted in when it is revealed, and Chrome reported the skipped transition as an uncaught InvalidStateError on the game page. Production pages link their CSS in <head>, so the enlargement stays on there, but it is untested in a production preview
- Under SwiftShader the loupe's 2.5x clone and the canvas readbacks (marble refraction, bloom) are slow to composite, so headless live runs can take several seconds to reach ready. On real GPUs the JS draw cost is 0.2 to 2.4 ms per preview
- Stand-in posters: latent.jpg is 215 KB, over the 140 KB target. shoot.mjs cannot set JPEG quality
- Strict 1-bit is not quite strict on the Ruby Sector magnifier ring: the canvas anti-aliases the ring strokes

## API deviations

- Frame classes use the hub- prefix (hub-sheet, hub-frame, hub-strip, …) per architecture §3.5 rather than the unprefixed .sheet/.frame names in hub.md §3.2
- Card link pattern: the article carries aria-labelledby; aria-describedby (blurb, meta, progress) sits on the h3 link rather than the article, so it is announced on focus. Meta id is m-<slug> and progress id is p-<slug>
- Activation circle: circlePath(image rect expanded by about 0.5u) instead of 1.5u, because the shared circlePath already pads about 16%; at 1.5u the loop spilled well into neighbouring frames
- The permanent-note positions for question, crop and arrow are nudged so they do not sit on the edge print. The arrow starts on the bottom rebate rather than inside the caption, so it never crosses caption text
- Desktop dictation card: 12 px Plex Mono (13 px when the card is ≥520 px wide), and its foot lies over the sheet's top paper border (margin-bottom -84px, z-index 2), with the PROOF stamp kept clear of it, so the first strip fits above the fold at 1440x900. Card notes are placed in free line space rather than at fixed spots
- The wordmark is capped at min(--ar-text-display, 12.4vw) with nowrap, so 'Andrew Rankin' stays on one line on phones
- Plates storyboard adapted to the Ruby Sector premise: the deckhouse doorway with three men, a lantern and the ship's rail are kept, plus a lighthouse throwing its sector, stars and glitter on the water
- Odd frames show RANKIN 400 on top and their edge joke as loupe-only vertical side text; even frames show the joke on top and RANKIN on the side, so all six jokes can be found
- Extra modes: ?poster=<slug> (stand-in posters). Extra debug members: bench(n), previewHash(slug, t). activate(slug) forces that frame until activate(null)
- Hub footer credit names 'Ruby Sector' (the current registry title) instead of 'Halation'
- src/hub/placeholder.css is kept because games/latent/index.html and games/studio/index.html still link it (architecture §5.8 says delete it after wave 3)

## Requests

- Orchestrator/shared-platform: public/apple-touch-icon.png is linked by every page but missing (outside my owned paths). R3's posters script should produce it, or I can add an ?icon= mode if public/apple-touch-icon.png is assigned to me
- Orchestrator (R3): when scripts/posters.mjs exists and has captured the real games into public/posters/*.jpg, re-run `node scripts/shoot.mjs "/?og=<slug>" --size 1200x630 --out public/og/<slug>.jpg` for each slug and hub. The ?og= mode already uses a real poster when one exists
- shared-platform: the hub's font payload is over the hub.md §14 budget of 250 KB (Fraunces full plus full-italic is about 270 KB latin alone, plus Archivo, Caveat and Plex). Consider Fraunces opsz-only axes, or a lighter subset for the hub
- shared-platform: consider a pagereveal/pageswap guard in the game page templates (catch the ready/finished rejections of a skipped ViewTransition), so the hub can leave cross-document transitions on in dev too
- shared-platform (minor): mountHubShell could take an initialLoupe option. The hub currently sets the loupe button's aria-pressed itself after mounting
- Each game integrator: add __game.poster() and honour ?embed=poster so R3 can capture real posters (hub.md §11.1)
- shared-platform/review: once the games ship, flip each registry status to 'ready' (R8). The hub then drops the 'In the tray' stamps automatically through syncRegistry; regenerate the static markup with render-frames.mjs too
