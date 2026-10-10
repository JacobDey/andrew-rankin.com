// The preview contract (hub.md §4.2). Each preview is a small procedural 2D-canvas loop, a
// "photograph of the game", not a screenshot. No WebGL, no three, no imports from games/.

export interface PreviewEnv {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  w: number // backing-store pixels (already x dpr)
  h: number
  dpr: number
  seed: number // stable per slug
  accentLit: string // registry accentLit
}

export interface Preview {
  readonly period: number // seconds; the loop is seamless at t = period
  readonly heroT: number // the best single moment, used for stills and reduced motion
  init(env: PreviewEnv): void | Promise<void> // precompute; heavy work in idle chunks
  resize(env: PreviewEnv): void // backing size changed
  draw(t: number): void // a PURE function of t in [0, period): deterministic
  dispose?(): void
}

export type PreviewFactory = () => Preview
