// games/plates/content/plates.ts — the fourteen PlateDefs (data) and PlateMeta derivation.
// Register lines, titles and dates are FINAL text from plates-story.md §6 and §7.6.
import { EYE, type PlateId, type PlateMeta, type Hotspot, type PortraitRect, type SoulId } from '../contracts'
import { BASE, EYE_W, type Painter } from './paint'
import { p00, p01, p02, p03, p04, p05, p06 } from './scenes1'
import { p07, p08, p09, p10, p11, p12, p13 } from './scenes2'

/** A hotspot authored in cyclopean eye coordinates at depth z. */
interface HS { id: string; eye: 'L' | 'R' | 'both'; cx: number; cy: number; z: number; r: number; zone: Hotspot['zone']; minPower?: 1 | 2 | 4 | 8; kind: Hotspot['kind']; clue?: string }
interface PR { soul: SoulId; fig: number; eye: 'L' | 'R'; cx: number; cy: number; z: number; w: number; h: number }

export interface PlateDef {
  id: PlateId; no: number | 'TRIAL'; title: string; date: string; time: string; bundle: 1 | 2 | 3 | 4
  register: string; souls: SoulId[]; chord: number[]
  fov: number; scale: number; motion: boolean; scratch: string; subjectZ: number
  scene: (P: Painter) => void
  hs: HS[]; pr: PR[]
}

const port = (soul: SoulId, fig: number, cx: number, cy: number, z: number, w = 64, h = 64, eye: 'L' | 'R' = 'L'): PR => ({ soul, fig, eye, cx, cy, z, w, h })

export const PLATE_DEFS: PlateDef[] = [
  { id: 'p00', no: 'TRIAL', title: 'Trial of the Batch', date: 'Fri. 4th Nov. 1887', time: '3.10 p.m.', bundle: 1,
    register: 'Trial of the batch, the store-room door. f/16, 20 sec. Wick would sleep in the plate box.',
    souls: [], chord: [62, 65, 69], fov: 40, scale: 1, motion: true, scratch: 'TRIAL', subjectZ: 2.2, scene: p00,
    hs: [
      { id: 'wick', eye: 'L', cx: 120, cy: 251, z: 3.1, r: 9, zone: 'mid', minPower: 4, kind: 'wick' },
      { id: 'of', eye: 'both', cx: 316, cy: 203, z: 2.2, r: 10, zone: 'mid', minPower: 4, kind: 'clue' },
    ], pr: [] },
  { id: 'p01', no: 1, title: 'The Company at the Door', date: 'Thurs. 10th Nov. 1887', time: '11.40 a.m.', bundle: 1,
    register: 'No. 1. Thurs. 10th, 11.40 a.m. The company at the door, for the Board’s album. f/16, 2 sec. Davy would laugh.',
    souls: ['saul', 'amos', 'nell', 'keturah', 'davy'], chord: [58, 62, 65], fov: 40, scale: 1, motion: true, scratch: 'No. 1', subjectZ: 5.5, scene: p01,
    hs: [
      { id: 'C01', eye: 'both', cx: 400, cy: 262, z: 5, r: 26, zone: 'mid', kind: 'clue', clue: 'C01' },
      { id: 'C02', eye: 'both', cx: 165, cy: 158, z: 5.5, r: 12, zone: 'shadow', minPower: 4, kind: 'clue', clue: 'C02' },
      { id: 'C03', eye: 'both', cx: 236, cy: 108, z: 5.55, r: 14, zone: 'mid', kind: 'clue', clue: 'C03' },
      { id: 'C04', eye: 'both', cx: 236, cy: 206, z: 5.25, r: 22, zone: 'mid', minPower: 2, kind: 'clue', clue: 'C04' },
      { id: 'C08', eye: 'both', cx: 246, cy: 186, z: 5.25, r: 14, zone: 'mid', kind: 'clue', clue: 'C08' },
      { id: 'wick', eye: 'both', cx: 258, cy: 218, z: 5.15, r: 14, zone: 'mid', kind: 'wick' },
    ],
    pr: [port('saul', 1, 150, 112, 5.5), port('amos', 2, 236, 120, 5.55), port('nell', 3, 246, 172, 5.25), port('keturah', 4, 334, 132, 5.5), port('davy', 5, 400, 262, 5)] },
  { id: 'p02', no: 2, title: 'The Lens', date: 'Fri. 11th Nov. 1887', time: '10.15 a.m.', bundle: 1,
    register: 'No. 2. Fri. 11th, 10.15 a.m. Lantern. Mr K. at his glass. N. would come up. f/22, 6 sec.',
    souls: ['amos', 'nell'], chord: [53, 57, 60, 65], fov: 40, scale: 1, motion: false, scratch: 'No. 2', subjectZ: 2.9, scene: p02,
    hs: [
      { id: 'C05', eye: 'both', cx: 375, cy: 177, z: 3.6, r: 60, zone: 'mid', kind: 'clue', clue: 'C05' },
      { id: 'C06', eye: 'both', cx: 188, cy: 148, z: 2.25, r: 14, zone: 'highlight', minPower: 4, kind: 'clue', clue: 'C06' },
      { id: 'C07', eye: 'both', cx: 428, cy: 180, z: 3.6, r: 16, zone: 'mid', kind: 'clue', clue: 'C07' },
      { id: 'C08', eye: 'both', cx: 452, cy: 276, z: 3.55, r: 16, zone: 'mid', kind: 'clue', clue: 'C08' },
      { id: 'numerals', eye: 'both', cx: 375, cy: 222, z: 3.6, r: 40, zone: 'mid', minPower: 2, kind: 'clue', clue: 'C05' },
      { id: 'wick', eye: 'both', cx: 62, cy: 258, z: 4.6, r: 12, zone: 'mid', minPower: 2, kind: 'wick' },
    ], pr: [] },
  { id: 'p03', no: 3, title: 'The Store-room by Day', date: 'Fri. 11th Nov. 1887', time: '11.30 a.m.', bundle: 1,
    register: 'No. 3. 11.30 a.m. The store-room, for the album. The sea struck at six & my lamp came off its hook. f/11, 20 sec. Nothing to be done till the boat.',
    souls: ['nell'], chord: [60, 64, 67], fov: 40, scale: 1, motion: false, scratch: 'No. 3', subjectZ: 1.42, scene: p03,
    hs: [
      { id: 'C09', eye: 'both', cx: 300, cy: 220, z: 1.42, r: 60, zone: 'mid', kind: 'clue', clue: 'C09' },
      { id: 'C10', eye: 'both', cx: 110, cy: 150, z: 2.4, r: 40, zone: 'mid', kind: 'clue', clue: 'C10' },
      { id: 'wick', eye: 'both', cx: 78, cy: 120, z: 2.9, r: 12, zone: 'shadow', minPower: 2, kind: 'wick' },
    ], pr: [] },
  { id: 'p04', no: 4, title: 'Dinner', date: 'Fri. 11th Nov. 1887', time: '12.45 p.m.', bundle: 2,
    register: 'No. 4. 12.45 p.m. Dinner. f/11, 8 sec. Mrs K. would not sit.',
    souls: ['amos', 'saul', 'davy', 'keturah'], chord: [55, 58, 62], fov: 40, scale: 1, motion: true, scratch: 'No. 4', subjectZ: 3.6, scene: p04,
    hs: [
      { id: 'C11', eye: 'both', cx: 280, cy: 350, z: 1.9, r: 40, zone: 'mid', minPower: 2, kind: 'clue', clue: 'C11' },
      { id: 'C12', eye: 'both', cx: 386, cy: 110, z: 4.3, r: 40, zone: 'highlight', minPower: 4, kind: 'clue', clue: 'C12' },
      { id: 'C13', eye: 'both', cx: 126, cy: 96, z: 4.3, r: 22, zone: 'highlight', minPower: 2, kind: 'clue', clue: 'C13' },
      { id: 'wick', eye: 'both', cx: 338, cy: 368, z: 1.9, r: 16, zone: 'mid', kind: 'wick' },
    ], pr: [] },
  { id: 'p05', no: 5, title: 'The Tower from the Landing', date: 'Fri. 11th Nov. 1887', time: '1.50 p.m.', bundle: 2,
    register: 'No. 5. 1.50 p.m. The tower from the landing, long lens. f/16, ½ sec. Wind getting up.',
    souls: ['saul', 'davy'], chord: [57, 62, 65], fov: 26, scale: 1, motion: true, scratch: 'No. 5', subjectZ: 22, scene: p05,
    hs: [
      { id: 'C14', eye: 'both', cx: 321, cy: 42, z: 22, r: 10, zone: 'mid', minPower: 4, kind: 'clue', clue: 'C14' },
      { id: 'C15', eye: 'both', cx: 344, cy: 44, z: 22, r: 14, zone: 'mid', kind: 'clue', clue: 'C15' },
      { id: 'C15b', eye: 'both', cx: 352, cy: 300, z: 4.2, r: 40, zone: 'mid', kind: 'clue', clue: 'C15' },
      { id: 'wick', eye: 'both', cx: 102, cy: 372, z: 9, r: 8, zone: 'shadow', minPower: 4, kind: 'wick' },
    ], pr: [] },
  { id: 'p06', no: 6, title: 'The Lamp Mended', date: 'Fri. 11th Nov. 1887', time: '3.15 p.m.', bundle: 2,
    register: 'No. 6. 3.15 p.m. The lamp mended! N. very proud. f/11, 40 sec., door a hand open. Then to work.',
    souls: ['nell'], chord: [58, 62, 65, 69], fov: 40, scale: 1, motion: false, scratch: 'No. 6', subjectZ: 1.3, scene: p06,
    hs: [
      { id: 'C16', eye: 'both', cx: 228, cy: 137, z: 1.3, r: 60, zone: 'mid', kind: 'clue', clue: 'C16' },
      { id: 'C17', eye: 'both', cx: 279, cy: 195, z: 1.3, r: 12, zone: 'shadow', minPower: 4, kind: 'clue', clue: 'C17' },
      { id: 'C18', eye: 'both', cx: 372, cy: 175, z: 1.6, r: 26, zone: 'mid', kind: 'clue', clue: 'C18' },
      { id: 'wick', eye: 'both', cx: 52, cy: 288, z: 2.1, r: 16, zone: 'shadow', kind: 'wick' },
    ], pr: [] },
  { id: 'p07', no: 7, title: 'Lighting-up', date: 'Fri. 11th Nov. 1887', time: '4.35 p.m.', bundle: 2,
    register: 'No. 7. 4.35 p.m. Lighting-up. f/11, 30 sec. Mr K. did not know I was there until I spoke.',
    souls: ['amos', 'nell'], chord: [57, 62, 64], fov: 40, scale: 1, motion: false, scratch: 'No. 7', subjectZ: 2.0, scene: p07,
    hs: [
      { id: 'C19', eye: 'both', cx: 300, cy: 150, z: 2.3, r: 80, zone: 'mid', kind: 'clue', clue: 'C19' },
      { id: 'C20', eye: 'both', cx: 407, cy: 164, z: 2.6, r: 8, zone: 'mid', minPower: 4, kind: 'clue', clue: 'C20' },
      { id: 'C21', eye: 'R', cx: 152, cy: 310, z: 2.8, r: 30, zone: 'shadow', kind: 'clue', clue: 'C21' },
      { id: 'wick', eye: 'R', cx: 170, cy: 392, z: 2.8, r: 8, zone: 'shadow', kind: 'wick' },
    ], pr: [] },
  { id: 'p08', no: 8, title: 'The Light in the Gale', date: 'Fri. 11th Nov. 1887', time: '7.02 p.m.', bundle: 3,
    register: 'No. 8. 7.02 p.m. The light in the gale, from the gallery. Cap off, counted 40. Mr P. came up running with the hand-lamp. A ship.',
    souls: ['saul', 'keturah'], chord: [50, 57, 65], fov: 40, scale: 1, motion: true, scratch: 'No. 8', subjectZ: 2.4, scene: p08,
    hs: [
      { id: 'C22', eye: 'both', cx: 300, cy: 120, z: 40, r: 40, zone: 'mid', kind: 'clue', clue: 'C22' },
      { id: 'C23', eye: 'both', cx: 321, cy: 82, z: 2.4, r: 60, zone: 'highlight', kind: 'clue', clue: 'C23' },
      { id: 'C24', eye: 'both', cx: 84, cy: 340, z: 25, r: 12, zone: 'shadow', minPower: 4, kind: 'clue', clue: 'C24' },
      { id: 'wick', eye: 'both', cx: 98, cy: 352, z: 25, r: 6, zone: 'shadow', minPower: 8, kind: 'wick' },
    ], pr: [] },
  { id: 'p09', no: 9, title: 'Magnesium', date: 'Fri. 11th Nov. 1887', time: '7.35 p.m.', bundle: 3,
    register: 'No. 9. 7.35 p.m. Burned the ribbon for them to see by and opened the lens. The mast went.',
    souls: ['keturah', 'amos', 'saul', 'abery', 'davy', 'shilling', 'rype', 'hosken'], chord: [60, 65, 69], fov: 40, scale: 1, motion: true, scratch: 'No. 9', subjectZ: 6.2, scene: p09,
    hs: [
      { id: 'C25', eye: 'both', cx: 238, cy: 300, z: 12, r: 24, zone: 'mid', kind: 'clue', clue: 'C25' },
      { id: 'C26', eye: 'both', cx: 480, cy: 302, z: 9, r: 24, zone: 'mid', kind: 'clue', clue: 'C26' },
      { id: 'C27', eye: 'both', cx: 126, cy: 230, z: 22, r: 12, zone: 'shadow', minPower: 4, kind: 'clue', clue: 'C27' },
      { id: 'C28', eye: 'both', cx: 346, cy: 196, z: 60, r: 12, zone: 'shadow', minPower: 4, kind: 'clue', clue: 'C28' },
      { id: 'wick', eye: 'both', cx: 158, cy: 292, z: 8, r: 6, zone: 'mid', minPower: 4, kind: 'wick' },
    ],
    pr: [port('hosken', 6, 346, 196, 60, 28, 28), port('rype', 7, 128, 230, 22, 32, 32)] },
  { id: 'p10', no: 10, title: 'The Last of the Ribbon', date: 'Fri. 11th Nov. 1887', time: '7.50 p.m.', bundle: 3,
    register: 'No. 10. 7.50 p.m. The last of the ribbon. Davy is gone. The boy is ours.',
    souls: ['shilling', 'saul', 'abery', 'keturah', 'amos'], chord: [55, 58, 62, 67], fov: 40, scale: 1, motion: false, scratch: 'No. 10', subjectZ: 7, scene: p10,
    hs: [
      { id: 'C29', eye: 'both', cx: 366, cy: 282, z: 7.5, r: 34, zone: 'mid', kind: 'clue', clue: 'C29' },
      { id: 'C30', eye: 'both', cx: 61, cy: 235, z: 22, r: 16, zone: 'shadow', kind: 'clue', clue: 'C30' },
      { id: 'C31', eye: 'both', cx: 420, cy: 315, z: 10, r: 18, zone: 'mid', minPower: 2, kind: 'clue', clue: 'C31' },
      { id: 'C32', eye: 'both', cx: 283, cy: 207, z: 60, r: 18, zone: 'shadow', kind: 'clue', clue: 'C32' },
      { id: 'wick', eye: 'both', cx: 34, cy: 372, z: 1.9, r: 16, zone: 'mid', kind: 'wick' },
    ],
    pr: [port('shilling', 10, 362, 294, 8.6, 56, 40)] },
  { id: 'p11', no: 11, title: 'The Kitchen, Midnight', date: 'Sat. 12th Nov. 1887', time: '12.20 a.m.', bundle: 3,
    register: 'No. 11. Sat. 12th, 12.20 a.m. Kitchen. Lamp, 60 sec. Mrs K. at the cask for the cold men.',
    souls: ['shilling', 'abery', 'keturah', 'saul', 'rype', 'nell', 'ottilie'], chord: [57, 61, 64, 67], fov: 40, scale: 1, motion: true, scratch: 'No. 11', subjectZ: 2.6, scene: p11,
    hs: [
      { id: 'C33', eye: 'both', cx: 336, cy: 286, z: 2.75, r: 26, zone: 'mid', minPower: 2, kind: 'clue', clue: 'C33' },
      { id: 'C34', eye: 'both', cx: 261, cy: 322, z: 2.2, r: 14, zone: 'mid', minPower: 2, kind: 'clue', clue: 'C34' },
      { id: 'C35', eye: 'both', cx: 352, cy: 196, z: 3.7, r: 44, zone: 'mid', kind: 'clue', clue: 'C35' },
      { id: 'C36', eye: 'both', cx: 30, cy: 346, z: 2.4, r: 12, zone: 'mid', minPower: 4, kind: 'clue', clue: 'C36' },
      { id: 'C36b', eye: 'both', cx: 70, cy: 327, z: 2.4, r: 10, zone: 'shadow', minPower: 2, kind: 'clue', clue: 'C36' },
      { id: 'C37', eye: 'both', cx: 18, cy: 178, z: 1.3, r: 30, zone: 'shadow', minPower: 2, kind: 'clue', clue: 'C37' },
      { id: 'wick', eye: 'both', cx: 368, cy: 326, z: 3.7, r: 12, zone: 'shadow', kind: 'wick' },
    ],
    pr: [port('abery', 8, 352, 180, 3.7), port('ottilie', 9, 18, 176, 1.3, 40, 56)] },
  { id: 'p12', no: 12, title: 'The Watch Room, Three O’Clock', date: 'Sat. 12th Nov. 1887', time: '2.58 a.m.', bundle: 3,
    register: 'No. 12. 2.58 a.m. Mr K. writing the night into the book. 50 sec. I made this one on purpose.',
    souls: ['amos'], chord: [62, 66, 69], fov: 40, scale: 1, motion: true, scratch: 'No. 12', subjectZ: 1.25, scene: p12,
    hs: [
      { id: 'C38', eye: 'both', cx: 290, cy: 244, z: 1.25, r: 40, zone: 'highlight', minPower: 2, kind: 'clue', clue: 'C38' },
      { id: 'C38clock', eye: 'both', cx: 420, cy: 66, z: 2.6, r: 30, zone: 'highlight', minPower: 2, kind: 'clue', clue: 'C38' },
      { id: 'C39', eye: 'both', cx: 435, cy: 355, z: 1.3, r: 30, zone: 'mid', kind: 'clue', clue: 'C39' },
      { id: 'C40', eye: 'both', cx: 130, cy: 260, z: 0.95, r: 50, zone: 'mid', kind: 'clue', clue: 'C40' },
      { id: 'wick', eye: 'both', cx: 470, cy: 356, z: 1.3, r: 16, zone: 'mid', kind: 'wick' },
    ], pr: [] },
  { id: 'p13', no: 13, title: 'In the Camera', date: 'Sat. 12th Nov. 1887', time: 'c. 8.40 a.m.', bundle: 4,
    register: '13. In the camera. I could not.',
    souls: ['ottilie', 'nell'], chord: [62, 66, 69, 74, 76], fov: 40, scale: 1, motion: false, scratch: 'O.F. & N.K. 12 Nov 87', subjectZ: 1.9, scene: p13,
    hs: [{ id: 'wick', eye: 'both', cx: 300, cy: 268, z: 1.85, r: 16, zone: 'mid', kind: 'wick' }], pr: [] },
]

export function defOf(id: PlateId): PlateDef {
  const d = PLATE_DEFS.find((p) => p.id === id)
  if (!d) throw new Error(`no plate ${id}`)
  return d
}

/** Half the stereo disparity (px) at depth z for a plate. */
export function halfShift(def: PlateDef, z: number): number {
  const f = (EYE_W / 2) / Math.tan((def.fov * Math.PI) / 360)
  return (f * BASE) / (2 * z)
}
/** Cyclopean eye coordinates → plate texel coordinates for one eye. */
export function toPlate(def: PlateDef, eye: 'L' | 'R', cx: number, cy: number, z: number): [number, number] {
  const h = halfShift(def, z)
  return eye === 'L' ? [EYE.L.x + cx + h, EYE.L.y + cy] : [EYE.R.x + cx - h, EYE.R.y + cy]
}

const metaCache = new Map<PlateId, PlateMeta>()
export function metaOf(id: PlateId): PlateMeta {
  const hit = metaCache.get(id)
  if (hit) return hit
  const d = defOf(id)
  const hotspots: Hotspot[] = d.hs.map((h) => {
    const [x, y] = toPlate(d, h.eye === 'R' ? 'R' : 'L', h.cx, h.cy, h.z)
    const o: Hotspot = { id: h.id, eye: h.eye, x: Math.round(x), y: Math.round(y), r: h.r, zone: h.zone, kind: h.kind }
    if (h.minPower) o.minPower = h.minPower
    if (h.clue) o.clue = h.clue
    return o
  })
  const portraits: PortraitRect[] = d.pr.map((p) => {
    const [x, y] = toPlate(d, p.eye, p.cx, p.cy, p.z)
    return { soul: p.soul, fig: p.fig, eye: p.eye, x: Math.round(x - p.w / 2), y: Math.round(y - p.h / 2), w: p.w, h: p.h }
  })
  const f = (EYE_W / 2) / Math.tan((d.fov * Math.PI) / 360)
  const m: PlateMeta = { id: d.id, no: d.no, title: d.title, date: d.date, time: d.time, bundle: d.bundle, register: d.register,
    souls: d.souls, portraits, hotspots, convergencePx: Math.round((f * BASE) / d.subjectZ), chord: d.chord }
  metaCache.set(id, m)
  return m
}
