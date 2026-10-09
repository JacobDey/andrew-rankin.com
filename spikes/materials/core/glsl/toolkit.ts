// Shared procedural toolkit (GLSL ES 3.00), prepended to every material recipe.
//
// Determinism contract
// --------------------
// * All randomness comes from integer hashing (lowbias32) of integer lattice
//   coordinates, the material seed and a per-call salt. WebGL2 guarantees
//   32-bit highp ints in fragment shaders, so every GPU computes identical
//   random numbers. There is no sin()-based hashing anywhere.
// * Lattice coordinates are derived from gl_FragCoord (exact half-integers)
//   times power-of-two pixel steps, so floor() picks the same cell everywhere.
// * The remaining float math (interpolation, sqrt, pow...) can differ in the
//   last bit between GPUs. That moves a texel by << 1/255 except where a hard
//   threshold sits exactly on the value. See NOTES.md, "Determinism".
//
// Tiling contract
// ---------------
// Every lattice function takes an integer period (ivec2 per). Recipes work in
// tile UV space (one tile = [0,1)^2 = uTileMm millimetres) and ask for an
// integer number of cells across the tile, so all noise wraps seamlessly and a
// region bake of part of the tile shows exactly the same features at a higher
// texel density.
//
// Band limiting
// -------------
// uPx is the size of one output pixel in tile UV units. fbm() fades out octaves
// that would alias, without changing the amplitude of the octaves it keeps, so
// the large-scale shape is identical at every resolution and zoom.

export const TOOLKIT_GLSL = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform uint uSeed;      // material seed
uniform float uTileMm;   // physical width of one tile in millimetres
uniform float uPx;       // tile-UV size of one output pixel

#define PI 3.14159265358979
#define TAU 6.28318530717959

// ------------------------------------------------------------------ hashing
// lowbias32 finalizer (C. Wellons): full avalanche with two multiplies. Integer-only, so it is
// bit-identical on every WebGL2 GPU. Each noise call derives one stream key from (salt, seed),
// then hashes its wrapped lattice corners within that stream.
uint hmix(uint h) { h ^= h >> 16u; h *= 0x7FEB352Du; h ^= h >> 15u; h *= 0x846CA68Bu; h ^= h >> 16u; return h; }
// 24 significant bits -> exact float in [0,1)
float u2f(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }

// floor-modulo in pure integer math (% on negative ints is undefined in ES 3.00, so shift
// positive first). Valid for i > -1024 * per, i.e. lattice coords within 1024 tiles of the origin.
int wrapI(int i, int per) {
  if (per <= 0) return i;
  return int(uint(i + per * 1024) % uint(per));
}
ivec2 wrap2(ivec2 c, ivec2 per) { return ivec2(wrapI(c.x, per.x), wrapI(c.y, per.y)); }

const int HOFF = 1073741824; // keeps lattice ints positive before uint()
uint streamKey(uint salt) { return hmix(salt * 0x9E3779B9u + uSeed * 0x85EBCA6Bu + 0x632BE5ABu); }
// hash of an already-wrapped lattice point inside a stream
uint latticeHash(int x, int y, uint k) { return hmix((uint(x + HOFF) * 0x8DA6B343u) ^ (uint(y + HOFF) * 0xD8163841u) ^ k); }
// derive further independent words from one hash
uint hnext(uint h, uint c) { return hmix(h ^ c); }

uint cellHash(ivec2 c, ivec2 per, uint salt) { c = wrap2(c, per); return latticeHash(c.x, c.y, streamKey(salt)); }
float hash1(ivec2 c, ivec2 per, uint salt) { return u2f(cellHash(c, per, salt)); }
vec2 hash2(ivec2 c, ivec2 per, uint salt) { uint h = cellHash(c, per, salt); return vec2(u2f(h), u2f(hnext(h, 0xA511E9B3u))); }
vec3 hash3(ivec2 c, ivec2 per, uint salt) {
  uint h = cellHash(c, per, salt); uint h2 = hnext(h, 0xA511E9B3u);
  return vec3(u2f(h), u2f(h2), u2f(hnext(h2, 0x63D83595u)));
}
// hash of a plain id (e.g. a Voronoi cell id) -> 3 randoms
vec3 hashId(float id, uint salt) {
  uint h = hmix(uint(id * 16777216.0) ^ streamKey(salt)); uint h2 = hnext(h, 0xA511E9B3u);
  return vec3(u2f(h), u2f(h2), u2f(hnext(h2, 0x63D83595u)));
}

// ------------------------------------------------------------------ helpers
// Portable sine for stripes and rings: GPU sin()/cos() reduce large arguments with vendor-specific
// precision (measured: whole-texture differences between SwiftShader and D3D11 at |x| ~ 70), so
// periodic patterns use exact fract() range reduction plus a polynomial (max error ~0.001).
float psin(float x) {
  float t = fract(x * 0.15915494309189535);
  float s = t * 2.0 - 1.0;
  float y = -4.0 * s * (1.0 - abs(s));
  return 0.225 * (y * abs(y) - y) + y;
}
float pcos(float x) { return psin(x + 1.5707963267948966); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec2 sat(vec2 x) { return clamp(x, 0.0, 1.0); }
vec3 sat(vec3 x) { return clamp(x, 0.0, 1.0); }
float remap(float x, float a, float b, float c, float d) { return c + (d - c) * sat((x - a) / (b - a)); }
float lstep(float a, float b, float x) { return sat((x - a) / (b - a)); }
float smin(float a, float b, float k) { float h = sat(0.5 + 0.5 * (b - a) / k); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 rot2(vec2 p, float a) { float c = pcos(a), s = psin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// millimetres <-> tile UV, and "how many cells of this feature size fit in a tile"
float MM(float mm) { return mm / uTileMm; }
float nc(float featureMm) { return max(1.0, floor(uTileMm / featureMm + 0.5)); }
float ncEven(float featureMm) { return max(2.0, 2.0 * floor(uTileMm / featureMm * 0.5 + 0.5)); }
// soft threshold whose width tracks the pixel footprint (anti-aliased step).
// Only call from uniform control flow (uses derivatives).
float aastep(float edge, float x) { float w = max(fwidth(x), 1e-6) * 0.75; return smoothstep(edge - w, edge + w, x); }
// anti-aliased threshold with a known feature scale: x in tile-UV units
float aaband(float edge, float x, float softUv) { float w = max(softUv, uPx * 0.75); return smoothstep(edge - w, edge + w, x); }
// thin line along the zero set of field f with a physical width in mm.
// Sub-pixel lines fade by coverage instead of aliasing. Uniform control flow only.
float isoLine(float f, float widthMm) {
  float fw = max(fwidth(f), 1e-7);
  float wpx = MM(widthMm) / uPx;
  float hw = 0.5 * wpx * fw;
  return (1.0 - smoothstep(hw, hw + fw, abs(f))) * min(1.0, wpx + 0.25);
}
// rounded dome profile: 1 at d = 0, 0 at d >= r
float dome(float d, float r) { return sqrt(sat(1.0 - (d * d) / (r * r))); }
// fade factor for a feature of the given UV size relative to pixel size
float detail(float featureUv) { return smoothstep(0.6, 2.2, featureUv / uPx); }

// ------------------------------------------------------------------ value noise
vec2 quintic(vec2 f) { return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
float vnoise(vec2 p, ivec2 per, uint salt) {
  vec2 fi = floor(p); ivec2 i = ivec2(fi); vec2 f = p - fi; vec2 u = quintic(f);
  uint k = streamKey(salt);
  int x0 = wrapI(i.x, per.x), x1 = wrapI(i.x + 1, per.x), y0 = wrapI(i.y, per.y), y1 = wrapI(i.y + 1, per.y);
  float a = u2f(latticeHash(x0, y0, k)), b = u2f(latticeHash(x1, y0, k));
  float c = u2f(latticeHash(x0, y1, k)), d = u2f(latticeHash(x1, y1, k));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ------------------------------------------------------------------ gradient noise
// 16 exact unit gradients (no transcendental per-sample math)
const vec2 GRAD16[16] = vec2[16](
  vec2(1.0, 0.0), vec2(0.9238795, 0.3826834), vec2(0.7071068, 0.7071068), vec2(0.3826834, 0.9238795),
  vec2(0.0, 1.0), vec2(-0.3826834, 0.9238795), vec2(-0.7071068, 0.7071068), vec2(-0.9238795, 0.3826834),
  vec2(-1.0, 0.0), vec2(-0.9238795, -0.3826834), vec2(-0.7071068, -0.7071068), vec2(-0.3826834, -0.9238795),
  vec2(0.0, -1.0), vec2(0.3826834, -0.9238795), vec2(0.7071068, -0.7071068), vec2(0.9238795, -0.3826834));
vec2 gradOf(uint h) { return GRAD16[int(h >> 28u)]; }
// Perlin-style gradient noise, roughly [-1, 1]
float gnoise(vec2 p, ivec2 per, uint salt) {
  vec2 fi = floor(p); ivec2 i = ivec2(fi); vec2 f = p - fi; vec2 u = quintic(f);
  uint k = streamKey(salt);
  int x0 = wrapI(i.x, per.x), x1 = wrapI(i.x + 1, per.x), y0 = wrapI(i.y, per.y), y1 = wrapI(i.y + 1, per.y);
  float a = dot(gradOf(latticeHash(x0, y0, k)), f);
  float b = dot(gradOf(latticeHash(x1, y0, k)), f - vec2(1.0, 0.0));
  float c = dot(gradOf(latticeHash(x0, y1, k)), f - vec2(0.0, 1.0));
  float d = dot(gradOf(latticeHash(x1, y1, k)), f - vec2(1.0, 1.0));
  return 1.4142 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ------------------------------------------------------------------ simplex noise
// Sheared-lattice simplex (after Gustavson & McEwan's psrdnoise) so it can tile:
// x period any integer, y period must be EVEN. Fewer axis artefacts than Perlin.
uint skHash(ivec2 ij, ivec2 per, uint k) {
  if (per.y > 0) { int j2 = wrapI(ij.y, per.y); ij.x -= (ij.y - j2) / 2; ij.y = j2; }
  if (per.x > 0) ij.x = wrapI(ij.x, per.x);
  return latticeHash(ij.x, ij.y, k);
}
float snoise(vec2 x, ivec2 per, uint salt) {
  vec2 uv = vec2(x.x + x.y * 0.5, x.y);
  vec2 i0 = floor(uv); vec2 f0 = uv - i0;
  vec2 o1 = (f0.x > f0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 i1 = i0 + o1; vec2 i2 = i0 + vec2(1.0);
  vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
  vec2 v1 = vec2(i1.x - i1.y * 0.5, i1.y);
  vec2 v2 = vec2(i2.x - i2.y * 0.5, i2.y);
  vec2 x0 = x - v0, x1 = x - v1, x2 = x - v2;
  uint k = streamKey(salt);
  vec2 g0 = gradOf(skHash(ivec2(i0), per, k));
  vec2 g1 = gradOf(skHash(ivec2(i1), per, k));
  vec2 g2 = gradOf(skHash(ivec2(i2), per, k));
  vec3 w = max(0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  w = w * w; w = w * w;
  return 10.9 * dot(w, vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2)));
}

// ------------------------------------------------------------------ cellular
// Feature point of a wrapped cell: offset in [0,1)^2 from its hash.
vec2 featureOf(uint h, float jitter) { return 0.5 + jitter * (vec2(u2f(h), u2f(hnext(h, 0xA511E9B3u))) - 0.5); }

// Cheap Worley: x = F1, y = F2, z = id of nearest cell in [0,1), w unused
vec4 worley(vec2 p, ivec2 per, uint salt, float jitter) {
  vec2 fi = floor(p); ivec2 n = ivec2(fi); vec2 f = p - fi;
  uint k = streamKey(salt);
  int xs[3] = int[3](wrapI(n.x - 1, per.x), wrapI(n.x, per.x), wrapI(n.x + 1, per.x));
  float d1 = 9.0, d2 = 9.0; uint best = 0u;
  for (int j = -1; j <= 1; j++) {
    int yy = wrapI(n.y + j, per.y);
    for (int i = -1; i <= 1; i++) {
      uint h = latticeHash(xs[i + 1], yy, k);
      vec2 r = vec2(float(i), float(j)) + featureOf(h, jitter) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; best = h; } else if (d < d2) { d2 = d; }
    }
  }
  return vec4(sqrt(d1), sqrt(d2), u2f(hnext(best, 0x63D83595u)), 0.0);
}

// Nearest feature only (3x3 search): f1, vector to it, its random triple. Cheapest cell lookup.
struct Cell { float f1; vec2 rel; vec3 rnd; };
vec3 rndOf(uint h) { uint a = hnext(h, 0x68E31DA4u), b = hnext(a, 0xB5297A4Du); return vec3(u2f(a), u2f(b), u2f(hnext(b, 0x1B56C4E9u))); }
Cell nearestCell(vec2 p, ivec2 per, uint salt, float jitter) {
  vec2 fi = floor(p); ivec2 n = ivec2(fi); vec2 f = p - fi;
  uint k = streamKey(salt);
  int xs[3] = int[3](wrapI(n.x - 1, per.x), wrapI(n.x, per.x), wrapI(n.x + 1, per.x));
  float d1 = 9.0; vec2 mr = vec2(0.0); uint best = 0u;
  for (int j = -1; j <= 1; j++) {
    int yy = wrapI(n.y + j, per.y);
    for (int i = -1; i <= 1; i++) {
      uint h = latticeHash(xs[i + 1], yy, k);
      vec2 r = vec2(float(i), float(j)) + featureOf(h, jitter) - f;
      float d = dot(r, r);
      if (d < d1) { d1 = d; mr = r; best = h; }
    }
  }
  Cell c; c.f1 = sqrt(d1); c.rel = mr; c.rnd = rndOf(best);
  return c;
}

// Full Voronoi: nearest feature, F2, exact distance to the cell border (Quilez's two-pass method)
struct Vor { float f1; float f2; float edge; vec2 rel; float id; vec3 rnd; };
Vor voronoi(vec2 p, ivec2 per, uint salt, float jitter) {
  vec2 fi = floor(p); ivec2 n = ivec2(fi); vec2 f = p - fi;
  uint k = streamKey(salt);
  int xs[3] = int[3](wrapI(n.x - 1, per.x), wrapI(n.x, per.x), wrapI(n.x + 1, per.x));
  float d1 = 9.0, d2 = 9.0; vec2 mr = vec2(0.0); ivec2 mg = ivec2(0); uint best = 0u;
  for (int j = -1; j <= 1; j++) {
    int yy = wrapI(n.y + j, per.y);
    for (int i = -1; i <= 1; i++) {
      uint h = latticeHash(xs[i + 1], yy, k);
      vec2 r = vec2(float(i), float(j)) + featureOf(h, jitter) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; mr = r; mg = ivec2(i, j); best = h; } else if (d < d2) { d2 = d; }
    }
  }
  float ed = 9.0;
  for (int j = -2; j <= 2; j++) {
    int yy = wrapI(n.y + mg.y + j, per.y);
    for (int i = -2; i <= 2; i++) {
      ivec2 g = mg + ivec2(i, j);
      uint h = latticeHash(wrapI(n.x + g.x, per.x), yy, k);
      vec2 r = vec2(g) + featureOf(h, jitter) - f;
      vec2 dr = r - mr;
      // skip the nearest cell itself by index (exact), not by |dr| ~ 0 (fragile under FMA / codegen)
      if (i != 0 || j != 0) ed = min(ed, dot(0.5 * (mr + r), dr * inversesqrt(max(dot(dr, dr), 1e-12))));
    }
  }
  Vor v; v.f1 = sqrt(d1); v.f2 = sqrt(d2); v.edge = ed; v.rel = mr; v.id = u2f(hnext(best, 0x63D83595u));
  v.rnd = rndOf(best);
  return v;
}

// ------------------------------------------------------------------ fractals
// pxl = lattice units per output pixel at octave 0 (for band limiting)
#ifndef EXTRA_OCT
#define EXTRA_OCT 0
#endif
// Zoom detail: programs compiled with EXTRA_OCT > 0 (the generator's "zoom" variant) keep adding
// octaves past \`oct\` while they are still resolvable at this pixel size, so racking in reveals
// finer structure instead of smooth blobs. The first \`oct\` octaves and their normalization are
// untouched, so large-scale structure is identical in both variants. Extra ridged/billow octaves
// are re-centred so they add texture, not a height offset.
float octFade(float pxl) { return 1.0 - smoothstep(0.3, 0.65, pxl); }
float fbm(vec2 p, ivec2 per, float pxl, int oct, float gain, uint salt) {
  float s = 0.0, a = 1.0, norm = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= oct + EXTRA_OCT) break;   // constant at every call site: unrolled. (A data-dependent break here
    // crashed the D3D11 driver for one recipe; extra octaves are faded by octFade instead.)
    s += a * gnoise(p, per, salt + uint(i) * 1013u) * octFade(pxl);
    if (i < oct) norm += a;
    p *= 2.0; per *= 2; pxl *= 2.0; a *= gain;
  }
  return s / norm;
}
float sfbm(vec2 p, ivec2 per, float pxl, int oct, float gain, uint salt) {
  float s = 0.0, a = 1.0, norm = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= oct + EXTRA_OCT) break;
    s += a * snoise(p, per, salt + uint(i) * 1013u) * octFade(pxl);
    if (i < oct) norm += a;
    p *= 2.0; per *= 2; pxl *= 2.0; a *= gain;
  }
  return s / norm;
}
// ridged multifractal-ish: sharp crests at noise zero crossings, [0,1]
float ridged(vec2 p, ivec2 per, float pxl, int oct, float gain, uint salt) {
  float s = 0.0, a = 1.0, norm = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= oct + EXTRA_OCT) break;
    float n = 1.0 - abs(gnoise(p, per, salt + uint(i) * 1013u));
    s += a * (i < oct ? n * n : n * n - 0.45) * octFade(pxl);
    if (i < oct) norm += a;
    p *= 2.0; per *= 2; pxl *= 2.0; a *= gain;
  }
  return s / norm;
}
// billow / turbulence: |noise|, [0,1]
float billow(vec2 p, ivec2 per, float pxl, int oct, float gain, uint salt) {
  float s = 0.0, a = 1.0, norm = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= oct + EXTRA_OCT) break;
    float n = abs(gnoise(p, per, salt + uint(i) * 1013u));
    s += a * (i < oct ? n : n - 0.35) * octFade(pxl);
    if (i < oct) norm += a;
    p *= 2.0; per *= 2; pxl *= 2.0; a *= gain;
  }
  return s / norm;
}

// ------------------------------------------------------------------ tile-space wrappers
// n = number of lattice cells across the tile (integer valued). vec2 n = anisotropic.
float vnoiseT(vec2 uv, float n, uint salt) { return vnoise(uv * n, ivec2(int(n)), salt); }
float vnoiseT(vec2 uv, vec2 n, uint salt) { return vnoise(uv * n, ivec2(n), salt); }
float gnoiseT(vec2 uv, float n, uint salt) { return gnoise(uv * n, ivec2(int(n)), salt); }
float gnoiseT(vec2 uv, vec2 n, uint salt) { return gnoise(uv * n, ivec2(n), salt); }
float snoiseT(vec2 uv, float n, uint salt) { float m = 2.0 * floor(n * 0.5 + 0.5); return snoise(uv * vec2(n, m), ivec2(int(n), int(m)), salt); }
float fbmT(vec2 uv, float n, int oct, float gain, uint salt) { return fbm(uv * n, ivec2(int(n)), uPx * n, oct, gain, salt); }
float fbmT(vec2 uv, vec2 n, int oct, float gain, uint salt) { return fbm(uv * n, ivec2(n), uPx * max(n.x, n.y), oct, gain, salt); }
float sfbmT(vec2 uv, float n, int oct, float gain, uint salt) { float m = 2.0 * floor(n * 0.5 + 0.5); return sfbm(uv * vec2(n, m), ivec2(int(n), int(m)), uPx * n, oct, gain, salt); }
float ridgedT(vec2 uv, float n, int oct, float gain, uint salt) { return ridged(uv * n, ivec2(int(n)), uPx * n, oct, gain, salt); }
float ridgedT(vec2 uv, vec2 n, int oct, float gain, uint salt) { return ridged(uv * n, ivec2(n), uPx * max(n.x, n.y), oct, gain, salt); }
float billowT(vec2 uv, float n, int oct, float gain, uint salt) { return billow(uv * n, ivec2(int(n)), uPx * n, oct, gain, salt); }
float billowT(vec2 uv, vec2 n, int oct, float gain, uint salt) { return billow(uv * n, ivec2(n), uPx * max(n.x, n.y), oct, gain, salt); }
vec4 worleyT(vec2 uv, float n, uint salt, float jitter) { return worley(uv * n, ivec2(int(n)), salt, jitter); }
vec4 worleyT(vec2 uv, vec2 n, uint salt, float jitter) { return worley(uv * n, ivec2(n), salt, jitter); }
Vor voronoiT(vec2 uv, float n, uint salt, float jitter) { return voronoi(uv * n, ivec2(int(n)), salt, jitter); }
Cell nearestCellT(vec2 uv, float n, uint salt, float jitter) { return nearestCell(uv * n, ivec2(int(n)), salt, jitter); }
Vor voronoiT(vec2 uv, vec2 n, uint salt, float jitter) { return voronoi(uv * n, ivec2(n), salt, jitter); }
// domain warp offset (in lattice-cell-relative units, scale by amp in UV)
vec2 warpT(vec2 uv, float n, int oct, uint salt) { return vec2(fbmT(uv, n, oct, 0.5, salt), fbmT(uv, n, oct, 0.5, salt + 7919u)); }

// periodic hex lattice: returns xy = offset from nearest centre in mm, zw = cell ids
// cols = number of columns across the tile; rows forced even (~cols / 0.866)
vec4 hexT(vec2 uv, float cols, out vec2 cellMm) {
  float rows = 2.0 * floor(cols / 0.8660254 * 0.5 + 0.5);
  vec2 q = uv * vec2(cols, rows);
  vec2 sz = vec2(uTileMm / cols, uTileMm / rows);
  cellMm = sz;
  float best = 1e9; vec2 bo = vec2(0.0); vec2 bid = vec2(0.0);
  float j0 = floor(q.y);
  for (int dj = -1; dj <= 1; dj++) {
    float j = j0 + float(dj);
    float odd = mod(j, 2.0);
    float shift = 0.5 * odd;
    float i0 = floor(q.x - shift + 0.5);
    for (int di = -1; di <= 1; di++) {
      float i = i0 + float(di);
      vec2 c = vec2(i + shift, j + 0.5);
      vec2 o = (q - c) * sz;
      float d = dot(o, o);
      if (d < best) { best = d; bo = o; bid = vec2(i, j); }
    }
  }
  bid = vec2(wrap2(ivec2(bid), ivec2(int(cols), int(rows))));
  return vec4(bo, bid);
}

// ------------------------------------------------------------------ surface
struct Surface {
  float height;  // millimetres above the tile's datum
  vec3 albedo;   // linear RGB
  float rough;   // perceptual roughness
  float metal;   // metalness
  float loose;   // 0..1 loose / transferable material (rust dust, grit, flour)
  float layer;   // 0..1 recipe-defined code of the top layer (for abrasion probes)
};
Surface surf(float h, vec3 albedo, float rough, float metal) {
  Surface s; s.height = h; s.albedo = albedo; s.rough = rough; s.metal = metal; s.loose = 0.0; s.layer = 0.0; return s;
}
// put a coating over s where mask > 0
void coat(inout Surface s, float mask, float thick, vec3 albedo, float rough, float metal, float code) {
  s.height += thick * mask;
  s.albedo = mix(s.albedo, albedo, mask);
  s.rough = mix(s.rough, rough, mask);
  s.metal = mix(s.metal, metal, mask);
  s.layer = mix(s.layer, code, step(0.5, mask));
}
`;
