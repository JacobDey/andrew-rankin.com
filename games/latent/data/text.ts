// Every in-game string outside the records database: story bible §7 (verbatim) and §10 (stages).
import type { StageId } from '../core/types'

export const OPENING = {
  pull: 'PULL',
  startCard: 'Start here. The first print is already in the easel. Into the left tray, rock it gently, and wait for it. — R.K.',
}

/** §7.1 terminal boot (types itself at 40 chars/s; any key skips). The last line is the search prompt with HOLD typed. */
export const BOOT_LINES = [
  'VARROW POLICE · RECORDS TERMINAL 7 · PHOTOGRAPHIC UNIT',
  '28.03.03  21:06',
  'WORK ORDER 03-0417 ASSIGNED TO: CALDER TECHNICIAN',
  'ONE WORD OR TWO. ENTER TO SEARCH.',
]
export const BOOT_QUERY = 'HOLD'

/** §7.2 terminal responses. */
export const TERM = {
  results: (n: number) => (n > 5 ? `${n} MATCHES — SHOWING 5 (OLDEST FIRST)` : `${n} MATCH${n === 1 ? '' : 'ES'}`),
  none: 'NO MATCH.',
  everything: 'THAT WORD IS IN EVERYTHING. BE SPECIFIC.',
  repeat: 'ALREADY ON YOUR TAPE.',
  tooMany: 'ONE WORD OR TWO.',
  help: 'SEARCH: ONE WORD OR TWO.  OPEN: ARROWS + ENTER.  BACK: ESC.  CLOSE 03-0417 WHEN DONE.',
  notProcessed: 'REG 14.2: MATERIAL NOT YET PROCESSED. CONTINUE.',
  disposition: 'DISPOSITION?  FILE  /  PURGE',
  file: (n: number) => `ENVELOPE CONTAINS ${n} PRINT(S). SEND TO FRONT DESK?  YES / NO`,
  purge: 'PURGE IS FINAL. CONFIRM?  YES / NO',
  keepOne: 'ONE PRINT MAY BE KEPT.',
  close: 'CLOSE 03-0417',
}

/** §7.4 labels on objects. */
export const LABELS = {
  carton: 'HOLD — R.K.',
  tank: ['LATENT IMAGE', 'UNIT TANK 2'],
  chart: [
    'VARROW PAN 400 · UNIT DEVELOPER · 20 °C',
    'NORMAL (EI 400) ........ 8:00',
    'PUSH +1 (EI 800) ....... 10:30',
    'PUSH +2 (EI 1600) ...... 12:45',
    'AGITATE: 4 INVERSIONS EVERY 30 S. RAP THE TANK.',
  ],
  chartPencil: 'SLATE. BRACKET. CAPITALS. — R.K.',
  paperSafe: 'VARROW BROMIDE · GRADED · 8×10 · 100 SHEETS',
  drawer: '0 1 2 3 4 5',
  drawerNote: 'for ghosts',
  trays: ['DEV', 'STOP', 'FIX'],
  envelope: 'TO: PROFESSIONAL STANDARDS · VIA FRONT DESK · 6 PRINTS MAX',
  stamp: 'LEGIBLE',
}

/** §7.5 wordless technique cards (Mina's cursive). */
export const CARDS: { id: string; word: string; where: 'column' | 'drawer' | 'carrier' | 'shelf' | 'dev' }[] = [
  { id: 'dodge', word: 'wiggle', where: 'column' },
  { id: 'burn', word: 'more', where: 'column' },
  { id: 'grade', word: 'harder', where: 'drawer' },
  { id: 'flip', word: 'backwards?', where: 'carrier' },
  { id: 'push', word: 'longer', where: 'shelf' },
  { id: 'enlarge', word: 'focus again', where: 'column' },
  { id: 'wait', word: 'wait for it', where: 'dev' },
]

/** §7.6 desk phone hints: stage → [tier 1, tier 2, tier 3]. */
export const HINTS: Record<StageId, [string, string, string]> = {
  A: ["Old darkroom hands used to say: put it in and don't touch it till it's done.", 'Left tray. Rock it like a cradle.', 'Just get the slate up. Read me what it says.'],
  B: ['Whatever that slate says, the terminal\'s heard of it.', "There's a name on that slate that isn't a copper's.", 'Try ODGERS.'],
  C: ["Tank's on the shelf. Chart's on the wall. Lights off first.", "Load it in the dark. Left, right, left, right. Don't rush it.", "Start with roll one. It's a burglary. Nothing'll go wrong."],
  D: ['Mr Odgers wanted to know if anything was saved. Something was.', 'Roll six. A photograph of a photograph. Look past the bird.', "There's a number plate. Burn the shine off it and search the plate."],
  E: ['Whoever walked on that tannery step had a funny heel.', 'Christmas party. Somebody put his foot on a chair. Dot never forgave him.', 'Search BOOT.'],
  F: ["The sleeve that's already developed. Somebody's been in it before you.", 'Last frames of that roll. Somebody was low down and running.', 'Read the plate on the car leaving the dock.'],
  G: ['Those cassettes marked plus two. That means something to a darkroom.', "Longer in the developer. There's a chart.", 'Twelve forty-five.'],
  H: ['Coroner measured her. Did anybody measure Mina?', 'Search HEIGHT.', 'Search STATURE, then look at a door frame.'],
  I: ['Funny thing, a horizon. Always at your own eye.', 'Tanner\'s Row. Twice. Look at the white line.', 'Roll three and roll eight, same alley. Which side of the line is the camera?'],
  J: ['Ten in the log. Count them.', 'The one with no label. Look at the cassette, not the film.', 'Last frame. Night. Windows turn into mirrors.'],
  K: ["I'm here till six. Envelope comes up to me, or it doesn't.", "Whatever you decide, I'll not ask you why.", 'Type CLOSE 03-0417.'],
}

export const UNPROMPTED = {
  first: "Desk here. Kessane's not coming in; said you'd manage. Terminal's on the left. Ring if you're stuck.",
  dock: "I was the first one there, you know. Saw a kid run off the dock. I told him. Never mind. Carry on.",
  van: "Van's outside. Driver says he'll wait. Take your time.",
}

/** §7.7 endings. */
export const ENDING = {
  fileAtwellDock: "He takes the envelope. He looks at the top print for a long time. 'I told him about the kid,' he says. 'I told him.'",
  fileAtwell: 'He takes the envelope and goes back up without a word.',
  clippings: {
    murder: { h: 'DEPUTY CHIEF ARRESTED OVER 1979 PHOTO PLANT DEATH', d: 'Medal dinner cancelled; fire squad files seized' },
    arson: { h: "DEPUTY CHIEF'S RETIREMENT POSTPONED", d: 'Two 1970s fires to be re-examined' },
    corruption: { h: "INSURER'S OLD PAYOUTS UNDER REVIEW", d: 'Police decline to comment' },
    none: { h: 'POLICE PHOTO UNIT CLOSES AFTER 61 YEARS', d: 'Deputy Chief Hale to receive Chief\'s Medal' },
    identity: { h: "WOMAN BURIED AS 'MINA LUSK' WAS POLICE PHOTOGRAPHER, REVIEW FINDS", d: '' },
    mina: { h: "'DEAD' FIRE WITNESS ALIVE, SAY DETECTIVES", d: 'Woman, 50, living under colleague\'s name since 1979, to give evidence' },
    medal: { h: "DEPUTY CHIEF HALE RECEIVES CHIEF'S MEDAL", d: '' },
  },
  faxMina: 'You found us both. Thank you. — Mina',
  faxIdentity: 'Thank you for looking at her. — R.K.',
  faxPlain: 'Thank you. — R.K.',
  faxPurge: 'Thank you.',
  headstone: "ST. EBBA'S, JUNE 2003: HEADSTONE RE-CUT. RUTH ANN KESSANE, 1941–1979.",
  last: (sent: number, kept: number) => `${sent} NEGATIVES WENT TO SILVER RECOVERY AT 06:00. ${kept} KEPT.`,
}

/** §10 stages (hint selection, test API). */
export const STAGES: { id: StageId; label: string }[] = [
  { id: 'A', label: 'First print' },
  { id: 'B', label: 'Find the order' },
  { id: 'C', label: 'Develop a roll' },
  { id: 'D', label: 'The car' },
  { id: 'E', label: 'The boot' },
  { id: 'F', label: 'The plant' },
  { id: 'G', label: 'The two pushed rolls' },
  { id: 'H', label: 'Who died' },
  { id: 'I', label: 'Who held the camera' },
  { id: 'J', label: 'The eleventh roll' },
  { id: 'K', label: 'Done' },
]

/** Records-only fallback notice (GDD §11.7). */
export const RECORDS_ONLY = 'The darkroom needs WebGL2. The records are all here.'
