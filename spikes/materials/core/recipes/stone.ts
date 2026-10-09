// Stone, ceramic and earth recipes.

const BRICK_FIELD = /* glsl */ `
// x = face undulation, y = face micro-relief, z = chipped-edge noise, w = mottling
vec4 field(vec2 uv) {
  return vec4(fbmT(uv, nc(40.0), 4, 0.5, 8u), fbmT(uv, nc(2.0), 5, 0.6, 9u), fbmT(uv, nc(9.0), 5, 0.55, 7u), fbmT(uv, nc(25.0), 5, 0.55, 13u));
}
`
const BRICK_SURFACE = /* glsl */ `
// Running bond, 215 x 65 mm bricks with 10 mm joints. Tile = 2 bricks x 6 courses.
Surface surface(vec2 uv) {
  vec4 Fb = F0();
  float rowF = uv.y * 6.0;
  float row = floor(rowF);
  float odd = mod(row, 2.0);
  float bxF = uv.x * 2.0 + 0.5 * odd;
  float col = floor(bxF);
  vec2 local = vec2((bxF - col) * 225.0, (rowF - row) * 75.0); // mm inside the brick module
  ivec2 bid = wrap2(ivec2(int(col), int(row)), ivec2(2, 6));
  vec3 br = hash3(bid, ivec2(0), 5u);
  vec3 br2 = hash3(bid, ivec2(0), 6u);
  vec2 dE = min(local - 5.0, vec2(220.0, 70.0) - local);
  float de = min(dE.x, dE.y) + 3.0 * Fb.z - 0.6;
  float brickM = smoothstep(-0.6, 0.6, de);
  // brick face: slightly uneven, sandy, a few pits, chipped arrises
  float face = 0.6 * Fb.x + 0.12 * Fb.y;
  vec4 wp = worleyT(uv, nc(3.0), 10u, 1.0);
  float pits = smoothstep(0.3, 0.05, wp.x) * step(0.75, wp.z);
  float bevel = smoothstep(0.0, 4.0, de);
  float hBrick = 6.5 * bevel + face * bevel - 0.8 * pits + 0.5 * (br.z - 0.5);
  // mortar: recessed, gritty, slightly concave (tooled joint)
  float grit = fbmT(uv, nc(0.8), 4, 0.55, 11u);
  float hMortar = 1.2 + 0.25 * grit + 0.25 * fbmT(uv, nc(10.0), 3, 0.5, 12u);
  float h = mix(hMortar, hBrick, brickM);
  // colours: each brick its own firing, darker flashed ends, iron spots
  vec3 c1 = mix(hex(#8E3A26), hex(#B0532F), br.x);
  c1 = mix(c1, hex(#6A2A20), smoothstep(0.7, 1.0, br.y) * 0.7);
  float flash = smoothstep(150.0, 215.0, (br2.x > 0.5 ? local.x : 225.0 - local.x)) * br2.y;
  c1 = mix(c1, hex(#3E1E18), flash * 0.6);
  float mottle = Fb.w;
  c1 *= 0.85 + 0.3 * sat(0.5 + mottle);
  float spot = smoothstep(0.88, 0.95, vnoiseT(uv, nc(1.2), 14u));
  c1 = mix(c1, hex(#2A1A16), spot * 0.7);
  c1 = mix(c1, hex(#C9B49A), smoothstep(0.45, 0.8, fbmT(uv, nc(30.0), 4, 0.5, 15u)) * 0.25 * br2.z);
  c1 = mix(c1, c1 * 0.6, pits);
  vec3 cm = mix(hex(#A39A8C), hex(#C3BBAE), sat(0.5 + grit));
  vec3 alb = mix(cm, c1, brickM);
  Surface s = surf(h, alb, mix(0.95, 0.85 + 0.08 * mottle, brickM), 0.0);
  s.layer = brickM;
  s.loose = mix(0.6, 0.25, brickM);
  return s;
}
`
export const BRICK = { fields: [BRICK_FIELD], surface: BRICK_SURFACE }
