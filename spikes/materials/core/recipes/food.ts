// Plant & food recipes.

export const ORANGE_PEEL = /* glsl */ `
Surface surface(vec2 uv) {
  // oil glands sit under shallow dimples; between them the waxy skin domes up
  vec2 w = uv + MM(0.35) * warpT(uv, nc(3.0), 2, 1u);
  vec4 g1 = worleyT(w, nc(0.9), 2u, 0.95);
  vec4 g2 = worleyT(w + 0.5, nc(1.6), 3u, 0.95);
  float d1 = 1.0 - smoothstep(0.0, 0.5, g1.x);
  float d2 = 1.0 - smoothstep(0.0, 0.55, g2.x);
  d1 = d1 * d1 * (3.0 - 2.0 * d1); d2 = d2 * d2 * (3.0 - 2.0 * d2);
  float dome = smoothstep(0.05, 0.8, g1.x) * smoothstep(0.0, 0.5, g1.y - g1.x);
  float pores = (1.0 - smoothstep(0.0, 0.3, worleyT(uv, nc(0.2), 4u, 0.9).x)) * detail(MM(0.1));
  float broad = fbmT(uv, nc(8.0), 4, 0.5, 5u);
  float h = 0.16 * broad + 0.025 * dome - 0.055 * d1 * (0.5 + 0.7 * g1.z) - 0.03 * d2 - 0.006 * pores;
  float mott = fbmT(uv, nc(3.0), 5, 0.55, 6u);
  vec3 base = mix(hex(#EC7C16), hex(#F69A28), sat(0.5 + mott * 1.3));
  vec3 alb = mix(base, hex(#DC6A12), d1 * 0.3 + d2 * 0.12);
  alb = mix(alb, hex(#F9AE40), dome * 0.12);
  alb = mix(alb, hex(#B19A30), smoothstep(0.35, 0.6, fbmT(uv, nc(12.0), 3, 0.5, 7u)) * 0.12);
  Surface s = surf(h, alb, 0.24 + 0.14 * d1 + 0.04 * mott, 0.0);
  s.loose = 0.15 * d1;
  return s;
}
`

export const STRAWBERRY = /* glsl */ `
Surface surface(vec2 uv) {
  // achenes in shallow pits on a jittered hex lattice, all pointing toward the tip (-V)
  vec2 jw = uv + MM(0.8) * warpT(uv, nc(7.0), 2, 1u);
  vec2 cell;
  vec4 hx = hexT(jw, nc(3.6), cell);
  ivec2 hid = ivec2(hx.zw);
  vec2 jit = (hash2(hid, ivec2(0), 2u) - 0.5) * cell * 0.25;
  vec2 o = hx.xy - jit;                 // mm from the achene centre
  float r = length(o);
  float pitR = cell.x * 0.3;
  float pit = 1.0 - smoothstep(0.0, pitR, r);
  pit = pit * pit * (3.0 - 2.0 * pit);
  // achene: ellipse ~1.1 x 0.65 mm, slightly tilted per seed, sitting low in its pit
  float ang = (hash1(hid, ivec2(0), 3u) - 0.5) * 0.6;
  float sc = 0.85 + 0.3 * hash1(hid, ivec2(0), 8u);
  vec2 e = rot2(o + vec2(0.0, 0.12), ang) / (vec2(0.32, 0.55) * sc);
  float seed = 1.0 - smoothstep(0.7, 1.0, length(e));
  float seedDome = sqrt(sat(1.0 - dot(e, e)));
  float bulge = 0.5 + 0.5 * sfbmT(uv, nc(2.6), 3, 0.5, 9u);
  float broad = fbmT(uv, nc(7.0), 3, 0.5, 4u);
  float h = 0.35 * bulge + 0.12 * broad - 0.22 * pit + seed * (0.06 + 0.14 * seedDome);
  float ripe = sat(0.55 + 0.9 * fbmT(uv, nc(9.0), 4, 0.5, 5u));
  vec3 flesh = mix(hex(#E34A40), hex(#B0121C), ripe);
  flesh = mix(flesh, hex(#8E0C16), pit * 0.25);
  // pale speckles (lenticel-like dots) on the flesh
  float speck = smoothstep(0.88, 0.96, vnoiseT(uv, nc(0.16), 6u)) * (1.0 - pit) * detail(MM(0.1));
  flesh = mix(flesh, hex(#F6CDB4), speck * 0.5);
  float sv = hash1(hid, ivec2(0), 7u);
  vec3 achene = mix(hex(#E0BC48), hex(#B04424), smoothstep(0.45, 0.95, sv) * 0.85) * (0.7 + 0.4 * seedDome);
  vec3 alb = mix(flesh, achene, seed);
  Surface s = surf(h, alb, mix(0.13, 0.45, seed) + 0.05 * pit, 0.0);
  s.layer = seed;
  s.loose = 0.2 * (1.0 - seed);
  return s;
}
`
