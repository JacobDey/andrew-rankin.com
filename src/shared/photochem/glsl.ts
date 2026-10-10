// GLSL ES 3.00 ports of the hot per-texel functions, for running the paper
// fields on the GPU (darkroom-toy plan: RGBA16F/32F ping-pong textures).
// These are strings only; this module has no WebGL dependency. The demo's
// "GPU parity" check compiles them and compares against the CPU reference.
//
// Texture packing used by SILVER_DEVELOP_FRAG (all RGBA16F or RGBA32F):
//   uLatent  : (Hh, Hs, H2h, H2s)        written by an exposure pass
//   uTarget  : (d1, d2, dcap, warm)      d1/d2 written by a "recompute" pass after exposure
//   uDev     : (p1, p2, c, tau)
//   uProc    : (x, r, wet, cf)
//   uContact : r = liquid contact 0..1   from the tray heightfield
// The develop pass writes uTarget, uDev and uProc via three MRT outputs.

/** Library: softplus, softmin, H&D curve, exact development step, reciprocity. */
export const GLSL_LIB = /* glsl */ `
float pc_softplus(float x) { return x > 0.0 ? x + log(1.0 + exp(-x)) : log(1.0 + exp(x)); }
float pc_softmin(float a, float b, float s) { return min(a, b) - s * log(1.0 + exp(-abs(a - b) / s)); }
// c0 = (gamma, logH0, toe, dmax), c1 = (shoulder, solarize, solarizeAt, 0)
float pc_curve(vec4 c0, vec4 c1, float x) {
  float lin = c0.x * (x - c0.y);
  float toe = c0.z * pc_softplus(lin / c0.z);
  float d = pc_softmin(toe, c0.w, c1.x);
  if (c1.y > 0.0) d -= c1.y * pc_softplus(3.0 * (x - c1.z)) / 3.0;
  return max(d, 0.0);
}
float pc_curveH(vec4 c0, vec4 c1, float H) { return pc_curve(c0, c1, H > 1e-30 ? log(H) * 0.43429448190325176 : -30.0); }
// Exact step of dp/dt = R (a + b p)(1 - p).
float pc_devStep(float p, float R, float a, float b, float dt) {
  if (p >= 1.0) return 1.0;
  float k = (a + b) * R * dt;
  if (k <= 0.0) return p;
  if (k > 60.0) return 1.0;
  float K = ((a + b * p) / (1.0 - p)) * exp(k);
  return clamp((K - a) / (K + b), p, 1.0);
}
// r = (iLow, pLow, iHigh, pHigh); iHigh <= 0 disables high-intensity failure.
float pc_recip(vec4 r, float I) {
  if (I <= 0.0) return 0.0;
  float e = 1.0;
  if (r.y > 0.0 && r.x > 0.0) { float u = r.x / I; e *= pow(1.0 + u * u, -0.5 * r.y); }
  if (r.w > 0.0 && r.z > 0.0) { float v = I / r.z; e *= pow(1.0 + v * v, -0.5 * r.w); }
  return e;
}
`

/** Develop pass: one dt of paper development with boundary-layer exchange and fog. */
export const SILVER_DEVELOP_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTarget;   // d1, d2, dcap, warm
uniform sampler2D uDev;      // p1, p2, c, tau
uniform sampler2D uProc;     // x, r, wet, cf
uniform sampler2D uContact;  // r = contact
uniform float uR;            // developer rate x paper rate (1/s)
uniform float uRef;          // paper reference rate (normalises tau)
uniform float uDt;
uniform float uTauEx;        // boundary-layer exchange time constant (s)
uniform float uSeedLo, uSeedSpan, uDmaxInt;
uniform float uFogDt;        // fog rate x dt
uniform float uDeplete;
uniform float uDmaxFactor, uWarmth;
in vec2 vUv;
layout(location = 0) out vec4 oTarget;
layout(location = 1) out vec4 oDev;
layout(location = 2) out vec4 oProc;
${GLSL_LIB}
void main() {
  vec4 T = texture(uTarget, vUv);
  vec4 D = texture(uDev, vUv);
  vec4 P = texture(uProc, vUv);
  float cc = texture(uContact, vUv).r;
  float c0 = D.z;
  float tauI = cc > 0.0 ? uTauEx / max(0.05, cc) : 25.0;
  float e = exp(-uDt / tauI);
  float c1 = cc + (c0 - cc) * e;
  float cm = cc + (c0 - cc) * (tauI / uDt) * (1.0 - e);
  float rate = uR * cm;
  float F = min(T.x / uDmaxInt, 1.0);
  float pn = pc_devStep(D.x, rate, uSeedLo + uSeedSpan * F, 1.0, uDt);
  float dp = pn - D.x;
  float dD = dp * min(T.x, uDmaxInt);
  float qn = D.y;
  if (T.y > 0.0) {
    float F2 = min(T.y / uDmaxInt, 1.0);
    qn = pc_devStep(D.y, rate, uSeedLo + uSeedSpan * F2, 1.0, uDt);
    dD += (qn - D.y) * min(T.y, uDmaxInt);
  }
  c1 = max(0.0, c1 - uDeplete * dD);
  float t1 = D.w + (rate / max(uRef, 1e-9)) * uDt;
  float cf = P.w + (t1 > 25.0 ? uFogDt * cm : 0.0);
  float dcap = T.z, warm = T.w;
  if (dp > 0.0) { float wgt = dp / (pn + 1e-6); dcap += (uDmaxFactor - dcap) * wgt; warm += (uWarmth - warm) * wgt; }
  oTarget = vec4(T.x, T.y, dcap, warm);
  oDev = vec4(pn, qn, c1, t1);
  oProc = vec4(P.x, P.y, 1.0, cf);
}
`

/**
 * Colour: silver density -> linear reflectance. Fields from the packed
 * textures plus paper uniforms. Toning, stains and print-out are left out of
 * this minimal port (add the same terms as SilverSheet.reflectance when needed).
 */
export const GLSL_SILVER_COLOR = /* glsl */ `
// returns linear RGB reflectance
vec3 pc_silverReflect(vec4 T, vec4 D, vec4 P, float dmaxInt, float capSoft, float fog, float drydown,
                      float surfDry, float surfWet, vec3 white, vec3 tint) {
  float dens = pc_softmin(D.x * T.x + D.y * T.y, dmaxInt * T.z, capSoft) + fog * D.x + P.w;
  dens = max(dens, 0.0);
  float wet = P.z;
  float u = min(1.0, dens / dmaxInt);
  dens *= 1.0 + drydown * (1.0 - wet) * 4.0 * u * (1.0 - u);
  vec3 warmTint = vec3(0.84, 1.0, 1.2);
  vec3 t = mix(tint, warmTint, T.w);
  float s = mix(surfDry, surfWet, wet);
  return (1.0 - s) * white * pow(vec3(10.0), -dens * t) + s;
}
`
