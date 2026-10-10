// The game registry: single source of truth for the hub, the shell, page metadata,
// posters and OG cards. PURE DATA: no DOM, no imports, safe to import from vite.config.ts.
// Entries are architecture.md Appendix A (which overrides hub.md §10 where they differ).

export type GameSlug = 'texturedle' | 'darkroom' | 'plates' | 'latent' | 'lensbench' | 'studio'
export type GreaseMark = 'question' | 'check' | 'crop' | 'arrow' | 'underline' | 'star'

export interface GameInfo {
  slug: GameSlug
  frame: 1 | 2 | 3 | 4 | 5 | 6
  title: string // the game lead owns this
  noteName: string // Andrew's plain name, used in the hub kicker; fixed
  tagline: string // <= 60 chars
  blurb: string // 35-50 words; the hub caption
  description: string // <= 155 chars; <meta name=description> and OG
  meta: [string, string, string]
  greaseMark: GreaseMark
  greaseNote: string // <= 6 words
  edgeJoke: string // <= 30 chars, all caps
  scheme: 'auto' | 'light' | 'dark'
  accent: string // mirrors --ar-game-<slug> (light value) for canvas use
  accentLit: string // mirrors --ar-game-<slug>-lit
  status: 'developing' | 'ready'
  credit?: string
}

export const SITE = {
  title: 'Andrew Rankin · Minigame Collection',
  tagline: 'Six photographic toys, thought up at the kitchen sink.',
  stock: 'RANKIN 400',
  roll: 'ROLL 01',
  repoUrl: 'https://github.com/JacobDey/andrew-rankin.com',
}

export const GAMES: readonly GameInfo[] = [
  {
    slug: 'texturedle',
    frame: 1,
    title: 'Texturedle',
    noteName: 'Texture-dle',
    tagline: 'One surface a day, much too close.',
    blurb:
      "A photograph taken far too close to something you've definitely touched. Tilt the camera five degrees, roll a marble across the grain, drag a fine cloth and a rough one over it, then name the surface before your guesses run out.",
    description:
      'A daily guessing game played by touch: tilt, roll a marble and drag cloth across an extreme close-up, then name the surface.',
    meta: ['Puzzle', 'Daily', '~5 min'],
    greaseMark: 'question',
    greaseNote: 'too close?',
    edgeJoke: 'TOO CLOSE TO FOCUS · 0.3 MM',
    scheme: 'auto',
    accent: '#A84B22',
    accentLit: '#EA8A5F',
    status: 'developing',
  },
  {
    slug: 'darkroom',
    frame: 2,
    title: 'Darkroom',
    noteName: 'Darkroom',
    tagline: 'A darkroom you can slosh.',
    blurb:
      'Bring your own picture. Drop in a PNG, prep it, then print it in silver under the safelight or in iron as a cyanotype, rocking the tray until the Prussian blue blooms. Every drop of chemistry is simulated, and the bench saves where you left it.',
    description:
      'A hands-in-the-tray darkroom toy: import a PNG, then print it in silver or as a cyanotype with simulated, sloshing chemistry.',
    meta: ['Toy', 'Chemistry', 'Saves'],
    greaseMark: 'check',
    greaseNote: 'cyanotype, not cyanide',
    edgeJoke: 'DO NOT WASH WITH DISHES',
    scheme: 'dark',
    accent: '#1F4F99',
    accentLit: '#86ABF0',
    status: 'developing',
  },
  {
    slug: 'plates',
    frame: 3,
    title: 'Ruby Sector',
    noteName: 'Darkroom, 1-bit',
    tagline: 'Twelve undeveloped plates know why.',
    blurb:
      "A lighthouse showed white where it should have shown red, and three men drowned. Develop a dead photographer's glass plates in a sloshing, one-bit darkroom, look with one eye and then the other, and work out who everyone was and what became of them.",
    description:
      "A one-bit darkroom mystery: develop a lighthouse photographer's glass plates and work out who everyone was and how each one ended.",
    meta: ['Mystery', '1-bit', 'Deduction'],
    greaseMark: 'crop',
    greaseNote: 'count the faces',
    edgeJoke: 'HANDLE GLASS BY THE EDGES',
    scheme: 'dark',
    accent: '#2E2C28',
    accentLit: '#E6DFCB',
    status: 'developing',
  },
  {
    slug: 'latent',
    frame: 4,
    title: 'Latent Image',
    noteName: 'Police story',
    tagline: 'Nothing is evidence until you develop it.',
    blurb:
      "An old case, a police photo archive and a search box. Type a word, pull up negatives and records in any order, and print what nobody bothered to look at. Each print gives you the next word. The story is in there. It just hasn't come up yet.",
    description:
      'A police story told through an archive: search, print forgotten negatives, and develop the case in any order you like.',
    meta: ['Story', 'Search', 'Mystery'],
    greaseMark: 'arrow',
    greaseNote: 'print this one',
    edgeJoke: 'EXHIBIT ▸04A · DO NOT FOLD',
    scheme: 'dark',
    accent: '#8A5E00',
    accentLit: '#E9B04A',
    status: 'developing',
  },
  {
    slug: 'lensbench',
    frame: 5,
    title: 'Lens Bench',
    noteName: 'Camera designer',
    tagline: 'Build the glass. Shoot the street.',
    blurb:
      'Slide lenses along an optical rail and watch real rays bend, focus and fringe. Choose an aperture and a shutter, bolt on a body, then carry your camera down to a small 3D street, take actual photographs with every flaw you built in, and develop the roll.',
    description:
      'Design a camera from the glass up, watch real rays bend, then shoot and develop photos on a small 3D street.',
    meta: ['Toy', 'Optics', '3D'],
    greaseMark: 'underline',
    greaseNote: 'f/1.4 or bust',
    edgeJoke: 'CIRCLE OF CONFUSION ≤ 0.03',
    scheme: 'auto',
    accent: '#5B3FA6',
    accentLit: '#AE97F2',
    status: 'developing',
  },
  {
    slug: 'studio',
    frame: 6,
    title: 'Sunny 16',
    noteName: 'The whole studio',
    tagline: 'A house that takes pictures.',
    blurb:
      'A little summer house that takes pictures. Build a camera in the garage, set it up in a backyard full of physics toys, then carry the roll down to the basement darkroom to find out what you caught. Everything you print stays.',
    description:
      'A physics-toy photo studio in a little house: build a camera, play in the backyard, shoot, and develop the roll in the basement.',
    meta: ['Sandbox', 'Physics', '3 rooms'],
    greaseMark: 'star',
    greaseNote: "the friend's pick",
    edgeJoke: "FRIEND'S FRAME · NOT DICTATED",
    scheme: 'auto',
    accent: '#2C7547',
    accentLit: '#78CB97',
    status: 'developing',
    credit: "Frame 06 wasn't in the dictation. The friend holding the phone asked for it.",
  },
]

export const gameBySlug = (s: GameSlug): GameInfo => GAMES.find((g) => g.slug === s)!
