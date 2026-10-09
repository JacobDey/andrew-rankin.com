// Render pipeline stages to a PNG contact sheet without a browser.
//   node spikes/photochem/tools/dump.mjs silver '{"grade":3}' out.png
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { runSilver, runCyano, SILVER_DEFAULTS, CYANO_DEFAULTS } from '../demo/pipelines.ts'

const [kind = 'silver', json = '{}', out = 'shots/photochem-dump.png'] = process.argv.slice(2)
const params = JSON.parse(json)
const t0 = performance.now()
const res = kind === 'silver'
  ? runSilver({ ...SILVER_DEFAULTS, ...params, film: { ...SILVER_DEFAULTS.film, ...(params.film ?? {}) } })
  : runCyano({ ...CYANO_DEFAULTS, ...params })
const ms = performance.now() - t0
const st = res.stages
const cols = 4, pad = 6
const w = st[0].w, h = st[0].h
const rows = Math.ceil(st.length / cols)
const W = cols * (w + pad) + pad, H = rows * (h + pad) + pad
const img = new Uint8Array(W * H * 3).fill(30)
st.forEach((s, k) => {
  const ox = pad + (k % cols) * (w + pad), oy = pad + Math.floor(k / cols) * (h + pad)
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = (y * s.w + x) * 4, o = ((oy + y) * W + ox + x) * 3
    img[o] = s.rgba[i]; img[o + 1] = s.rgba[i + 1]; img[o + 2] = s.rgba[i + 2]
  }
})
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1) }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
writeFileSync(out, png(W, H, img))
console.log(out, `${W}x${H}`, `${ms.toFixed(0)} ms`, JSON.stringify(Object.fromEntries(Object.entries(res.timings).map(([k, v]) => [k, Math.round(v)]))))
console.log(st.map((s) => s.label).join(' | '))
console.log(res.log)
for (const [k, v] of res.facts) console.log(' ', k, ':', v)
