// Polymer, rubber and plastic recipes.

export const GOLF_BALL = /* glsl */ `
Surface surface(vec2 uv) {
  vec2 cell;
  vec4 hx = hexT(uv, nc(4.0), cell);
  float d = length(hx.xy);
  float R = cell.x * 0.47;
  // spherical-cap dimple with a soft lip
  float t = sat(d / R);
  float dimple = (1.0 - t * t);
  float lip = smoothstep(0.92, 1.0, t) * (1.0 - smoothstep(1.0, 1.12, d / R));
  float h = 0.3 - 0.26 * dimple * step(t, 0.999) * smoothstep(1.0, 0.96, t) + 0.01 * lip;
  float paint = fbmT(uv, nc(0.6), 3, 0.5, 2u);
  h += 0.003 * paint;
  float scuff = smoothstep(0.35, 0.65, fbmT(uv + MM(2.0) * warpT(uv, nc(8.0), 2, 3u), vec2(nc(1.0), nc(6.0)), 4, 0.6, 4u));
  vec3 alb = hex(#F3F3EE) * (0.97 + 0.03 * paint);
  alb = mix(alb, hex(#B9B6AC), scuff * 0.35);
  Surface s = surf(h, alb, 0.22 + 0.25 * scuff + 0.03 * paint, 0.0);
  s.layer = scuff;
  return s;
}
`

export const BASKETBALL = /* glsl */ `
// Pebbled composite rubber with a black channel seam.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.15) * warpT(uv, nc(2.0), 2, 1u);
  vec4 pb = worleyT(w, nc(1.15), 2u, 0.65);
  float peb = dome(pb.x, 0.46);
  float flat_ = smoothstep(0.0, 0.25, peb);
  // channel along U at v = 0.7 of the tile: 3.5 mm wide, ~0.8 mm deep
  float dv = abs(fract(uv.y - 0.7 + 0.5) - 0.5) * uTileMm;
  float ch = 1.0 - smoothstep(1.4, 2.0, dv);
  float chProf = sqrt(sat(1.0 - (dv * dv) / 4.0));
  float wearN = fbmT(uv, nc(10.0), 3, 0.5, 3u);
  float h = 0.9 + 0.3 * peb - 0.08 * smoothstep(0.3, 0.9, wearN) * peb;
  h = mix(h, 0.9 - 0.8 * chProf, ch);
  vec3 orange = mix(hex(#B04A22), hex(#C9612E), sat(0.5 + wearN));
  vec3 alb = mix(orange * 0.8, orange, flat_);
  alb = mix(alb, alb * 1.15 + 0.01, smoothstep(0.6, 1.0, peb) * 0.3);
  float dirt = smoothstep(0.2, 0.6, fbmT(uv, nc(6.0), 4, 0.6, 4u));
  alb *= 1.0 - 0.25 * dirt * (1.0 - peb);
  alb = mix(alb, hex(#1B1918), ch);
  Surface s = surf(h, alb, mix(mix(0.75, 0.6, peb), 0.55, ch), 0.0);
  s.layer = ch;
  return s;
}
`

export const PEELING_PAINT = /* glsl */ `
// A wall with three histories: grey plaster, old cream paint, flaking mint topcoat.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(2.0) * warpT(uv, nc(15.0), 3, 1u);
  float plaster = fbmT(uv, nc(2.0), 5, 0.6, 2u);
  float damage = fbmT(uv, nc(25.0), 5, 0.55, 3u);
  float damage2 = fbmT(uv, nc(12.0), 4, 0.55, 4u);
  // topcoat flakes: Voronoi plates, missing where the damage field is high
  Vor f = voronoiT(w, nc(4.5), 5u, 0.9);
  float eMm = f.edge * uTileMm / nc(4.5);
  float topLost = step(0.05 + 0.25 * f.rnd.x, damage + 0.12);
  float creamLost = smoothstep(0.22, 0.3, damage2 + 0.4 * damage);
  // fine craquelure on the paint that remains
  Vor cq = voronoiT(w, nc(1.6), 6u, 0.9);
  float craq = 1.0 - smoothstep(0.015, 0.045, cq.edge);
  float crack = 1.0 - smoothstep(0.05, 0.18, eMm);
  float curl = (1.0 - smoothstep(0.0, 1.6, eMm)) * smoothstep(-0.05, 0.12, damage) * 0.35;
  float h = 0.1 + 0.05 * plaster;
  vec3 alb = mix(hex(#7E786E), hex(#9C968A), sat(0.5 + plaster));
  float layer = 0.0;
  if (creamLost < 0.5) {
    h += 0.08;
    alb = mix(hex(#D9D1BE), hex(#E8E1D0), sat(0.5 + plaster));
    layer = 0.5;
  }
  if (topLost < 0.5) {
    h += 0.12 + curl - 0.05 * craq;
    vec3 mint = mix(hex(#7FA9A2), hex(#9CC4BC), sat(0.5 + 2.0 * fbmT(uv, nc(8.0), 3, 0.5, 7u)));
    mint = mix(mint, hex(#C9D8CC), smoothstep(0.1, 0.3, curl) * 0.6);
    alb = mix(mint, hex(#4A5450), max(craq * 0.6, crack * 0.8));
    layer = 1.0;
  }
  float grime = smoothstep(0.2, 0.6, fbmT(uv, nc(10.0), 3, 0.5, 8u));
  alb *= 1.0 - 0.15 * grime;
  Surface s = surf(h, alb, layer > 0.9 ? 0.6 : 0.9, 0.0);
  s.layer = layer;
  s.loose = layer < 0.9 ? 0.5 : 0.1;
  return s;
}
`

export const SPONGE = /* glsl */ `
// Yellow cellulose sponge: open pores of every size, soft walls between them.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.4) * warpT(uv, nc(3.0), 2, 1u);
  vec4 a = worleyT(w, nc(3.6), 2u, 1.0);
  vec4 b = worleyT(w + 0.31, nc(1.5), 3u, 1.0);
  vec4 c = worleyT(w + 0.77, nc(0.6), 4u, 1.0);
  float ha = 1.0 - smoothstep(0.2 + 0.25 * a.z, 0.3 + 0.25 * a.z, a.x);
  float hb = 1.0 - smoothstep(0.22 + 0.2 * b.z, 0.32 + 0.2 * b.z, b.x);
  float hc = (1.0 - smoothstep(0.25, 0.4, c.x)) * step(0.3, c.z);
  float depthA = ha * (1.6 + 0.6 * a.z) * dome(a.x, 0.45 + 0.25 * a.z);
  float depthB = hb * 1.2 * dome(b.x, 0.45 + 0.2 * b.z);
  float depthC = hc * 0.6 * dome(c.x, 0.4);
  float pit = max(depthA, max(depthB, depthC));
  float fib = fbmT(uv, nc(0.2), 3, 0.6, 5u);
  float h = 2.4 - pit + 0.05 * fib;
  vec3 yellow = mix(hex(#D9A92A), hex(#EDC54A), sat(0.5 + fib));
  float inPit = sat(pit / 1.2);
  vec3 alb = mix(yellow, hex(#8A6414), inPit * 0.7);
  Surface s = surf(h, alb, 0.9, 0.0);
  s.layer = inPit;
  return s;
}
`

export const STYROFOAM = /* glsl */ `
// Expanded polystyrene: fused rounded beads with faint seams; each bead a foam of tiny cells.
Surface surface(vec2 uv) {
  vec2 w = uv + MM(0.3) * warpT(uv, nc(2.0), 2, 1u);
  Vor b = voronoiT(w, nc(2.4), 2u, 0.9);
  float eMm = b.edge * uTileMm / nc(2.4);
  float seam = 1.0 - smoothstep(0.0, 0.06, eMm);
  float bead = smoothstep(0.0, 1.3, eMm) * (0.85 + 0.3 * b.rnd.z);
  vec4 cc = worleyT(uv, nc(0.1), 3u, 1.0);
  float cells = smoothstep(0.0, 0.3, cc.y - cc.x) * detail(MM(0.07));
  vec4 cc2 = worleyT(uv + 0.5, nc(0.22), 4u, 1.0);
  float cells2 = smoothstep(0.0, 0.3, cc2.y - cc2.x);
  float h = 0.1 + 0.07 * bead + 0.004 * cells + 0.006 * cells2 + 0.01 * b.rnd.y;
  vec3 alb = vec3(0.84 + 0.05 * b.rnd.y) * (0.95 + 0.03 * cells + 0.03 * cells2);
  alb *= 1.0 - 0.06 * seam;
  Surface s = surf(h, alb, 0.72 + 0.08 * cells, 0.0);
  s.loose = 0.1;
  return s;
}
`

export const TOY_BRICK = /* glsl */ `
// Glossy red ABS with studs on an 8 mm grid (4 x 4 per tile), scuffs and dust.
Surface surface(vec2 uv) {
  vec2 q = uv * 4.0;
  vec2 d = (fract(q) - 0.5) * 8.0;          // mm from the stud axis
  float r = length(d);
  float R = 2.4;
  float side = 1.0 - smoothstep(R - 0.02, R + 0.04, r);
  float bevel = smoothstep(R - 0.25, R, r) * side;
  float sink = (1.0 - smoothstep(R + 0.05, R + 0.6, r)) * (1.0 - side);
  float h = 1.7 * side - 0.12 * bevel - 0.01 * sink;
  // a faint gate mark on top of each stud
  float gate = (1.0 - smoothstep(0.25, 0.4, r)) * 0.008;
  h += gate * side;
  float scuff = isoLine(gnoiseT(uv, vec2(nc(6.0), nc(2.0)), 3u), 0.05) * smoothstep(0.2, 0.5, fbmT(uv, nc(10.0), 2, 0.5, 4u));
  float smear = smoothstep(0.2, 0.55, fbmT(uv, nc(12.0), 4, 0.6, 5u));
  float dust = smoothstep(0.85, 0.92, vnoiseT(uv, nc(0.15), 6u)) * (1.0 - side * 0.5);
  vec3 alb = hex(#B00F0F);
  alb = mix(alb, hex(#C98A80), scuff * 0.5);
  alb = mix(alb, hex(#9A928A), dust * 0.5);
  Surface s = surf(h, alb, 0.16 + 0.22 * smear + 0.3 * scuff + 0.3 * dust, 0.0);
  s.layer = side;
  return s;
}
`

export const VINYL = /* glsl */ `
// One spiral groove, seen up close: glossy lands between V-shaped grooves whose walls wiggle with the music.
Surface surface(vec2 uv) {
  float NG = nc(0.1);
  float NX = nc(0.04);
  float loud = 0.5 + 0.5 * gnoiseT(uv, vec2(nc(3.0), 1.0), 2u);
  float audio = gnoise(vec2(uv.x * NX, uv.y * NG), ivec2(int(NX), int(NG)), 3u) * 0.5 + gnoise(vec2(uv.x * NX * 2.0, uv.y * NG), ivec2(int(NX) * 2, int(NG)), 4u) * 0.25;
  float y = uv.y * NG + 0.15 * loud * audio;
  float f = fract(y);
  float v = abs(f - 0.5) * 2.0;            // 0 at groove bottom, 1 at the land centre
  float groove = 0.55 + 0.15 * loud;       // louder passages cut wider grooves
  float wall = smoothstep(0.0, groove, v);
  float land = smoothstep(groove - 0.05, groove + 0.05, v);
  float h = 0.035 * wall;
  float dust = smoothstep(0.93, 0.98, vnoiseT(uv, nc(0.04), 5u)) * step(0.75, vnoiseT(uv, nc(0.8), 6u));
  float scr = isoLine(gnoiseT(uv, vec2(2.0, 3.0), 7u), 0.02);
  h += 0.01 * dust - 0.008 * scr;
  vec3 alb = mix(hex(#0E0E10), hex(#18181B), land);
  alb = mix(alb, hex(#B8B4AC), dust);
  alb = mix(alb, hex(#2A2A2E), scr);
  Surface s = surf(h, alb, mix(0.3, 0.12, land) + 0.3 * dust + 0.1 * scr, 0.0);
  s.loose = dust;
  return s;
}
`

export const SANDPAPER = /* glsl */ `
// P120 aluminium-oxide grit: sharp faceted crystals ~125 um in a resin bond.
Surface surface(vec2 uv) {
  Vor g = voronoiT(uv, nc(0.14), 2u, 1.0);
  float cell = uTileMm / nc(0.14);
  vec2 p = rot2(-g.rel, g.rnd.x * TAU);
  float a1 = abs(p.x) * (1.0 + g.rnd.y) + abs(p.y) * (1.6 - g.rnd.y);
  float a2 = abs(p.x + p.y * 0.6) * 1.3;
  float facet = max(a1, a2);
  float size = 0.5 + 0.35 * g.rnd.z;
  float present = step(0.1, g.rnd.y);
  float crystal = sat(1.0 - facet / size) * present;
  float bond = 0.025 + 0.008 * fbmT(uv, nc(0.3), 3, 0.5, 3u);
  float h = max(bond, crystal * cell * 0.7 * (0.6 + 0.4 * g.rnd.z));
  vec3 grit = mix(hex(#8A4426), hex(#C0703E), g.rnd.z);
  grit = mix(grit, hex(#D9A27A), step(0.92, g.rnd.x) * 0.7);
  grit = mix(grit, hex(#4A2416), step(g.rnd.x, 0.06) * 0.8);
  vec3 alb = mix(hex(#5A2C18), grit * (0.85 + 0.25 * crystal), smoothstep(0.0, 0.05, crystal));
  Surface s = surf(h, alb, mix(0.6, 0.3, step(0.55, g.rnd.x) * crystal), 0.0);
  s.loose = 0.2;
  s.layer = step(0.001, crystal);
  return s;
}
`

