# Build report: shared-platform-audio (done)

Landed @shared/core, @shared/storage, @shared/games, @shared/ui, the @shared/audio engine, the five games/<slug>/sounds.ts libraries and public/favicon.svg, all strict-TS clean for my paths (tsc grep for src/shared/{core,storage,ui,audio,games} and games/*/sounds is empty). Every module has a dev page with a selftest, a README.md and screenshots. Core selftest 47/47 and gfx 16/16, storage 44/44, UI selftest 7/7 and interaction test 15/15 (desktop and phone), audio 0 failures over 201 sounds (148 one-shots, 53 loops, all 188 Appendix B ids registered). Live engine smoke in headless Chromium: silent and no context before a gesture, running after a click, one-shots and loops play, no errors. Hub-safe bundle measured at 16 KB gz JS and 8 KB gz CSS (about 31 KB gz JS if the hub imports the full @shared/audio barrel); no three in either.

## Works

- @shared/core (src/shared/core): rng (reference mulberry32/hashString/hash2i, hash2, hash3, rngStream, gauss, pick, shuffle), noise (value, gradient, fbm, ridged, worley, bandNoise), math (incl. stable springStep, monotoneCubic), bus, fixed-step loop with deterministic advance(), flags (all section 3.6 flags, cached), quality (deviceInfo, probeGL, detectTier, dprCap, createPerfMonitor), gestures (tap, doubleTap, hold, drag, wheel, pinch, twist, twoFingerTap/Drag, hover, priority handlers), keys, files (pickFile, onFileDrop, importImage with magic-byte sniffing, share/download/copy), idle (runSliced), testapi (installGameApi, extendGameApi, markReady, error capture). gfx.ts behind @shared/core/gfx (createRenderer, fitRenderer, createRT, readRTPixels async+sync, floatCaps, dataTexture, toHalfFloatArray, disposeDeep, snapshotCanvas) verified against SwiftShader.
- @shared/storage: IndexedDB 'andrew-rankin' with all 8 stores in one v1 upgrade, KV with memory fallback (verified with indexedDB.open patched to throw), local() JSON store, resetGame, applyResetFlag, hub notes, createSlots (manual slots, auto ring, migrate), debouncedSave (flushes on hidden/pagehide), compress/decompress, bit-exact packTyped/unpackTyped, filmcan.
- @shared/games (src/shared/games.ts): pure-data registry per Appendix A (Ruby Sector, Sunny 16), SITE.repoUrl set to the GitHub repo.
- @shared/ui: tokens.css (art-direction 4.1 verbatim + data-motion and poster rules), base.css, fonts.ts (Fontsource), theme.ts, shell.ts + shell.css (film-strip bar with perforations, back link with confirmLeave dialog, identity, status, actions with priority overflow into More, help, sound, lights, fullscreen, auto-hide, phone layout, help on first visit, ?embed=poster hiding), mountHubShell (brand mark, wordmark that slides in, loupe, sound, lights), help datasheet, dialog (openDialog, confirmDialog), toast/announce, menu, tooltip, loader, no-WebGL and crash cards, guardStartup, controls (bindRange with detents, switch, segmented), icons, grease-pencil paths and drawStroke, grain. Verified on dark/light themes, desktop and 390px phone.
- @shared/audio: port of spikes/audio/core split into a lean core (UI palette only, used by the shell and hub) and the full barrel (generic library registered into the same single engine). Added has(), onCaption() (+ caption on defs), noise(), setMuffle(hz|null), uiSound with section 10.2 names (paper-out maps to ui.paperOut), sound.volume/setVolume, haptic() (touch only, tied to sound), hard silence for ?test=1 and ?embed=poster, ?mute=1 start-muted, authoring kit (alias, noiseBed, shot, loopDef, modulate).
- Per-game libraries games/{darkroom,plates,latent,lensbench,studio}/sounds.ts exporting SOUNDS and idempotent registerSounds(): 27 + 24 + 27 + 24 + 30 ids with the Appendix B names and params, recipes from each GDD audio table (aliases of generic recipes where the GDD names one), captions on the four darkroom sounds.
- Dev pages with window.__game.selftest(): /src/shared/core/dev/ and /src/shared/core/dev/gfx.html, /src/shared/storage/dev/, /src/shared/ui/dev/ (also interact(), ?game= ?view= ?embed=poster ?theme= ?confirm=1), /src/shared/audio/dev/ (every id with a play button). Screenshots in shots/shared-ui and shots/shared-audio.
- public/favicon.svg (art-direction section 8, verbatim).

## Missing

- No listening pass on any sound (recipes follow GDD numbers and pass level and finiteness checks only; the GDD levels are deliberately quiet, so some beds may need a gain bump by ear).
- public/apple-touch-icon.png and public/icons/** are not produced (art-direction assigns the PNG to the posters script, request R3); nothing else in the docs calls for icons.
- mountHubShell is verified only on my harness page (?game=hub&view=hub), not on the real hub page, and the loupe toggle only fires the callback (the hub owns the loupe).
- Texturedle has no sounds.ts by design (it uses its own engine and may use the generic marble.*, cloth.rustle, impact, ui.* ids, which exist as soon as @shared/audio is imported).
- darkroom.radio jazz is a simple generative ii-V-I (walking bass, brushes, FM piano) and has not been tuned; ?embed=preview is not specified for the shell or audio.

## Known bugs

- Dev-only noise: navigating from a page that opts in to cross-document view transitions (base.css) to one that does not (for example today's placeholder hub that does not import base.css) makes shoot.mjs report 'InvalidStateError: Transition was aborted because of invalid state. ViewTransition opt-in disabled'. It goes away once the real hub imports base.css; hot-reloading base.css while a page is open can trigger it too.
- Vite HMR full reloads caused by other agents' edits occasionally destroy a long --eval ('Execution context was destroyed'); rerun.
- readRTPixels({ async: false }) logs a Chromium 'GPU stall due to ReadPixels' warning (expected for the sync path).
- Synth's default random source in the audio engine is Math.random (audio-only variation, allowed by section 3.3); offline renders are seeded.
- The first Esc/backdrop close of a datasheet animates for 160 ms, so code that checks dialog[open] immediately after pressing Esc sees it still open for that long.

## API deviations

- testapi additive: isGameReady(), whenGameReady(); markReady() also dispatches window event 'ar:ready' (the shell uses it for help-on-first-visit). installGameApi merges by property descriptor so getters stay live.
- flags: bool() is true when present and not 0|false|no|off; ?quality= wins over ?q=, invalid values fall through; _setFlagsForTests() added.
- detectTier({ prefer }) treats prefer as a ceiling. springStep mutates and returns the same Spring1. Perf monitor time is the sum of samples; samples over 1000 ms are ignored.
- gestures: third finger ignored; pinch/twist/twoFingerDrag fire only when their value changed; derived events (tap, dragEnd, twoFingerTap) follow 'up'; wheel always preventDefaults. fitRenderer sets the canvas to 100% CSS and uses setSize(w, h, false).
- storage additive: applyResetFlag(slug), _resetStorageForTests(). createSlots auto ids are always 'auto:1'..'auto:k' (architecture 3.8's 'pin:auto' is 'pin:auto:1'; load('auto') accepted); keys are `${prefix}:${id}` and `${prefix}meta:${id}`. resetGame keeps ar:<slug>:hub but clears seenHelp.
- ui additive: liveRegion(), attachTooltip/hideTooltip, openHelp(slug, content, { onClose }). The Lights button shows the icon and label of the theme it switches to. Fullscreen sets <html data-fullscreen> (stage inset 0) and the shell dispatches window 'ar:shellvisibility'. ?test=1 suppresses help-on-first-visit. base.css hides body overflow only when <html data-game> is set and is not 'hub'. showCrashCard logs with console.error (a real failure).
- audio: new lean entry @shared/audio/core (engine + UI palette + uiSound/sound/getAudio/haptic); the @shared/audio barrel registers the generic library into the same engine as a side effect. No default export (named only). UiSoundName type uses 'paper-out'. SoundDef gains caption?. Recipes that throw now console.warn once instead of console.error. analysis.ts is dev/test only and not exported.
- games.ts: titles and taglines follow architecture Appendix A (Ruby Sector, Sunny 16, Lens Bench 'street'), which override hub.md section 10; SITE.repoUrl is set because R5 is done.

## Requests

- Hub owner: import uiSound/sound/getAudio from '@shared/audio/core' (not the '@shared/audio' barrel) to keep the hub bundle near 16 KB gz JS; the barrel is about 31 KB gz and still under the 70 KB budget. Use mountHubShell with a page wordmark marked [data-hub-wordmark] (or a main h1), and import '@shared/ui/base.css' so cross-document view transitions opt in.
- Game integrators: call `await applyResetFlag('<slug>')` from '@shared/storage' at boot to honour ?reset=1; call registerSounds() from games/<slug>/sounds.ts once; put <html data-game="<slug>"> (and data-scheme-lock where the registry says) in the page HTML; call markReady() after the first real frame so help-on-first-visit opens.
- Orchestrator (R3): the posters script should also emit public/apple-touch-icon.png (180x180 favicon art on #121110), which the page template references; nothing is needed in package.json, vite.config.ts, tsconfig.json or scripts/.
- Architect/docs: consider noting in docs/architecture.md 4.4 the two audio entry points (@shared/audio/core vs the barrel), the createSlots auto id form 'auto:k' versus 'pin:auto' in 3.8, and that Appendix A (not hub.md 10) is the registry source. I did not edit docs/.
