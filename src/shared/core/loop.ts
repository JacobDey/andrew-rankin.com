// Fixed-step game loop with a render callback. One rAF per page (architecture.md §7.2).

export interface LoopOptions {
  fixedDt?: number // 1/60
  maxSteps?: number // 4: the sim slows, it never spirals
  maxFrameDt?: number // 0.1 s
  pauseWhenHidden?: boolean // true
  autoStart?: boolean // true
}

export interface Loop {
  start(): void
  stop(): void
  readonly running: boolean
  setPaused(on: boolean): void
  readonly paused: boolean // paused = no fixed steps; onFrame still runs so the UI keeps drawing
  readonly simTime: number
  readonly frame: number
  onStep(fn: (dt: number, simTime: number) => void, order?: number): () => void
  onFrame(fn: (dtReal: number, alpha: number, simTime: number) => void, order?: number): () => void
  /** Deterministic: `frames` fixed steps synchronously, then one onFrame. Works while paused or stopped. */
  advance(frames: number, dt?: number): void
  stats(): { fps: number; meanMs: number; p75Ms: number; p90Ms: number; stepsLastFrame: number }
}

interface Entry<F> {
  fn: F
  order: number
  seq: number
}

const STATS_WINDOW = 120

export function createLoop(o: LoopOptions = {}): Loop {
  const fixedDt = o.fixedDt ?? 1 / 60
  const maxSteps = o.maxSteps ?? 4
  const maxFrameDt = o.maxFrameDt ?? 0.1
  const pauseWhenHidden = o.pauseWhenHidden ?? true

  type StepFn = (dt: number, simTime: number) => void
  type FrameFn = (dtReal: number, alpha: number, simTime: number) => void
  let steps: Entry<StepFn>[] = []
  let frames: Entry<FrameFn>[] = []
  let seq = 0

  let running = false
  let paused = false
  let simTime = 0
  let frameNo = 0
  let acc = 0
  let last = 0
  let raf = 0
  let stepsLast = 0
  const ring = new Float32Array(STATS_WINDOW)
  let ringN = 0
  let ringI = 0
  let tmp = new Float32Array(STATS_WINDOW)

  const add = <F>(list: Entry<F>[], fn: F, order: number): Entry<F>[] => {
    const e: Entry<F> = { fn, order, seq: seq++ }
    return [...list, e].sort((a, b) => a.order - b.order || a.seq - b.seq)
  }

  const runSteps = (dt: number): void => {
    simTime += dt
    for (const e of steps) e.fn(dt, simTime)
  }
  const runFrame = (dtReal: number, alpha: number): void => {
    frameNo++
    for (const e of frames) e.fn(dtReal, alpha, simTime)
  }

  const tick = (nowMs: number): void => {
    if (!running) return
    raf = requestAnimationFrame(tick)
    if (pauseWhenHidden && typeof document !== 'undefined' && document.hidden) {
      last = nowMs
      return
    }
    const rawMs = nowMs - last
    last = nowMs
    let dt = rawMs / 1000
    if (dt < 0) dt = 0
    if (dt > maxFrameDt) dt = maxFrameDt
    ring[ringI] = rawMs > 1000 ? 1000 : rawMs
    ringI = (ringI + 1) % STATS_WINDOW
    if (ringN < STATS_WINDOW) ringN++

    let n = 0
    if (!paused) {
      acc += dt
      while (acc >= fixedDt && n < maxSteps) {
        runSteps(fixedDt)
        acc -= fixedDt
        n++
      }
      if (n === maxSteps && acc >= fixedDt) acc = 0 // drop the backlog instead of spiralling
    }
    stepsLast = n
    runFrame(dt, paused ? 0 : acc / fixedDt)
  }

  const onVisibility = (): void => {
    last = performance.now()
    acc = 0
  }

  const api: Loop = {
    start() {
      if (running) return
      running = true
      last = performance.now()
      acc = 0
      if (pauseWhenHidden && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
      raf = requestAnimationFrame(tick)
    },
    stop() {
      if (!running) return
      running = false
      cancelAnimationFrame(raf)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    },
    get running() {
      return running
    },
    setPaused(on) {
      paused = on
      if (!on) acc = 0
    },
    get paused() {
      return paused
    },
    get simTime() {
      return simTime
    },
    get frame() {
      return frameNo
    },
    onStep(fn, order = 0) {
      steps = add(steps, fn, order)
      return () => {
        steps = steps.filter((e) => e.fn !== fn)
      }
    },
    onFrame(fn, order = 0) {
      frames = add(frames, fn, order)
      return () => {
        frames = frames.filter((e) => e.fn !== fn)
      }
    },
    advance(n, dt = fixedDt) {
      const count = Math.max(0, Math.floor(n))
      for (let i = 0; i < count; i++) runSteps(dt)
      stepsLast = count
      runFrame(count * dt, 0)
    },
    stats() {
      if (ringN === 0) return { fps: 0, meanMs: 0, p75Ms: 0, p90Ms: 0, stepsLastFrame: stepsLast }
      if (tmp.length < ringN) tmp = new Float32Array(STATS_WINDOW)
      const view = tmp.subarray(0, ringN)
      let sum = 0
      for (let i = 0; i < ringN; i++) {
        const v = ring[i] as number
        view[i] = v
        sum += v
      }
      view.sort()
      const q = (p: number): number => view[Math.min(ringN - 1, Math.floor(p * (ringN - 1) + 0.5))] as number
      const mean = sum / ringN
      return { fps: mean > 0 ? 1000 / mean : 0, meanMs: mean, p75Ms: q(0.75), p90Ms: q(0.9), stepsLastFrame: stepsLast }
    },
  }

  if (o.autoStart ?? true) api.start()
  return api
}
