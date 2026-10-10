/**
 * GLSL helpers for games that dither in their own shaders (Plates room post, Latent
 * stations). Include the string once at the top of a fragment shader (after precision
 * statements). GLSL ES 3.00 (three's ShaderMaterial / RawShaderMaterial with glslVersion).
 *
 *   float bayer8(vec2 p)                          8x8 Bayer threshold at integer pixel p, [0,1)
 *   float ign(vec2 p)                             interleaved gradient noise, [0,1)
 *   float bayerIgn(vec2 p)                        0.5 * bayer8 + 0.5 * ign (latent.md 7.1)
 *   float thresholdLookup(sampler2D t, vec2 p, float size)
 *                                                 byte threshold map texel (see thresholdTexture), [0,1)
 *   float ditherBit(float tone, float threshold)  1.0 where tone > threshold
 *   vec3  paletteBit(float bit, vec3 ink, vec3 light)
 *   float paletteDissolve(vec2 p, float t)        1.0 where the new palette is used (bayer8 < t),
 *                                                 for the 0.8 s palette transition (plates.md 7.1)
 *   vec3  paletteMapped(float tone, vec2 p, vec3 inkA, vec3 lightA, vec3 inkB, vec3 lightB,
 *                       float mixT, float threshold)
 */
export const DITHER_GLSL = /* glsl */ `
float bayer8(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 8.0));
  float v = 0.0;
  float scale = 1.0;
  // Top coordinate bit = lowest base-4 digit; digit = (2*bx) ^ (3*by) (matrix [[0,2],[3,1]]).
  for (int k = 2; k >= 0; k--) {
    int bx = (i.x >> k) & 1;
    int by = (i.y >> k) & 1;
    v += float((bx << 1) ^ (by * 3)) * scale;
    scale *= 4.0;
  }
  return (v + 0.5) / 64.0;
}

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

float bayerIgn(vec2 p) {
  return 0.5 * bayer8(p) + 0.5 * ign(p);
}

float thresholdLookup(sampler2D t, vec2 p, float size) {
  ivec2 q = ivec2(mod(floor(p), size));
  return (texelFetch(t, q, 0).r * 255.0 + 0.5) / 256.0;
}

float ditherBit(float tone, float threshold) {
  return tone > threshold ? 1.0 : 0.0;
}

vec3 paletteBit(float bit, vec3 ink, vec3 light) {
  return mix(ink, light, bit);
}

float paletteDissolve(vec2 p, float t) {
  return bayer8(p) < t ? 1.0 : 0.0;
}

vec3 paletteMapped(float tone, vec2 p, vec3 inkA, vec3 lightA, vec3 inkB, vec3 lightB, float mixT, float threshold) {
  float bit = ditherBit(tone, threshold);
  float useB = paletteDissolve(p, mixT);
  return mix(mix(inkA, lightA, bit), mix(inkB, lightB, bit), useB);
}
`
