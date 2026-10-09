// Shared GLSL for the macro bench: raking-light heightfield shadows (surface +
// cloth occluder map), analytic marble shadow / AO / caustic, GGX, softbox.
// All lighting happens in PLATE space (the tilted plate's local frame, z up),
// so the CPU passes the world-fixed light/camera/softbox transformed into it.

export const LIGHTING_UNIFORMS = /* glsl */ `
uniform sampler2D uHeight;   // surface height (mm), R16F, linear
uniform sampler2D uOcc;      // cloth occluder heights (mm), same plate extent
uniform float uOccOn;
uniform float uSize;         // plate extent (mm)
uniform vec3 uL;             // direction TO the key light (plate space)
uniform vec3 uLightCol;      // key radiance (linear)
uniform float uLampSize;     // ~ angular diameter of the lamp (radians)
uniform vec3 uCam;           // camera position (plate space)
uniform vec3 uBox;           // direction to the softbox (plate space)
uniform vec3 uBoxCol;        // softbox radiance
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec4 uMarble;        // centre xyz (plate), radius (0 = none)
uniform float uGlass;        // 1 glass marble, 0 steel
`

export const LIGHTING_FUNCS = /* glsl */ `
#ifndef SHADOW_STEPS
#define SHADOW_STEPS 16
#endif
const float PI = 3.14159265;

// terrain height for shadow rays; the cloth occluder is cone-sampled (blurrier
// mips farther along the ray) so cloth shadows get soft penumbrae, not stairs
float surfH(vec2 p, float lod) {
  vec2 uv = p / uSize + 0.5;
  float h = texture(uHeight, uv).r;
  if (uOccOn > 0.5) {
    vec2 o = textureLod(uOcc, uv, lod).rg;
    if (o.g > 0.02) h = max(h, o.r / o.g - 5.0 - (1.0 - o.g) * 0.3);
  }
  return h;
}

// soft heightfield shadow toward the key light, from point p (plate mm)
float marchShadow(vec3 p, float t0) {
  float lh = length(uL.xy);
  if (lh < 1e-4) return 1.0;
  vec2 dir = uL.xy / lh;
  float rise = uL.z / lh;            // mm of ray height per mm of travel
  float res = 1.0;
  float t = t0;
  float texel = uSize / float(textureSize(uOcc, 0).x);
  for (int i = 0; i < SHADOW_STEPS; i++) {
    vec2 q = p.xy + dir * t;
    float lod = log2(max(t * uLampSize / texel, 1.0)) + 0.5;
    float d = p.z + rise * t - surfH(q, lod);  // > 0: ray above terrain
    res = min(res, clamp(0.5 + d / (t * uLampSize * 1.5), 0.0, 1.0));
    if (res < 0.01) break;
    t *= 1.32;
  }
  return res * res * (3.0 - 2.0 * res);
}

// analytic sphere occluder: x = shadow factor (with glass transmission + caustic), y = ambient occlusion
vec2 marbleTerms(vec3 p, vec3 n) {
  if (uMarble.w <= 0.0) return vec2(1.0);
  vec3 c = uMarble.xyz;
  float r = uMarble.w;
  vec3 v = c - p;
  float d = length(v);
  // ambient occlusion of a sphere: (r/d)^2 * cos
  float ao = 1.0 - clamp((r * r) / (d * d) * max(dot(n, v / d), 0.0) * 1.1, 0.0, 0.9);
  float tca = dot(v, uL);
  float sh = 1.0;
  if (tca > 0.0) {
    float perp = sqrt(max(d * d - tca * tca, 0.0));
    float edge = perp - r;                     // < 0 inside the umbra core
    float pen = max(tca * uLampSize, 0.02);
    float occ = clamp(0.5 - edge / pen, 0.0, 1.0);
    occ = occ * occ * (3.0 - 2.0 * occ);
    if (uGlass > 0.5) {
      // glass: transmits most light, ball-lens focus ~1.5 r beyond the centre
      float focus = exp(-pow((tca - 1.5 * r) / (1.1 * r), 2.0));
      float core = exp(-pow(perp / (0.28 * r), 2.0));
      float ring = exp(-pow((perp - 0.8 * r) / (0.22 * r), 2.0)) * 0.3;   // darker rim (total internal reflection)
      sh = 1.0 - occ * (0.5 + ring) + occ * core * focus * 4.0;
    } else {
      sh = 1.0 - occ;
    }
  }
  return vec2(sh, ao);
}

// contact darkening from cloth resting at/around p (blurred occluder mip)
float clothContactAO(vec2 uv, float z) {
  if (uOccOn < 0.5) return 1.0;
  vec2 o = textureLod(uOcc, uv, 2.5).rg;
  if (o.g < 0.01) return 1.0;
  float above = o.r / o.g - 5.0 - z;
  return 1.0 - 0.55 * o.g * smoothstep(-0.05, 0.5, above);
}

vec3 fresnelSchlick(float c, vec3 f0) { return f0 + (1.0 - f0) * pow(1.0 - c, 5.0); }

vec3 ggx(vec3 n, vec3 v, vec3 l, float rough, vec3 f0) {
  vec3 h = normalize(v + l);
  float a = max(rough * rough, 0.002);
  float a2 = a * a;
  float nh = max(dot(n, h), 0.0);
  float nv = max(dot(n, v), 1e-3);
  float nl = max(dot(n, l), 1e-3);
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = a * 0.5;
  float G = (nv / (nv * (1.0 - k) + k)) * (nl / (nl * (1.0 - k) + k));
  vec3 F = fresnelSchlick(max(dot(h, v), 0.0), f0);
  return D * G * F / (4.0 * nv * nl);
}

// broad overhead softbox seen in reflections; widens with roughness
vec3 softbox(vec3 r, float rough) {
  float c = dot(r, uBox);
  float size = 0.22 + rough * 0.9;
  float lobe = smoothstep(cos(size), cos(size * 0.35), c);
  return uBoxCol * lobe / (1.0 + rough * 6.0);
}
`
