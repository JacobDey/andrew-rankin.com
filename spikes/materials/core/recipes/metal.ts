// Metal recipes. Each string defines `Surface surface(vec2 uv)` in tile UV
// (one tile = info.tileMm). Heights are millimetres. +V is "up" on the object.

export const RUSTY_MAILBOX = /* glsl */ `
// Faded green enamel over red-oxide primer over rolled steel (texturedle-game.md 5).
float rustField(vec2 uv, int oct) {
  vec2 w = uv + MM(3.0) * warpT(uv, nc(16.0), 3, 11u);
  return fbmT(w, nc(14.0), oct, 0.55, 12u);
}
float scratchLine(vec2 q, vec2 n, uint salt, float widthMm) {
  float v = gnoise(q * n, ivec2(n), salt);
  float wpx = max(MM(widthMm) / uPx, 0.6);
  return (1.0 - smoothstep(0.0, wpx, abs(v) / max(fwidth(v), 1e-6))) * detail(MM(widthMm) * 2.0);
}
Surface surface(vec2 uv) {
  // rolled steel: mill striations along X
  float roll = fbmT(uv, vec2(nc(40.0), nc(0.15)), 3, 0.6, 1u);
  Surface s = surf(roll * 0.002, hex(#8D9195) * (0.9 + 0.15 * roll), 0.36 + 0.1 * roll, 1.0);

  float rf = rustField(uv, 6);
  float detailN = fbmT(uv, nc(1.2), 4, 0.55, 13u);

  // scratches: two families of long wandering lines (sheared, still periodic)
  vec2 q1 = vec2(uv.x + uv.y, uv.y);
  vec2 q2 = vec2(uv.x - uv.y, uv.x);
  float segA = smoothstep(0.15, 0.35, fbmT(uv, nc(12.0), 2, 0.5, 14u));
  float segB = smoothstep(0.2, 0.4, fbmT(uv, nc(10.0), 2, 0.5, 15u));
  float scr = max(scratchLine(q1, vec2(3.0, 9.0), 16u, 0.12) * segA, scratchLine(q2, vec2(2.0, 8.0), 17u, 0.09) * segB);

  float field = rf + 0.06 * detailN + 0.10 * scr;
  float rust = smoothstep(0.085, 0.15, field);
  float primerMask = 1.0 - smoothstep(0.045, 0.085, field + 0.02 * detailN);
  float paintMask = 1.0 - smoothstep(-0.005, 0.03, field + 0.04 * detailN);
  paintMask *= 1.0 - scr * 0.95;
  // small chips knocked out of sound paint, showing primer
  vec4 wc = worleyT(uv, nc(1.4), 18u, 1.0);
  float chip = (1.0 - smoothstep(0.12, 0.2, wc.x + 0.05 * detailN)) * step(0.9, wc.z);
  paintMask *= 1.0 - chip;

  // red-oxide primer
  coat(s, primerMask, 0.025, hex(#7A3524) * (0.9 + 0.2 * detailN), 0.75, 0.0, 0.33);
  // enamel: faded, chalky green with orange-peel waviness
  float peel = fbmT(uv, nc(2.2), 2, 0.5, 21u);
  float chalk = sat(0.5 + 0.9 * fbmT(uv, nc(9.0), 4, 0.55, 22u));
  vec3 green = mix(hex(#2F4A39), hex(#71876F), chalk * 0.8);
  green *= 0.95 + 0.1 * detailN;
  coat(s, paintMask, 0.05 + peel * 0.004, green, mix(0.32, 0.7, chalk), 0.0, 0.66);

  // blisters: rust pushing the paint up near the rust fronts
  vec4 wb = worleyT(uv, nc(2.4), 31u, 0.9);
  float bl = sat(1.0 - wb.x / (0.35 + 0.15 * wb.z));
  bl = bl * bl * (3.0 - 2.0 * bl);
  float blZone = smoothstep(-0.10, 0.03, field) * (1.0 - rust) * step(0.3, wb.z);
  s.height += bl * blZone * (0.1 + 0.2 * wb.z);
  s.albedo *= 1.0 - 0.25 * bl * blZone * smoothstep(0.0, 0.08, field);

  // rust: crusty scale with pits, an oxide family of colours
  float crust = ridgedT(uv + MM(0.7) * warpT(uv, nc(3.0), 2, 40u), nc(1.8), 5, 0.6, 41u);
  vec4 wp = worleyT(uv, nc(0.8), 42u, 1.0);
  float pit = smoothstep(0.38, 0.05, wp.x) * step(0.6, wp.z);
  float tone = fbmT(uv, nc(5.0), 4, 0.55, 43u);
  vec3 rc = mix(hex(#8A4F25), hex(#C46A30), sat(0.5 + tone * 1.5 + crust * 0.4));
  rc = mix(rc, hex(#6A2A1C), smoothstep(0.1, 0.4, -tone) * 0.8);
  rc = mix(rc, hex(#D9A066), smoothstep(0.75, 0.95, crust) * 0.35);
  float fleck = smoothstep(0.82, 0.9, vnoiseT(uv, nc(0.25), 44u));
  rc = mix(rc, hex(#2A2522), max(pit * 0.85, fleck * 0.6));
  float rustH = 0.02 + 0.28 * crust * crust * smoothstep(0.1, 0.3, field) - 0.16 * pit;
  s.height = mix(s.height, rustH, rust);
  s.albedo = mix(s.albedo, rc, rust);
  s.rough = mix(s.rough, 0.9 + 0.08 * crust, rust);
  s.metal = mix(s.metal, 0.0, rust);
  s.layer = mix(s.layer, 1.0, step(0.5, rust));
  s.loose = rust * sat(0.3 + crust);

  // white rust halo where zinc / primer meets corrosion
  float halo = smoothstep(0.075, 0.1, field) * (1.0 - smoothstep(0.1, 0.125, field));
  s.albedo = mix(s.albedo, hex(#A8A090), halo * 0.18 * sat(detailN + 0.5));

  // rust runs: stains that run DOWN (-V) from blooms above
  // (taps read only the field's base octave: 5 noise calls instead of 5 full warped fields)
  float run = 0.0;
  vec2 wr = uv + MM(3.0) * vec2(gnoiseT(uv, nc(16.0), 11u), gnoiseT(uv, nc(16.0), 11u + 7919u)) * 0.5;
  for (int i = 1; i <= 5; i++) {
    float o = MM(1.2 * float(i * i));
    run = max(run, smoothstep(0.03, 0.13, 0.5 * gnoiseT(wr + vec2(0.0, o), nc(14.0), 12u)) * (1.0 - float(i) * 0.15));
  }
  float streaky = sat(0.55 + 1.6 * fbmT(uv, vec2(nc(0.9), nc(16.0)), 4, 0.5, 51u));
  run *= streaky * (1.0 - rust);
  s.albedo = mix(s.albedo, s.albedo * vec3(1.3, 0.75, 0.45) + hex(#5A2A12) * 0.25, run * 0.6);
  s.rough = mix(s.rough, 0.8, run * 0.5);

  // dust in the low spots, never on the tops
  float dust = smoothstep(0.2, 0.7, fbmT(uv, nc(6.0), 3, 0.5, 61u));
  s.albedo = mix(s.albedo, hex(#8A7F6E), dust * 0.12 * (1.0 - rust));
  return s;
}
`

export const BRUSHED_ALUMINUM = /* glsl */ `
Surface surface(vec2 uv) {
  // brushing: very anisotropic noise, grooves along X, in three bands of width
  float g1 = fbmT(uv, vec2(nc(5.0), nc(0.12)), 4, 0.7, 1u);
  float g2 = fbmT(uv, vec2(nc(2.0), nc(0.5)), 3, 0.6, 2u);
  float g3 = fbmT(uv, vec2(nc(10.0), nc(0.04)), 2, 0.6, 3u);
  float h = 0.0022 * g1 + 0.002 * g2 + 0.0008 * g3;
  // a few deeper stray scratches, slightly off-axis
  float sv = gnoise(vec2((uv.x + uv.y) * 2.0, uv.y * 60.0), ivec2(2, 60), 7u);
  float stray = (1.0 - smoothstep(0.0, 1.2, abs(sv) / max(fwidth(sv), 1e-6))) * smoothstep(0.35, 0.6, fbmT(uv, nc(8.0), 2, 0.5, 8u));
  h -= 0.004 * stray;
  float mott = fbmT(uv, nc(8.0), 3, 0.5, 4u);
  vec3 alb = hex(#C4C8CC) * (0.9 + 0.07 * g1 + 0.06 * g2 + 0.03 * mott);
  Surface s = surf(h, alb, 0.3 + 0.1 * g1 + 0.05 * mott + 0.1 * stray, 1.0);
  // faint fingerprint-ish smudges raise roughness
  float smudge = smoothstep(0.25, 0.6, fbmT(uv, nc(12.0), 3, 0.5, 9u));
  s.rough = mix(s.rough, 0.5, smudge * 0.4);
  return s;
}
`

export const CAST_IRON = /* glsl */ `
Surface surface(vec2 uv) {
  // as-cast sand texture: dense small grains, softened by polymerized seasoning
  vec4 w1 = worleyT(uv, nc(0.22), 1u, 0.95);
  vec4 w2 = worleyT(uv, nc(0.45), 2u, 0.95);
  float g1 = sat(1.0 - w1.x / 0.75); g1 *= g1;
  float g2 = sat(1.0 - w2.x / 0.8); g2 *= g2;
  float broad = fbmT(uv, nc(5.0), 4, 0.5, 3u);
  float h = 0.04 * g1 * detail(MM(0.1)) + 0.06 * g2 + 0.04 * broad;
  // seasoning pools in the low spots and smooths them
  float low = sat(0.5 - (g2 * 0.6 + broad * 0.8));
  h += 0.03 * low;
  float sheen = fbmT(uv, nc(4.0), 4, 0.55, 4u);
  vec3 alb = mix(hex(#1B1A19), hex(#262320), sat(0.5 + sheen));
  // carbonized oil spots (brown) and worn bright iron on the highest tops
  float carbon = smoothstep(0.25, 0.55, fbmT(uv, nc(7.0), 4, 0.6, 5u));
  alb = mix(alb, hex(#3B2A1D), carbon * 0.6);
  float wear = smoothstep(0.75, 0.95, g2 * 0.7 + broad * 0.5 + 0.35);
  Surface s = surf(h, alb, mix(0.42, 0.3, low) + 0.08 * carbon, 0.0);
  s.albedo = mix(s.albedo, hex(#5E5F60), wear * 0.8);
  s.metal = wear * 0.9;
  s.rough = mix(s.rough, 0.35, wear);
  s.loose = carbon * 0.3;
  s.layer = wear > 0.5 ? 0.0 : 1.0;
  return s;
}
`

export const GALVANIZED = /* glsl */ `
Surface surface(vec2 uv) {
  // zinc spangle grains 2-8 mm with dendritic feathering at a per-grain angle
  vec2 w = uv + MM(1.2) * warpT(uv, nc(10.0), 3, 1u);
  Vor v = voronoiT(w, nc(5.0), 2u, 0.95);
  float ang = v.rnd.x * PI;
  vec2 d = vec2(cos(ang), sin(ang));
  // offsets relative to the grain's own seed point keep the pattern periodic
  vec2 pmm = -v.rel * (uTileMm / nc(5.0));
  float along = dot(pmm, d), across = dot(pmm, vec2(-d.y, d.x));
  // feather: primary arms + secondary arms at ~60 deg
  float fA = abs(sin(across * (6.0 + 4.0 * v.rnd.y) + 2.0 * gnoiseT(uv, nc(1.5), 3u)));
  float fB = abs(sin((along * 0.5 + abs(across) * 0.87) * 9.0));
  float feather = (1.0 - fA) * 0.6 + (1.0 - fB) * 0.4 * smoothstep(0.2, 0.0, fA);
  feather *= detail(MM(0.3));
  float bright = v.rnd.z;
  float border = 1.0 - smoothstep(0.0, 0.05, v.edge);
  float h = 0.004 * feather + 0.002 * fbmT(uv, nc(2.0), 3, 0.5, 4u) - 0.004 * border;
  vec3 alb = hex(#A9AEB2) * (0.86 + 0.18 * bright + 0.05 * feather);
  Surface s = surf(h + 0.006, alb, mix(0.18, 0.5, bright) + 0.1 * feather, 1.0);
  // white rust (zinc carbonate) blooms, dull and crusty
  float wr = smoothstep(0.35, 0.6, fbmT(uv, nc(9.0), 5, 0.6, 5u));
  float crust = billowT(uv, nc(0.5), 4, 0.5, 6u);
  s.height += wr * (0.008 + 0.01 * crust);
  s.albedo = mix(s.albedo, hex(#D4D1C6) * (0.9 + 0.15 * crust), wr * 0.85);
  s.rough = mix(s.rough, 0.95, wr);
  s.metal = mix(s.metal, 0.0, wr);
  s.loose = wr * 0.4;
  s.layer = wr > 0.5 ? 1.0 : 0.0;
  // a little grime along grain borders
  s.albedo *= 1.0 - border * 0.2;
  return s;
}
`
