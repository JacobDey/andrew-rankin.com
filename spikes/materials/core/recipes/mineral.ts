// Stone, ceramic, earth and glass recipes (brick lives in stone.ts).

const CONCRETE_FIELD_FINISH = /* glsl */ `
// x = broom streaks, y = wear, z = tone
vec4 field(vec2 uv) {
  vec2 bw = uv + vec2(0.0, MM(0.8) * fbmT(uv, nc(18.0), 3, 0.5, 9u));
  float broom = fbmT(bw, vec2(nc(20.0), nc(0.5)), 5, 0.6, 6u);
  float wear = smoothstep(-0.3, 0.4, fbmT(uv, nc(25.0), 3, 0.5, 10u));
  return vec4(broom, wear, fbmT(uv, nc(14.0), 5, 0.55, 11u), 0.0);
}
`
const CONCRETE_FIELD_AGGREGATE = /* glsl */ `
// x = sand, y = sand grains, z = aggregate distance, w = aggregate random
vec4 field(vec2 uv) {
  float sand = fbmT(uv, nc(0.4), 3, 0.6, 1u);
  vec4 sg = worleyT(uv, nc(0.5), 2u, 1.0);
  vec2 w = uv + MM(1.5) * warpT(uv, nc(6.0), 2, 3u);
  vec4 ag = worleyT(w, nc(3.5), 4u, 0.9);
  return vec4(sand, dome(sg.x, 0.5) * detail(MM(0.3)), ag.x, ag.z);
}
`
const CONCRETE_SURFACE = /* glsl */ `
// Broom-finished sidewalk: cement paste and sand, a few exposed stones, bugholes, grime.
Surface surface(vec2 uv) {
  vec4 Fi = F0(), Ag = F1();
  float broom = Fi.x, wear = Fi.y, tone = Fi.z;
  float sand = Ag.x, grains = Ag.y;
  float stone = (1.0 - smoothstep(0.24, 0.32, Ag.z)) * step(0.72, Ag.w);
  vec4 bh = worleyT(uv, nc(3.0), 7u, 1.0);
  float hole = (1.0 - smoothstep(0.05, 0.15, bh.x)) * step(0.9, bh.z);
  float h = 0.35 + 0.22 * broom * (1.0 - 0.5 * wear) + 0.05 * sand + 0.035 * grains + stone * 0.06 * dome(Ag.z, 0.32) - 0.5 * hole;
  vec3 alb = mix(hex(#8E8B85), hex(#B0ACA4), sat(0.5 + tone));
  alb *= 0.9 + 0.1 * sand + 0.08 * (grains - 0.5);
  vec3 sc = mix(hex(#85807A), hex(#A39C92), fract(Ag.w * 7.13));
  alb = mix(alb, sc, stone * 0.8);
  float grime = smoothstep(0.0, -0.3, broom) * 0.4 + hole * 0.7;
  alb *= 1.0 - grime * 0.4;
  // a flattened blob of old chewing gum
  vec4 gm = worleyT(uv, nc(30.0), 12u, 0.8);
  float gum = (1.0 - smoothstep(0.1, 0.14, gm.x)) * step(0.75, gm.z);
  alb = mix(alb, hex(#4A4744), gum * 0.8);
  Surface s = surf(h + gum * 0.12, alb, mix(0.9, 0.85, stone) - gum * 0.35, 0.0);
  s.loose = 0.2 * sat(sand + 0.5) * (1.0 - stone);
  s.layer = stone;
  return s;
}
`
export const CONCRETE = { fields: [CONCRETE_FIELD_FINISH, CONCRETE_FIELD_AGGREGATE], surface: CONCRETE_SURFACE }

const ASPHALT_SHAPE = /* glsl */ `
// irregular rounded outline: radius wobbles with direction (triple-angle identities, no trig)
float stoneShape(Vor v, float r) {
  vec2 d = normalize(v.rel + 1e-5);
  float s3 = 3.0 * d.y - 4.0 * d.y * d.y * d.y, c3 = 4.0 * d.x * d.x * d.x - 3.0 * d.x;
  float phi = v.rnd.x * 6.28;
  float wob = 0.12 * (v.rnd.y - 0.5) * d.x + 0.12 * (v.rnd.z - 0.5) * d.y + 0.06 * (s3 * pcos(phi) + c3 * psin(phi));
  return v.f1 / (r * (1.0 + wob));
}
vec2 asphaltWarp(vec2 uv) { return uv + MM(0.8) * warpT(uv, nc(6.0), 2, 1u); }
`
const ASPHALT_FIELD_STONES = ASPHALT_SHAPE + /* glsl */ `
// x = big-stone shape distance (1 = outline), yzw = stone randoms
vec4 field(vec2 uv) {
  Vor a = voronoiT(asphaltWarp(uv), nc(4.0), 2u, 0.9);
  return vec4(stoneShape(a, 0.36 + 0.14 * a.rnd.x), a.rnd);
}
`
const ASPHALT_FIELD_FINES = ASPHALT_SHAPE + /* glsl */ `
// x = fine-stone shape distance, y = present, z = shade
vec4 field(vec2 uv) {
  Vor b = voronoiT(asphaltWarp(uv) + 0.43, nc(1.6), 5u, 1.0);
  return vec4(stoneShape(b, 0.33 + 0.1 * b.rnd.x), step(0.3, b.rnd.y), b.rnd.z, 0.0);
}
`
const ASPHALT_SURFACE = /* glsl */ `
vec2 asphaltWarp(vec2 uv) { return uv + MM(0.8) * warpT(uv, nc(6.0), 2, 1u); }
// Stone aggregate held in a black bitumen binder; the tops polished by tyres.
Surface surface(vec2 uv) {
  vec4 A = F0(), B = F1();
  float sa = A.x;
  vec3 ar = A.yzw;
  float stA = 1.0 - smoothstep(0.92, 1.0, sa);
  float stB = (1.0 - smoothstep(0.9, 1.0, B.x)) * B.y * (1.0 - stA);
  float facet = fbmT(asphaltWarp(uv), nc(1.3), 3, 0.5, 4u);
  float sand = fbmT(uv, nc(0.25), 3, 0.6, 6u);
  float hBinder = 0.55 + 0.08 * sand + 0.15 * fbmT(uv, nc(3.0), 3, 0.5, 7u);
  float hA = 0.8 + 1.5 * dome(sa, 1.0) * (0.6 + 0.4 * ar.x) + 0.12 * facet;
  float hB = 0.65 + 0.5 * dome(B.x, 1.0);
  float h = hBinder;
  h = mix(h, max(h, hB), stB);
  h = mix(h, max(h, hA), stA);
  vec3 cA = mix(hex(#5B5853), hex(#8F8A83), ar.y);
  cA = mix(cA, hex(#7A5A4E), step(0.9, ar.z));
  cA = mix(cA, hex(#363431), step(ar.z, 0.12));
  cA *= 0.85 + 0.25 * sat(0.5 + facet);
  float top = smoothstep(0.5, 0.9, dome(sa, 1.0)) * stA;
  cA = mix(cA, cA * 1.15 + 0.015, top * 0.7);
  vec3 cB = mix(hex(#45423F), hex(#6E6A64), B.z);
  vec3 bc = mix(hex(#17171A), hex(#28272A), sat(0.5 + sand));
  vec3 alb = mix(mix(bc, cB, stB), cA, stA);
  Surface s = surf(h, alb, mix(mix(0.72, 0.82, stB), mix(0.75, 0.5, top), stA), 0.0);
  s.layer = max(stA, stB);
  s.loose = 0.3 * (1.0 - s.layer);
  return s;
}
`
export const ASPHALT = { fields: [ASPHALT_FIELD_STONES, ASPHALT_FIELD_FINES], surface: ASPHALT_SURFACE }

const TERRACOTTA_FIELD = /* glsl */ `
// x = salt-bloom field, y = damp patches, z = tone, w = lumps
vec4 field(vec2 uv) {
  float bloomN = fbmT(uv + MM(2.0) * warpT(uv, nc(10.0), 2, 8u), nc(12.0), 6, 0.6, 9u);
  return vec4(bloomN, fbmT(uv, nc(18.0), 3, 0.5, 10u), fbmT(uv, nc(8.0), 5, 0.55, 5u), fbmT(uv, nc(10.0), 4, 0.5, 4u));
}
`
const TERRACOTTA_SURFACE = /* glsl */ `
// Unglazed red clay: wheel rings, grog specks, salt bloom.
Surface surface(vec2 uv) {
  vec4 T = F0();
  float tone = T.z, lump = T.w;
  float rings = psin(TAU * (uv.y * nc(2.6) + 0.35 * fbmT(uv, nc(20.0), 3, 0.5, 1u)));
  float tooth = fbmT(uv, nc(0.35), 4, 0.6, 2u);
  vec4 pk = worleyT(uv, nc(0.7), 3u, 1.0);
  float pore = (1.0 - smoothstep(0.08, 0.2, pk.x)) * step(0.7, pk.z);
  float h = 0.12 + 0.035 * rings + 0.012 * tooth + 0.06 * lump - 0.05 * pore;
  vec3 alb = mix(hex(#A44E33), hex(#C66E4A), sat(0.5 + tone * 1.2));
  alb *= 0.95 + 0.08 * tooth;
  // grog: crushed fired clay, pale and dark specks
  float g1 = smoothstep(0.86, 0.92, vnoiseT(uv, nc(0.25), 6u));
  float g2 = smoothstep(0.88, 0.94, vnoiseT(uv + 0.3, nc(0.2), 7u));
  alb = mix(alb, hex(#E2B08A), g1 * 0.7);
  alb = mix(alb, hex(#5A2A1C), g2 * 0.6);
  alb *= 1.0 - pore * 0.4;
  // efflorescence: fuzzy white salt bloom; damp darker patches
  float bloom = smoothstep(0.12, 0.45, T.x) * (0.6 + 0.4 * tooth);
  float damp = smoothstep(0.2, 0.5, T.y);
  alb *= 1.0 - damp * 0.2;
  alb = mix(alb, hex(#E7E0D3), bloom * 0.75);
  Surface s = surf(h + bloom * 0.01, alb, 0.82 + 0.1 * bloom - 0.08 * damp, 0.0);
  s.loose = 0.2 + 0.6 * bloom;
  s.layer = bloom;
  return s;
}
`
export const TERRACOTTA = { fields: [TERRACOTTA_FIELD], surface: TERRACOTTA_SURFACE }

export const BEACH_SAND = /* glsl */ `
// Rounded grains 0.2-0.6 mm: quartz, feldspar, shell, the odd magnetite.
vec3 grainColour(vec3 r) {
  vec3 c = mix(hex(#CDB88C), hex(#E4D3AE), r.y);
  if (r.x > 0.6) c = mix(hex(#C08E72), hex(#D8A88A), r.y);
  if (r.x > 0.78) c = mix(hex(#AE8048), hex(#C9A26A), r.y);
  if (r.x > 0.9) c = mix(hex(#EEE8DC), hex(#F6F1E6), r.y);
  if (r.x > 0.955) c = mix(hex(#24221F), hex(#3E3934), r.y);
  return c;
}
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.05) * warpT(uv, nc(0.6), 2, 1u);
  Cell a = nearestCellT(w, nc(0.45), 2u, 0.85);
  Cell b = nearestCellT(w + 0.37, nc(0.3), 3u, 0.9);
  Cell c = nearestCellT(w + 0.71, nc(0.2), 7u, 0.9);
  float ca = uTileMm / nc(0.45), cb = uTileMm / nc(0.3), cc = uTileMm / nc(0.2);
  // irregular, rounded grain outlines
  float wob = 0.06 * gnoiseT(uv, nc(0.12), 8u);
  float da = dome(a.f1 + wob, 0.36 + 0.14 * a.rnd.z);
  float db = dome(b.f1 + wob, 0.34 + 0.14 * b.rnd.z);
  float dc = dome(c.f1 + wob, 0.36 + 0.1 * c.rnd.z);
  float ha = 0.16 + ca * 0.36 * da * (0.7 + 0.5 * a.rnd.y) - (1.0 - step(0.001, da)) * 0.2;
  float hb = 0.1 + cb * 0.36 * db - (1.0 - step(0.001, db)) * 0.2;
  float hc = 0.04 + cc * 0.36 * dc - (1.0 - step(0.001, dc)) * 0.2;
  float h = max(ha, max(hb, hc));
  bool topA = ha >= max(hb, hc);
  bool topB = !topA && hb >= hc;
  vec3 rnd = topA ? a.rnd : (topB ? b.rnd : c.rnd);
  float dd = topA ? da : (topB ? db : dc);
  vec3 alb = grainColour(rnd) * (0.7 + 0.3 * sqrt(dd));
  alb = mix(hex(#3A3026), alb, smoothstep(0.0, 0.25, dd));
  float glint = step(0.72, rnd.z) * step(rnd.x, 0.6);
  Surface s = surf(max(h, 0.0), alb, mix(0.7, 0.25, glint), 0.0);
  s.loose = 0.9;
  s.layer = rnd.x;
  return s;
}
`

// Granite is three passes: the crystal lattice, the mica lattice and the glinting flake facets are
// each a Voronoi, and Voronoi is the most compile-expensive primitive (see NOTES.md).
const GRANITE_WARP = `
vec2 graniteWarp(vec2 uv) {
  vec2 w = uv + MM(0.6) * warpT(uv, nc(3.0), 3, 1u);
  return w + MM(0.18) * warpT(w, nc(0.6), 2, 11u);
}
`
const GRANITE_FIELD_CRYSTALS = GRANITE_WARP + /* glsl */ `
// x = distance to crystal border, y = mineral pick, z = shade
vec4 field(vec2 uv) {
  Vor big = voronoiT(graniteWarp(uv), nc(1.3), 2u, 1.0);
  return vec4(big.edge, big.rnd.x, big.rnd.y, 0.0);
}
`
const GRANITE_FIELD_MICA = GRANITE_WARP + /* glsl */ `
// x = is black mica, y = mica shade
vec4 field(vec2 uv) {
  Vor m = voronoiT(graniteWarp(uv) + 0.37, nc(0.6), 3u, 1.0);
  float clump = fbmT(uv, nc(5.0), 2, 0.5, 4u);
  // ~12% of the surface: small scattered flakes, only loosely clumped
  float isDark = step(0.87 - 0.07 * clump, m.rnd.x) * smoothstep(0.0, 0.05, m.edge + 0.02);
  return vec4(isDark, m.rnd.y, 0.0, 0.0);
}
`
const GRANITE_FIELD_FLAKES = /* glsl */ `
// x = facet slope (mm/mm along a random tilt), y = is a mirror-like flake
vec4 field(vec2 uv) {
  Vor fl = voronoiT(uv, nc(0.25), 6u, 1.0);
  vec2 tilt = (fl.rnd.xy - 0.5) * 0.3;
  return vec4(dot(-fl.rel * (uTileMm / nc(0.25)), tilt), step(0.45, fl.rnd.z), 0.0, 0.0);
}
`
const GRANITE_SURFACE = /* glsl */ `
// Polished salt-and-pepper granite: white feldspar, glassy grey quartz, scattered black mica.
Surface surface(vec2 uv) {
  vec4 c = F0(), m = F1(), f = F2();
  float edge = c.x, pick = c.y;
  vec3 white = mix(hex(#C9C4BB), hex(#E6E2DA), c.z);
  vec3 cream = mix(hex(#C8B9A8), hex(#DDD0C0), c.z);
  vec3 quartz = mix(hex(#6A6966), hex(#8E8B87), c.z);
  vec3 alb = pick < 0.58 ? white : (pick < 0.7 ? cream : quartz);
  // quartz looks deep: darker core, lighter rim
  alb *= pick >= 0.7 ? (0.85 + 0.25 * smoothstep(0.0, 0.25, 0.3 - edge)) : 1.0;
  float isDark = m.x;
  alb = mix(alb, mix(hex(#0E0E0E), hex(#262422), m.y), isDark);
  float cl = gnoiseT(uv, nc(0.12), 5u) * 0.5 + 0.5;
  alb *= 0.93 + 0.1 * cl * (pick < 0.7 ? 1.0 : 0.3);
  float bnd = 1.0 - smoothstep(0.0, 0.03, edge);
  // mica flakes are tiny tilted mirrors: they glint at one lamp angle
  float h = 0.01 + f.x * isDark * 0.02 - 0.004 * bnd;
  Surface s = surf(h, alb * (1.0 - bnd * 0.2), mix(0.06, 0.12, bnd) + 0.04 * isDark, 0.0);
  s.metal = isDark * 0.3 * f.y;
  s.layer = isDark;
  return s;
}
`
export const GRANITE = { fields: [GRANITE_FIELD_CRYSTALS, GRANITE_FIELD_MICA, GRANITE_FIELD_FLAKES], surface: GRANITE_SURFACE }

const MARBLE_FIELD_FLOW = /* glsl */ `
// xy = first flow warp, zw = second flow warp (computed once, read by the vein pass)
vec4 field(vec2 uv) {
  vec2 w = uv + 0.06 * warpT(uv, nc(40.0), 5, 1u);
  vec2 w2 = w + 0.03 * warpT(w, nc(15.0), 4, 2u);
  return vec4(w, w2);
}
`
const MARBLE_FIELD_VEINS = /* glsl */ `
// x = cloudiness, y = soft-vein field, z = sharp-vein field, w = hairline field
vec4 field(vec2 uv) {
  vec4 W = F0();
  vec2 w = W.xy, w2 = W.zw;
  return vec4(fbmT(w2, nc(25.0), 6, 0.55, 3u), fbmT(w, nc(60.0), 5, 0.55, 4u),
              fbmT(w2, nc(30.0), 6, 0.6, 5u), fbmT(w2 + 0.5, nc(12.0), 6, 0.6, 7u));
}
`
const MARBLE_SURFACE = /* glsl */ `
// Carrara-style white marble: cloudy grey drifts, soft veins, a few sharp dark ones.
Surface surface(vec2 uv) {
  vec4 V = F1();
  float cloud = V.x;
  float soft = exp(-abs(V.y) * 18.0);
  float sharp = isoLine(V.z, 0.35) * smoothstep(-0.1, 0.25, fbmT(uv, nc(40.0), 3, 0.5, 6u));
  float hair = isoLine(V.w, 0.12) * smoothstep(0.0, 0.3, fbmT(uv, nc(30.0), 3, 0.5, 8u));
  vec3 alb = mix(hex(#ECEAE6), hex(#D3D1CD), sat(0.5 + cloud * 1.4));
  alb = mix(alb, hex(#9C9DA2), soft * 0.55);
  alb = mix(alb, hex(#5E5F66), sharp * 0.8);
  alb = mix(alb, hex(#7A7B82), hair * 0.6);
  // calcite crystal sparkle and faint polish haze
  float xt = smoothstep(0.85, 0.95, vnoiseT(uv, nc(0.3), 9u));
  float haze = smoothstep(0.2, 0.6, fbmT(uv, nc(20.0), 3, 0.5, 10u));
  float h = 0.008 + 0.002 * fbmT(uv, nc(1.0), 3, 0.5, 11u) - 0.004 * sharp;
  Surface s = surf(h, alb * (1.0 + 0.03 * xt), 0.06 + 0.14 * haze + 0.05 * sharp, 0.0);
  s.layer = sharp;
  return s;
}
`
export const MARBLE = { fields: [MARBLE_FIELD_FLOW, MARBLE_FIELD_VEINS], surface: MARBLE_SURFACE }

export const POPCORN = /* glsl */ `
// Spray-on acoustic texture: blobs of every size, glinting vermiculite, dust in the hollows.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.8) * warpT(uv, nc(6.0), 2, 1u);
  vec4 a = worleyT(w, nc(3.4), 2u, 1.0);
  vec4 b = worleyT(w + 0.31, nc(1.9), 3u, 1.0);
  vec4 c = worleyT(w + 0.67, nc(1.0), 4u, 1.0);
  vec4 d = worleyT(w + 0.13, nc(0.5), 5u, 1.0);
  float la = dome(a.x, 0.62) * (1.2 + 1.2 * a.z);
  float lb = dome(b.x, 0.6) * (0.8 + 0.8 * b.z);
  float lc = dome(c.x, 0.58) * (0.5 + 0.5 * c.z);
  float ld = dome(d.x, 0.55) * (0.25 + 0.2 * d.z) * detail(MM(0.25));
  float h = smax(smax(la, lb, 0.25), smax(lc, ld, 0.12), 0.18);
  h += 0.06 * fbmT(uv, nc(0.4), 3, 0.5, 6u);
  float hn = sat(h / 2.4);
  vec3 alb = mix(hex(#CFC8BA), hex(#F1EEE7), smoothstep(0.0, 0.6, hn));
  float verm = smoothstep(0.9, 0.95, vnoiseT(uv, nc(0.22), 7u));
  alb = mix(alb, hex(#9C8C70), verm * 0.6);
  float flake = smoothstep(0.93, 0.97, vnoiseT(uv + 0.4, nc(0.18), 8u));
  Surface s = surf(h, alb, mix(0.95, 0.4, flake), 0.0);
  s.loose = 0.5 + 0.4 * (1.0 - hn);
  return s;
}
`

// Cracked mud is three passes: each crack generation (warp + Voronoi) is its own program.
const MUD_FIELD_PRIMARY = /* glsl */ `
// x = distance to a primary crack (mm), y = that crack's width (mm)
vec4 field(vec2 uv) {
  vec2 w = uv + MM(5.0) * warpT(uv, nc(45.0), 4, 1u);
  float nA = nc(32.0);
  Vor a = voronoiT(w, nA, 2u, 0.85);
  float eA = a.edge * uTileMm / nA + 0.6 * fbmT(uv, nc(3.0), 3, 0.5, 3u);
  float wA = 1.2 + 1.6 * vnoiseT(uv, nc(40.0), 4u);
  return vec4(eA, wA, 0.0, 0.0);
}
`
const MUD_FIELD_SECONDARY = /* glsl */ `
// x = distance to a secondary crack (mm), y = where secondary cracks have formed
vec4 field(vec2 uv) {
  vec2 w2 = uv + MM(2.0) * warpT(uv, nc(20.0), 3, 5u);
  float nB = nc(11.0);
  Vor b = voronoiT(w2, nB, 6u, 0.9);
  float eB = b.edge * uTileMm / nB + 0.3 * fbmT(uv, nc(1.5), 3, 0.5, 7u);
  float partial = smoothstep(0.0, 0.3, fbmT(uv, nc(25.0), 3, 0.5, 8u));
  return vec4(eB, partial, 0.0, 0.0);
}
`
const MUD_SURFACE = /* glsl */ `
// Desiccation cracks: curled plates, a second generation of fine cracks, silt and grit.
Surface surface(vec2 uv) {
  vec4 A = F0(), B = F1();
  float eA = A.x, wA = A.y, eB = B.x, partial = B.y;
  float crackA = 1.0 - smoothstep(wA * 0.5, wA * 0.5 + 0.6, eA);
  float crackB = (1.0 - smoothstep(0.25, 0.7, eB)) * partial;
  // plates curl up at their edges and dish in the middle
  float curl = smoothstep(9.0, 0.0, eA) * 1.6;
  float dish = smoothstep(2.0, 14.0, eA) * -0.6;
  float silt = fbmT(uv, nc(1.2), 5, 0.55, 9u);
  float h = 5.0 + curl + dish + 0.25 * silt;
  h -= crackB * 1.6;
  h = mix(h, 0.4 + 0.3 * silt, crackA);
  vec3 alb = mix(hex(#9C7F5C), hex(#B89A72), sat(0.5 + silt));
  alb = mix(alb, hex(#CDB48E), smoothstep(0.4, 1.4, curl) * 0.6);
  alb *= 0.9 + 0.2 * vnoiseT(uv, nc(0.3), 10u);
  vec3 deep = hex(#3E2F22);
  alb = mix(alb, deep, max(crackA, crackB * 0.7));
  float pebble = smoothstep(0.82, 0.9, vnoiseT(uv, nc(1.5), 11u));
  alb = mix(alb, hex(#6E6458), pebble * 0.5);
  Surface s = surf(h + pebble * 0.3, alb, 0.95, 0.0);
  s.loose = 0.4 + 0.5 * crackA;
  s.layer = crackA;
  return s;
}
`
export const CRACKED_MUD = { fields: [MUD_FIELD_PRIMARY, MUD_FIELD_SECONDARY], surface: MUD_SURFACE }

// Frost is two passes: the dendrite field (9 seeds x 2 arms of fern geometry) is its own program.
const FROST_FIELD_DENDRITES = /* glsl */ `
// Window frost dendrites: feathery ferns growing from seeds.
float fern(vec2 p, vec2 dir, float len, float scale) {
  float a = dot(p, dir), b = dot(p, vec2(-dir.y, dir.x));
  float t = a / len;
  float inLen = smoothstep(-0.1, 0.05, a) * (1.0 - smoothstep(0.75, 1.0, t));
  float taper = mix(1.0, 0.4, sat(t));
  float spine = 1.0 - smoothstep(0.05 * scale * taper, 0.1 * scale * taper, abs(b));
  float per = 0.42 * scale;
  float c = a - abs(b) * 0.62;
  float bl = max(len - a, 0.0) * 0.42;
  float fc = abs(fract(c / per) - 0.5);
  float br = 1.0 - smoothstep(0.07, 0.17, fc);
  float side = br * (1.0 - smoothstep(bl * 0.55, bl, abs(b)));
  // needles on the branches
  float c2 = abs(b) - fc * per * 0.6;
  float need = (1.0 - smoothstep(0.1, 0.25, abs(fract(c2 / (per * 0.35)) - 0.5))) * (1.0 - smoothstep(bl * 0.3, bl * 0.9, abs(b))) * 0.5;
  need *= 1.0 - smoothstep(0.1, 0.25, fc);
  return max(spine, max(side * 0.8, need)) * inLen;
}
// x = dendrite coverage
vec4 field(vec2 uv) {
  vec2 w = uv + MM(0.25) * warpT(uv, nc(1.5), 3, 1u);
  float n = nc(7.0);
  vec2 p = w * n;
  ivec2 per = ivec2(int(n));
  ivec2 ci = ivec2(floor(p));
  float cellMm = uTileMm / n;
  float fr = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 g = ci + ivec2(i, j);
    vec3 r = hash3(g, per, 2u);
    vec2 seedP = vec2(g) + 0.2 + 0.6 * r.xy;
    vec2 d = (p - seedP) * cellMm;
    float ang = r.z * TAU;
    float len = cellMm * (1.0 + 0.8 * hash1(g, per, 3u));
    fr = max(fr, fern(d, vec2(pcos(ang), psin(ang)), len, 1.0));
    float ang2 = ang + (hash1(g, per, 4u) > 0.5 ? 1.05 : -1.05);
    fr = max(fr, 0.85 * fern(d, vec2(pcos(ang2), psin(ang2)), len * 0.65, 0.8));
  }
  fr *= smoothstep(-0.3, 0.05, fbmT(uv, nc(14.0), 3, 0.5, 9u));
  return vec4(fr, 0.0, 0.0, 0.0);
}
`
const FROST_SURFACE = /* glsl */ `
// Window frost: feathery dendrites growing from seeds on dark glass, plus grainy hoarfrost.
Surface surface(vec2 uv) {
  float fr = F0().x;
  float hoar = smoothstep(0.1, 0.45, fbmT(uv, nc(8.0), 4, 0.55, 5u));
  vec4 gr = worleyT(uv, nc(0.14), 6u, 1.0);
  float grain = dome(gr.x, 0.55) * hoar * detail(MM(0.08));
  float ice = max(fr, grain * 0.8);
  float h = 0.02 + 0.09 * fr + 0.05 * grain;
  vec3 glass = hex(#0B1115);
  vec3 frost = mix(hex(#B9CAD6), hex(#F2F7FA), ice);
  vec3 alb = mix(glass, frost, sat(ice * 1.3));
  Surface s = surf(h, alb, mix(0.04, 0.5, sat(ice * 1.5)), 0.0);
  s.loose = ice * 0.6;
  s.layer = step(0.3, ice);
  return s;
}
`
export const FROST_GLASS = { fields: [FROST_FIELD_DENDRITES], surface: FROST_SURFACE }
