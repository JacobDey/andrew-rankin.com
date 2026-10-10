# Review 1: studio

Reviewed the studio game on desktop and mobile. It loads with no console errors. The first screen is a how-to-play modal with a clear "Got it" button, and the yard behind it looks good. Fixed the finder HUD collisions, added poster mode, and gave the interior walls plaster instead of exterior clapboard. Re-shot desktop and mobile and the finder is now clean. I did not do the draw-call reduction, the overview mirror-imaging, or dark-print tuning. I also did not run a full shoot, develop and print loop in this pass.

## Remaining

- Draw calls were 422 in the yard in my first-screen eval (about 490 in the overview per the build report), against a 250 budget. Static geometry is not merged yet.
- The overview is still mirror-imaged against the GDD, with the garage on the right. I left it as is.
- The sky and exposure read a little gloomy at the default 16:40 start. I did not tune it.
- Not done: the hall fridge print reading dark, the workshop drag-and-snap parts, and the other items on the Missing list in docs/build/studio.md.
- Not checked in this pass: a full shoot, develop and print loop through the UI, the poster on mobile, and the darkroom, workshop and hall screens.

## Requests

- shared-photo (src/shared/photo/finder.ts, around line 251): FinderPreview.render divides its display gain by radianceScale, while PhotoRenderer and the finder meter multiply by it. With radianceScale 1000 the preview comes out 10^6 too dark. Studio compensates by passing brightness x 1e6 in games/studio/camera/camera.ts renderFinder, and that compensation must be removed once this is fixed.
- Orchestrator: after capturing public/posters/studio.jpg from ?embed=poster, flip the studio registry status to 'ready'.
