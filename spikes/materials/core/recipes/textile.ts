// Woven, knitted and pile textiles. Yarn geometry is built per thread on an
// integer lattice so every weave tiles exactly.

export const DENIM = /* glsl */ `
// 3/1 right-hand twill: indigo warp (along V) over three weft picks, under one.
Surface surface(vec2 uv) {
  float N = 4.0 * floor(nc(0.38) / 4.0 + 0.5);           // threads per tile, multiple of 4
  vec2 q = uv * N;
  vec2 cf = floor(q);
  ivec2 c = wrap2(ivec2(cf), ivec2(int(N)));
  vec2 f = q - cf;
  int phase = wrapI(c.y - c.x, 4);
  bool warpUp = phase != 3;
  float K = nc(1.1);
  float slubW = gnoise(vec2(float(c.x) * 7.31, uv.y * K), ivec2(0, int(K)), 3u);
  float slubF = gnoise(vec2(uv.x * K, float(c.y) * 5.17), ivec2(int(K), 0), 4u);
  float fade = sat(0.5 + 2.0 * fbmT(uv, nc(6.0), 4, 0.55, 5u));   // worn, ring-dyed core showing
  float h;
  vec3 alb;
  if (warpUp) {
    float t = (float(phase) + f.y) / 3.0;
    float across = (f.x - 0.5) / (0.47 + 0.04 * slubW);
    float prof = sqrt(sat(1.0 - across * across));
    h = 0.11 + 0.12 * prof * (0.6 + 0.4 * sin(PI * t));
    vec3 indigo = mix(hex(#15274B), hex(#2B4A82), sat(0.5 + slubW));
    alb = mix(indigo, hex(#7488AE), fade * 0.5 * prof * prof);
    float tw = sin(TAU * (q.y * 2.5 + f.x * 1.3) + 3.0 * slubW);   // 2.5 * N cycles per tile: N % 4 == 0 keeps it whole
    alb *= (0.84 + 0.16 * tw) * (0.7 + 0.3 * prof);
    h += 0.008 * tw;
  } else {
    // the weft pick peeks out between two warp floats: low, narrow and half in shadow
    float across = (f.y - 0.5) / 0.36;
    float prof = sqrt(sat(1.0 - across * across));
    h = 0.06 + 0.07 * prof;
    alb = mix(hex(#8E8E90), hex(#B9B6AE), sat(0.5 + slubF)) * (0.55 + 0.45 * prof);
    float tw = sin(TAU * (q.x * 2.5 - f.y * 1.3));
    alb *= 0.9 + 0.1 * tw;
    // blue fibres from the neighbouring warp spill over it
    alb = mix(alb, hex(#2B4A82), 0.35 * smoothstep(0.25, 0.5, abs(f.x - 0.5)));
  }
  float hair = isoLine(gnoiseT(uv, nc(0.9), 7u), 0.012) * smoothstep(0.2, 0.6, fbmT(uv, nc(1.5), 2, 0.5, 8u));
  alb = mix(alb, hex(#B8C2D2), hair * 0.35);
  Surface s = surf(h, alb, 0.86 - 0.06 * hair, 0.0);
  s.layer = warpUp ? 1.0 : 0.0;
  s.loose = 0.3;
  return s;
}
`

export const WOOL_KNIT = /* glsl */ `
// Stockinette: columns of plump V-shaped stitches in a heathered, fuzzy wool.
float leg(vec2 p, vec2 c, float ang, vec2 ax) {
  vec2 d = rot2(p - c, -ang) / ax;
  return dot(d, d);
}
Surface surface(vec2 uv) {
  float NC = nc(4.4), NR = nc(3.2);
  ivec2 per = ivec2(int(NC), int(NR));
  vec2 q = uv * vec2(NC, NR);
  vec2 cf = floor(q);
  vec2 cell = vec2(uTileMm / NC, uTileMm / NR);
  float best = 9.0, side = 0.0;
  vec2 bestLocal = vec2(0.0);
  ivec2 bid = ivec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cc = cf + vec2(float(i), float(j));
    vec2 p = (q - cc) * cell;
    vec3 jr = hash3(ivec2(cc), per, 2u);
    vec2 jit = (jr.xy - 0.5) * vec2(0.15, 0.2);
    float fat = 1.0 + 0.1 * (jr.z - 0.5);
    for (int s = 0; s < 2; s++) {
      float sg = s == 0 ? -1.0 : 1.0;
      // each leg leans out from the bottom centre of its stitch: together they make the V
      vec2 ctr = vec2((0.5 + sg * 0.25) * cell.x, 0.62 * cell.y) + jit;
      float r = leg(p, ctr, -sg * 0.55, vec2(0.27 * cell.x, 0.78 * cell.y) * fat);   // tops lean outward: a V
      if (r < best) { best = r; side = sg; bestLocal = rot2(p - ctr, sg * 0.55); bid = wrap2(ivec2(cc), per); }
    }
  }
  float prof = sqrt(sat(1.0 - best));
  // plied yarn: twist stripes running diagonally across each leg
  float tw = sin(bestLocal.y * 6.0 + bestLocal.x * 5.0 * side);
  float fuzz = fbmT(uv, nc(0.3), 3, 0.6, 5u);
  float halo = fbmT(uv, nc(0.1), 2, 0.6, 6u) * detail(MM(0.1));
  float h = 1.9 * prof + 0.07 * tw * prof + 0.05 * fuzz + 0.03 * halo;
  float fib = vnoise(vec2(bestLocal.x * 5.0, bestLocal.y * 1.2) + vec2(bid) * 13.7, ivec2(0), 7u);
  vec3 alb = mix(hex(#BDAE95), hex(#DDD2BD), sat(0.5 + fuzz * 1.5));
  alb = mix(alb, hex(#7E6C58), smoothstep(0.8, 0.92, fib) * 0.7);
  alb = mix(alb, hex(#F0EADF), smoothstep(0.12, 0.0, fib) * 0.6);
  alb *= 0.7 + 0.3 * prof;
  alb *= 0.92 + 0.08 * tw;
  float gap = 1.0 - smoothstep(0.82, 1.05, best);
  alb = mix(alb * (0.35 + 0.2 * sat(halo + 0.5)), alb, gap);
  Surface s = surf(mix(0.35 + 0.1 * fuzz, h, gap), alb, 0.96, 0.0);
  s.loose = 0.15;
  return s;
}
`

export const CORDUROY = /* glsl */ `
// 11-wale corduroy: soft plateaus of cut velvet pile along V, base weave in the narrow gutters.
Surface surface(vec2 uv) {
  float NW = nc(2.3);
  float x = uv.x * NW + 0.5;                // gutters sit mid-tile, not on the tile edge
  float fx = fract(x);
  float across = (fx - 0.5) / 0.45;
  float ridge = pow(sat(1.0 - pow(abs(across), 3.0)), 0.6);   // flat-topped, steep sides
  // velvet: fibre tips read as a fine speckle; the nap combs it into short streaks along V
  float tips = vnoiseT(uv, vec2(nc(0.09), nc(0.12)), 2u);
  float tips2 = vnoiseT(uv, vec2(nc(0.045), nc(0.06)), 6u);
  float nap = fbmT(uv, vec2(nc(0.1), nc(0.8)), 3, 0.6, 3u);
  float clump = fbmT(uv, vec2(nc(0.4), nc(1.6)), 3, 0.55, 4u);
  float crush = smoothstep(0.15, 0.5, fbmT(uv, nc(9.0), 4, 0.55, 5u));
  float gutter = 1.0 - smoothstep(0.44, 0.5, abs(fx - 0.5));
  float base = sin(TAU * uv.y * nc(0.3)) * sin(TAU * fx * 4.0) * 0.5 + 0.5;
  float fuzz = (tips - 0.5) * 0.05 + (tips2 - 0.5) * 0.03 * detail(MM(0.05));
  float hPile = 0.2 + 0.42 * ridge + fuzz + 0.03 * clump + 0.015 * nap - 0.06 * crush * ridge;
  float h = mix(0.08 + 0.02 * base, hPile, gutter);
  vec3 col = hex(#8E5A2A);
  vec3 alb = col * (0.78 + 0.22 * ridge) * (0.72 + 0.4 * tips + 0.16 * tips2 * detail(MM(0.05)) + 0.12 * nap + 0.08 * clump);
  alb = mix(alb, col * 1.3 + 0.015, crush * 0.3 * ridge);
  alb = mix(col * 0.4 * (0.8 + 0.4 * base), alb, gutter);
  Surface s = surf(h, alb, 0.98 - 0.08 * crush * ridge, 0.0);
  s.loose = 0.1;
  s.layer = gutter;
  return s;
}
`

export const BURLAP = /* glsl */ `
// Loose plain-weave jute: lumpy, hairy yarns with open holes between them.
float yarnH(float acrossD, float thick) { return sqrt(sat(1.0 - (acrossD * acrossD) / (thick * thick))); }
Surface surface(vec2 uv) {
  float N = ncEven(2.1);
  float KW = floor(N * 0.7), KT = floor(N * 1.3);
  vec2 q = uv * N;
  vec2 cf = floor(q);
  float hW = -1.0, hF = -1.0;
  float aW = 0.0, aF = 0.0, idW = 0.0, idF = 0.0;
  // warp threads (along V): wander in X, vary in thickness
  for (int i = -1; i <= 1; i++) {
    float ci = cf.x + float(i);
    int ii = wrapI(int(ci), int(N));
    float wob = 0.14 * gnoise(vec2(float(ii) * 3.7, uv.y * KW), ivec2(0, int(KW)), 2u);
    float thick = 0.3 + 0.07 * gnoise(vec2(float(ii) * 5.1, uv.y * KT), ivec2(0, int(KT)), 3u) + 0.05 * hash1(ivec2(ii, 0), ivec2(0), 4u);
    float d = q.x - (ci + 0.5 + wob);
    float yh = yarnH(d, thick);
    // over/under: plain weave alternates every pick
    float j = floor(q.y);
    float over = mod(float(ii) + j, 2.0) < 0.5 ? 1.0 : -1.0; // N is even, so parity tiles
    float undul = over * cos(PI * (fract(q.y) - 0.5)) * 0.5;
    float hh = yh > 0.0 ? 0.55 + 0.45 * yh + 0.35 * undul : -1.0;
    if (hh > hW) { hW = hh; aW = d / thick; idW = float(ii); }
  }
  // weft threads (along U)
  for (int j = -1; j <= 1; j++) {
    float cj = cf.y + float(j);
    int jj = wrapI(int(cj), int(N));
    float wob = 0.14 * gnoise(vec2(uv.x * KW, float(jj) * 3.3), ivec2(int(KW), 0), 5u);
    float thick = 0.31 + 0.08 * gnoise(vec2(uv.x * KT, float(jj) * 4.9), ivec2(int(KT), 0), 6u) + 0.05 * hash1(ivec2(0, jj), ivec2(0), 7u);
    float d = q.y - (cj + 0.5 + wob);
    float yh = yarnH(d, thick);
    float i = floor(q.x);
    float over = mod(i + float(jj), 2.0) < 0.5 ? -1.0 : 1.0;
    float undul = over * cos(PI * (fract(q.x) - 0.5)) * 0.5;
    float hh = yh > 0.0 ? 0.55 + 0.45 * yh + 0.35 * undul : -1.0;
    if (hh > hF) { hF = hh; aF = d / thick; idF = float(jj); }
  }
  float h = max(max(hW, hF), 0.0);
  bool isW = hW >= hF;
  float a = isW ? aW : aF;
  vec2 alongV = isW ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  float along = dot(q, alongV);
  float tw = sin(TAU * (along * 3.5 + a * 0.9));   // N even => whole cycles per tile
  float fib = fbm(vec2(along * 6.0, a * 2.0 + (isW ? idW : idF) * 7.0), ivec2(int(N) * 6, 0), uPx * N * 6.0, 3, 0.6, 8u);
  float hairs = isoLine(gnoiseT(uv, nc(1.4), 9u), 0.03) * smoothstep(0.1, 0.5, fbmT(uv, nc(3.0), 2, 0.5, 10u));
  vec3 jute = mix(hex(#9C7D4E), hex(#C2A574), sat(0.5 + fib));
  jute *= 0.75 + 0.25 * sqrt(sat(1.0 - a * a));
  jute *= 0.9 + 0.1 * tw;
  float hole = 1.0 - step(0.0, max(hW, hF));
  vec3 alb = mix(jute, hex(#17110B), hole);
  alb = mix(alb, hex(#D4BC8C), hairs * 0.6);
  Surface s = surf(h + 0.04 * tw * (1.0 - hole) + 0.05 * hairs, alb, 0.95, 0.0);
  s.loose = 0.3 * (1.0 - hole);
  s.layer = isW ? 1.0 : 0.0;
  return s;
}
`

