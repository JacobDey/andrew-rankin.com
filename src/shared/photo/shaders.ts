// GLSL for the photo pipeline. Written for three.js ShaderMaterial on WebGL2 (compiled as GLSL ES 3.00;
// three maps gl_FragColor / texture2D / varying for us, and texelFetch is available).

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// ------------------------------------------------------------------ accumulate
// One draw per sub-frame. Reads the freshly rendered scene (radiance, cd/m^2), applies the shutter
// weight for this pixel's row, mechanical vignetting for this pupil point, and the focus-surface warp
// (field curvature + longitudinal colour), then adds into the accumulator with ONE/ONE blending.
// RGB accumulates X * w, A accumulates w. Resolve divides: X = RGB / A.
export const ACCUM_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uHalfSensor;    // mm, half-size of the rendered (overscanned) area
uniform vec2 uHalfFormat;    // mm, half-size of the film gate
uniform float uHalfDiag;     // mm
uniform vec2 uK;             // distortion k1, k2
uniform vec2 uLens;          // pupil point, metres (camera right, up)
uniform float uRimRadius;    // metres: barrel rim radius (= widest pupil radius)
uniform float uVignette;     // rim shift per unit field
uniform float uImageDist;    // mm
uniform float uFieldCurv;    // dioptres at the corner
uniform float uAstig;
uniform vec3 uLongCA;        // dioptres per channel
uniform float uValueScale;   // cd/m^2 -> X
uniform float uAccScale;
uniform float uMode;         // 0 = global/leaf, 1 = focal-plane
uniform float uWeight;       // leaf weight
uniform vec4 uBin;           // t0, t1, 1/dt, shutter t
uniform float uTravel;       // curtain travel, s
uniform vec4 uDir;           // curtain axis: a = dot(film/(2*halfFormat), uDir.xy) + 0.5
uniform float uFlashScale;   // > 0: flash sub-frame, add radiance * w * scale to RGB and nothing to A
uniform mat3 uSpectral;      // rendered RGB -> film channels
uniform sampler2D tProfile;  // custom shutter: fraction of this bin each print pixel is open (R8, v = 0 at the top)
uniform float uProfileOn;
uniform float uTiltTy;       // tilt: focus-plane slope, depth of the plane at a pixel = s / (1 - ty * ray_y)
uniform float uTanH;         // tan of the half height of the rendered frustum
#ifdef SMOOTH
// Per-sub-frame pre-blur: each pupil sample is widened to a small disc of radius ~ CoC / (2 sqrt(N)),
// so N samples tile the bokeh disc instead of leaving N sharp copies. Depth-aware (scatter-as-gather):
// a tap only contributes if its own blur radius reaches this pixel, so sharp edges do not bleed.
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uCocK;         // CoC radius in px per dioptre of defocus |1/z - 1/s|
uniform float uInvS;         // 1/focus distance, 1/m
uniform float uSmooth;       // kernel support (2 sigma) per CoC radius, ~ 1.77/sqrt(samples per pixel)
uniform vec2 uTexel;         // 1/render size
uniform float uRot;          // per-sub-frame rotation of the tap pattern
#endif
varying vec2 vUv;

vec2 gDisp[3];
float gExtraD = 0.0; // extra defocus (dioptres) from field curvature / longitudinal colour at this pixel

vec3 fetchScene(vec2 uv) {
#ifdef FOCUS_WARP
  return vec3(texture2D(tScene, uv - gDisp[0]).r, texture2D(tScene, uv - gDisp[1]).g, texture2D(tScene, uv - gDisp[2]).b);
#else
  return texture2D(tScene, uv).rgb;
#endif
}

#ifdef SMOOTH
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}
float focusInv(vec2 uv) {
  return uInvS * (1.0 - uTiltTy * (uv.y * 2.0 - 1.0) * uTanH);
}
float smoothR(float z, vec2 uv) {
  return uCocK * (abs(1.0 / z - focusInv(uv)) + gExtraD) * uSmooth;
}
const int TAPS = 12;
const vec2 POISSON[12] = vec2[12](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
  vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
#endif

void main() {
  vec2 xy = (vUv * 2.0 - 1.0) * uHalfSensor;
  float ru = length(xy) / uHalfDiag;
  float ru2 = ru * ru;
  vec2 film = xy * (1.0 + uK.x * ru2 + uK.y * ru2 * ru2);
  float w = uWeight;
  if (uMode > 0.5) {
    float a = clamp(dot(film / (2.0 * uHalfFormat), uDir.xy) + 0.5, 0.0, 1.0);
    float open = a * uTravel;
    float ov = min(uBin.y, open + uBin.w) - max(uBin.x, open);
    w = max(ov, 0.0) * uBin.z;
  }
  if (uProfileOn > 0.5) {
    vec2 puv = vec2(film.x / (2.0 * uHalfFormat.x) + 0.5, 0.5 - film.y / (2.0 * uHalfFormat.y));
    w *= texture2D(tProfile, clamp(puv, 0.0, 1.0)).r;
  }
  if (w <= 0.0) discard;
  vec2 field = film / uHalfDiag;
  float pass = 1.0;
  if (uVignette > 0.0) {
    vec2 rimC = uVignette * field * uRimRadius;
    pass = step(length(uLens - rimC), uRimRadius);
  }
#ifdef FOCUS_WARP
  float r2f = dot(field, field);
  vec2 rdir = r2f > 1e-10 ? field * inversesqrt(r2f) : vec2(1.0, 0.0);
  vec2 tdir = vec2(-rdir.y, rdir.x);
  float er = dot(uLens, rdir);
  float et = dot(uLens, tdir);
  vec2 toUv = uImageDist / (2.0 * uHalfSensor);
  for (int c = 0; c < 3; c++) {
    float dphi = uFieldCurv * r2f + uLongCA[c];
    gDisp[c] = (rdir * er * (1.0 - uAstig) + tdir * et * (1.0 + uAstig)) * dphi * toUv;
  }
  gExtraD = abs(uFieldCurv) * r2f * (1.0 + uAstig) + 0.5 * abs(uLongCA.x - uLongCA.z);
#endif
  vec3 col = uSpectral * fetchScene(vUv);
#ifdef SMOOTH
  float r0 = smoothR(viewZ(vUv), vUv);
  if (r0 > 0.6) {
    float cs = cos(uRot), sn = sin(uRot);
    mat2 R = mat2(cs, sn, -sn, cs);
    float wsum = 1.0;
    for (int j = 0; j < TAPS; j++) {
      vec2 p = R * POISSON[j];
      vec2 o = p * r0;
      vec2 tuv = vUv + o * uTexel;
      float rj = smoothR(viewZ(tuv), tuv);
      // gaussian weight (support r0 = 2 sigma); only taps whose own kernel reaches us count
      float tw = exp(-2.0 * dot(p, p)) * step(length(o), rj + 0.5);
      col += uSpectral * fetchScene(tuv) * tw;
      wsum += tw;
    }
    col /= wsum;
  }
#endif
  // the rim decides WHICH pupil samples reach this pixel (cat's-eye shapes); how MUCH light arrives is
  // restored analytically in the resolve pass, so few samples per row cannot cause brightness banding
  if (uFlashScale > 0.0) {
    gl_FragColor = vec4(min(col * (w * uFlashScale), vec3(6.0e7)), 0.0);
    return;
  }
  float wp = w * uAccScale * pass;
  vec3 v = min(col * uValueScale, vec3(6.0e7));
  gl_FragColor = vec4(v * wp, wp);
}
`

// ------------------------------------------------------------------ resolve
// Film-space pass at output resolution: inverse distortion, lateral colour, natural vignetting.
export const RESOLVE_FRAG = /* glsl */ `
uniform sampler2D tAcc;
uniform vec2 uAccSize;
uniform vec2 uHalfSensor;
uniform vec2 uHalfFormat;
uniform float uHalfDiag;
uniform vec2 uK;
uniform vec3 uLatCA;
uniform float uNatVig;
uniform float uImageDist;
uniform float uPostScale;
uniform float uVignette;
uniform float uRimRadius;
uniform int uPupilCount;
uniform vec3 uPupil[64];     // pupil points (m) + weight: for the analytic rim-pass fraction
varying vec2 vUv;

float rimPass(vec2 field) {
  if (uVignette <= 0.0 || uPupilCount == 0) return 1.0;
  vec2 c = uVignette * field * uRimRadius;
  float p = 0.0, t = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uPupilCount) break;
    vec3 q = uPupil[i];
    p += q.z * step(length(q.xy - c), uRimRadius);
    t += q.z;
  }
  return t > 0.0 ? p / t : 1.0;
}

vec4 fetchAcc(vec2 uv) {
#ifdef MANUAL_BILINEAR
  vec2 p = uv * uAccSize - 0.5;
  vec2 f = fract(p);
  ivec2 i0 = ivec2(floor(p));
  ivec2 mx = ivec2(uAccSize) - 1;
  vec4 a = texelFetch(tAcc, clamp(i0, ivec2(0), mx), 0);
  vec4 b = texelFetch(tAcc, clamp(i0 + ivec2(1, 0), ivec2(0), mx), 0);
  vec4 c = texelFetch(tAcc, clamp(i0 + ivec2(0, 1), ivec2(0), mx), 0);
  vec4 d = texelFetch(tAcc, clamp(i0 + ivec2(1, 1), ivec2(0), mx), 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
#else
  return texture2D(tAcc, uv);
#endif
}

float undistort(float rd) {
  float ru = rd;
  for (int i = 0; i < 6; i++) {
    float r2 = ru * ru;
    float f = ru * (1.0 + uK.x * r2 + uK.y * r2 * r2) - rd;
    float fp = 1.0 + 3.0 * uK.x * r2 + 5.0 * uK.y * r2 * r2;
    ru -= f / max(fp, 1e-3);
  }
  return ru;
}

void main() {
  vec2 film = (vUv * 2.0 - 1.0) * uHalfFormat;
  float rd = length(film) / uHalfDiag;
  float s = rd > 1e-6 ? undistort(rd) / rd : 1.0;
  vec3 X;
  float cover = 1.0;
  for (int c = 0; c < 3; c++) {
    vec2 xy = film * s / (1.0 + uLatCA[c]);
    vec4 a = fetchAcc(xy / uHalfSensor * 0.5 + 0.5);
    X[c] = a.w > 1e-12 ? a[c] / a.w : 0.0;
    cover = min(cover, a.w);
  }
  float tanT = length(film) / uImageDist;
  float c2 = 1.0 / (1.0 + tanT * tanT);
  X *= mix(1.0, c2 * c2, uNatVig) * rimPass(film / uHalfDiag);
  gl_FragColor = vec4(X * uPostScale, cover > 1e-12 ? 1.0 : 0.0);
}
`

// ------------------------------------------------------------------ separable gaussian (diffraction)
export const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;       // one texel step along the blur axis, in uv
uniform vec3 uSigma;       // per-channel sigma, px
varying vec2 vUv;
void main() {
  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  vec3 inv = 1.0 / (2.0 * uSigma * uSigma);
  for (int i = -RADIUS; i <= RADIUS; i++) {
    float x = float(i);
    vec3 w = exp(-x * x * inv);
    acc += texture2D(tSrc, vUv + uTexel * x).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, texture2D(tSrc, vUv).a);
}
`

// ------------------------------------------------------------------ downsample (13-tap, Jimenez 2014)
export const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
uniform float uScale;        // multiplier (1, or cd/m^2 -> X * postScale for the glare probe)
uniform mat3 uM;             // channel mix (identity, or the film's spectral matrix for the glare probe)
varying vec2 vUv;
vec3 s(vec2 o) { return uM * texture2D(tSrc, vUv + o * uSrcTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(min(col * uScale, vec3(6.0e4)), 1.0);
}
`

// ------------------------------------------------------------------ upsample (9-tap tent) + add
export const UP_FRAG = /* glsl */ `
uniform sampler2D tCoarse;   // previous (coarser) up level
uniform sampler2D tFine;     // this level's down result
uniform vec2 uCoarseTexel;
varying vec2 vUv;
void main() {
  vec2 t = uCoarseTexel;
  vec3 c = texture2D(tCoarse, vUv).rgb * 4.0;
  c += (texture2D(tCoarse, vUv + vec2(t.x, 0.0)).rgb + texture2D(tCoarse, vUv - vec2(t.x, 0.0)).rgb
      + texture2D(tCoarse, vUv + vec2(0.0, t.y)).rgb + texture2D(tCoarse, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  c += texture2D(tCoarse, vUv + t).rgb + texture2D(tCoarse, vUv - t).rgb
     + texture2D(tCoarse, vUv + vec2(t.x, -t.y)).rgb + texture2D(tCoarse, vUv + vec2(-t.x, t.y)).rgb;
  c /= 16.0;
  gl_FragColor = vec4(texture2D(tFine, vUv).rgb + c, 1.0);
}
`

// ------------------------------------------------------------------ mean of a small texture -> 1x1
export const MEAN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform ivec2 uSize;
void main() {
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 64; y++) {
    if (y >= uSize.y) break;
    for (int x = 0; x < 64; x++) {
      if (x >= uSize.x) break;
      acc += texelFetch(tSrc, ivec2(x, y), 0).rgb;
    }
  }
  gl_FragColor = vec4(acc / float(uSize.x * uSize.y), 1.0);
}
`

// ------------------------------------------------------------------ out-of-frame veiling glare from the glare probe
// The probe is a single-sample render covering 3x the frame's tangent extents. Light from outside the
// frame scatters into it with an angular falloff (barrel, hood); the result is expressed as an
// equivalent frame mean so it adds straight onto the in-frame mean in the composite.
export const PROBE_VEIL_FRAG = /* glsl */ `
uniform sampler2D tProbe;     // X * postScale, covers frame uv [-1, 2]
uniform ivec2 uSize;
uniform vec2 uFrameTan;       // tan of the frame half-angles
uniform float uFalloff;       // radians
void main() {
  vec3 acc = vec3(0.0);
  float frameOmega = 0.0;
  for (int y = 0; y < 128; y++) {
    if (y >= uSize.y) break;
    for (int x = 0; x < 128; x++) {
      if (x >= uSize.x) break;
      vec2 uv = (vec2(x, y) + 0.5) / vec2(uSize);
      vec2 t = (uv * 3.0 - 1.5) * 2.0 * uFrameTan;   // tangent-plane coordinates
      float c2 = 1.0 / (1.0 + dot(t, t));
      float dOmega = c2 * sqrt(c2);                  // cos^3: solid angle per tangent-plane area
      vec2 out2 = max(abs(t) - uFrameTan, 0.0);
      if (out2.x <= 0.0 && out2.y <= 0.0) { frameOmega += dOmega; continue; }
      float th = atan(length(out2));
      acc += texelFetch(tProbe, ivec2(x, y), 0).rgb * dOmega * exp(-th / uFalloff);
    }
  }
  gl_FragColor = vec4(acc / max(frameOmega, 1e-6), 1.0);
}
`

// ------------------------------------------------------------------ composite: flare + grain -> final latent
export const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tLatent;   // resolved (and diffraction-softened) X * postScale
uniform sampler2D tGlow;     // sum of up-chain levels (X * postScale * levels)
uniform sampler2D tGhost;    // blurred source for ghosts
uniform sampler2D tStar;     // quarter-res source for star spikes
uniform sampler2D tMean;     // 1x1 frame mean
uniform sampler2D tProbe;    // glare probe (X * postScale), covers frame uv [-1, 2]
uniform sampler2D tProbeVeil;// 1x1 out-of-frame glare as an equivalent frame mean
uniform float uProbeOn;
uniform sampler2D tBase;     // previous exposure on the same frame (X, pre-grain): double exposures
uniform float uBaseOn;
uniform float uNoGrain;      // 1 = write the pre-grain latent (for chaining exposures)
uniform float uPostScale;
uniform float uGlowLevels;
uniform float uGlow;
uniform float uVeil;
uniform float uGhost;
uniform float uStar;
uniform vec2 uStarTexel;
uniform float uStarRot;      // radians
uniform float uStarLines;
uniform vec2 uOutSize;
uniform float uGrainSigma;   // ln-exposure sigma per grain cell
uniform float uGrainCell;    // grain cell size in px
uniform float uGrainColor;   // 0 mono .. 1 independent dye layers
uniform float uSeed;
varying vec2 vUv;

uint hash3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float gauss(ivec2 cell, int ch) {
  uvec3 base = uvec3(uvec2(cell + 32768), uint(ch) * 7919u + uint(uSeed));
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += float(hash3(base + uvec3(0u, 0u, uint(i) * 104729u)) & 0xffffffu) / 16777216.0;
  }
  return (s - 2.0) * 1.7320508; // Irwin-Hall(4), unit variance
}
float grainNoise(vec2 px, int ch) {
  if (uGrainCell <= 1.0) return gauss(ivec2(floor(px)), ch);
  vec2 p = px / uGrainCell;
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  float a = gauss(c, ch), b = gauss(c + ivec2(1, 0), ch), d = gauss(c + ivec2(0, 1), ch), e = gauss(c + ivec2(1, 1), ch);
  return mix(mix(a, b, f.x), mix(d, e, f.x), f.y) * 1.62; // restore unit variance after interpolation
}

void main() {
  vec4 L = texture2D(tLatent, vUv);
  vec3 X = L.rgb / uPostScale;
  vec3 direct = X * (1.0 - uGlow - uVeil - uGhost * 0.01 - uStar);
  vec3 add = vec3(0.0);
#ifdef FLARE
  vec3 mean = texture2D(tMean, vec2(0.5)).rgb / uPostScale;
  if (uProbeOn > 0.5) mean += texture2D(tProbeVeil, vec2(0.5)).rgb / uPostScale;
  add += mean * uVeil;
  add += texture2D(tGlow, vUv).rgb / (uPostScale * uGlowLevels) * uGlow;
  // ghosts: images of the frame reflected through the optical axis at magnification m
  vec2 d = vUv - 0.5;
  const int NG = 6;
  float gm[6] = float[6](-0.42, -0.85, -1.6, 0.55, 1.35, -2.6);
  vec3 gt[6] = vec3[6](vec3(0.55, 0.9, 1.0), vec3(1.0, 0.7, 0.35), vec3(0.45, 1.0, 0.55), vec3(1.0, 0.45, 0.8), vec3(0.6, 0.6, 1.0), vec3(1.0, 0.85, 0.6));
  vec3 gh = vec3(0.0);
  for (int i = 0; i < NG; i++) {
    vec2 src = 0.5 - d / gm[i];
    float inside = smoothstep(0.0, 0.04, min(min(src.x, 1.0 - src.x), min(src.y, 1.0 - src.y)));
    vec3 g = texture2D(tGhost, clamp(src, 0.0, 1.0)).rgb * inside;
    if (uProbeOn > 0.5) {
      // sources outside the frame (a sun just out of shot) still throw ghosts into it
      vec2 puv = (src + 1.0) / 3.0;
      float pin = smoothstep(0.0, 0.03, min(min(puv.x, 1.0 - puv.x), min(puv.y, 1.0 - puv.y)));
      g += texture2D(tProbe, clamp(puv, 0.0, 1.0)).rgb * (1.0 - inside) * pin;
    }
    gh += gt[i] * g / (gm[i] * gm[i]);
  }
  add += gh / uPostScale * (uGhost * 0.0016);
#endif
#ifdef STARS
  vec3 st = vec3(0.0);
  for (int k = 0; k < 9; k++) {
    if (float(k) >= uStarLines) break;
    float th = uStarRot + 3.14159265 * float(k) / uStarLines;
    vec2 dir = vec2(cos(th), sin(th)) * uStarTexel;
    for (int j = 1; j <= 24; j++) {
      float fj = float(j);
      float w = 1.0 / (fj * fj);
      st += (texture2D(tStar, vUv + dir * fj).rgb + texture2D(tStar, vUv - dir * fj).rgb) * w;
    }
  }
  add += st / (uPostScale * uStarLines * 3.2899) * uStar;
#endif
  vec3 Y = direct + add;
  if (uBaseOn > 0.5) Y += texture2D(tBase, vUv).rgb;
#ifdef GRAIN
  if (uNoGrain < 0.5) {
  vec2 px = vUv * uOutSize;
  float ns = grainNoise(px, 0);
  vec3 n = vec3(ns);
  if (uGrainColor > 0.0) {
    vec3 ind = vec3(grainNoise(px, 1), grainNoise(px, 2), grainNoise(px, 3));
    n = ns * sqrt(1.0 - uGrainColor) + ind * sqrt(uGrainColor);
  }
  // grain lives in silver/dye density: little in thin (under-exposed) negative areas
  float lum = max(dot(Y, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  float dens = 0.15 + 2.25 / (1.0 + exp(-1.156 * (log(lum) / 2.302585 - 0.688)));
  float g = uGrainSigma * sqrt(clamp((dens - 0.15) / 0.7, 0.0, 1.6));
  Y *= exp(n * g - 0.5 * g * g);
  }
#endif
  gl_FragColor = vec4(Y, L.a);
}
`

// ------------------------------------------------------------------ preview (progressive, from the accumulator)
export const PREVIEW_FRAG = /* glsl */ `
uniform sampler2D tAcc;
uniform vec2 uCrop;          // halfFormat / halfSensor
uniform float uFlash;        // 0..1 overlay brightness for unexposed regions
uniform float uOpacity;      // 1 = opaque preview, < 1 = ghost over the live finder
uniform float uGhost;        // 1: unexposed areas are transparent
uniform float uGain;         // multiplier on the accumulated exposure (incremental exposures)
varying vec2 vUv;
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 uv = (vUv - 0.5) * uCrop + 0.5;
  vec4 a = texture2D(tAcc, uv);
  if (a.w <= 1e-12) {
    if (uGhost > 0.5) discard;
    gl_FragColor = vec4(vec3(0.05, 0.02, 0.02) * uFlash, 1.0);
    return;
  }
  vec3 X = uGain * a.rgb / a.w;
  // quick filmic positive for the progressive preview: X = 1 (metered mid-grey) -> ~18% grey
  vec3 lin = 0.215 * X;
  vec3 y = lin * (1.0 + lin / 16.0) / (1.0 + lin);
  gl_FragColor = vec4(toSRGB(y), uOpacity);
}
`

// ------------------------------------------------------------------ GPU print (display without readback)
// Same maths as film.ts develop(): a 1D LUT from log2 X to 8-bit sRGB print value.
export const PRINT_FRAG = /* glsl */ `
uniform sampler2D tLatent;   // final latent, X units (float)
uniform sampler2D tLut;      // R8 LUT over log2 X in [uLo, uHi]
uniform float uLo;
uniform float uHi;
uniform float uMono;
uniform vec3 uPan;
varying vec2 vUv;
float lut(float x) {
  float t = (log2(max(x, 1e-12)) - uLo) / (uHi - uLo);
  return texture2D(tLut, vec2(clamp(t, 0.0, 1.0), 0.5)).r;
}
void main() {
  vec3 X = texture2D(tLatent, vUv).rgb;
  vec3 c = uMono > 0.5 ? vec3(lut(dot(X, uPan))) : vec3(lut(X.r), lut(X.g), lut(X.b));
  gl_FragColor = vec4(c, 1.0);
}
`

// ------------------------------------------------------------------ analytic point emitters (bokeh discs)
// One draw per emitter per sub-frame, additive into the accumulator (RGB only: the scene pass supplies
// the time weight in A, so the disc simply joins the mean radiance). The disc is the pupil shape scaled
// to the point's blur circle; its energy is the source's flux, so it is conserved at any defocus.
export const EMITTER_FRAG = /* glsl */ `
uniform vec2 uHalfSensor;
uniform vec2 uHalfFormat;
uniform float uHalfDiag;
uniform vec2 uK;
uniform vec2 uCentre;        // mm, sensor coordinates
uniform float uRadius;       // mm, blur-circle radius in equal-area pupil units
uniform float uShapeScale;   // equal-area scale of the aperture shape
uniform vec3 uColour;        // radiance inside the disc, already in accumulator units (X * accScale)
uniform float uMode;
uniform float uWeight;
uniform vec4 uBin;
uniform float uTravel;
uniform vec4 uDir;
uniform float uBlades;
uniform float uRot;          // radians
uniform float uCurv;
uniform sampler2D tMask;
uniform float uMaskOn;
uniform float uPx;           // mm per output pixel (for edge antialiasing)
varying vec2 vUv;

float insideShape(vec2 s) {
  if (uMaskOn > 0.5) {
    if (abs(s.x) > 1.0 || abs(s.y) > 1.0) return 0.0;
    return step(0.5, texture2D(tMask, vec2((s.x + 1.0) * 0.5, (1.0 - s.y) * 0.5)).r);
  }
  float r2 = dot(s, s);
  if (r2 > 1.0) return 0.0;
  if (uBlades < 3.0 || uCurv >= 1.0) return 1.0;
  float sector = 6.2831853 / uBlades;
  float ang = atan(s.y, s.x) - uRot;
  ang = mod(mod(ang, sector) + sector, sector) - 0.5 * sector;
  float apothem = cos(3.14159265 / uBlades);
  float ap = apothem + (1.0 - apothem) * max(0.0, uCurv);
  return step(sqrt(r2) * cos(ang), ap);
}

void main() {
  vec2 xy = (vUv * 2.0 - 1.0) * uHalfSensor;
  float ru = length(xy) / uHalfDiag;
  float ru2 = ru * ru;
  vec2 film = xy * (1.0 + uK.x * ru2 + uK.y * ru2 * ru2);
  float w = uWeight;
  if (uMode > 0.5) {
    float a = clamp(dot(film / (2.0 * uHalfFormat), uDir.xy) + 0.5, 0.0, 1.0);
    float open = a * uTravel;
    float ov = min(uBin.y, open + uBin.w) - max(uBin.x, open);
    w = max(ov, 0.0) * uBin.z;
  }
  if (w <= 0.0) discard;
  // four sub-pixel taps: antialiased edge of the disc
  float cover = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i & 1) - 0.5, float(i >> 1) - 0.5) * 0.5 * uPx;
    cover += insideShape((xy + o - uCentre) / (uRadius * uShapeScale));
  }
  cover *= 0.25;
  if (cover <= 0.0) discard;
  gl_FragColor = vec4(uColour * (cover * w), 0.0);
}
`
