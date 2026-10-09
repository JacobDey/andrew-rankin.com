// Material catalog: pure data, no three.js, no GLSL. Safe to import anywhere
// (hub previews, the Atlas, a Node lint script).
//
// tileMm / reliefMm are real-world sizes: a recipe's height output is in mm and
// one generated tile covers tileMm x tileMm. The Atlas attributes (family,
// habitat, hardness, grain, wear) follow texturedle-game.md section 4 and must
// be unique per entry (see lintCatalog()).

import type { MaterialInfo } from './types'

const P = (
  muS: number,
  muK: number,
  restitution: number,
  rolling: number,
  residue: string | null,
  residueAmount: number,
  body: MaterialInfo['physics']['body'],
): MaterialInfo['physics'] => ({ muS, muK, restitution, rolling, residue, residueAmount, body })

export const CATALOG: readonly MaterialInfo[] = [
  {
    id: 'rusty-mailbox', name: 'Rusty mailbox',
    aliases: ['mailbox', 'mail box', 'letterbox', 'letter box', 'post box', 'postbox', 'rusty metal', 'rust', 'rusted steel', 'rusty steel', 'painted metal', 'rusty paint', 'rusty bin', 'rusty car door'],
    difficulty: 1, family: 'metal', habitat: 'street-yard', hardness: 5, grain: 4, wear: 4,
    tileMm: 48, reliefMm: 0.6,
    physics: P(0.8, 0.55, 0.45, 0.06, '#B5652F', 0.7, 'hollow-sheet-metal'),
    label: 'Rust takes up several times the room of the iron it eats, which is why it lifts paint into blisters instead of just staining it.',
  },
  {
    id: 'orange-peel', name: 'Orange peel',
    aliases: ['orange', 'orange skin', 'citrus peel', 'citrus', 'citrus skin', 'peel', 'tangerine', 'mandarin', 'clementine'],
    difficulty: 2, family: 'plant-food', habitat: 'kitchen', hardness: 3, grain: 3, wear: 1,
    tileMm: 30, reliefMm: 0.5,
    physics: P(0.5, 0.35, 0.2, 0.08, '#E8A030', 0.25, 'fruit'),
    label: 'Every pit is an oil gland. Bend the peel and they spray limonene, the smell of a freshly opened orange.',
  },
  {
    id: 'basketball', name: 'Basketball',
    aliases: ['basket ball', 'rubber ball', 'pebbled rubber', 'pebble grain rubber'],
    difficulty: 2, family: 'polymer', habitat: 'play-sport', hardness: 3, grain: 3, wear: 2,
    tileMm: 40, reliefMm: 1.2,
    physics: P(1.0, 0.8, 0.75, 0.05, '#7A3A1E', 0.1, 'hollow-rubber'),
    label: 'The pebbles are there for fingertips: they keep a sweaty palm from sliding off the ball.',
  },
  {
    id: 'oak-bark', name: 'Oak bark',
    aliases: ['bark', 'tree bark', 'tree', 'oak', 'oak tree', 'tree trunk', 'trunk', 'wood bark'],
    difficulty: 2, family: 'wood-bark', habitat: 'wild', hardness: 4, grain: 5, wear: 3,
    tileMm: 120, reliefMm: 9,
    physics: P(0.9, 0.7, 0.3, 0.12, '#5A4A3C', 0.3, 'wood'),
    label: 'A trunk grows from the inside, so the old outer bark splits into ridges as the tree widens.',
  },
  {
    id: 'birch-bark', name: 'Birch bark',
    aliases: ['birch', 'paper birch', 'white birch', 'silver birch', 'birch tree', 'white bark'],
    difficulty: 2, family: 'wood-bark', habitat: 'wild', hardness: 3, grain: 2, wear: 2,
    tileMm: 80, reliefMm: 1.2,
    physics: P(0.55, 0.4, 0.35, 0.05, '#EDEBE4', 0.5, 'wood'),
    label: 'The white is betulin, a waxy compound that reflects sunlight. The dark dashes are lenticels, pores the tree breathes through.',
  },
  {
    id: 'concrete-sidewalk', name: 'Concrete sidewalk',
    aliases: ['concrete', 'sidewalk', 'pavement', 'cement', 'footpath', 'driveway', 'concrete slab', 'broom finish concrete'],
    difficulty: 3, family: 'stone-ceramic', habitat: 'street-yard', hardness: 5, grain: 3, wear: 3,
    tileMm: 60, reliefMm: 1.0,
    physics: P(0.85, 0.65, 0.5, 0.05, '#A7A39C', 0.2, 'stone'),
    label: 'Finishers drag a stiff broom across the wet slab so shoes have something to grip in the rain.',
  },
  {
    id: 'asphalt', name: 'Asphalt',
    aliases: ['road', 'blacktop', 'tarmac', 'street', 'pavement', 'bitumen', 'parking lot', 'road surface'],
    difficulty: 3, family: 'stone-ceramic', habitat: 'street-yard', hardness: 4, grain: 4, wear: 3,
    tileMm: 50, reliefMm: 2.5,
    physics: P(0.95, 0.75, 0.45, 0.09, '#2E2D2C', 0.25, 'stone'),
    label: 'About 95 percent of asphalt pavement is crushed stone. The black is only the glue.',
  },
  {
    id: 'brick', name: 'Brick wall',
    aliases: ['brick', 'bricks', 'red brick', 'brickwork', 'masonry', 'mortar', 'red bricks'],
    difficulty: 1, family: 'stone-ceramic', habitat: 'street-yard', hardness: 5, grain: 4, wear: 3,
    tileMm: 450, reliefMm: 8,
    physics: P(0.9, 0.7, 0.4, 0.07, '#9A4A32', 0.4, 'stone'),
    label: 'Mortar is meant to be weaker than the brick, so a settling wall cracks along its joints instead of through its bricks.',
  },
  {
    id: 'terracotta-pot', name: 'Terracotta pot',
    aliases: ['terracotta', 'terra cotta', 'clay pot', 'flower pot', 'flowerpot', 'plant pot', 'clay', 'unglazed clay', 'earthenware'],
    difficulty: 3, family: 'stone-ceramic', habitat: 'home', hardness: 5, grain: 2, wear: 2,
    tileMm: 40, reliefMm: 0.35,
    physics: P(0.75, 0.55, 0.5, 0.04, '#C0704C', 0.35, 'ceramic'),
    label: 'Unglazed clay breathes. The white bloom is salt, carried out by water evaporating through the wall.',
  },
  {
    id: 'leather-wallet', name: 'Leather wallet',
    aliases: ['leather', 'wallet', 'billfold', 'purse', 'pebbled leather', 'cowhide', 'hide', 'leather goods'],
    difficulty: 3, family: 'hide-hair', habitat: 'wardrobe', hardness: 3, grain: 2, wear: 3,
    tileMm: 30, reliefMm: 0.4,
    physics: P(0.6, 0.45, 0.3, 0.05, null, 0, 'fabric'),
    label: 'Pebble grain is usually pressed into the hide with a heated plate, then softened by years in a pocket.',
  },
  {
    id: 'denim', name: 'Denim',
    aliases: ['jeans', 'blue jeans', 'jean', 'denim jacket', 'twill', 'chambray'],
    difficulty: 2, family: 'textile', habitat: 'wardrobe', hardness: 2, grain: 2, wear: 3,
    tileMm: 12, reliefMm: 0.25,
    physics: P(0.7, 0.55, 0.15, 0.1, '#2E4A80', 0.4, 'fabric'),
    label: 'Denim is a twill: indigo warp over undyed weft, which is why jeans are pale on the inside.',
  },
  {
    id: 'wool-knit', name: 'Wool knit sweater',
    aliases: ['sweater', 'jumper', 'knit', 'knitting', 'wool', 'wool sweater', 'knitwear', 'cardigan', 'pullover', 'stockinette'],
    difficulty: 2, family: 'textile', habitat: 'wardrobe', hardness: 1, grain: 4, wear: 2,
    tileMm: 40, reliefMm: 2.2,
    physics: P(0.9, 0.75, 0.05, 0.25, '#D8CFC0', 0.15, 'fabric'),
    label: 'Every V in stockinette is one loop of a single continuous yarn. Pull the right end and the whole thing unravels.',
  },
  {
    id: 'corduroy', name: 'Corduroy',
    aliases: ['cord', 'cords', 'corduroys', 'corduroy pants', 'corduroy jacket', 'needlecord', 'wale'],
    difficulty: 3, family: 'textile', habitat: 'wardrobe', hardness: 2, grain: 3, wear: 2,
    tileMm: 20, reliefMm: 1.1,
    physics: P(0.85, 0.6, 0.1, 0.15, '#8B5A2B', 0.1, 'fabric'),
    label: 'The ridges, called wales, are extra loops of weft cut open into pile. Brush them the wrong way and the colour darkens.',
  },
  {
    id: 'burlap', name: 'Burlap',
    aliases: ['hessian', 'jute', 'sackcloth', 'sack', 'potato sack', 'gunny sack', 'coffee sack', 'sandbag'],
    difficulty: 2, family: 'textile', habitat: 'workshop', hardness: 2, grain: 4, wear: 2,
    tileMm: 30, reliefMm: 1.4,
    physics: P(1.1, 0.8, 0.1, 0.2, '#B89A66', 0.3, 'fabric'),
    label: 'Burlap is woven from jute, a plant fibre grown in volumes second only to cotton.',
  },
  {
    id: 'cork-board', name: 'Cork board',
    aliases: ['cork', 'corkboard', 'bulletin board', 'pin board', 'pinboard', 'notice board', 'cork tile', 'wine cork'],
    difficulty: 3, family: 'wood-bark', habitat: 'home', hardness: 3, grain: 3, wear: 2,
    tileMm: 40, reliefMm: 0.8,
    physics: P(0.8, 0.6, 0.1, 0.12, '#A07C50', 0.2, 'wood'),
    label: 'Cork is bark, peeled from the cork oak every nine years or so without cutting the tree down.',
  },
  {
    id: 'sandpaper', name: 'Sandpaper',
    aliases: ['sand paper', 'glasspaper', 'emery paper', 'abrasive paper', 'grit paper', 'emery board', 'abrasive'],
    difficulty: 3, family: 'paper-card', habitat: 'workshop', hardness: 4, grain: 3, wear: 1,
    tileMm: 8, reliefMm: 0.16,
    physics: P(1.3, 1.0, 0.3, 0.25, '#8A4A2A', 0.15, 'stone'),
    label: 'The P number counts sieve openings, so higher numbers mean finer grit. Each grain here is a sharp crystal of aluminium oxide.',
  },
  {
    id: 'beach-sand', name: 'Beach sand',
    aliases: ['sand', 'beach', 'sandy beach', 'grains of sand', 'dune', 'shore'],
    difficulty: 3, family: 'stone-ceramic', habitat: 'wild', hardness: 3, grain: 3, wear: 2,
    tileMm: 10, reliefMm: 0.5,
    physics: P(0.9, 0.7, 0.05, 0.35, '#D8C49A', 0.6, 'earth'),
    label: 'Most beach sand is quartz. The black grains are often magnetite, and a fridge magnet will pick them up.',
  },
  {
    id: 'granite-countertop', name: 'Granite countertop',
    aliases: ['granite', 'countertop', 'counter top', 'kitchen counter', 'counter', 'worktop', 'polished stone', 'stone countertop'],
    difficulty: 3, family: 'stone-ceramic', habitat: 'kitchen', hardness: 5, grain: 1, wear: 1,
    tileMm: 40, reliefMm: 0.03,
    physics: P(0.3, 0.2, 0.85, 0.01, null, 0, 'stone'),
    label: 'Granite is a frozen crystal mix: pink or white feldspar, glassy grey quartz and flakes of black mica.',
  },
  {
    id: 'marble-slab', name: 'Marble slab',
    aliases: ['marble', 'carrara', 'carrara marble', 'marble countertop', 'marble floor', 'marble tile', 'polished marble'],
    difficulty: 2, family: 'stone-ceramic', habitat: 'home', hardness: 5, grain: 1, wear: 2,
    tileMm: 120, reliefMm: 0.02,
    physics: P(0.28, 0.18, 0.85, 0.01, null, 0, 'stone'),
    label: 'Marble is limestone recrystallized by heat and pressure. The grey veins are impurities smeared into flow lines.',
  },
  {
    id: 'brushed-aluminum', name: 'Brushed aluminum',
    aliases: ['aluminum', 'aluminium', 'brushed aluminium', 'brushed metal', 'brushed steel', 'stainless steel', 'laptop', 'brushed finish'],
    difficulty: 3, family: 'metal', habitat: 'home', hardness: 5, grain: 2, wear: 1,
    tileMm: 20, reliefMm: 0.01,
    physics: P(0.35, 0.25, 0.7, 0.01, '#9A9EA2', 0.05, 'thin-metal'),
    label: 'Brushing cuts parallel micro-grooves, so the highlight smears out across the grain, never along it.',
  },
  {
    id: 'cast-iron-pan', name: 'Cast iron pan',
    aliases: ['cast iron', 'skillet', 'frying pan', 'cast iron skillet', 'pan', 'griddle', 'dutch oven', 'seasoned cast iron'],
    difficulty: 4, family: 'metal', habitat: 'kitchen', hardness: 5, grain: 2, wear: 3,
    tileMm: 30, reliefMm: 0.2,
    physics: P(0.45, 0.35, 0.55, 0.03, '#1E1C1A', 0.2, 'heavy-metal'),
    label: 'Seasoning is cooking oil polymerized by heat into a hard, plastic-like film bonded to the iron.',
  },
  {
    id: 'galvanized-steel', name: 'Galvanized steel',
    aliases: ['galvanized', 'galvanised', 'galvanised steel', 'zinc', 'zinc plated', 'spangle', 'galvanized bucket', 'bucket', 'metal bucket', 'tin bucket', 'watering can', 'duct'],
    difficulty: 4, family: 'metal', habitat: 'street-yard', hardness: 5, grain: 2, wear: 2,
    tileMm: 60, reliefMm: 0.03,
    physics: P(0.4, 0.3, 0.6, 0.02, '#C8CACC', 0.05, 'hollow-sheet-metal'),
    label: 'The spangle crystals form as molten zinc freezes on the steel, each one growing outward from a single seed.',
  },
  {
    id: 'peeling-paint', name: 'Peeling paint wall',
    aliases: ['peeling paint', 'flaking paint', 'old paint', 'chipped paint', 'paint', 'painted wall', 'old wall', 'cracked paint', 'chipping paint'],
    difficulty: 2, family: 'polymer', habitat: 'street-yard', hardness: 4, grain: 4, wear: 5,
    tileMm: 60, reliefMm: 0.6,
    physics: P(0.75, 0.55, 0.35, 0.06, '#E6E2D6', 0.5, 'stone'),
    label: 'Paint lets go when water gets behind it. Old walls peel in layers, a record of every colour they have been.',
  },
  {
    id: 'popcorn-ceiling', name: 'Popcorn ceiling',
    aliases: ['popcorn', 'stipple ceiling', 'stucco ceiling', 'acoustic ceiling', 'cottage cheese ceiling', 'textured ceiling', 'ceiling', 'stucco'],
    difficulty: 4, family: 'stone-ceramic', habitat: 'home', hardness: 3, grain: 4, wear: 3,
    tileMm: 40, reliefMm: 2.5,
    physics: P(0.9, 0.7, 0.15, 0.2, '#EEEAE0', 0.6, 'stone'),
    label: 'Spray-on acoustic texture was everywhere from the 1950s to the 1980s, partly because it hid a sloppy ceiling.',
  },
  {
    id: 'moss-on-stone', name: 'Moss on stone',
    aliases: ['moss', 'mossy rock', 'mossy stone', 'moss covered rock', 'mossy boulder', 'moss on rock'],
    difficulty: 2, family: 'plant-food', habitat: 'wild', hardness: 2, grain: 3, wear: 4,
    tileMm: 50, reliefMm: 4,
    physics: P(0.8, 0.6, 0.05, 0.3, '#5E7A2A', 0.3, 'stone'),
    label: 'Moss has no roots, only hair-like rhizoids that grip. It drinks through its leaves.',
  },
  {
    id: 'leaf', name: 'Leaf',
    aliases: ['leaf veins', 'leaves', 'green leaf', 'tree leaf', 'leaf venation', 'foliage', 'plant leaf', 'maple leaf'],
    difficulty: 3, family: 'plant-food', habitat: 'wild', hardness: 2, grain: 2, wear: 1,
    tileMm: 30, reliefMm: 0.2,
    physics: P(0.4, 0.3, 0.1, 0.04, '#4F7F2A', 0.15, 'leaf'),
    label: 'The finest veins fence the leaf into little islands called areoles, each one fed from every side.',
  },
  {
    id: 'strawberry', name: 'Strawberry',
    aliases: ['strawberry skin', 'strawberries', 'berry'],
    difficulty: 1, family: 'plant-food', habitat: 'kitchen', hardness: 2, grain: 3, wear: 1,
    tileMm: 25, reliefMm: 0.8,
    physics: P(0.45, 0.3, 0.05, 0.1, '#C8303A', 0.4, 'fruit'),
    label: 'The "seeds" are achenes: each is a tiny dry fruit holding one seed of its own.',
  },
  {
    id: 'sponge', name: 'Kitchen sponge',
    aliases: ['sponge', 'cellulose sponge', 'dish sponge', 'scrubber', 'cleaning sponge'],
    difficulty: 2, family: 'polymer', habitat: 'kitchen', hardness: 2, grain: 5, wear: 2,
    tileMm: 30, reliefMm: 2.4,
    physics: P(1.0, 0.8, 0.02, 0.4, null, 0, 'foam'),
    label: 'Cellulose sponges get their holes from salt crystals mixed into the pulp and washed out afterwards.',
  },
  {
    id: 'styrofoam', name: 'Styrofoam',
    aliases: ['polystyrene', 'expanded polystyrene', 'eps', 'foam', 'packing foam', 'foam cup', 'cooler', 'styro'],
    difficulty: 3, family: 'polymer', habitat: 'home', hardness: 3, grain: 3, wear: 1,
    tileMm: 20, reliefMm: 0.35,
    physics: P(0.7, 0.55, 0.2, 0.08, '#F4F4F0', 0.1, 'foam'),
    label: 'Expanded polystyrene is about 98 percent air, trapped in beads that were steamed until they fused.',
  },
  {
    id: 'cracked-mud', name: 'Cracked mud',
    aliases: ['mud', 'dried mud', 'dry mud', 'mudcracks', 'mud cracks', 'desert', 'dry earth', 'clay soil', 'drought', 'dirt'],
    difficulty: 2, family: 'stone-ceramic', habitat: 'wild', hardness: 4, grain: 5, wear: 4,
    tileMm: 150, reliefMm: 7,
    physics: P(0.85, 0.65, 0.2, 0.1, '#A88B66', 0.5, 'earth'),
    label: 'Drying mud shrinks from the top down. The cracks meet at T-junctions first, and at three-way 120 degree joints as they age.',
  },
  {
    id: 'frost-glass', name: 'Frost on glass',
    aliases: ['frost', 'ice', 'frosted window', 'window frost', 'frost ferns', 'ice crystals', 'frozen window', 'hoarfrost'],
    difficulty: 4, family: 'stone-ceramic', habitat: 'home', hardness: 5, grain: 2, wear: 1,
    tileMm: 30, reliefMm: 0.12,
    physics: P(0.15, 0.08, 0.6, 0.01, '#DDE8F0', 0.3, 'glass'),
    label: 'Frost ferns start at scratches and specks of dust, then branch along the crystal axes of ice.',
  },
  {
    id: 'toy-brick', name: 'Toy brick studs',
    aliases: ['lego', 'legos', 'lego brick', 'lego bricks', 'toy brick', 'building brick', 'building block', 'duplo', 'brick toy', 'studs'],
    difficulty: 1, family: 'polymer', habitat: 'play-sport', hardness: 5, grain: 4, wear: 1,
    tileMm: 32, reliefMm: 1.8,
    physics: P(0.4, 0.3, 0.7, 0.02, null, 0, 'plastic'),
    label: 'Studs on an 8 mm grid. The bricks grip by friction alone, so the moulds are held to a few micrometres.',
  },
  {
    id: 'vinyl-record', name: 'Vinyl record',
    aliases: ['record', 'vinyl', 'lp', 'record grooves', 'gramophone record', 'phonograph record', 'lp record', 'gramophone'],
    difficulty: 4, family: 'polymer', habitat: 'home', hardness: 4, grain: 2, wear: 2,
    tileMm: 10, reliefMm: 0.04,
    physics: P(0.3, 0.2, 0.6, 0.02, null, 0, 'plastic'),
    label: 'It is one groove, spiralling inward. The wiggle in its walls is the sound itself.',
  },
  {
    id: 'golf-ball', name: 'Golf ball',
    aliases: ['golf', 'golfball', 'dimples', 'dimpled ball'],
    difficulty: 2, family: 'polymer', habitat: 'play-sport', hardness: 5, grain: 3, wear: 1,
    tileMm: 40, reliefMm: 0.3,
    physics: P(0.45, 0.35, 0.8, 0.02, null, 0, 'plastic'),
    label: 'Dimples trip the air into turbulence, which roughly halves the drag. Most balls carry 300 to 500 of them.',
  },
]

export type MaterialId = string

const BY_ID = new Map(CATALOG.map((m) => [m.id, m]))

export function getMaterialInfo(id: MaterialId): MaterialInfo {
  const m = BY_ID.get(id)
  if (!m) throw new Error(`Unknown material "${id}"`)
  return m
}

export const MATERIAL_IDS: readonly string[] = CATALOG.map((m) => m.id)

export const FAMILY_LABEL: Record<MaterialInfo['family'], string> = {
  'metal': 'Metal',
  'wood-bark': 'Wood & Bark',
  'stone-ceramic': 'Stone & Ceramic',
  'textile': 'Textile',
  'hide-hair': 'Hide & Hair',
  'polymer': 'Polymer',
  'paper-card': 'Paper & Card',
  'plant-food': 'Plant & Food',
}

export const HABITAT_LABEL: Record<MaterialInfo['habitat'], string> = {
  'kitchen': 'Kitchen & Pantry',
  'wardrobe': 'Wardrobe',
  'home': 'Home',
  'workshop': 'Workshop',
  'street-yard': 'Street & Yard',
  'wild': 'Wild',
  'play-sport': 'Play & Sport',
  'creature': 'Creature',
}

/** Problems a catalog editor should fix: Atlas collisions, alias clashes, bad numbers. */
export function lintCatalog(list: readonly MaterialInfo[] = CATALOG): string[] {
  const out: string[] = []
  const seen = new Map<string, string>()
  const alias = new Map<string, string[]>()
  for (const m of list) {
    const key = [m.family, m.habitat, m.hardness, m.grain, m.wear].join('|')
    const prev = seen.get(key)
    if (prev) out.push(`Atlas collision: ${prev} and ${m.id} share ${key}`)
    seen.set(key, m.id)
    for (const a of new Set([m.name.toLowerCase(), ...m.aliases])) {
      const arr = alias.get(a) ?? []
      arr.push(m.id)
      alias.set(a, arr)
    }
    if (!(m.tileMm > 0) || !(m.reliefMm > 0)) out.push(`${m.id}: tileMm/reliefMm must be > 0`)
  }
  for (const [a, ids] of alias) if (ids.length > 1) out.push(`Shared alias "${a}": ${ids.join(', ')} (resolveGuess ranks by Atlas closeness)`)
  return out
}
