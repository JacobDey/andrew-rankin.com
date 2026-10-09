# Andrew Rankin — Minigame Collection

Six photography minigames and physics toys, from ideas Andrew Rankin dictated over a sink of dishes.

| # | Game | Path |
|---|------|------|
| 1 | Texturedle — guess the surface from a macro you can poke | `/games/texturedle/` |
| 2 | Darkroom — sloshing trays, safelights, silver and cyanotype | `/games/darkroom/` |
| 3 | Plates — a 1-bit darkroom mystery | `/games/plates/` |
| 4 | Latent Image — a darkroom police story | `/games/latent/` |
| 5 | Lens Bench — design a camera, shoot, develop | `/games/lensbench/` |
| 6 | The Studio — darkroom, camera workshop and backyard | `/games/studio/` |

## Develop

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # static site in dist/
npm run check      # type-check
node scripts/shoot.mjs /games/darkroom/ --out shots/darkroom.png   # headless screenshot + console errors
```

Vite multi-page app: every `games/<slug>/index.html` becomes a page automatically. Shared code lives in `src/shared/`, the hub in `src/hub/`. Everything (textures, models, sound) is procedural; there is no backend.

Deployed on Vercel; every push to `main` deploys to production.
