// Loading the reel in the changing bag (rhythm and kinks, GDD §5.4) and the tank (dial, pour,
// inversions, rap, pour out → DevResult, §4.4 and §5.3).
import { mulberry32, type Rng } from '@shared/core'
import type { Crescent, DevResult, Spot } from '../core/types'
import { recipe } from '../data/rolls'
import { kinkSafe, makeDev } from './filmModel'

export type FilmPhase = 'none' | 'shelf' | 'bag' | 'tank' | 'dev' | 'done'
export type BagStep = 'cap' | 'leader' | 'wind' | 'close'

export class FilmProcess {
  phase: FilmPhase = 'none'
  roll = 0
  bag: BagStep = 'cap'
  leader = 0
  k = 0
  target = 24
  lastSide: 'L' | 'R' | null = null
  lastT = 0
  kinks: Crescent[] = []
  dial = 480 // game seconds (8:00)
  elapsed = 0 // game seconds in the developer
  inversions = 0
  rapped = false
  rapAt = -1
  bellRung = false
  tankAngle = 0
  private rng: Rng = mulberry32(1)
  lastStroke: 'clean' | 'risky' | 'slow' | 'kink' | null = null

  load(roll: number, seed: number): void {
    this.phase = 'shelf'; this.roll = roll; this.bag = 'cap'; this.leader = 0; this.k = 0
    this.target = roll === 11 ? 48 : 24
    this.kinks = []; this.dial = roll === 8 || roll === 9 ? 480 : 480
    this.elapsed = 0; this.inversions = 0; this.rapped = false; this.rapAt = -1; this.bellRung = false
    this.rng = mulberry32((seed ^ (roll * 7919)) >>> 0)
    this.lastSide = null; this.lastT = 0
  }
  openBag(): void { if (this.phase === 'shelf') { this.phase = 'bag'; this.bag = 'cap' } }
  popCap(): boolean { if (this.phase === 'bag' && this.bag === 'cap') { this.bag = 'leader'; return true } return false }
  pullLeader(): boolean { if (this.phase === 'bag' && this.bag === 'leader') { this.leader++; if (this.leader >= 3) this.bag = 'wind'; return true } return false }

  /** One stroke on a side at time t (ms). Returns what kind of stroke it was. */
  stroke(side: 'L' | 'R', tMs: number, steady: boolean): 'clean' | 'risky' | 'slow' | 'kink' | null {
    if (this.phase !== 'bag' || this.bag !== 'wind') return null
    const dt = this.lastT ? tMs - this.lastT : 400
    let kind: 'clean' | 'risky' | 'slow' | 'kink' = 'clean'
    if (!steady && (side === this.lastSide || dt < 150)) kind = 'risky'
    else if (dt > 650) kind = 'slow'
    else if (dt < 220 && !steady) kind = 'risky'
    if (kind === 'risky' && this.rng() < 0.35) {
      kind = 'kink'
      const frame = Math.min(this.target / 2, Math.floor(this.k / 2) + 1)
      const rec = recipe(this.roll, frame)
      const pos = kinkSafe(this.rng, (rec?.details ?? []).map((d) => d.bbox))
      this.kinks.push({ frame, x: pos.x, y: pos.y, rot: Math.round(this.rng() * 360) })
    }
    this.k++
    this.lastSide = side; this.lastT = tMs
    if (this.k >= this.target) this.bag = 'close'
    this.lastStroke = kind
    return kind
  }
  closeTank(): boolean { if (this.phase === 'bag' && this.bag === 'close') { this.phase = 'tank'; return true } return false }
  setDial(gameSeconds: number): void { this.dial = Math.max(240, Math.min(960, Math.round(gameSeconds / 15) * 15)) }
  pour(): boolean { if (this.phase === 'tank') { this.phase = 'dev'; this.elapsed = 0; this.bellRung = false; return true } return false }
  invert(): boolean { if (this.phase === 'dev') { this.inversions++; return true } return false }
  rap(): boolean { if (this.phase === 'dev') { this.rapped = true; if (this.rapAt < 0) this.rapAt = this.elapsed; return true } return false }
  /** Advance the developer clock (10 game seconds per real second). Returns true when the bell rings. */
  tick(dtReal: number): boolean {
    if (this.phase !== 'dev') return false
    this.elapsed += dtReal * 10
    if (!this.bellRung && this.elapsed >= this.dial) { this.bellRung = true; return true }
    return false
  }
  pourOut(): DevResult | null {
    if (this.phase !== 'dev') return null
    const min = Math.max(0.5, this.elapsed / 60)
    const n = this.inversions / min
    const bubbles: Spot[] = []
    if (!(this.rapped && this.rapAt <= 60)) {
      const nb = 3 + Math.floor(this.rng() * 3)
      for (let i = 0; i < nb; i++) {
        const frame = 1 + Math.floor(this.rng() * (this.target / 2))
        const rec = recipe(this.roll, frame)
        const p = kinkSafe(this.rng, (rec?.details ?? []).map((d) => d.bbox))
        bubbles.push({ frame, x: p.x, y: p.y, r: 0.25 + this.rng() * 0.25 })
      }
    }
    this.phase = 'done'
    return makeDev({ tDev: this.elapsed, inversionsPerMin: n, rapped: this.rapped, bubbles, kinks: this.kinks })
  }
}

export function fmtTime(gameS: number): string {
  const m = Math.floor(gameS / 60), s = Math.floor(gameS % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
