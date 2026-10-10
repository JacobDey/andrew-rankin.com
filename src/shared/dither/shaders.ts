/**
 * GLSL for OneBitPass. All passes are fullscreen triangles over integer texel grids
 * (texelFetch everywhere, no filtering), compiled by three as GLSL ES 3.00.
 *
 * Buffers (internal resolution, e.g. 640x360):
 *   sceneRT  RGBA16F (or SRGB8_A8)  lit scene colour; alpha < 0.75 marks a surface that
 *                                   already dithered itself (surfaceDither.ts)
 *   geomRT   RGBA8                  RG = octahedral view normal, BA = 16-bit log depth
 *   bitsRT   RGBA8                  R = final bit, G = outline flag, B = tone (pre-dither)
 */

/**
 * Tone curve shared by the composite and by surface-dithered materials:
 * exposure -> extended Reinhard shoulder (white point W; W <= 0 = hard clip) -> gamma
 * -> contrast/bias about 0.5. Physically lit rooms span 100:1 between the lantern and
 * the far wall; the shoulder keeps paper next to the flame from clipping solid.
 */
export const toneGLSL = /* glsl */ `
uniform float uExposure;
uniform float uWhite;
uniform float uGamma;
uniform float uContrast;
uniform float uBias;
float toneMap(float lin) {
  float x = max(lin * uExposure, 0.0);
  float t = uWhite > 0.0 ? x * (1.0 + x / (uWhite * uWhite)) / (1.0 + x) : x;
  t = pow(clamp(t, 0.0, 1.0), 1.0 / uGamma);
  return clamp((t - 0.5) * uContrast + 0.5 + uBias, 0.0, 1.0);
}
`

export const fullscreenVert = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const common = /* glsl */ `
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform vec2 uTanHalf;   // tan(fovX/2), tan(fovY/2), straight from the projection matrix
uniform float uNear;
uniform float uFar;

vec3 rayDir(ivec2 p) {
  vec2 ndc = (vec2(p) + 0.5) / uRes * 2.0 - 1.0;
  return vec3(ndc * uTanHalf, -1.0);   // view space, z-normalised: point = rayDir * z
}

vec3 octDecode(vec2 e) {
  e = e * 2.0 - 1.0;
  vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-n.z, 0.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.y += n.y >= 0.0 ? -t : t;
  return normalize(n);
}

float decodeDepth(vec4 g) {
  float v = (g.b * 255.0 * 256.0 + g.a * 255.0) / 65535.0;
  return uNear * exp(v * log(uFar / uNear));
}
`

/** Pass 2: view-space normals reconstructed from depth + packed log depth. */
export const geomFrag = /* glsl */ `
${common}
uniform highp sampler2D tDepth;

float viewZ(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uRes) - 1);
  float d = texelFetch(tDepth, p, 0).r;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}

vec2 octEncode(vec3 n) {
  n /= (abs(n.x) + abs(n.y) + abs(n.z));
  vec2 s = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * s;
  return e * 0.5 + 0.5;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float d = texelFetch(tDepth, p, 0).r;
  if (d >= 1.0) { gl_FragColor = vec4(0.5, 0.5, 1.0, 1.0); return; }

  ivec2 X = ivec2(1, 0);
  ivec2 Y = ivec2(0, 1);
  float zc = viewZ(p);
  float zl = viewZ(p - X), zr = viewZ(p + X), zl2 = viewZ(p - 2 * X), zr2 = viewZ(p + 2 * X);
  float zd = viewZ(p - Y), zu = viewZ(p + Y), zd2 = viewZ(p - 2 * Y), zu2 = viewZ(p + 2 * Y);

  // Planes are linear in 1/z across the screen. For each axis, take the side whose
  // two samples best extrapolate to the centre: that side lies on the same plane,
  // so creases and silhouettes get the true face normal (Turanszki's method).
  float ic = 1.0 / zc;
  float eL = abs(2.0 / zl - 1.0 / zl2 - ic);
  float eR = abs(2.0 / zr - 1.0 / zr2 - ic);
  float eD = abs(2.0 / zd - 1.0 / zd2 - ic);
  float eU = abs(2.0 / zu - 1.0 / zu2 - ic);
  if (p.x < 2) eL = 1e9;
  if (p.x > int(uRes.x) - 3) eR = 1e9;
  if (p.y < 2) eD = 1e9;
  if (p.y > int(uRes.y) - 3) eU = 1e9;

  vec3 P = rayDir(p) * zc;
  vec3 dx = eL < eR ? P - rayDir(p - X) * zl : rayDir(p + X) * zr - P;
  vec3 dy = eD < eU ? P - rayDir(p - Y) * zd : rayDir(p + Y) * zu - P;
  vec3 n = normalize(cross(dx, dy));
  if (dot(n, P) > 0.0) n = -n;

  float ld = clamp(log(zc / uNear) / log(uFar / uNear), 0.0, 1.0) * 65535.0;
  float hi = floor(ld / 256.0);
  float lo = floor(ld - hi * 256.0);
  gl_FragColor = vec4(octEncode(n), hi / 255.0, lo / 255.0);
}
`

/** Pass 3: tone, stabilised threshold, outlines -> bits. */
export const compositeFrag = /* glsl */ `
${common}
uniform sampler2D tColor;
uniform sampler2D tGeom;
uniform sampler2D tNoise;
uniform int uNoiseSize;

uniform int uMode;          // 0 none (0.5), 1 screen, 2 sphere, 3 world
uniform mat3 uCamRot;       // camera world rotation
uniform vec3 uCamPos;
uniform mat3 uAnchorInv;    // inverse of the sphere-map anchor rotation (current, A)
uniform vec3 uAnchorPos;    // sphere centre (A)
uniform mat3 uAnchorInvB;   // previous anchor while dissolving (B)
uniform vec3 uAnchorPosB;
uniform float uAnchorMix;   // 1 = A only; <1 = Bayer dissolve B -> A
uniform bool uAnchorPosOn;  // false = classic camera-centred sphere
uniform float uSphereScale; // texels per unit tangent = H / (2 tan(fovY/2))
uniform vec2 uHalfShift;    // 0.5 on odd axes so pixel centres never sit on texel edges
uniform ivec2 uScreenOffset;
uniform float uWorldTexel;  // world size (m) of a level-0 texel in world mode
uniform float uWorldLodBias;

uniform vec3 uLuma;
${toneGLSL}

uniform bool uOutline;
uniform float uDepthTol;
uniform float uDepthAbs;
uniform float uCreaseCos;
uniform float uOutlineMaxDist;
uniform int uLineColor;     // 0 auto, 1 ink, 2 light
uniform bool uIdLines;      // seams where the alpha-encoded line ID changes (lineId.ts)
uniform float uAutoLine;

float noiseAt(ivec2 c) {
  int s = uNoiseSize;
  ivec2 m = ((c % s) + s) % s;
  return (texelFetch(tNoise, m, 0).r * 255.0 + 0.5) / 256.0;
}

// Gnomonic (cube-face) projection of a direction, in the anchor's frame.
// When the camera sits at the anchor and faces along it, this is exactly the screen
// grid (perspective is a gnomonic projection too), so texels are 1:1 with pixels.
float cubeThreshold(vec3 d) {
  vec3 a = abs(d);
  vec2 uv;
  int face;
  // The forward face covers rays up to ~78 deg off-axis (not just 45), so wide and
  // ultrawide FOVs (tan(hfov/2) > 1) get no face seam while at rest.
  if (d.z < 0.0 && -d.z > 0.2 * max(a.x, a.y)) { uv = d.xy / -d.z; face = 0; }
  else if (a.z >= a.x && a.z >= a.y) { uv = vec2(d.z < 0.0 ? d.x : -d.x, d.y) / a.z; face = d.z < 0.0 ? 0 : 1; }
  else if (a.x >= a.y)          { uv = vec2(d.x > 0.0 ? d.z : -d.z, d.y) / a.x; face = d.x > 0.0 ? 2 : 3; }
  else                          { uv = vec2(d.x, d.y > 0.0 ? d.z : -d.z) / a.y; face = d.y > 0.0 ? 4 : 5; }
  ivec2 c = ivec2(floor(uv * uSphereScale + uHalfShift)) + ivec2(face * 23, face * 41);
  return noiseAt(c);
}

float bayer4(ivec2 p) {
  int i = (p.y & 3) * 4 + (p.x & 3);
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}

// Sphere map centred on an ANCHOR POINT (not the camera): the direction from a fixed
// point to a static surface point never changes, so the pattern is glued to the world
// under rotation AND translation while the camera stays near the anchor (density drifts
// by r_anchor / r_camera). Background pixels use the view ray (infinitely far).
// During a re-anchor, a 4x4 Bayer mask dissolves from anchor B (old) to A (new).
float sphereThreshold(ivec2 p, vec3 Pw, bool bg) {
  bool useB = uAnchorMix < 1.0 && bayer4(p) >= uAnchorMix;
  mat3 inv = useB ? uAnchorInvB : uAnchorInv;
  vec3 ap = useB ? uAnchorPosB : uAnchorPos;
  vec3 dw = (bg || !uAnchorPosOn) ? uCamRot * rayDir(p) : Pw - ap;
  return cubeThreshold(inv * dw);
}

// Sum of U(0,1-w) and U(0,w) mapped back to U(0,1) through its CDF, so blending two
// octaves keeps the tone exact (a plain lerp would pull every threshold toward 0.5).
float blendUniform(float a, float b, float w) {
  float x = mix(a, b, w);
  float s = min(w, 1.0 - w);
  float l = 1.0 - s;
  if (s < 1e-4) return x;
  if (x < s) return x * x / (2.0 * s * l);
  if (x > l) return 1.0 - (1.0 - x) * (1.0 - x) / (2.0 * s * l);
  return (x - 0.5 * s) / l;
}

// Triplanar world-anchored threshold with power-of-two octaves picked from the pixel
// footprint, cross-faded with blendUniform. Stable under translation as well as
// rotation, at the cost of soft "breathing" while depth changes.
float worldThreshold(vec3 Pw, vec3 Nw, float dist, vec3 Vw) {
  vec3 an = abs(Nw);
  vec2 q;
  int axis;
  float axisCos;
  if (an.x >= an.y && an.x >= an.z) { q = Pw.zy; axis = 0; axisCos = an.x; }
  else if (an.y >= an.z)            { q = Pw.xz; axis = 1; axisCos = an.y; }
  else                              { q = Pw.xy; axis = 2; axisCos = an.z; }
  // Footprint from euclidean distance (not view depth) so the octave choice at a
  // surface point is invariant under camera rotation; only translation re-picks it.
  float pix = 2.0 * dist * uTanHalf.y / uRes.y;
  float cosV = max(abs(dot(Nw, Vw)), 0.2);
  float foot = pix * sqrt(axisCos / cosV);
  float L = log2(foot / uWorldTexel) + uWorldLodBias;
  float k = floor(L);
  float w = L - k;
  float s0 = uWorldTexel * exp2(k);
  int ki = int(k);
  ivec2 o0 = ivec2(ki * 19 + axis * 7, ki * 37 + axis * 3);
  ivec2 o1 = ivec2((ki + 1) * 19 + axis * 7, (ki + 1) * 37 + axis * 3);
  float n0 = noiseAt(ivec2(floor(q / s0)) + o0);
  float n1 = noiseAt(ivec2(floor(q / (2.0 * s0))) + o1);
  return blendUniform(n0, n1, w);
}

vec4 geomAt(ivec2 p) { return texelFetch(tGeom, clamp(p, ivec2(0), ivec2(uRes) - 1), 0); }

// Line ID from scene alpha: 1 - n/256 (n 1..63, 0 = none); surface-dithered texels
// carry the same ID shifted down by 0.5 (0.5 - n/256), so grain doesn't break seams.
int lineIdAt(ivec2 p) {
  float a = texelFetch(tColor, clamp(p, ivec2(0), ivec2(uRes) - 1), 0).a;
  return int(floor(((a < 0.7 ? 0.5 : 1.0) - a) * 256.0 + 0.5));
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 col = texelFetch(tColor, p, 0);
  float lin = dot(max(col.rgb, vec3(0.0)), uLuma);
  bool pre = col.a < 0.7;   // alpha in [0.25, 0.5]: the material dithered itself (surfaceDither.ts)
  float t = pre ? clamp(lin, 0.0, 1.0) : toneMap(lin);

  vec4 gc = geomAt(p);
  float zc = decodeDepth(gc);
  vec3 nc = octDecode(gc.rg);
  bool bg = gc.b >= 1.0 && gc.a >= 1.0;

  float th = 0.5;
  if (!pre) {
    vec3 rd = rayDir(p);
    vec3 Pw = uCamRot * (rd * zc) + uCamPos;
    if (uMode == 1) th = noiseAt(p + uScreenOffset);
    else if (uMode == 2) th = sphereThreshold(p, Pw, bg);
    else if (uMode == 3) {
      if (bg) th = sphereThreshold(p, Pw, bg);
      else {
        vec3 Nw = uCamRot * nc;
        vec3 Vw = uCamRot * normalize(rd);
        th = worldThreshold(Pw, Nw, zc * length(rd), Vw);
      }
    }
  }
  float bit = t > th ? 1.0 : 0.0;

  float edge = 0.0;
  if (uOutline && !bg && zc < uOutlineMaxDist) {
    ivec2 X = ivec2(1, 0);
    ivec2 Y = ivec2(0, 1);
    vec4 gl0 = geomAt(p - X), gr = geomAt(p + X), gd = geomAt(p - Y), gu = geomAt(p + Y);
    float zl = decodeDepth(gl0), zr = decodeDepth(gr), zd = decodeDepth(gd), zu = decodeDepth(gu);
    // Silhouettes: extend this pixel's plane (P, n) along each neighbour's ray and
    // compare. A neighbour BEHIND the plane by more than max(abs, rel * z) means this
    // pixel is the near side of a depth step: one pixel wide, on the object. Planes at
    // grazing angles predict themselves exactly, so floors don't sprout lines, and the
    // world-space tolerance keeps a 4 cm step from flickering in and out at 3 m.
    vec3 P = rayDir(p) * zc;
    float pn = dot(P, nc);
    float tol = max(uDepthAbs, uDepthTol * zc);
    float zs[4] = float[4](zl, zr, zd, zu);
    ivec2 offs[4] = ivec2[4](-X, X, -Y, Y);
    bool sil = false;
    for (int k = 0; k < 4; k++) {
      float dn = dot(rayDir(p + offs[k]), nc);
      float zp = dn < -1e-4 ? pn / dn : 1e9;     // plane depth along the neighbour ray
      if (zs[k] - min(zp, 1e9) > tol && zs[k] > zc + tol) sil = true;
    }
    // Creases: one-sided normal test against right/up neighbours on the same surface.
    vec3 nr = octDecode(gr.rg), nu = octDecode(gu.rg);
    bool connR = abs(zr - zc) < 0.08 * zc;
    bool connU = abs(zu - zc) < 0.08 * zc;
    bool cr = (connR && dot(nc, nr) < uCreaseCos) || (connU && dot(nc, nu) < uCreaseCos);
    // Seams: one-sided ID change against right/up neighbours on a connected surface.
    bool seam = false;
    if (uIdLines) {
      int idc = lineIdAt(p);
      seam = (connR && lineIdAt(p + X) != idc) || (connU && lineIdAt(p + Y) != idc);
    }
    if (sil || cr || seam) {
      edge = 1.0;
      float lineBit = uLineColor == 1 ? 0.0 : (uLineColor == 2 ? 1.0 : (t < uAutoLine && !pre ? 1.0 : 0.0));
      bit = lineBit;
    }
  }
  gl_FragColor = vec4(bit, edge, t, 1.0);
}
`

/** Pass 4: integer nearest upscale to the canvas, palette map, debug views. */
export const blitFrag = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tBits;
uniform sampler2D tGeom;
uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uScale;
uniform vec3 uInkA;
uniform vec3 uLightA;
uniform vec3 uInkB;
uniform vec3 uLightB;
uniform float uMix;
uniform int uView;     // 0 final, 1 tone, 2 edges, 3 normals, 4 split final|tone
uniform float uSplit;

float bayer4(ivec2 p) {
  int i = (p.y & 3) * 4 + (p.x & 3);
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}

vec3 octDecode(vec2 e) {
  e = e * 2.0 - 1.0;
  vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-n.z, 0.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.y += n.y >= 0.0 ? -t : t;
  return normalize(n);
}

void main() {
  ivec2 t = ivec2(floor((gl_FragCoord.xy - uOffset) / uScale));
  t = clamp(t, ivec2(0), ivec2(uRes) - 1);
  vec4 b = texelFetch(tBits, t, 0);
  bool useB = bayer4(t) < uMix;
  vec3 ink = useB ? uInkB : uInkA;
  vec3 light = useB ? uLightB : uLightA;
  vec3 c = mix(ink, light, b.r);
  if (uView == 1) c = vec3(b.b);
  else if (uView == 2) c = mix(light, ink, b.g);
  else if (uView == 3) c = octDecode(texelFetch(tGeom, t, 0).rg) * 0.5 + 0.5;
  else if (uView == 4 && float(t.x) >= uSplit * uRes.x) c = mix(ink, light, b.b);
  gl_FragColor = vec4(c, 1.0);
}
`
