# Review 1: lensbench

Lens Bench review pass, kept small. Desktop and mobile first screens load with zero console errors. The street, tank and lightbox loop works: the full desktop smoke run passes (errors [], no horizontal scroll, runRef T02 and T04 pass, identical hashes for the same seed). I added the poster mode and a first-visit street hint, and fixed the hint's phone placement. I did not touch the bench's mobile overlaps or the first-time bench guidance, and I did not shoot the tank screen or the lightbox on a phone.

## Remaining

- Bench on mobile: the 50x spot loupe overlaps the 'Fit' chip and the rail label, and the ground-glass inset overlaps the film-plane line.
- The first bench screen has no clear next-step prompt after Help closes. The Street tab pulses, but nothing says 'now go to Street'. Nothing has been checked on a real device.
- The help dialog on mobile has no touch alternative for 'Bend a surface', and the 'Got it' button was not matched by clickText on mobile.
- Heart bokeh orientation and size are unverified (needs one --gpu desktop capture). At test tier the bulbs render as blobs.
- Tank and lightbox on a phone were not shot or reviewed this round.
- Missing items from the build report are unchanged: scripted onboarding, halation, stop/fix/wash animations, and the SHOULD tier.

## Requests

- Orchestrator: run the poster capture script against /games/lensbench/?embed=poster&motion=reduce at 1200x800 and write public/posters/lensbench.jpg. Wait for window.__game.posterReady (about 1 s after load).
- shared-fixer: no src/shared edits are required for lensbench.
- shared-photo: still need confirmation that the ApertureMask row-0 convention gives upright heart bokeh (carried over from the build report).
