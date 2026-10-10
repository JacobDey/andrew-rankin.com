// The eleven rolls and every frame recipe (story bible §5). Templates are painted by frames/paint.ts.
import type { Crescent, DetailSpec, DevResult, FrameRecipe, RollMeta } from '../core/types'

const ROLL7_CRESCENTS: Crescent[] = [
  { frame: 2, x: 0.10, y: 0.85, rot: 20 },
  { frame: 3, x: 0.88, y: 0.80, rot: 200 }, { frame: 3, x: 0.15, y: 0.10, rot: 90 },
  { frame: 5, x: 0.92, y: 0.50, rot: 270 },
  { frame: 6, x: 0.20, y: 0.88, rot: 10 }, { frame: 6, x: 0.75, y: 0.15, rot: 160 },
  { frame: 7, x: 0.50, y: 0.92, rot: 0 },
  { frame: 8, x: 0.30, y: 0.20, rot: 45 },
  { frame: 9, x: 0.90, y: 0.10, rot: 220 },
  { frame: 10, x: 0.08, y: 0.30, rot: 80 }, { frame: 10, x: 0.85, y: 0.90, rot: 300 },
  { frame: 11, x: 0.40, y: 0.85, rot: 15 }, { frame: 11, x: 0.70, y: 0.12, rot: 180 },
  { frame: 12, x: 0.50, y: 0.50, rot: 90 },
]

/** Mina's motel-bathroom development of Roll 7: about normal time, little agitation, 14 kinks. */
export const ROLL7_DEV: DevResult = { tDev: 500, inversionsPerMin: 2, rapped: false, r: 1.0, agit: 1.0, bubbles: [], kinks: ROLL7_CRESCENTS }

export const ROLLS: RollMeta[] = [
  { id: 1, property: '79-0311/01', label: '79-0108 BURGLARY HOLLOWAY', hand: 'caps', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth', date: '8 Jan 79' },
  { id: 2, property: '79-0311/02', label: '78-1211 TANNERY BRACK', hand: 'caps', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth', date: '11 Dec 78' },
  { id: 3, property: '79-0311/03', label: '79-0122 RTA TANNERS ROW', hand: 'caps', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth', date: '22 Jan 79' },
  { id: 4, property: '79-0311/04', label: 'XMAS 78 UNIT', hand: 'caps', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth', date: '22 Dec 78' },
  { id: 5, property: '79-0311/05', label: 'PERSONAL R.K.', hand: 'caps', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth (F10 by Mina)', date: 'Dec 78–14 Feb 79' },
  { id: 6, property: '79-0311/06', label: '79-0215 COPY ODGERS 4471', hand: 'caps', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth', date: '15 Feb 79' },
  { id: 7, property: '79-0311/07', label: '16.2', hand: 'cursive', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Ruth F1–8, Mina F9–12', date: '16 Feb 79', preDeveloped: ROLL7_DEV, sleeve: true },
  { id: 8, property: '79-0311/08', label: '+2', hand: 'cursive', frames: 12, nominalEV: -2, ageFog: 0.06, shotBy: 'Mina', date: '23 Feb 79' },
  { id: 9, property: '79-0311/09', label: '+2', hand: 'cursive', frames: 12, nominalEV: -2, ageFog: 0.06, shotBy: 'Mina', date: '2–4 Mar 79' },
  { id: 10, property: '79-0311/10', label: 'Wick Lane', hand: 'cursive', frames: 12, nominalEV: 0, ageFog: 0.06, shotBy: 'Mina', date: '1 Mar 79' },
  { id: 11, property: '87-0040', label: '', hand: 'none', frames: 36, nominalEV: 0, ageFog: 0.12, dx: true, shotBy: 'Mina', date: 'Mar 84–Feb 87' },
]

export function rollMeta(id: number): RollMeta { return ROLLS[id - 1] }

type D = Omit<DetailSpec, 'hide'> & { hide?: string[] }
const det = (d: D): DetailSpec => ({ hide: d.hide ?? ['detail'], ...d })

const recipes: FrameRecipe[] = []
function add(roll: number, frames: number[], template: string, params: Record<string, unknown> = {}, details: D[] = [], evs?: number[]): void {
  frames.forEach((frame, i) => {
    const ev = (evs ? evs[i] : 0) + rollMeta(roll).nominalEV
    recipes.push({ roll, frame, template, ev, seed: roll * 1000 + frame * 10 + 1, params: { ...params, idx: i }, details: details.map(det) })
  })
}
const B3 = [-1, 0, 1]

// Roll 1: Holloway's Chandlery
add(1, [1], 'slate', { lines: ['79-0108', '8.1.79', 'R.K.'], bg: 'brick' })
add(1, [2, 3, 4], 'shopfront', {}, [], B3)
add(1, [5, 6, 7], 'interior', { kind: 'counter' }, [], B3)
add(1, [8, 9, 10], 'closeup', { kind: 'jemmy' }, [], B3)
add(1, [11], 'shadow')
add(1, [12], 'fogged', { fog: 0.4 })
// Roll 2: the Tannery
add(2, [1], 'slate', { lines: ['78-1211', '11.12.78', 'R.K.'], bg: 'timber' })
add(2, [2, 3, 4], 'yard', {}, [], B3)
add(2, [5, 6, 7], 'step', {}, [{ id: 'HEEL_TANNERY', bbox: [0.58, 0.52, 0.16, 0.20], rho: 0.45, mMin: 5, pattern: ['BLOWN', 'SMALL'] }], B3)
add(2, [8, 9, 10], 'interior', { kind: 'fuse' }, [{ id: 'CAN_TANNERY', bbox: [0.40, 0.72, 0.18, 0.18], rho: 0.45, mMin: 2, pattern: ['BURIED'] }], B3)
add(2, [11], 'closeup', { kind: 'boot' }, [{ id: 'HEEL_TANNERY', bbox: [0.30, 0.55, 0.30, 0.30], rho: 0.45, mMin: 3, pattern: ['SMALL'] }])
add(2, [12], 'fogged', { fog: 1 })
// Roll 3: Tanner's Row
add(3, [1], 'slate', { lines: ['79-0122', '22.1.79', 'R.K.'], bg: 'brick' })
add(3, [2, 3, 4], 'alley', { cam: 1.66, night: false, van: true }, [{ id: 'HORIZON_RUTH', bbox: [0.20, 0.40, 0.60, 0.25], rho: 0.5, mMin: 2, pattern: [], hide: ['floodline'] }], B3)
add(3, [5, 6, 7], 'van', {}, [], B3)
add(3, [8, 9, 10], 'closeup', { kind: 'skid' }, [], B3)
add(3, [11], 'closeup', { kind: 'plaque' })
add(3, [12], 'fogged', { fog: 1 })
// Roll 4: the Christmas party
add(4, [1], 'slate', { lines: ['XMAS 78', 'UNIT'], bg: 'wall', star: true })
add(4, [2, 3, 4], 'party', {}, [
  { id: 'HEEL_PARTY', bbox: [0.30, 0.78, 0.10, 0.10], rho: 0.45, mMin: 7, pattern: ['BURIED', 'SMALL'] },
  { id: 'RUTH_TALL', bbox: [0.84, 0.18, 0.12, 0.45], rho: 0.5, mMin: 2, pattern: [], hide: ['ruth'] },
], B3)
add(4, [5, 6, 7], 'interior', { kind: 'dot' }, [], B3)
add(4, [8, 9, 10], 'closeup', { kind: 'cake' }, [], B3)
add(4, [11], 'interior', { kind: 'haleWindow' })
add(4, [12], 'fogged', { fog: 1 })
// Roll 5: personal
add(5, [1], 'plant', { kind: 'line2' })
add(5, [2], 'diner', { kind: 'booth' })
add(5, [3], 'bus', {}, [{ id: 'MINA_FACE', bbox: [0.55, 0.35, 0.16, 0.22], rho: 0.45, mMin: 2, pattern: ['BURIED'] }])
add(5, [4], 'flat', { kind: 'door', mina: true }, [{ id: 'HEIGHT_MARKS', bbox: [0.46, 0.08, 0.20, 0.40], rho: 0.5, mMin: 6, pattern: ['SMALL'] }])
add(5, [5], 'flat', { kind: 'window' })
add(5, [6], 'closeup', { kind: 'hours' })
add(5, [7], 'diner', { kind: 'reading' })
add(5, [8], 'street', { kind: 'river' })
add(5, [9], 'dock', { kind: 'day' })
add(5, [10], 'flat', { kind: 'ruth' })
add(5, [11], 'closeup', { kind: 'watchbox' })
add(5, [12], 'closeup', { kind: 'caseback' }, [{ id: 'WATCH_M', bbox: [0.42, 0.40, 0.16, 0.16], rho: 0.45, mMin: 6, pattern: ['BLOWN', 'SMALL'] }])
// Roll 6: the copy of Odgers's prints
add(6, [1], 'slate', { lines: ['R.K.', '15.2.79', 'COPY ODGERS 4471'], bg: 'black' })
add(6, [2, 3, 4], 'copystand', { print: 'heron9' }, [], B3)
add(6, [5, 6, 7], 'copystand', { print: 'heron14' }, [{ id: 'KDL_TANNERY', bbox: [0.55, 0.42, 0.14, 0.08], rho: 0.5, mMin: 8, pattern: ['BLOWN', 'SMALL'], inset: true, hide: ['plateText'] }], B3)
add(6, [8, 9, 10], 'copystand', { print: 'heron15' }, [{ id: 'CANS_TANNERY', bbox: [0.50, 0.45, 0.20, 0.30], rho: 0.45, mMin: 2, pattern: ['BURIED'] }], B3)
add(6, [11], 'copystand', { print: 'envelope' })
add(6, [12], 'fogged', { fog: 1 })
// Roll 7: the fire (already developed)
add(7, [1], 'slate', { lines: ['R.K.', '16.2.79', 'ODGERS NEGS'], bg: 'lighttable' })
add(7, [2, 3, 4], 'copystand', { print: 'negstrip' }, [{ id: 'KDL_NEG', bbox: [0.48, 0.46, 0.06, 0.03], rho: 0.4, mMin: 14, pattern: ['SMALL'], inset: true }], B3)
add(7, [5], 'plant', { kind: 'lt3' })
add(7, [6], 'plant', { kind: 'fire' }, [{ id: 'STAIRWELL_FIRE', bbox: [0.30, 0.10, 0.40, 0.70], rho: 0.45, mMin: 2, pattern: ['GHOST'] }])
add(7, [7], 'closeup', { kind: 'minaFace' })
add(7, [8], 'handover')
add(7, [9], 'dock', { kind: 'night', roll: 6 }, [{ id: 'HEEL_PLANT', bbox: [0.38, 0.70, 0.10, 0.10], rho: 0.45, mMin: 8, pattern: ['BURIED', 'SMALL'] }])
add(7, [10], 'dock', { kind: 'car' }, [{ id: 'KDL_PLANT', bbox: [0.44, 0.55, 0.12, 0.06], rho: 0.45, mMin: 6, pattern: ['SMALL'] }])
add(7, [11], 'street', { kind: 'riverBlur' })
add(7, [12], 'dark', { sliver: true })
// Roll 8: the Lantern (Mina, -2 EV)
add(8, [1], 'street', { kind: 'lantern' })
add(8, [2], 'street', { kind: 'envelope' }, [{ id: 'ENVELOPE_LANTERN', bbox: [0.40, 0.50, 0.25, 0.15], rho: 0.45, mMin: 2, pattern: ['PUSHED', 'BURIED'] }])
add(8, [3], 'street', { kind: 'haleLamp' }, [{ id: 'HALE_FACE', bbox: [0.45, 0.25, 0.12, 0.18], rho: 0.45, mMin: 2, pattern: ['PUSHED'] }])
add(8, [4], 'street', { kind: 'plate' }, [{ id: 'KDL_LANTERN', bbox: [0.42, 0.60, 0.16, 0.08], rho: 0.45, mMin: 5, pattern: ['PUSHED', 'SMALL'] }])
add(8, [5], 'alley', { cam: 1.46, night: true, car: true }, [{ id: 'HORIZON_MINA', bbox: [0.20, 0.35, 0.60, 0.25], rho: 0.35, mMin: 2, pattern: [], hide: ['floodline'] }])
add(8, [6], 'street', { kind: 'corran' })
add(8, [7], 'diner', { kind: 'mirror' }, [{ id: 'GD_BRIEFCASE', bbox: [0.62, 0.62, 0.10, 0.06], rho: 0.45, mMin: 7, pattern: ['MIRRORED', 'SMALL'] }])
add(8, [8], 'street', { kind: 'rain' })
add(8, [9], 'street', { kind: 'haleBack' })
add(8, [10], 'street', { kind: 'tail' })
add(8, [11], 'street', { kind: 'puddle' })
add(8, [12], 'fogged', { fog: 1 })
// Roll 9: Corran Mutual and the windscreen (Mina, -2 EV)
add(9, [1, 2, 3], 'street', { kind: 'office' }, [{ id: 'CLAIM_PAID', bbox: [0.48, 0.48, 0.14, 0.05], rho: 0.45, mMin: 8, pattern: ['BLOWN', 'SMALL'], inset: true }])
add(9, [4, 5, 6], 'street', { kind: 'leaving' })
add(9, [7, 8, 9, 10, 11], 'alley', { cam: 1.46, night: true, car: true, rain: true })
add(9, [12], 'street', { kind: 'windscreen' }, [{ id: 'HALE_SAW', bbox: [0.42, 0.30, 0.16, 0.22], rho: 0.4, mMin: 2, pattern: ['PUSHED', 'BURIED', 'BLOWN'] }])
// Roll 10: Wick Lane
add(10, [1], 'flat', { kind: 'door', hand: true }, [{ id: 'HEIGHT_MARKS_2', bbox: [0.44, 0.05, 0.22, 0.42], rho: 0.5, mMin: 6, pattern: ['SMALL'] }])
add(10, [2], 'flat', { kind: 'coat' })
add(10, [3], 'flat', { kind: 'bed' })
add(10, [4], 'flat', { kind: 'shelf' })
add(10, [5], 'flat', { kind: 'window', rain: true })
add(10, [6], 'closeup', { kind: 'carton' }, [{ id: 'CURSIVE_LABEL', bbox: [0.30, 0.20, 0.40, 0.18], rho: 0.45, mMin: 4, pattern: ['SMALL'] }])
add(10, [7], 'closeup', { kind: 'sleeve' })
add(10, [8], 'flat', { kind: 'chair' })
add(10, [9, 10, 11, 12], 'unexposed')
// Roll 11: the window, 1984–1987
for (let n = 1; n <= 36; n++) {
  add(11, [n], 'window', { month: n }, n === 36 ? [{ id: 'MINA_1987', bbox: [0.38, 0.28, 0.24, 0.42], rho: 0.4, mMin: 3, pattern: ['MIRRORED', 'BURIED', 'GHOST'] }] : [])
}

export const RECIPES: FrameRecipe[] = recipes
const byKey = new Map(recipes.map((r) => [`${r.roll}:${r.frame}`, r]))
export function recipe(roll: number, frame: number): FrameRecipe | undefined { return byKey.get(`${roll}:${frame}`) }
export function allDetails(): { recipe: FrameRecipe; detail: DetailSpec }[] {
  return recipes.flatMap((r) => r.details.map((d) => ({ recipe: r, detail: d })))
}
/** The tutorial print waiting in the easel (Roll 7 F1, the slate). */
export const TUTORIAL = { roll: 7, frame: 1 }
