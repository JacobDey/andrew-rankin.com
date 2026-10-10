// The Atlas (texturedle.md §3.3, §6.4): every valid guess, with the five tile
// attributes. "We grade the surface, not the noun": nouns that would share all
// five values are merged into one entry with both as aliases (lintAtlas()).

export type Family = 'metal' | 'wood' | 'stone' | 'textile' | 'animal' | 'polymer' | 'paper' | 'plant'
export type Habitat = 'kitchen' | 'wardrobe' | 'home' | 'workshop' | 'street' | 'garden' | 'wild' | 'play'
export interface AtlasEntry { id: string; name: string; family: Family; habitat: Habitat; hardness: number; grain: number; wear: number; aliases: string[] }

export const FAMILY_NAME: Record<Family, string> = {
  metal: 'Metal', wood: 'Wood & Bark', stone: 'Stone & Earth', textile: 'Textile', animal: 'Animal', polymer: 'Polymer', paper: 'Paper & Card', plant: 'Plant & Food',
}
export const HABITAT_NAME: Record<Habitat, string> = {
  kitchen: 'Kitchen', wardrobe: 'Wardrobe', home: 'Home', workshop: 'Workshop & Studio', street: 'Street & Yard', garden: 'Garden', wild: 'Wild', play: 'Play & Sport',
}
export const HARDNESS_NAME = ['', 'Fluffy', 'Soft', 'Yielding', 'Firm', 'Hard']
export const GRAIN_NAME = ['', 'Glassy', 'Fine', 'Medium', 'Coarse', 'Rugged']
export const WEAR_NAME = ['', 'New', 'Used', 'Worn', 'Weathered', 'Ruined']

const F: Record<string, Family> = { M: 'metal', W: 'wood', S: 'stone', T: 'textile', A: 'animal', P: 'polymer', C: 'paper', F: 'plant' }
const H: Record<string, Habitat> = { K: 'kitchen', R: 'wardrobe', H: 'home', S: 'workshop', Y: 'street', G: 'garden', W: 'wild', P: 'play' }

// id | Name | F H hd gr wr | aliases (;-separated)
const RAW = `
rusty-mailbox|Rusty mailbox|M Y 5 4 4|rusted mailbox;mailbox;mail box;letterbox;letter box;post box;old mailbox;rusty letterbox
packing-bubbles|Packing bubbles|P H 3 4 1|bubble wrap;bubblewrap;bubble pack;air bubbles;packing bubble
dried-mud-rut|Dried mud rut|S Y 4 4 4|dried mud;cracked mud;mud;rut;dirt;dry mud;mud crust
laurel-leaf|Laurel hedge leaf|F G 3 2 1|laurel;laurel leaf;hedge leaf;hedge;leaf;evergreen leaf
moss-fence-post|Moss on a fence post|F G 2 3 1|moss;fence post moss;mossy wood;cushion moss
oak-bark|Oak bark|W G 5 5 4|oak;bark;tree bark;oak tree;trunk;tree trunk
house-brick|House brick|S Y 5 3 4|brick;bricks;red brick;brick wall;brickwork;masonry
porch-boards|Porch boards|W H 4 3 4|porch;deck;decking;floorboards;boards;weathered boards;porch floor
coir-doormat|Coir doormat|T H 4 5 2|doormat;door mat;coir;welcome mat;coir mat
brass-knocker|Brass door knocker|M H 5 2 3|brass;knocker;door knocker;brass knocker
flocked-wallpaper|Flocked wallpaper|C H 2 2 2|wallpaper;flock wallpaper;flock;velvet wallpaper
denim-jacket|Denim jacket|T R 3 2 3|denim;jeans;jean jacket;blue jeans;twill
corduroy-armchair|Corduroy armchair|T H 3 4 2|corduroy;cord;cords;armchair;chair
vinyl-record|Vinyl record|P H 5 2 2|record;vinyl;lp;album;gramophone record
cork-board|Cork board|W H 3 2 2|cork;corkboard;bulletin board;pinboard;notice board
orange-peel|Orange peel|F K 3 3 1|orange;orange skin;citrus peel;citrus;peel;tangerine;mandarin;clementine
strawberry|Strawberry|F K 2 3 1|strawberries;berry
toast|Toast|F K 4 3 2|toasted bread;slice of toast;buttered toast
cast-iron-pan|Cast-iron pan|M K 5 2 3|cast iron;skillet;frying pan;pan;cast iron pan
terry-towel|Terry tea towel|T K 2 3 2|tea towel;towel;terry cloth;terry;dish towel
chalkboard|Chalkboard|S H 5 2 2|blackboard;slate board;chalk board
basketball|Basketball|P P 4 3 3|basket ball;ball
golf-ball|Golf ball|P P 5 4 2|golfball;golf
hook-and-loop|Hook-and-loop strip|P R 4 2 2|hook and loop;touch fastener;fastener;camera bag flap;hook tape
leather-strap|Leather camera strap|A S 3 2 3|leather;strap;camera strap;leather strap;belt
brushed-aluminium|Brushed aluminium light stand|M S 5 2 2|aluminium;aluminum;brushed aluminium;brushed aluminum;light stand;brushed metal
sandpaper|Coarse sandpaper|C S 5 3 2|sand paper;emery paper;glasspaper;abrasive paper
popcorn-ceiling|Popcorn ceiling|S H 4 4 3|stipple ceiling;textured ceiling;stucco ceiling;ceiling
contact-sheet|Contact-sheet paper|C S 4 1 2|photo paper;contact sheet;photograph;photo;print;glossy paper;coffee ring
darkroom-sink|Darkroom sink|M S 5 1 3|sink;stainless steel;steel sink;stainless sink
birch-bark|Birch bark|W W 4 3 4|birch;paper birch;white birch;silver birch;birch tree
granite-lichen|Granite with lichen|S W 5 4 4|granite;lichen;rock;boulder;lichen on rock
window-frost|Window frost|S H 5 2 1|frost;ice;frosted window;frosted glass;ice crystals
knurled-knob|Knurled steel knob|M S 5 3 2|knurl;knob;knurled knob;knurling;steel knob
sourdough-crust|Sourdough crust|F K 4 4 2|sourdough;bread crust;bread;crust;loaf
cyanotype-paper|Cold-press cyanotype paper|C S 4 3 1|cyanotype;cold press paper;blueprint paper;cyanotype print
peeling-painted-wood|Peeling painted wood|W Y 4 3 5|peeling paint;painted wood;old paint;flaking paint
rusty-car-door|Rusty car door|M Y 5 3 4|car door;car;rusty car;car body
galvanized-bucket|Galvanized bucket|M G 5 2 3|bucket;pail;galvanised bucket;metal bucket
copper-pot|Copper pot|M K 5 1 3|copper;copper pan;saucepan
chrome-tap|Chrome tap|M K 5 1 1|tap;faucet;chrome;chrome faucet
tin-can|Tin can|M K 4 1 2|can;tin;soup can;food tin
chain-link-fence|Chain-link fence|M Y 5 5 3|chain link;fence;wire fence;cyclone fence
steel-wool|Steel wool|M S 3 2 2|wire wool;scouring pad
corrugated-roof|Corrugated metal roof|M Y 5 5 4|corrugated iron;tin roof;metal roof;roof
cheese-grater|Cheese grater|M K 5 3 2|grater
coin|Coin|M H 5 2 2|penny;quarter;money;loonie
anchor-chain|Anchor chain|M W 5 5 5|chain;ship chain;rusty chain
radiator|Radiator|M H 5 3 3|heater;cast iron radiator
wrought-iron-gate|Wrought-iron gate|M G 5 4 4|gate;iron gate;wrought iron
bike-chain|Bike chain|M P 5 3 3|bicycle chain;chain ring
aluminium-foil|Aluminium foil|M K 2 1 2|foil;tin foil;aluminum foil
key|Key|M H 5 2 1|house key;keys
cutlery|Cutlery|M K 5 1 2|fork;spoon;knife;silverware;flatware
nail-head|Nail head|M S 5 2 4|nail;nails;rusty nail
pine-bark|Pine bark|W W 4 5 4|pine;pine tree;bark mulch
driftwood|Driftwood|W W 4 3 5|drift wood;beach wood
plywood|Plywood|W S 4 3 2|ply;sheet wood
chipboard|Chipboard|W S 4 4 2|particle board;particleboard;osb;oriented strand board
pine-cone|Pine cone|W W 4 5 3|pinecone;cone
wicker-basket|Wicker basket|W H 4 4 3|wicker;basket;rattan
bamboo|Bamboo|W G 5 2 2|bamboo cane;cane
tree-stump|Tree stump|W W 5 4 5|stump;log;end grain
cutting-board|Cutting board|W K 4 2 3|chopping board;bread board
wooden-spoon|Wooden spoon|W K 4 2 4|wood spoon;spatula;wooden spatula
picket-fence|Picket fence|W G 4 3 4|picket;fence post;garden fence
pencil|Pencil|W S 4 1 2|graphite;pencil lead
matchbox-wood|Matchbox wood|W H 3 2 1|matchbox;match;matches;matchstick
sandstone|Sandstone|S W 4 3 4|sand stone;cliff
concrete-sidewalk|Concrete sidewalk|S Y 5 3 3|concrete;sidewalk;pavement;cement;driveway
gravel|Gravel|S Y 5 5 3|pebbles;stones;gravel drive
beach-sand|Beach sand|S W 2 2 2|sand;beach;dune
terracotta-pot|Terracotta pot|S G 5 2 3|terracotta;flower pot;clay pot;plant pot
porcelain-plate|Porcelain plate|S K 5 1 1|porcelain;plate;china;dish
marble-countertop|Marble countertop|S K 5 1 2|marble;countertop;counter;worktop
slate-roof|Slate roof|S Y 5 2 4|slate;roof tile;shingle
pumice|Pumice|S W 4 3 2|pumice stone;lava rock
asphalt|Asphalt|S Y 5 4 3|road;blacktop;tarmac;street
snow|Snow|S W 1 2 1|snowbank;snowflake
salt-crust|Salt crust|S W 4 2 3|salt;rock salt;salt flat
glass-bottle|Glass bottle|S K 5 1 3|bottle;glass;jar
crackle-glaze-mug|Crackle-glaze mug|S K 5 2 2|mug;crackle glaze;glaze;ceramic mug;cup
plaster-wall|Plaster wall|S H 4 2 3|plaster;wall;drywall
grout|Grout|S K 4 2 4|tile grout;tiles;tile
velvet|Velvet|T H 2 2 1|velour;plush
wool-sweater|Wool sweater|T R 2 3 2|sweater;jumper;wool;knit sweater
felt|Felt|T S 2 2 1|felt sheet;wool felt
lace|Lace|T R 2 3 1|doily;lace trim
canvas|Canvas|T S 3 2 2|canvas bag;tote;duck cloth
fleece|Fleece|T R 1 2 1|fleece jacket;polar fleece
carpet|Carpet|T H 3 3 3|rug;carpeting;broadloom
tweed|Tweed|T R 3 3 2|tweed jacket;herringbone
silk-scarf|Silk scarf|T R 1 1 1|silk;scarf;satin
nylon-rope|Nylon rope|T P 4 4 3|rope;cord rope;climbing rope
mesh-bag|Mesh bag|T K 3 4 2|mesh;net bag;onion bag
sequin-fabric|Sequin fabric|T R 3 3 1|sequins;sequin;glitter fabric
knitted-hat|Knitted hat|T R 2 4 2|toque;beanie;wool hat;knit hat
quilted-jacket|Quilted jacket|T R 2 4 1|puffer;puffer jacket;quilt;down jacket
burlap-sack|Burlap sack|T G 3 4 3|burlap;hessian;jute;sack;sandbag
linen-napkin|Linen napkin|T K 2 2 2|linen;napkin;tablecloth
suede-shoe|Suede shoe|A R 2 2 3|suede;shoe;boot
sheepskin|Sheepskin|A H 1 4 2|sheepskin rug;fleece rug;lambskin
snakeskin|Snakeskin|A W 4 3 1|snake;snake skin;reptile skin
feather|Feather|A W 1 2 1|plume;quill
dog-fur|Dog fur|A H 1 3 2|fur;dog;pet hair
horsehair-brush|Horsehair brush|A S 3 3 3|brush;bristles;paintbrush
eggshell|Eggshell|A K 4 1 1|egg;egg shell
seashell|Seashell|A W 5 3 4|shell;clam shell;scallop
moth-wing|Moth wing|A W 1 1 1|moth;butterfly wing;wing
honeycomb-wax|Honeycomb wax|A G 3 4 1|honeycomb;beeswax;wax
natural-sponge|Natural sponge|A H 2 4 2|sea sponge;bath sponge
fish-scales|Fish scales|A K 4 2 1|fish;scales;fish skin
bone|Bone|A W 5 2 4|skull;antler
rubber-glove|Rubber glove|P K 2 1 2|glove;dish glove;latex
yoga-mat|Yoga mat|P P 2 3 2|exercise mat;foam mat
phone-case|Phone case|P H 4 1 2|phone;case;cell phone case
garden-hose|Garden hose|P G 3 2 3|hose;hosepipe
toy-brick|Toy brick|P P 5 1 2|building brick;plastic brick;toy block
plastic-bag|Plastic bag|P K 1 1 2|bag;grocery bag;carrier bag
foam-peanut|Foam peanut|P H 2 3 1|packing peanut;styrofoam;polystyrene
shower-curtain|Shower curtain|P H 2 1 3|curtain;shower liner
tire-tread|Tire tread|P Y 4 5 4|tire;tyre;tread;wheel
kitchen-sponge|Kitchen sponge|P K 2 4 3|sponge;scrubber
bath-mat|Bath mat|P H 2 4 2|shower mat;non-slip mat
rubber-band|Rubber band|P H 3 1 2|elastic;elastic band
balloon|Balloon|P P 2 1 1|party balloon
cardboard-box|Cardboard box|C H 3 2 3|box;carton;cardboard;moving box
corrugated-cardboard|Corrugated cardboard|C S 3 4 2|corrugated;fluted card
paper-bag|Paper bag|C K 2 2 2|lunch bag;brown bag
newspaper|Newspaper|C H 2 2 3|newsprint;paper;news
egg-carton|Egg carton|C K 3 4 2|egg box;pulp;moulded pulp
paper-towel|Paper towel|C K 1 2 1|kitchen roll;paper towels
tissue|Tissue|C H 1 2 1|tissue paper;kleenex;facial tissue
playing-card|Playing card|C P 4 1 2|card;cards;deck of cards
envelope|Envelope|C H 3 1 2|letter;mail;post
sticky-note|Sticky note|C S 3 1 1|post-it;note;memo
receipt|Receipt|C H 3 1 3|till receipt;thermal paper
book-cloth|Book cloth|C H 3 2 2|book;book cover;hardcover
watercolour-paper|Watercolour paper|C S 3 3 1|watercolor paper;cold press;rag paper
avocado-skin|Avocado skin|F K 3 4 1|avocado;avocado peel
lemon|Lemon|F K 3 2 1|lemon peel;lime
cabbage-leaf|Cabbage leaf|F G 3 2 2|cabbage;kale
pineapple|Pineapple|F K 4 5 1|pineapple skin
potato|Potato|F K 4 2 1|potato skin;spud
walnut-shell|Walnut shell|F K 5 4 2|walnut;nut;nutshell
tortilla-chip|Tortilla chip|F K 4 3 1|chip;nacho;corn chip
cheese-rind|Cheese rind|F K 3 3 2|cheese;rind;parmesan
chocolate-bar|Chocolate bar|F K 4 1 1|chocolate;candy bar
cracker|Cracker|F K 4 2 2|biscuit;saltine;cracker biscuit
rice-cake|Rice cake|F K 4 4 1|puffed rice
kiwi|Kiwi|F K 3 2 2|kiwi fruit;kiwifruit
peach|Peach|F K 2 2 1|peach skin;nectarine;apricot
lettuce|Lettuce|F G 2 2 1|salad;lettuce leaf
coffee-beans|Coffee beans|F K 5 4 1|coffee;beans;coffee bean
dry-pasta|Dry pasta|F K 5 2 1|pasta;spaghetti;macaroni;noodles
cucumber|Cucumber|F G 3 3 1|pickle;gherkin
apple|Apple|F K 3 1 1|apple skin;red apple
onion-skin|Onion skin|F K 2 1 2|onion;onion peel;shallot
`

export const ATLAS: readonly AtlasEntry[] = RAW.trim().split('\n').map((line) => {
  const [id, name, attrs, aliases] = line.split('|')
  const [f, h, hd, gr, wr] = attrs.split(' ')
  return { id, name, family: F[f], habitat: H[h], hardness: +hd, grain: +gr, wear: +wr, aliases: aliases ? aliases.split(';') : [] }
})

const byId = new Map(ATLAS.map((e) => [e.id, e]))
export function atlasEntry(id: string): AtlasEntry | undefined {
  return byId.get(id)
}

/** Uniqueness lint (MUST): no two entries share all five values; ids, names and aliases are unique. */
export function lintAtlas(): string[] {
  const out: string[] = []
  const tuples = new Map<string, string>()
  const names = new Map<string, string>()
  for (const e of ATLAS) {
    if (!e.family || !e.habitat) out.push(`${e.id}: bad family/habitat`)
    for (const v of [e.hardness, e.grain, e.wear]) if (!(v >= 1 && v <= 5)) out.push(`${e.id}: ordinal out of range`)
    const t = `${e.family}|${e.habitat}|${e.hardness}|${e.grain}|${e.wear}`
    const prev = tuples.get(t)
    if (prev) out.push(`${e.id} collides with ${prev} (${t})`)
    else tuples.set(t, e.id)
    for (const n of [e.name, ...e.aliases]) {
      const k = normalizeGuess(n)
      const p = names.get(k)
      if (p && p !== e.id) out.push(`"${n}" names both ${p} and ${e.id}`)
      else names.set(k, e.id)
    }
  }
  if (ATLAS.length < 150) out.push(`only ${ATLAS.length} entries (MUST 150)`)
  return out
}

/** Lower case, strip punctuation and accents, British/American variants, plural s. */
export function normalizeGuess(s: string): string {
  let t = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  t = t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  t = t.replace(/^(a|an|the|some) /, '')
  t = t.replace(/aluminum/g, 'aluminium').replace(/colou?r/g, 'colour').replace(/gray/g, 'grey').replace(/galvanised/g, 'galvanized').replace(/watercolor/g, 'watercolour')
  return t
}
