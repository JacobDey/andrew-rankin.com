// Save-state codec shared by SilverSheet and CyanoSheet: a JSON header plus
// each Float32 field quantised to uint16 against its own [0, max] range.
// All-zero fields cost nothing. Fields are non-negative by construction.
// Typical size at 320x256: silver ~1.8 MB (0.8 MB gzipped), cyanotype ~2.3 MB.
// For IndexedDB, wrap with CompressionStream('gzip') in the browser.

export interface FieldPack {
  header: Record<string, unknown>
  fields: Record<string, Float32Array>
}

export function packFields(header: Record<string, unknown>, fields: Record<string, Float32Array>, keys: readonly string[]): Uint8Array {
  const meta: { k: string; max: number; n: number }[] = []
  const blobs: Uint16Array[] = []
  for (const k of keys) {
    const a = fields[k]
    let max = 0
    for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i]
    meta.push({ k, max, n: a.length })
    if (max > 0) {
      const q = new Uint16Array(a.length)
      const s = 65535 / max
      for (let i = 0; i < a.length; i++) q[i] = a[i] > 0 ? Math.round(a[i] * s) : 0
      blobs.push(q)
    }
  }
  const hj = new TextEncoder().encode(JSON.stringify({ ...header, fields: meta }))
  const pad = (2 - ((4 + hj.length) % 2)) % 2
  const total = 4 + hj.length + pad + blobs.reduce((s, b) => s + b.byteLength, 0)
  const out = new Uint8Array(total)
  new DataView(out.buffer).setUint32(0, hj.length, true)
  out.set(hj, 4)
  let o = 4 + hj.length + pad
  for (const b of blobs) {
    out.set(new Uint8Array(b.buffer, b.byteOffset, b.byteLength), o)
    o += b.byteLength
  }
  return out
}

export function unpackFields(bytes: Uint8Array): FieldPack {
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true)
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + len))) as Record<string, unknown> & { fields: { k: string; max: number; n: number }[] }
  const pad = (2 - ((4 + len) % 2)) % 2
  let o = 4 + len + pad
  const fields: Record<string, Float32Array> = {}
  for (const { k, max, n } of header.fields) {
    const a = new Float32Array(n)
    if (max > 0) {
      const q = new Uint16Array(bytes.slice(o, o + n * 2).buffer)
      const sc = max / 65535
      for (let i = 0; i < n; i++) a[i] = q[i] * sc
      o += n * 2
    }
    fields[k] = a
  }
  return { header, fields }
}
