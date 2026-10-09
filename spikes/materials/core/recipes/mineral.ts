// Stone, ceramic, earth and glass recipes (brick lives in stone.ts).

export const CONCRETE = /* glsl */ `
// Broom-finished sidewalk: cement paste and sand, a few exposed stones, bugholes, grime.
Surface surface(vec2 uv) {
  float sand = fbmT(uv, nc(0.4), 3, 0.6, 1u);
  vec4 sg = worleyT(uv, nc(0.5), 2u, 1.0);
  float grains = dome(sg.x, 0.5) * detail(MM(0.3));
  vec2 w = uv + MM(1.5) * warpT(uv, nc(6.0), 2, 3u);
  vec4 ag = worleyT(w, nc(3.5), 4u, 0.9);
  float stone = (1.0 - smoothstep(0.24, 0.32, ag.x)) * step(0.72, ag.z);
  // broom: streaks along X, wavy, with ridges thrown up by the bristles
  vec2 bw = uv + vec2(0.0, MM(0.8) * fbmT(uv, nc(18.0), 3, 0.5, 9u));
  float broom = fbmT(bw, vec2(nc(20.0), nc(0.5)), 5, 0.6, 6u);
  float wear = smoothstep(-0.3, 0.4, fbmT(uv, nc(25.0), 3, 0.5, 10u));
  vec4 bh = worleyT(uv, nc(3.0), 7u, 1.0);
  float hole = (1.0 - smoothstep(0.05, 0.15, bh.x)) * step(0.9, bh.z);
  float h = 0.35 + 0.22 * broom * (1.0 - 0.5 * wear) + 0.05 * sand + 0.035 * grains + stone * 0.06 * dome(ag.x, 0.32) - 0.5 * hole;
  float tone = fbmT(uv, nc(14.0), 5, 0.55, 11u);
  vec3 alb = mix(hex(#8E8B85), hex(#B0ACA4), sat(0.5 + tone));
  alb *= 0.9 + 0.1 * sand + 0.08 * (grains - 0.5);
  vec3 sc = mix(hex(#85807A), hex(#A39C92), ag.y);
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

export const ASPHALT = /* glsl */ `
// Stone aggregate held in a black bitumen binder; the tops polished by tyres.
float stoneShape(Vor v, float r) {
  // irregular rounded outline: radius wobbles with direction
  vec2 d = normalize(v.rel + 1e-5);
  float wob = 0.12 * (v.rnd.y - 0.5) * d.x + 0.12 * (v.rnd.z - 0.5) * d.y + 0.06 * sin(atan(d.y, d.x) * 3.0 + v.rnd.x * 6.28);
  return v.f1 / (r * (1.0 + wob));
}
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.8) * warpT(uv, nc(6.0), 2, 1u);
  Vor a = voronoiT(w, nc(4.0), 2u, 0.9);
  float sa = stoneShape(a, 0.36 + 0.14 * a.rnd.x);
  float stA = 1.0 - smoothstep(0.92, 1.0, sa);
  Vor b = voronoiT(w + 0.43, nc(1.6), 5u, 1.0);
  float sb = stoneShape(b, 0.33 + 0.1 * b.rnd.x);
  float stB = (1.0 - smoothstep(0.9, 1.0, sb)) * step(0.3, b.rnd.y) * (1.0 - stA);
  float facet = fbmT(w, nc(1.3), 3, 0.5, 4u);
  float sand = fbmT(uv, nc(0.25), 3, 0.6, 6u);
  float hBinder = 0.55 + 0.08 * sand + 0.15 * fbmT(uv, nc(3.0), 3, 0.5, 7u);
  float hA = 0.8 + 1.5 * dome(sa, 1.0) * (0.6 + 0.4 * a.rnd.x) + 0.12 * facet;
  float hB = 0.65 + 0.5 * dome(sb, 1.0);
  float h = hBinder;
  h = mix(h, max(h, hB), stB);
  h = mix(h, max(h, hA), stA);
  vec3 cA = mix(hex(#5B5853), hex(#8F8A83), a.rnd.y);
  cA = mix(cA, hex(#7A5A4E), step(0.9, a.rnd.z));
  cA = mix(cA, hex(#363431), step(a.rnd.z, 0.12));
  cA *= 0.85 + 0.25 * sat(0.5 + facet);
  float top = smoothstep(0.5, 0.9, dome(sa, 1.0)) * stA;
  cA = mix(cA, cA * 1.15 + 0.015, top * 0.7);
  vec3 cB = mix(hex(#45423F), hex(#6E6A64), b.rnd.z);
  vec3 bc = mix(hex(#17171A), hex(#28272A), sat(0.5 + sand));
  vec3 alb = mix(mix(bc, cB, stB), cA, stA);
  Surface s = surf(h, alb, mix(mix(0.72, 0.82, stB), mix(0.75, 0.5, top), stA), 0.0);
  s.layer = max(stA, stB);
  s.loose = 0.3 * (1.0 - s.layer);
  return s;
}
`

export const TERRACOTTA = /* glsl */ `
// Unglazed red clay: wheel rings, grog specks, salt bloom.
Surface surface(vec2 uv) {
  float rings = sin(TAU * (uv.y * nc(2.6) + 0.35 * fbmT(uv, nc(20.0), 3, 0.5, 1u)));
  float tooth = fbmT(uv, nc(0.35), 4, 0.6, 2u);
  vec4 pk = worleyT(uv, nc(0.7), 3u, 1.0);
  float pore = (1.0 - smoothstep(0.08, 0.2, pk.x)) * step(0.7, pk.z);
  float lump = fbmT(uv, nc(10.0), 4, 0.5, 4u);
  float h = 0.12 + 0.035 * rings + 0.012 * tooth + 0.06 * lump - 0.05 * pore;
  float tone = fbmT(uv, nc(8.0), 5, 0.55, 5u);
  vec3 alb = mix(hex(#A44E33), hex(#C66E4A), sat(0.5 + tone * 1.2));
  alb *= 0.95 + 0.08 * tooth;
  // grog: crushed fired clay, pale and dark specks
  float g1 = smoothstep(0.86, 0.92, vnoiseT(uv, nc(0.25), 6u));
  float g2 = smoothstep(0.88, 0.94, vnoiseT(uv + 0.3, nc(0.2), 7u));
  alb = mix(alb, hex(#E2B08A), g1 * 0.7);
  alb = mix(alb, hex(#5A2A1C), g2 * 0.6);
  alb *= 1.0 - pore * 0.4;
  // efflorescence: fuzzy white salt bloom; damp darker patches
  float bloomN = fbmT(uv + MM(2.0) * warpT(uv, nc(10.0), 2, 8u), nc(12.0), 6, 0.6, 9u);
  float bloom = smoothstep(0.12, 0.45, bloomN) * (0.6 + 0.4 * tooth);
  float damp = smoothstep(0.2, 0.5, fbmT(uv, nc(18.0), 3, 0.5, 10u));
  alb *= 1.0 - damp * 0.2;
  alb = mix(alb, hex(#E7E0D3), bloom * 0.75);
  Surface s = surf(h + bloom * 0.01, alb, 0.82 + 0.1 * bloom - 0.08 * damp, 0.0);
  s.loose = 0.2 + 0.6 * bloom;
  s.layer = bloom;
  return s;
}
`

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

export const GRANITE = /* glsl */ `
// Polished salt-and-pepper granite: white feldspar, glassy grey quartz, scattered black mica.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.6) * warpT(uv, nc(3.0), 3, 1u);
  w += MM(0.18) * warpT(w, nc(0.6), 2, 11u);
  Vor big = voronoiT(w, nc(1.7), 2u, 1.0);
  float pick = big.rnd.x;
  vec3 white = mix(hex(#C9C4BB), hex(#E6E2DA), big.rnd.y);
  vec3 cream = mix(hex(#C8B9A8), hex(#DDD0C0), big.rnd.y);
  vec3 quartz = mix(hex(#5E5D5B), hex(#8A8784), big.rnd.y);
  vec3 alb = pick < 0.45 ? white : (pick < 0.55 ? cream : quartz);
  // quartz looks deep: darker core, lighter rim
  alb *= pick >= 0.55 ? (0.85 + 0.25 * smoothstep(0.0, 0.25, 0.3 - big.edge)) : 1.0;
  // black mica: small scattered flakes on their own finer lattice, loosely clumped
  Vor m = voronoiT(w + 0.37, nc(0.75), 3u, 1.0);
  float clump = fbmT(uv, nc(5.0), 2, 0.5, 4u);
  float isDark = step(0.8 - 0.12 * clump, m.rnd.x) * smoothstep(0.0, 0.05, m.edge + 0.02);
  vec3 mica = mix(hex(#0E0E0E), hex(#262422), m.rnd.y);
  alb = mix(alb, mica, isDark);
  float cl = gnoiseT(uv, nc(0.12), 5u) * 0.5 + 0.5;
  alb *= 0.93 + 0.1 * cl * (pick < 0.55 ? 1.0 : 0.3);
  float bnd = 1.0 - smoothstep(0.0, 0.03, big.edge);
  // mica flakes are tiny tilted mirrors: they glint at one lamp angle
  Vor fl = voronoiT(uv, nc(0.25), 6u, 1.0);
  vec2 tilt = (fl.rnd.xy - 0.5) * 0.3;
  float facet = dot(-fl.rel * (uTileMm / nc(0.25)), tilt) * isDark;
  float h = 0.01 + facet * 0.02 - 0.004 * bnd;
  Surface s = surf(h, alb * (1.0 - bnd * 0.2), mix(0.06, 0.12, bnd) + 0.04 * isDark, 0.0);
  s.metal = isDark * 0.3 * step(0.45, fl.rnd.z);
  s.layer = isDark;
  return s;
}
`

export const MARBLE = /* glsl */ `
// Carrara-style white marble: cloudy grey drifts, soft veins, a few sharp dark ones.
Surface surface(vec2 uv) {
  vec2 w = uv + 0.06 * warpT(uv, nc(40.0), 5, 1u);
  vec2 w2 = w + 0.03 * warpT(w, nc(15.0), 4, 2u);
  float cloud = fbmT(w2, nc(25.0), 6, 0.55, 3u);
  float v1 = fbmT(w, nc(60.0), 5, 0.55, 4u);
  float soft = exp(-abs(v1) * 18.0);
  float v2 = fbmT(w2, nc(30.0), 6, 0.6, 5u);
  float sharp = isoLine(v2, 0.35) * smoothstep(-0.1, 0.25, fbmT(uv, nc(40.0), 3, 0.5, 6u));
  float v3 = fbmT(w2 + 0.5, nc(12.0), 6, 0.6, 7u);
  float hair = isoLine(v3, 0.12) * smoothstep(0.0, 0.3, fbmT(uv, nc(30.0), 3, 0.5, 8u));
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

export const CRACKED_MUD = /* glsl */ `
// Desiccation cracks: curled plates, a second generation of fine cracks, silt and grit.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(5.0) * warpT(uv, nc(45.0), 4, 1u);
  float nA = nc(32.0);
  Vor a = voronoiT(w, nA, 2u, 0.85);
  float eA = a.edge * uTileMm / nA + 0.6 * fbmT(uv, nc(3.0), 3, 0.5, 3u);
  float wA = 1.2 + 1.6 * vnoiseT(uv, nc(40.0), 4u);
  float crackA = 1.0 - smoothstep(wA * 0.5, wA * 0.5 + 0.6, eA);
  vec2 w2 = uv + MM(2.0) * warpT(uv, nc(20.0), 3, 5u);
  float nB = nc(11.0);
  Vor b = voronoiT(w2, nB, 6u, 0.9);
  float eB = b.edge * uTileMm / nB + 0.3 * fbmT(uv, nc(1.5), 3, 0.5, 7u);
  float partial = smoothstep(0.0, 0.3, fbmT(uv, nc(25.0), 3, 0.5, 8u));
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

export const FROST_GLASS = /* glsl */ `
// Window frost: feathery dendrites growing from seeds on dark glass, plus grainy hoarfrost.
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
Surface surface(vec2 uv) {
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
    fr = max(fr, fern(d, vec2(cos(ang), sin(ang)), len, 1.0));
    float ang2 = ang + (hash1(g, per, 4u) > 0.5 ? 1.05 : -1.05);
    fr = max(fr, 0.85 * fern(d, vec2(cos(ang2), sin(ang2)), len * 0.65, 0.8));
  }
  // growth fronts: leave some glass clear
  fr *= smoothstep(-0.3, 0.05, fbmT(uv, nc(14.0), 3, 0.5, 9u));
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
