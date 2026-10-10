# Review 1: plates

Reviewed Ruby Sector on desktop and mobile. I fixed the title screen, the first-visit help overlap, the mobile document Back button and the empty first bench screen, and added poster mode. I did not do per-hotspot clue legibility, the full loop walk-through, or the other MUST gaps. The plates paths type-check clean and __game.errors() was empty in every run.

## Remaining

- Per-hotspot clue legibility at each loupe power, and at P=24 and P=60, has not been done. This is the make-or-break check.
- I did not walk the core loop (carry plate, rock, fix, light table, Return) by hand this round. Clicking the tin opens bundle I, but the plates stay in the tin and are not visibly drawn there. Whether a first-time visitor can find and click a plate in the tin is untested.
- The poster shows the three empty trays and lamp, not the focused tray with a developing plate. poster() calls focusTray('dev'), but the captured frame did not show it. This needs investigating before capturing public/posters/plates.jpg.
- The ghost-hand hint is not visible in my Shelf screenshots.
- MUST gaps from the build report are still open: the '8' pencil mark on the tray rim, the tongs cursor, dragging the brass wick key, carrying the pane, and the Register page pinned at the Shelf.
- At the Trays station the lamp fills the upper right.
- The full smoke steps file was not rerun.
- Mobile 390x844 was checked only for the title, letters, Shelf and the hint bar. The Trays view and the light table were not checked.

## Requests

- Orchestrator: capture public/posters/plates.jpg from /games/plates/?embed=poster once window.__game.posterReady is true, at 1280x800 and 4:3 if needed. Wait about 7 s; the page has no UI chrome.
- shared-fixer (optional): shell.helpOnFirstVisit fires on ar:ready even when a game has its own title or intro screen. Consider an option to defer it until the game calls a hook, or suppress it while a title is up. Plates now sets helpOnFirstVisit false as a workaround.
- shoot.mjs: the --steps clickText 'Back' did not reliably hit the document Back button on a second consecutive click. Real coordinate clicks and element .click() work, so this looks like a harness text-locator issue rather than a game bug.
