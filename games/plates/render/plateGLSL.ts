// games/plates/render/plateGLSL.ts — FROZEN. Used by WP2 (tray, plate mesh, thumbs) and WP4 (light table).
export const PLATE_GLSL = /* glsl */ `
uniform sampler2D uE;        // R8, linear + mipmaps: L = r*13.0 - 12.0
uniform sampler2D uChem;     // RGBA16F, linear: R=P G=H B=F A=B
uniform sampler2D uNoise;    // 128x128 R8 blue noise, nearest, repeat
uniform vec2  uNoiseSeed;    // per-plate texel offset
uniform float uK;            // K_DEV
uniform float uS;            // S_SLOPE
const vec2 PLATE_SIZE = vec2(1024.0, 512.0);
float plateL(vec2 uv, float lod) { return textureLod(uE, uv, lod).r * 13.0 - 12.0; }
float plateDensity(vec2 uv, float lod) {
  vec4 c = texture(uChem, uv);
  return 1.0 - exp(-uK * c.r * (exp2(uS * plateL(uv, lod)) + c.b));
}
float grainT(vec2 uv, float texelsPerPx, vec2 salt) {
  vec2 p = floor(uv * PLATE_SIZE / max(1.0, texelsPerPx)) + uNoiseSeed + salt;
  return texture(uNoise, (p + 0.5) / 128.0).r * 0.98 + 0.01;
}
float plateSilver(vec2 uv, float texelsPerPx) {
  return step(grainT(uv, texelsPerPx, vec2(0.0)), plateDensity(uv, log2(max(1.0, texelsPerPx))));
}
float plateMilk(vec2 uv, float texelsPerPx) {
  return step(grainT(uv, texelsPerPx, vec2(37.0, 61.0)), texture(uChem, uv).g * 0.85);
}
`
export function plateUniforms(gpu: { E: unknown; chem: unknown; seed: unknown }, noise: unknown) {
  return { uE: { value: gpu.E }, uChem: { value: gpu.chem }, uNoise: { value: noise },
           uNoiseSeed: { value: gpu.seed }, uK: { value: 1 / 22 }, uS: { value: 0.5 } }
}
