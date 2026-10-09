// Bark, cork, leather, moss and leaf.

const OAK_FIELD_WARP = /* glsl */ `
// xy = warped coordinate shared by every later pass
vec4 field(vec2 uv) {
  vec2 w = uv + MM(5.0) * warpT(uv, nc(40.0), 3, 1u);
  w += vec2(MM(3.0) * fbmT(uv, vec2(nc(30.0), nc(80.0)), 3, 0.5, 2u), 0.0);
  return vec4(w, 0.0, 0.0);
}
`
const OAK_FIELD_PLATES = /* glsl */ `
// x = distance to a furrow (mm), y = furrow edge noise
vec4 field(vec2 uv) {
  vec2 w = F0().xy;
  vec2 nP = vec2(nc(11.0), nc(45.0));
  Vor pl = voronoiT(w, nP, 3u, 0.85);
  return vec4(pl.edge * uTileMm / nP.x, fbmT(uv, nc(4.0), 3, 0.5, 4u), 0.0, 0.0);
}
`
const OAK_FIELD_RELIEF = /* glsl */ `
// x = vertical ridging, y = bumps, z = raw fissure field
vec4 field(vec2 uv) {
  vec2 w = F0().xy;
  return vec4(ridgedT(w, vec2(nc(9.0), nc(90.0)), 4, 0.55, 5u), fbmT(w, vec2(nc(3.0), nc(8.0)), 5, 0.55, 6u),
              fbmT(w, vec2(nc(5.0), nc(25.0)), 3, 0.5, 7u), 0.0);
}
`
const OAK_SURFACE = /* glsl */ `
// Long vertical ridges of corky bark between deep furrows, broken by cross-cracks; lichen.
Surface surface(vec2 uv) {
  vec4 P = F1(), Q = F2();
  float eMm = P.x;
  float furrow = 1.0 - smoothstep(0.5, 3.0, eMm + 0.8 * P.y);
  float ridgeV = Q.x, bumps = Q.y;
  float plateTop = sat(eMm / 4.0);
  float fiss = isoLine(Q.z, 0.25) * plateTop;
  float h = 7.0 * (1.0 - furrow) * (0.6 + 0.4 * sqrt(plateTop)) + 1.5 * ridgeV + 0.8 * bumps - 0.6 * fiss;
  vec3 grey = mix(hex(#6E655B), hex(#A39B90), sat(0.5 + bumps * 1.2));
  vec3 alb = mix(grey, hex(#4A3B2E), furrow);
  alb *= 0.9 + 0.2 * ridgeV;
  alb = mix(alb, hex(#3A3027), fiss * 0.6);
  float lich = smoothstep(0.25, 0.45, fbmT(uv, nc(16.0), 5, 0.6, 8u)) * (1.0 - furrow);
  float lspot = smoothstep(0.45, 0.6, vnoiseT(uv, nc(1.0), 9u));
  alb = mix(alb, mix(hex(#8E9A7E), hex(#B8C0A0), lspot), lich * 0.8);
  float moss = smoothstep(0.3, 0.5, fbmT(uv, nc(20.0), 3, 0.5, 10u)) * furrow;
  alb = mix(alb, hex(#46552A), moss * 0.6);
  Surface s = surf(h + lich * 0.15, alb, 0.92 - 0.1 * lich, 0.0);
  s.loose = 0.3 + 0.3 * lich;
  s.layer = furrow;
  return s;
}
`
export const OAK_BARK = { fields: [OAK_FIELD_WARP, OAK_FIELD_PLATES, OAK_FIELD_RELIEF], surface: OAK_SURFACE }

const BIRCH_FIELD = /* glsl */ `
// x = striation, y = lenticels, z = peeling-band field
vec4 field(vec2 uv) {
  vec2 w = uv + MM(1.5) * warpT(uv, nc(20.0), 3, 1u);
  float stri = fbmT(w, vec2(nc(40.0), nc(0.25)), 4, 0.6, 2u);
  // lenticels: horizontal dashes 2-12 mm long, ~0.8 mm tall
  vec4 lw = worleyT(w, vec2(nc(9.0), nc(3.0)), 3u, 0.9);
  float lent = 1.0 - smoothstep(0.0, 0.08, lw.x * 0.7 - 0.06 * (0.35 + 0.6 * lw.z));
  vec4 lw2 = worleyT(w, vec2(nc(14.0), nc(2.2)), 4u, 0.8);
  float dash = (1.0 - smoothstep(0.12, 0.2, lw2.x)) * step(0.45, lw2.z);
  float band = fbmT(w, vec2(nc(60.0), nc(4.0)), 3, 0.5, 5u);
  return vec4(stri, max(lent * step(0.6, lw.z), dash), band, 0.0);
}
`
const BIRCH_SURFACE = /* glsl */ `
// Chalky white betulin, dark horizontal lenticels, papery strips curling up to show tan inner bark.
Surface surface(vec2 uv) {
  vec4 B = F0();
  float stri = B.x, lenticel = B.y, band = B.z;
  float peel = smoothstep(0.22, 0.3, band);
  float edge = smoothstep(0.14, 0.22, band) * (1.0 - peel);
  float lift = smoothstep(0.3, 0.45, band);
  float h = 0.3 + 0.03 * stri + 0.35 * edge + 0.25 * lift - 0.12 * lenticel;
  vec3 white = mix(hex(#DCD8CF), hex(#F1EEE8), sat(0.5 + 2.0 * stri));
  white = mix(white, hex(#E6D9C6), smoothstep(0.2, 0.6, fbmT(uv, nc(25.0), 3, 0.5, 6u)) * 0.4);
  vec3 inner = mix(hex(#B67A4E), hex(#D5A27A), sat(0.5 + stri * 2.0));
  vec3 alb = mix(white, inner, (1.0 - peel) * smoothstep(0.05, 0.14, band) * (1.0 - edge * 0.6));
  alb = mix(alb, hex(#2E2621), lenticel * 0.9);
  // grey-black rough scar patches
  float scar = smoothstep(0.5, 0.65, fbmT(uv, nc(30.0), 4, 0.6, 7u));
  float scarT = fbmT(uv, nc(1.0), 4, 0.6, 8u);
  alb = mix(alb, mix(hex(#2A2622), hex(#4A433C), sat(0.5 + scarT)), scar);
  h += scar * (0.4 + 0.4 * scarT);
  Surface s = surf(h, alb, 0.8 + 0.1 * scar, 0.0);
  s.loose = 0.5 * (1.0 - scar) * peel;
  s.layer = peel;
  return s;
}
`
export const BIRCH_BARK = { fields: [BIRCH_FIELD], surface: BIRCH_SURFACE }

const CORK_GRANULES = (n: string, off: string, salt: string) => /* glsl */ `
// x = distance to granule border, yzw = granule randoms
vec4 field(vec2 uv) {
  vec2 w = uv + MM(0.35) * warpT(uv, nc(2.0), 2, 1u);
  Vor a = voronoiT(w + ${off}, nc(${n}), ${salt}, 1.0);
  return vec4(a.edge, a.rnd);
}
`
const CORK_SURFACE = /* glsl */ `
// Agglomerated cork granules: tan to brown, honeycomb cells inside, a few old pinholes.
Surface surface(vec2 uv) {
  vec4 A = F0(), B = F1();
  bool useB = B.y > 0.5 && B.x > 0.06;
  vec3 rnd = useB ? B.yzw : A.yzw;
  float edge = useB ? B.x : A.x;
  float gapN = vnoiseT(uv, nc(0.5), 7u);
  float gap = (1.0 - smoothstep(0.0, 0.035, edge)) * smoothstep(0.35, 0.6, gapN);
  vec4 cc = worleyT(uv, nc(0.12), 4u, 1.0);
  float cells = smoothstep(0.0, 0.5, cc.y - cc.x) * detail(MM(0.1));
  float h = 0.45 + 0.1 * rnd.y + 0.04 * cells - 0.3 * gap + 0.05 * fbmT(uv, nc(0.6), 3, 0.5, 5u);
  vec3 alb = mix(hex(#9A7046), hex(#CDA875), rnd.z);
  alb = mix(alb, hex(#6A4526), step(0.85, rnd.x) * 0.7);
  alb = mix(alb, hex(#E0C292), step(rnd.x, 0.08) * 0.5);
  alb *= 0.86 + 0.18 * cells;
  alb = mix(alb, hex(#2E1E10), gap * 0.8);
  vec4 ph = worleyT(uv, nc(9.0), 6u, 0.9);
  float pin = (1.0 - smoothstep(0.28, 0.4, ph.x * (uTileMm / nc(9.0)))) * step(0.55, ph.z);
  h -= pin * 0.6;
  alb = mix(alb, hex(#1A120A), pin);
  Surface s = surf(h, alb, 0.88, 0.0);
  s.loose = 0.25;
  return s;
}
`
export const CORK = { fields: [CORK_GRANULES('1.6', '0.0', '2u'), CORK_GRANULES('0.8', '0.4', '3u')], surface: CORK_SURFACE }

const LEATHER_FIELD = /* glsl */ `
// x = distance to pebble border, y = distance to pebble centre
vec4 field(vec2 uv) {
  vec2 w = uv + MM(0.3) * warpT(uv, nc(2.0), 3, 1u);
  Vor p = voronoiT(w, nc(1.0), 2u, 0.95);
  return vec4(p.edge, p.f1, 0.0, 0.0);
}
`
const LEATHER_SURFACE = /* glsl */ `
// Pebble-grain cowhide, creased by years in a pocket, with a saddle-stitched edge.
Surface surface(vec2 uv) {
  vec4 P = F0();
  float pebble = smoothstep(0.0, 0.18, P.x);
  float tops = dome(P.y, 0.7);
  float crease = isoLine(fbmT(uv, nc(7.0), 4, 0.55, 3u), 0.25) * smoothstep(0.0, 0.35, fbmT(uv, nc(12.0), 2, 0.5, 4u));
  float fold = ridgedT(uv, nc(14.0), 3, 0.5, 5u);
  float h = 0.15 + 0.07 * pebble + 0.03 * tops + 0.08 * fold - 0.06 * crease;
  float wear = smoothstep(0.5, 0.95, fold) * pebble;
  vec3 brown = mix(hex(#4A2A18), hex(#6A3E24), sat(0.5 + fbmT(uv, nc(6.0), 4, 0.5, 6u)));
  vec3 alb = mix(brown * 0.6, brown, pebble);
  alb = mix(alb, hex(#8A5C3A), wear * 0.5);
  alb *= 1.0 - crease * 0.4;
  float rough = mix(0.65, 0.42, pebble * tops) - 0.12 * wear;
  // saddle stitching along V near the right edge, plus a creased guide line
  float sx = fract(uv.x) * uTileMm;
  float lineX = 0.82 * uTileMm;
  float groove = 1.0 - smoothstep(0.12, 0.3, abs(sx - (lineX + 2.2)));
  float band = 1.0 - smoothstep(0.9, 1.4, abs(sx - lineX));
  h -= 0.06 * groove + 0.04 * band;
  float NS = nc(3.2);
  float pitch = uTileMm / NS;
  float sy = fract(uv.y * NS);
  vec2 sp = vec2(sx - lineX, (sy - 0.5) * pitch);
  vec2 sr = rot2(sp, 0.55);
  float st = 1.0 - smoothstep(0.8, 1.0, length(sr / vec2(0.42, pitch * 0.5)));
  float thread = 0.65 + 0.35 * psin(sr.y * 10.0 + sr.x * 4.0);
  h += 0.12 * st * sqrt(sat(1.0 - pow(length(sr / vec2(0.42, pitch * 0.5)), 2.0)));
  alb = mix(alb * (1.0 - 0.3 * band), hex(#D8C9A6) * thread, st);
  rough = mix(rough, 0.7, st);
  Surface s = surf(h, alb, rough, 0.0);
  s.layer = st;
  return s;
}
`
export const LEATHER = { fields: [LEATHER_FIELD], surface: LEATHER_SURFACE }

const MOSS_FIELD_LEAVES = /* glsl */ `
// x = leaflet relief, y = leaflet shade
vec4 field(vec2 uv) {
  Vor lf = voronoiT(uv, nc(0.42), 7u, 1.0);
  float leaf = dome(length(rot2(lf.rel, lf.rnd.x * TAU) / vec2(0.28, 0.5)), 1.0);
  Vor lf2 = voronoiT(uv + 0.3, nc(0.26), 8u, 1.0);
  float leaf2 = dome(length(rot2(lf2.rel, lf2.rnd.x * TAU) / vec2(0.3, 0.55)), 1.0);
  return vec4(max(leaf, leaf2 * 0.8) * detail(MM(0.15)), lf.rnd.y, 0.0, 0.0);
}
`
const MOSS_FIELD_ROCK = /* glsl */ `
// x = moss cushion field, y = rock noise, z = rock grain distance, w = grain shade
vec4 field(vec2 uv) {
  vec2 w = uv + MM(4.0) * warpT(uv, nc(30.0), 3, 1u);
  vec4 rg = worleyT(uv, nc(0.8), 3u, 1.0);
  return vec4(fbmT(w, nc(22.0), 5, 0.55, 6u), fbmT(uv, nc(12.0), 5, 0.55, 2u), rg.x, rg.z);
}
`
const MOSS_SURFACE = /* glsl */ `
// Grey granular stone carrying cushions of moss; lichen crusts on the bare rock.
Surface surface(vec2 uv) {
  vec4 L = F0(), K = F1();
  float leaves = L.x;
  float mm = K.x, rockN = K.y;
  float rock = 0.6 + 0.6 * rockN + 0.1 * dome(K.z, 0.6);
  vec3 rockC = mix(hex(#6C6862), hex(#9A958D), sat(0.5 + rockN)) * (0.9 + 0.15 * K.w);
  float lich = smoothstep(0.35, 0.5, fbmT(uv, nc(6.0), 4, 0.6, 4u));
  rockC = mix(rockC, mix(hex(#A9AC8E), hex(#C8B860), step(0.7, vnoiseT(uv, nc(3.0), 5u))), lich * 0.75);
  float mask = smoothstep(-0.05, 0.2, mm);
  float cushion = smoothstep(-0.05, 0.45, mm);
  float hm = rock * 0.3 + 3.2 * cushion + 0.35 * leaves;
  float h = mix(rock, max(rock, hm), mask);
  vec3 green = mix(hex(#3E5A1A), hex(#7E9C2C), sat(leaves * 0.8 + 0.3 * L.y));
  green = mix(green, hex(#A9B848), smoothstep(0.75, 1.0, leaves) * cushion * 0.5);
  green = mix(green, hex(#6B5A2A), smoothstep(0.6, 0.9, fbmT(uv, nc(8.0), 3, 0.5, 9u)) * 0.5);
  green *= 0.45 + 0.55 * sat(leaves + 0.25);
  vec3 alb = mix(rockC, green, mask);
  Surface s = surf(h, alb, mix(0.85, 0.75, mask), 0.0);
  s.loose = mask * 0.3 + lich * 0.2;
  s.layer = mask;
  return s;
}
`
export const MOSS_STONE = { fields: [MOSS_FIELD_LEAVES, MOSS_FIELD_ROCK], surface: MOSS_SURFACE }

export const LEAF = /* glsl */ `
// Upper surface of a broad leaf: sunken pale veins in a hierarchy, puffy areoles, waxy cuticle.
Surface surface(vec2 uv) {
  // secondary veins: diagonal, gently curved (sheared coordinate keeps them periodic)
  vec2 w = uv + MM(0.8) * warpT(uv, nc(10.0), 3, 1u);
  float ns = nc(9.0);
  float sec = (w.x + w.y) * ns + 0.25 * psin(TAU * w.y);
  float secD = abs(fract(sec) - 0.5) / ns * uTileMm;        // mm to the nearest secondary vein
  float secV = 1.0 - smoothstep(0.12, 0.3, secD);
  // midrib along V
  float mid = abs(fract(w.x + 0.0) - 0.15) * uTileMm;
  float midV = 1.0 - smoothstep(0.45, 0.85, mid);
  // tertiary and quaternary: areole network
  Vor t = voronoiT(w, nc(1.8), 2u, 0.9);
  float tert = 1.0 - smoothstep(0.02, 0.05, t.edge);
  Vor q = voronoiT(w + 0.27, nc(0.6), 3u, 0.9);
  float quat = (1.0 - smoothstep(0.02, 0.06, q.edge)) * detail(MM(0.05));
  float veins = max(max(secV, midV), max(tert * 0.85, quat * 0.45));
  float puff = dome(t.f1, 0.9) * 0.6 + dome(q.f1, 0.9) * 0.4;
  float h = 0.12 + 0.04 * puff - 0.05 * max(secV, tert) - 0.03 * quat + 0.04 * midV;
  float mott = fbmT(uv, nc(5.0), 4, 0.55, 4u);
  vec3 green = mix(hex(#3E6E22), hex(#5C8E30), sat(0.5 + mott));
  green *= 0.9 + 0.12 * puff;
  vec3 alb = mix(green, hex(#A9C870), veins * 0.75);
  alb = mix(alb, hex(#C9D890), midV * 0.6);
  // a few necrotic specks and a nibble of rust fungus
  float speck = smoothstep(0.92, 0.97, vnoiseT(uv, nc(0.3), 5u));
  alb = mix(alb, hex(#7A6A2A), speck * 0.7);
  Surface s = surf(h, alb, 0.38 - 0.08 * puff + 0.15 * veins, 0.0);
  s.layer = veins;
  return s;
}
`

