/**
 * GLSL for the tray. Everything that sits under the liquid (paper, tray floor) samples the fluid texture
 * itself to do absorption, fake refraction and caustics, so the liquid surface pass only has to add
 * reflections (Fresnel, the bulb's glint, a faint body glow). No render targets, no screen-space passes:
 * cheap on phones.
 *
 * Fluid texture (RGBA32F, (nx+1) x (ny+1) cell corners, NEAREST): R depth (m), G freshness 0..1, B speed (m/s).
 * Paper texture (RGBA8, LINEAR): R density 0..1, G wetness, B coverage, A boundary-layer developer.
 * All lighting mirrors three's physically based point light: radiance = albedo/PI * I/d^2 * ndl.
 */

export const FLUID_GLSL = /* glsl */ `
uniform sampler2D uFluid;
uniform vec2 uGrid;   // corner grid size: (nx + 1, ny + 1)
uniform float uDx;
// The CPU uploads CORNER values (each the mean of the 2x2 cells around it). That box filter removes the
// grid-scale checkerboard a first-order scheme leaves behind bores, and corners land exactly on vertices.
vec4 fluidCorner(ivec2 c) {
  c = clamp(c, ivec2(0), ivec2(uGrid) - 1);
  return texelFetch(uFluid, c, 0);
}
// bilinear sample at tray coords (m); corner (i, j) sits at (i*dx, j*dx)
vec4 fluidAt(vec2 p) {
  vec2 g = clamp(p / uDx, vec2(0.0), uGrid - 1.0);
  vec2 g0 = floor(g);
  vec2 f = g - g0;
  ivec2 i0 = ivec2(g0);
  vec4 a = fluidCorner(i0);
  vec4 b = fluidCorner(i0 + ivec2(1, 0));
  vec4 c = fluidCorner(i0 + ivec2(0, 1));
  vec4 d = fluidCorner(i0 + ivec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`

export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uLightPos;     // world
uniform vec3 uLightColor;   // linear
uniform float uLightPower;  // candela-ish, like PointLight.intensity
uniform vec3 uAmbient;      // ambient irradiance
`

// ---------------------------------------------------------------- liquid surface (additive)

export const LIQUID_VERT = /* glsl */ `
${FLUID_GLSL}
uniform float uNormalGain;
varying vec3 vWorld;
varying vec3 vN;
varying float vH;
varying float vFresh;
varying float vSpeed;
void main() {
  vec2 p = position.xy;
  vec4 f = fluidAt(p);
  // normals over a 4-cell span: the bulb's needle glint would otherwise turn every 3-4 cell wobble into a
  // woven grid. Waves longer than ~4 cells (all the slosh you can feel) keep their full shape.
  float e = 2.0 * uDx;
  float hl = fluidAt(p - vec2(e, 0.0)).r;
  float hr = fluidAt(p + vec2(e, 0.0)).r;
  float hd = fluidAt(p - vec2(0.0, e)).r;
  float hu = fluidAt(p + vec2(0.0, e)).r;
  vec2 gr = vec2(hl - hr, hd - hu) * uNormalGain / (2.0 * e);
  float gl = length(gr);
  if (gl > 0.9) gr *= 0.9 / gl;   // a breaking front is not a mirror wall
  vec3 nl = normalize(vec3(gr, 1.0));
  vN = normalize(mat3(modelMatrix) * nl);
  vec4 w = modelMatrix * vec4(p, f.r + 0.0003, 1.0);
  vWorld = w.xyz;
  vH = f.r;
  vFresh = f.g;
  vSpeed = f.b;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const LIQUID_FRAG = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uTintFresh;
uniform vec3 uTintSpent;
uniform float uBulbRadiance;
varying vec3 vWorld;
varying vec3 vN;
varying float vH;
varying float vFresh;
varying float vSpeed;
void main() {
  float cover = smoothstep(0.00003, 0.0006, vH);
  if (cover < 0.002) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 Ld = uLightPos - vWorld;
  float d2 = dot(Ld, Ld);
  vec3 L = Ld * inversesqrt(d2);
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  float E = uLightPower / d2;
  // the bulb is small and very bright: a needle-sharp lobe that waves smear into long streaks,
  // plus a broad sheen so the whole surface reads as wet
  float bulb = pow(nh, 7000.0) * uBulbRadiance + pow(nh, 400.0) * 1.2 + pow(nh, 40.0) * 0.05;
  vec3 R = reflect(-V, N);
  float roomGlow = pow(max(dot(R, L), 0.0), 3.0);
  vec3 env = uAmbient * 0.35 + uLightColor * roomGlow * 0.05 * E;
  vec3 refl = F * (env + uLightColor * bulb * E);
  // faint body glow from light scattered inside the liquid (stronger when spent/brown, and when stirred)
  vec3 tint = mix(uTintSpent, uTintFresh, vFresh);
  float body = (1.0 - exp(-vH * 90.0)) * (0.035 + 0.05 * (1.0 - vFresh));
  vec3 col = refl + tint * uLightColor * E * body * 0.3183 + vec3(min(vSpeed, 0.5)) * uLightColor * E * 0.004;
  gl_FragColor = vec4(col * cover, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------- paper + tray floor

export const UNDER_VERT = /* glsl */ `
varying vec2 vP;
varying vec3 vWorld;
varying vec3 vNw;
void main() {
  vP = position.xy;  // tray coords: meshes are built directly in tray space
  vNw = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const UNDER_FRAG = /* glsl */ `
${FLUID_GLSL}
${LIGHT_GLSL}
uniform sampler2D uPaper;
uniform vec4 uPaperRect;     // x, y, w, h in tray metres
uniform vec3 uAlbedo;
uniform float uRefract;      // exaggeration of the apparent shift through the surface
uniform float uCaustic;      // exaggeration of focusing by surface curvature
uniform vec3 uSigmaFresh;    // absorption per metre (rgb)
uniform vec3 uSigmaSpent;
uniform float uDmax;
varying vec2 vP;
varying vec3 vWorld;
varying vec3 vNw;
void main() {
  vec4 f = fluidAt(vP);
  float h = f.r;
  float e = 1.5 * uDx;
  float hx1 = fluidAt(vP + vec2(e, 0.0)).r;
  float hx0 = fluidAt(vP - vec2(e, 0.0)).r;
  float hy1 = fluidAt(vP + vec2(0.0, e)).r;
  float hy0 = fluidAt(vP - vec2(0.0, e)).r;
  vec2 grad = vec2(hx1 - hx0, hy1 - hy0) / (2.0 * e);
  float lap = (hx1 + hx0 + hy1 + hy0 - 4.0 * h) / (e * e);
  float under = smoothstep(0.00005, 0.0006, h);
  // apparent shift through the surface, clamped so a breaking front can't smear the floor into stripes
  vec2 off = grad * h * uRefract * under;
  float ol = length(off);
  if (ol > 0.0018) off *= 0.0018 / ol;
  vec2 q = vP - off;
#ifdef IS_PAPER
  vec2 uv = (q - uPaperRect.xy) / uPaperRect.zw;
  vec4 pa = texture2D(uPaper, uv);
  float D = pa.r;
  float wet = pa.g;
  // optical density -> reflectance, normalised so bare paper is the base albedo
  float refl = pow(10.0, -uDmax * D);
  vec3 albedo = uAlbedo * refl;
  albedo *= mix(vec3(1.0), vec3(1.0, 0.93, 0.84), D);   // warm silver black
  albedo *= 1.0 - 0.16 * wet;                           // wet paper is darker
  // paper edge: a hairline shadow so the sheet reads against the white floor
  vec2 ed = min(uv, 1.0 - uv) * uPaperRect.zw;
  float edge = smoothstep(0.0, 0.0012, min(ed.x, ed.y));
  albedo *= 0.75 + 0.25 * edge;
#else
  vec3 albedo = uAlbedo;
  // moulded ribs on the tray floor
  float rib = 1.0 - smoothstep(0.0, 0.0012, abs(fract(q.y / 0.018) - 0.5) * 0.018);
  albedo *= 1.0 - 0.07 * rib;
  // contact shadow around the paper
  vec2 pd = max(abs(q - (uPaperRect.xy + 0.5 * uPaperRect.zw)) - 0.5 * uPaperRect.zw, 0.0);
  albedo *= 1.0 - 0.25 * exp(-length(pd) / 0.002);
  float wet = under;
#endif
  vec3 Ld = uLightPos - vWorld;
  float d2 = dot(Ld, Ld);
  vec3 L = Ld * inversesqrt(d2);
  vec3 Nw = normalize(vNw);
  float ndl = max(dot(Nw, L), 0.0);
  // light through the liquid: absorption in and out, and focusing by the curved surface
  vec3 sigma = mix(uSigmaSpent, uSigmaFresh, f.g);
  vec3 T = exp(-sigma * h * 2.2);
  // focusing by surface curvature (lens equation, exaggerated); steep fronts scatter instead of focus
  float lens = clamp(uCaustic * h * lap, -0.7, 1.5);
  float focus = 1.0 / (1.0 + lens);
  focus = mix(1.0, focus, under * exp(-length(grad) * 1.5));
  vec3 direct = uLightColor * (uLightPower / d2) * ndl * focus;
  vec3 col = albedo * (direct + uAmbient) * T * 0.3183;
  // a damp surface with no liquid over it has a soft sheen
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 Hh = normalize(L + V);
  float sheen = pow(max(dot(Nw, Hh), 0.0), 60.0) * wet * (1.0 - under) * 0.6;
  col += uLightColor * (uLightPower / d2) * sheen * 0.05;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------- bubbles and droplets (points)

export const POINTS_VERT = /* glsl */ `
attribute float aSize;
uniform float uScale;
varying float vSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.5, aSize * uScale / -mv.z);
  vSize = gl_PointSize;
  gl_Position = projectionMatrix * mv;
}
`

export const BUBBLE_FRAG = /* glsl */ `
${LIGHT_GLSL}
varying float vSize;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
  float rim = smoothstep(0.62, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
  float hi = 1.0 - smoothstep(0.0, 0.32, length(c - vec2(-0.3, -0.35)));
  vec3 col = uLightColor * (rim * 0.55 + hi * 2.2) * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const DROP_FRAG = /* glsl */ `
${LIGHT_GLSL}
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 1.0, r);
  vec3 col = uLightColor * core * core * 1.8;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

// ---------------------------------------------------------------- pour / drain streams

export const STREAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNw;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vNw = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const STREAM_FRAG = /* glsl */ `
${LIGHT_GLSL}
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vNw;
varying vec3 vWorld;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = abs(dot(normalize(vNw), V));
  float edge = pow(1.0 - ndv, 1.5);
  float streak = 0.55 + 0.45 * sin(vUv.y * 70.0 + uTime * 38.0 + sin(vUv.x * 18.85) * 1.7);
  vec3 Ld = uLightPos - vWorld;
  float E = uLightPower / dot(Ld, Ld);
  vec3 col = uLightColor * E * (0.04 + edge * 0.22) * streak;
  gl_FragColor = vec4(col * uOpacity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
