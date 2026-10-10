// Scheduling helpers: next frame, idle time, sleeping, and time-sliced jobs.

export function nextFrame(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document !== 'undefined' && document.hidden) {
      // rAF does not fire in hidden tabs; keep jobs moving.
      setTimeout(() => resolve(performance.now()), 0)
    } else {
      requestAnimationFrame(resolve)
    }
  })
}

/** requestIdleCallback with a setTimeout fallback. */
export function idle(timeoutMs = 200): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (typeof ric === 'function') ric(() => resolve(), { timeout: timeoutMs })
    else setTimeout(resolve, 1)
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Drive a generator in slices: calls job.next() until sliceMs elapses, yields to the next frame
 * (setTimeout(0) while hidden), and resolves with the generator's return value.
 */
export async function runSliced<T>(
  job: Iterator<unknown, T, void>,
  o: { sliceMs?: number; signal?: AbortSignal; onProgress?: (steps: number) => void } = {},
): Promise<T> {
  const sliceMs = o.sliceMs ?? 8
  let steps = 0
  for (;;) {
    if (o.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const t0 = performance.now()
    do {
      const r = job.next()
      steps++
      if (r.done) {
        o.onProgress?.(steps)
        return r.value
      }
    } while (performance.now() - t0 < sliceMs)
    o.onProgress?.(steps)
    await nextFrame()
  }
}
