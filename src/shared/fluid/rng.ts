/** Small seeded PRNG (mulberry32) so splashes and bubbles replay identically from a snapshot. */
export class Rng {
  private s: number
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1
  }
  /** Uniform in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  /** Uniform in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  get state(): number {
    return this.s
  }
  set state(v: number) {
    this.s = v >>> 0 || 1
  }
}
