// GLSL for the specimen plate, the glass marble, cloths and grains
// (texturedle.md §5.8, §7.3, §11.4). Written as ShaderMaterial sources: three
// prefixes `#version 300 es` on WebGL2, so texelFetch/textureLod are available.

export const COMMON = /* glsl */ `
uniform sampler2D uHeight;   // R32F, mm, nearest
uniform float uRes;
uniform float uSize;         // bake square side, mm
uniform vec3 uLampW;         // toward the lamp, world space
uniform vec3 uLampP;         // toward the lamp, plate space
uniform float uRing;         // 1 = ring light mode
uniform mat3 uStage;         // plate -> world rotation
uniform float uExposure;

float hFetch(ivec2 p) {
  int n = int(uRes) - 1;
  return texelFetch(uHeight, clamp(p, ivec2(0), ivec2(n)), 0).r;
}
float hAt(vec2 uv) {
  vec2 f = uv * uRes - 0.5;
  vec2 i = floor(f);
  vec2 t = f - i;
  ivec2 a = ivec2(i);
  float h00 = hFetch(a), h10 = hFetch(a + ivec2(1, 0)), h01 = hFetch(a + ivec2(0, 1)), h11 = hFetch(a + ivec2(1, 1));
  return mix(mix(h00, h10, t.x), mix(h01, h11, t.x), t.y);
}
// plate-space normal from height, central differences at step s (uv units)
vec3 nAt(vec2 uv, float s) {
  float mm = s * uSize;
  float hx = hAt(uv + vec2(s, 0.0)) - hAt(uv - vec2(s, 0.0));
  float hy = hAt(uv + vec2(0.0, s)) - hAt(uv - vec2(0.0, s));
  return normalize(vec3(-hx / (2.0 * mm), -hy / (2.0 * mm), 1.0));
}
// the dark studio: a gridded softbox at the lamp, a thin strip light, black flocking elsewhere
vec3 envW(vec3 r, float rough) {
  vec3 col = vec3(0.004, 0.0045, 0.005) + vec3(0.02) * max(r.z, 0.0) * 0.5;
  vec3 L = normalize(uLampW);
  vec3 up = vec3(0.0, 0.0, 1.0);
  vec3 side = normalize(cross(up, L));
  vec3 vert = cross(L, side);
  float d = dot(r, L);
  if (d > 0.0) {
    vec2 q = vec2(dot(r, side), dot(r, vert)) / d;
    float w = 0.22 + rough * 0.9, h = 0.15 + rough * 0.9;
    float soft = 0.02 + rough * 0.6;
    float m = (1.0 - smoothstep(w - soft * 0.2, w + soft, abs(q.x))) * (1.0 - smoothstep(h - soft * 0.2, h + soft, abs(q.y)));
    vec2 g = abs(fract(q * vec2(8.0, 8.0)) - 0.5);
    float grid = mix(1.0, 0.82, smoothstep(0.46, 0.5, max(g.x, g.y)) * (1.0 - rough));
    col += vec3(1.0, 0.94, 0.88) * 9.0 * m * grid * (1.0 - rough * 0.85);
  }
  // strip light opposite-ish, higher up
  vec3 S = normalize(vec3(-L.x * 0.6 + L.y * 0.8, -L.y * 0.6 - L.x * 0.8, 0.9));
  float ds = dot(r, S);
  if (ds > 0.0) {
    vec3 sx = normalize(cross(up, S));
    float a = abs(dot(r, sx) / ds), b = abs(dot(r, cross(S, sx)) / ds);
    col += vec3(0.85, 0.9, 1.0) * 2.5 * (1.0 - smoothstep(0.0, 0.05 + rough * 0.4, a)) * (1.0 - smoothstep(0.5, 0.7 + rough, b)) * (1.0 - rough * 0.9);
  }
  return col;
}
float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d + 1e-6); }
float V_SmithJ(float NoV, float NoL, float a) { float k = a * 0.5; return 0.25 / ((NoV * (1.0 - k) + k) * (NoL * (1.0 - k) + k) + 1e-5); }
vec3 F_Schlick(float VoH, vec3 f0) { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`

export const PLATE_VS = /* glsl */ `
${COMMON}
varying vec2 vUv;
varying vec3 vPlate;
varying vec3 vWorld;
void main() {
  vUv = uv;
  float h = hFetch(ivec2(uv * uRes));
  vec3 p = vec3(position.xy, h);
  vPlate = p;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const PLATE_FS = /* glsl */ `
${COMMON}
uniform sampler2D uAlbedo;
uniform sampler2D uOrm;
uniform sampler2D uLoose;
uniform float uLooseOn;
uniform vec3 uLooseRgb;
uniform float uFocusZ;
uniform float uM;
uniform float uN;
uniform float uMmPerTexel;
uniform int uSteps;
uniform vec4 uMarble;      // plate xyz + r (r = 0: hidden)
uniform vec2 uFrame;       // frame w, h (mm)
uniform float uSeed;
uniform float uAniso;
uniform float uPeak;
varying vec2 vUv;
varying vec3 vPlate;
varying vec3 vWorld;

void main() {
  // physical depth of field: subject-side blur b = m |dz| / (N (1 + m)), as a mip bias
  float dz = abs(vWorld.z - uFocusZ);
  float b = uM * dz / (uN * (1.0 + uM));
  float lod = log2(1.0 + b / uMmPerTexel);
  vec3 alb = textureLod(uAlbedo, vUv, lod).rgb;
  vec4 orm = textureLod(uOrm, vUv, lod);
  float tex = 1.0 / uRes;
  vec3 nP = nAt(vUv, tex * max(1.0, exp2(lod)));
  // loose material (rust flakes, dust) sits in the cavities
  if (uLooseOn > 0.5) {
    float L = texture(uLoose, vUv).r;
    float k = smoothstep(0.0, 20.0, L);
    alb = mix(alb, uLooseRgb * (0.8 + 0.4 * hash12(vUv * 913.0)), k * 0.9);
    orm.g = mix(orm.g, 0.95, k);
    orm.b *= 1.0 - k;
  }
  float ao = orm.r;
  float rough = clamp(orm.g, 0.04, 1.0);
  float metal = orm.b;
  vec3 N = normalize(uStage * nP);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uRing > 0.5 ? normalize(V + vec3(0.0, 0.0, 0.6)) : normalize(uLampW);
  float NoL = max(dot(N, L), 0.0);
  float NoV = max(dot(N, V), 1e-3);
  vec3 H = normalize(L + V);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);
  float a = rough * rough;
  vec3 f0 = mix(vec3(0.04), alb, metal);
  vec3 F = F_Schlick(VoH, f0);
  vec3 spec = D_GGX(NoH, a) * V_SmithJ(NoV, NoL, a) * F;
  vec3 diff = (1.0 - F) * (1.0 - metal) * alb / 3.14159;

  // heightfield self-shadowing toward the lamp, in plate space
  float vis = 1.0;
  vec3 p0 = vec3(vPlate.xy, hAt(vUv) + 0.002);
  if (uRing < 0.5) {
    vec3 Lp = normalize(uLampP);
    float stepMm = 1.5 * uMmPerTexel;
    float t = stepMm;
    for (int i = 0; i < 24; i++) {
      if (i >= uSteps) break;
      vec3 q = p0 + Lp * t;
      vec2 quv = q.xy / uSize + 0.5;
      if (quv.x < 0.0 || quv.y < 0.0 || quv.x > 1.0 || quv.y > 1.0) break;
      float hh = hAt(quv);
      vis = min(vis, clamp(8.0 * (q.z - hh) / t, 0.0, 1.0));
      stepMm *= 1.32;
      t += stepMm;
    }
  }
  // the marble: contact AO, long soft shadow, and its caustic
  float caust = 0.0;
  float mAO = 1.0;
  if (uMarble.w > 0.0) {
    float r = uMarble.w;
    vec3 C = uMarble.xyz;
    float d = length(vPlate.xy - C.xy);
    float gap = max(0.0, C.z - r - p0.z);
    mAO = 1.0 - 0.55 * exp(-d * d / (r * r * 0.25)) * exp(-gap / (0.6 * r));
    vec3 Lp = uRing > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(uLampP);
    vec3 v = C - p0;
    float tca = dot(v, Lp);
    if (tca > 0.0) {
      float d2 = dot(v, v) - tca * tca;
      float pen = r * (0.06 + 0.05 * tca);
      float sh = 1.0 - smoothstep((r - pen) * (r - pen), (r + pen) * (r + pen), d2);
      vis = min(vis, 1.0 - 0.86 * sh);
      // light through the ball focuses ~0.75 mm past the glass, then spreads into an
      // elongated bright patch in the far throat of the shadow
      float foc = uRing > 0.5 ? 0.0 : 1.0;
      float c1 = exp(-d2 / (0.22 * r * r)) * exp(-pow((tca - 3.1 * r) / (1.1 * r), 2.0));
      float c0 = exp(-d2 / (0.02 * r * r)) * (1.0 - foc);
      caust = (c1 * foc * 1.15 + c0 * 3.0) * (1.0 - min(1.0, gap / (2.5 * r)));
    }
  }
  vec3 lampC = vec3(1.0, 0.945, 0.894);
  float lampI = uRing > 0.5 ? 2.3 : 5.2;
  vec3 col = (diff + spec) * lampC * lampI * NoL * vis;
  col += diff * lampC * lampI * caust * 0.6;
  // cool hemisphere fill
  col += alb * vec3(0.78, 0.83, 0.9) * 0.12 * (0.6 + 0.4 * N.z) * ao;
  // softbox reflections (glossy paint and metal show the catchlight)
  vec3 R = reflect(-V, N);
  vec3 envc = envW(R, rough);
  col += envc * F * (1.0 - rough * 0.7) * ao * 0.6;
  col *= ao * mAO;
  // focus peaking (SHOULD)
  if (uPeak > 0.5 && b < uMmPerTexel * 0.7) col = mix(col, vec3(1.0, 0.2, 0.1), 0.35);
  // vignette (−0.6 EV at the corners) and a whisper of sensor noise in the shadows
  vec2 fc = vPlate.xy / (0.5 * uFrame);
  float rv = clamp(dot(fc, fc) * 0.5, 0.0, 1.5);
  col *= exp2(-0.6 * rv);
  col *= uExposure;
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col += (hash12(gl_FragCoord.xy + uSeed) - 0.5) * 0.012 * (1.0 - smoothstep(0.0, 0.25, lum));
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const MARBLE_VS = /* glsl */ `
uniform vec3 uCenter;
varying vec3 vPlate;
void main() {
  vec3 p = position + uCenter;
  vPlate = p;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`

export const MARBLE_FS = /* glsl */ `
${COMMON}
uniform sampler2D uAlbedo;
uniform vec3 uCenter;
uniform float uR;
uniform vec3 uCamP;      // camera in plate space
uniform float uSurfZ;    // plate height under the marble
uniform float uDirt;
uniform vec3 uDirtRgb;
uniform float uFade;
varying vec3 vPlate;

vec3 shadeIn(vec2 uv) {
  vec3 alb = texture(uAlbedo, uv).rgb;
  vec3 n = uStage * nAt(uv, 2.0 / uRes);
  vec3 L = uRing > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(uLampW);
  float w = (dot(n, L) + 0.35) / 1.35;
  return alb * (vec3(1.0, 0.945, 0.894) * (uRing > 0.5 ? 2.3 : 5.2) * max(w, 0.0) / 3.14159 + vec3(0.22));
}

void main() {
  vec3 ro = uCamP;
  vec3 rd = normalize(vPlate - uCamP);
  vec3 oc = ro - uCenter;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - uR * uR;
  float h = b * b - c;
  if (h < 0.0) discard;
  float t = -b - sqrt(h);
  vec3 P = ro + rd * t;
  vec3 N = normalize(P - uCenter);
  float cosi = max(dot(-rd, N), 0.0);
  float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
  vec3 reflC = envW(uStage * reflect(rd, N), 0.02);
  // refraction in, across the chord, and out (n = 1.5)
  vec3 r1 = refract(rd, N, 1.0 / 1.5);
  float tb = -2.0 * dot(P - uCenter, r1);
  vec3 P2 = P + r1 * tb;
  vec3 N2 = normalize(P2 - uCenter);
  vec3 r2 = refract(r1, -N2, 1.5);
  vec3 trans;
  float path = tb;
  if (dot(r2, r2) < 1e-4) {
    trans = envW(uStage * reflect(r1, -N2), 0.05);
  } else if (r2.z < -1e-3) {
    float tz = (uSurfZ - P2.z) / r2.z;
    vec3 Q = P2 + r2 * tz;
    vec2 uv = Q.xy / uSize + 0.5;
    trans = shadeIn(clamp(uv, 0.0, 1.0));
    trans = mix(trans, uDirtRgb * 0.3, uDirt * 0.6);
  } else {
    trans = envW(uStage * r2, 0.05);
  }
  vec3 tint = exp(-vec3(0.06, 0.035, 0.05) * path);
  // thick glass and total internal reflection darken the rim
  trans *= mix(0.25, 1.0, smoothstep(0.08, 0.55, cosi));
  vec3 col = mix(trans * tint, reflC, F);
  // light focused through the ball leaves a warm crescent on the far side
  vec3 Lpn = uRing > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(uLampP);
  float cres = pow(max(dot(N, -vec3(Lpn.xy, 0.0) * 0.9 + vec3(0.0, 0.0, 0.35)), 0.0), 6.0);
  col += vec3(1.0, 0.86, 0.66) * cres * 0.5 * (uRing > 0.5 ? 0.3 : 1.0);
  // sharp lamp highlight
  vec3 Nw = uStage * N;
  vec3 Vw = uStage * (-rd);
  vec3 Lw = uRing > 0.5 ? normalize(Vw + vec3(0.0, 0.0, 0.5)) : normalize(uLampW);
  vec3 Hw = normalize(Lw + Vw);
  col += vec3(1.0, 0.95, 0.9) * pow(max(dot(Nw, Hw), 0.0), 900.0) * 30.0;
  // a faint rim so the bead reads against dark rust
  col += vec3(0.6, 0.7, 0.65) * pow(1.0 - cosi, 3.0) * 0.08;
  col *= uExposure;
  gl_FragColor = vec4(col, uFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const CLOTH_VS = /* glsl */ `
attribute vec4 aResidue;
varying vec2 vUv;
varying vec3 vN;
varying vec4 vRes;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vRes = aResidue;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const CLOTH_FS = /* glsl */ `
uniform vec3 uLampW;
uniform float uRing;
uniform float uKind;     // 0 lens, 1 burlap
uniform float uSwatch;   // swatch side, mm
uniform vec3 uBase;
uniform float uExposure;
uniform float uFlipped;
varying vec2 vUv;
varying vec3 vN;
varying vec4 vRes;
varying vec3 vWorld;
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec2 mm = vUv * uSwatch;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 base = uBase;
  float weave = 1.0;
  if (uKind > 0.5) {
    // plain-weave jute: yarns about 1.6 mm apart, gaps between them
    vec2 q = mm / 1.6;
    vec2 f = fract(q) - 0.5;
    vec2 cell = floor(q);
    float over = mod(cell.x + cell.y, 2.0);
    float warp = 1.0 - smoothstep(0.26, 0.42, abs(f.x));
    float weft = 1.0 - smoothstep(0.26, 0.42, abs(f.y));
    if (warp < 0.05 && weft < 0.05) discard;
    float top = over > 0.5 ? warp : weft;
    float along = over > 0.5 ? f.y : f.x;
    float across = over > 0.5 ? f.x : f.y;
    // twisted jute: diagonal twist bands along the yarn, hairy fibres, darker crossings
    vec2 fib = over > 0.5 ? vec2(mm.x * 9.0, mm.y * 1.1) : vec2(mm.y * 9.0, mm.x * 1.1);
    float hair = vnoise2(fib * vec2(1.0, 6.0)) * 0.6 + vnoise2(fib * vec2(2.3, 13.0)) * 0.4;
    float twist = 0.5 + 0.5 * sin((along * 2.0 + across * 1.2) * 6.28 * 2.0);
    float streak = pow(vnoise2(fib * vec2(3.1, 20.0)), 3.0);
    weave = (0.42 + 0.58 * max(warp, weft)) * (0.62 + 0.22 * twist + 0.5 * (hair - 0.5) + 0.45 * streak) * (0.78 + 0.22 * cos(along * 6.28));
    N = normalize(N + vec3((over > 0.5 ? f.x : 0.0), (over > 0.5 ? 0.0 : f.y), 0.0) * 1.4 * top + vec3((hair - 0.5) * 0.4, (twist - 0.5) * 0.3, 0.0));
    base *= 0.82 + 0.3 * fract(sin(dot(cell, vec2(12.9, 78.2))) * 43758.5);
  } else {
    // microfibre: a very fine knit, faint
    vec2 q = mm / 0.09;
    weave = 0.93 + 0.07 * sin(q.x * 6.28) * sin(q.y * 6.28);
  }
  // residue picked up from the surface
  vec3 res = vRes.rgb;
  float ra = vRes.a * (uKind > 0.5 ? 0.6 : 0.95);
  base = mix(base, res * res, ra);
  vec3 L = uRing > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(uLampW);
  float wrap = uKind > 0.5 ? 0.25 : 0.4;
  float d = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
  vec3 col = base * weave * (vec3(1.0, 0.945, 0.894) * (uRing > 0.5 ? 1.6 : 3.2) * d / 3.14159 + vec3(0.07, 0.075, 0.085));
  // microfibre sheen at grazing angles
  if (uKind < 0.5) {
    vec3 V = normalize(cameraPosition - vWorld);
    col += vec3(0.6, 0.65, 0.7) * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.25 * d;
  }
  col *= uExposure;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const GRAIN_VS = /* glsl */ `
varying vec3 vColor;
varying vec3 vN;
void main() {
  vColor = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
  #endif
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
  im = instanceMatrix;
  #endif
  vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * im * vec4(position, 1.0);
}
`

export const GRAIN_FS = /* glsl */ `
uniform vec3 uLampW;
uniform float uExposure;
varying vec3 vColor;
varying vec3 vN;
void main() {
  float d = max(dot(normalize(vN), normalize(uLampW)), 0.0);
  vec3 col = vColor * (d * 2.2 + 0.25) * uExposure;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
