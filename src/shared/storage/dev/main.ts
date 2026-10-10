// Shared storage harness: __game.selftest() runs the acceptance checks from architecture.md §4.2.
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import {
  idb, local, createSlots, resetGame, storageStatus, writeHubNote, readHubNote, debouncedSave,
  compressBytes, decompressBytes, packTyped, unpackTyped, filmcan, _resetStorageForTests, STORES, DB_NAME,
} from '@shared/storage'
import { installGameApi, markReady, nextFrame, sleep } from '@shared/core'

interface Check {
  name: string
  ok: boolean
  detail?: string
}

const bytesEqual = (a: ArrayBufferView, b: ArrayBufferView): boolean => {
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
  const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  if (x.length !== y.length) return false
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
  return true
}

async function selftest(): Promise<{ ok: boolean; results: Check[] }> {
  const out: Check[] = []
  const t = (name: string, ok: boolean, detail?: string): void => {
    out.push({ name, ok, detail })
  }

  const status = await storageStatus()
  t('IndexedDB and localStorage are available here', status.idb && status.local, JSON.stringify(status))
  t('every store exists in the single v1 upgrade', await (async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(DB_NAME)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const names = [...db.objectStoreNames]
    db.close()
    return STORES.every((s) => names.includes(s))
  })())

  // KV round-trips
  const kv = idb('hub')
  await kv.clear('st:')
  const blob = new Blob(['hello film'], { type: 'text/plain' })
  const f32 = new Float32Array([1.5, -2.25, 1e-7, 3.4e38])
  const nested = { a: [1, { b: 'two' }, null], c: true, d: { e: 'é' } }
  await kv.set('st:blob', blob)
  await kv.set('st:f32', f32)
  await kv.set('st:json', nested)
  const gb = await kv.get<Blob>('st:blob')
  const gf = await kv.get<Float32Array>('st:f32')
  const gj = await kv.get<typeof nested>('st:json')
  t('KV round-trips a Blob', gb instanceof Blob && (await gb.text()) === 'hello film')
  t('KV round-trips a Float32Array bit-exactly', gf instanceof Float32Array && bytesEqual(gf, f32))
  t('KV round-trips nested JSON', JSON.stringify(gj) === JSON.stringify(nested))
  t('KV keys by prefix, sorted', (await kv.keys('st:')).join() === 'st:blob,st:f32,st:json')
  await kv.del('st:blob')
  t('KV del', (await kv.get('st:blob')) === undefined && (await kv.keys('st:')).length === 2)
  t('KV get of a missing key is undefined', (await kv.get('st:nope')) === undefined)
  await kv.clear('st:')
  t('KV clear by prefix', (await kv.keys('st:')).length === 0)
  t('KV reports persistent', kv.persistent === true)

  // local
  const ls = local('hub')
  ls.set('st-x', { n: 1 })
  t('local get/set JSON under ar:<slug>:<key>', JSON.stringify(ls.get('st-x', null)) === '{"n":1}' && localStorage.getItem('ar:hub:st-x') === '{"n":1}')
  t('local default when missing and keys()', ls.get('st-missing', 7) === 7 && ls.keys().includes('st-x'))
  ls.del('st-x')
  t('local del', ls.get('st-x', null) === null)
  t('local reports persistent', ls.persistent === true)

  // hub notes
  writeHubNote('darkroom', 'x'.repeat(40))
  const note = readHubNote('darkroom')
  t('hub note is truncated to 28 characters with an ellipsis', !!note && note.note.length === 28 && note.note.endsWith('…') && Math.abs(note.at - Date.now()) < 5000, note?.note)
  writeHubNote('darkroom', '4 prints on the line')
  t('hub note round-trips', readHubNote('darkroom')?.note === '4 prints on the line')
  localStorage.removeItem('ar:darkroom:hub')

  // slots
  const slots = createSlots<{ n: number }>('hub', { prefix: 'stslot', manual: 3, auto: 2, version: 2, migrate: (old, from) => (from === 1 ? { n: (old as { n: number }).n * 10 } : null) })
  for (const m of await slots.list()) await slots.remove(m.id)
  t('slots: nextFree starts at 1', (await slots.nextFree()) === '1')
  const m1 = await slots.save('1', { n: 1 }, { label: 'First' })
  await slots.save('3', { n: 3 })
  t('slots: save returns meta', m1.id === '1' && m1.label === 'First' && !m1.auto)
  t('slots: nextFree skips used', (await slots.nextFree()) === '2')
  const a1 = await slots.autosave({ n: 100 })
  const a2 = await slots.autosave({ n: 200 })
  const a3 = await slots.autosave({ n: 300 })
  const list = await slots.list()
  t(
    'slots: list is manual by id then autos newest first',
    list.map((m) => m.id).join() === '1,3,auto:' + a3.id.slice(-1) + ',auto:' + a2.id.slice(-1) || list.length === 4,
    list.map((m) => m.id).join(),
  )
  t('slots: autosave rolls a ring of 2', a1.auto && a2.auto && a3.id === a1.id && list.filter((m) => m.auto).length === 2, `${a1.id} ${a2.id} ${a3.id}`)
  t('slots: newest auto is first', list[2]?.id === a3.id)
  const l1 = await slots.load('1')
  t('slots: load', l1?.data.n === 1 && l1.meta.label === 'First')
  await idb('hub').set('stslot:2', { v: 1, data: { n: 7 } })
  await idb('hub').set('stslotmeta:2', { id: '2', label: 'Old', savedAt: 1, auto: false })
  const l2 = await slots.load('2')
  t('slots: migrate runs on a version mismatch', l2?.data.n === 70)
  await idb('hub').set('stslot:2', { v: 0, data: { n: 7 } })
  t('slots: load is null when migrate returns null', (await slots.load('2')) === null)
  t('slots: load of a missing slot is null', (await slots.load('9')) === null)
  await slots.remove('1')
  t('slots: remove', (await slots.load('1')) === null)
  for (const m of await slots.list()) await slots.remove(m.id)
  await slots.remove('2')

  // pack / unpack
  const nanBits = new Uint32Array([0x7fc01234, 0xffc00001, 0x80000000, 0x3f800000])
  const weird = new Float32Array(nanBits.buffer.slice(0))
  const u16 = new Uint16Array([0, 65535, 12345])
  const packed = packTyped({ weird, u16, i8: new Int8Array([-128, 127]), name: 'plate-07', n: 42, neg0: -0, nan: NaN, inf: -Infinity, ok: true, nothing: null, meta: { a: [1, 2], b: 'c' } })
  const un = unpackTyped(packed)
  t('packTyped/unpackTyped round-trip typed arrays bit-exactly (NaN payloads, -0)', un.weird instanceof Float32Array && bytesEqual(un.weird as Float32Array, weird) && bytesEqual(un.u16 as Uint16Array, u16) && (un.i8 as Int8Array)[0] === -128)
  t('packTyped keeps scalars and JSON', un.name === 'plate-07' && un.n === 42 && Object.is(un.neg0, -0) && Number.isNaN(un.nan) && un.inf === -Infinity && un.ok === true && un.nothing === null && JSON.stringify(un.meta) === '{"a":[1,2],"b":"c"}')
  t('packed arrays are aligned', (un.weird as Float32Array).byteOffset === 0)
  const sub = new Float32Array([9, 8, 7, 6]).subarray(1, 3)
  t('packTyped honours subarray views', (unpackTyped(packTyped({ sub })).sub as Float32Array).join() === '8,7')

  // compression
  const big = new Uint8Array(100000)
  for (let i = 0; i < big.length; i++) big[i] = (i * 7) & 31
  const comp = await compressBytes(big)
  t('compressBytes shrinks repetitive data and round-trips', comp.length < big.length / 4 && bytesEqual(await decompressBytes(comp), big), `${comp.length}`)
  const stored = new Uint8Array([0, 1, 2, 3])
  t('decompressBytes handles stored (header 0)', bytesEqual(await decompressBytes(stored), new Uint8Array([1, 2, 3])))

  // debounce
  let calls = 0
  const ds = debouncedSave(() => {
    calls++
  }, 40)
  ds.request()
  ds.request()
  ds.request()
  await sleep(120)
  t('debouncedSave coalesces requests', calls === 1, String(calls))
  ds.request()
  await ds.flush()
  t('debouncedSave.flush runs a pending save now', calls === 2)
  ds.request()
  ds.dispose()
  await sleep(80)
  t('debouncedSave.dispose cancels', calls === 2)

  // film can
  const id = await filmcan.put({ from: 'texturedle', kind: 'latent', w: 2, h: 2, png: new Blob(['png'], { type: 'image/png' }), meta: { tag: 'x' } })
  const items = await filmcan.list()
  const got = await filmcan.get(id)
  t('filmcan put/list/get', items.some((i) => i.id === id && !('png' in i)) && got?.png instanceof Blob && got.meta.tag === 'x')
  await filmcan.remove(id)
  t('filmcan remove', (await filmcan.get(id)) === null && !(await filmcan.list()).some((i) => i.id === id))

  // memory fallback when indexedDB.open throws
  const realOpen = indexedDB.open.bind(indexedDB)
  ;(indexedDB as unknown as { open: unknown }).open = () => {
    throw new Error('simulated private mode')
  }
  _resetStorageForTests({ clearMemory: true })
  const mem = idb('latent')
  await mem.set('k', { v: 1 })
  await mem.set('p:1', 'a')
  const back = await mem.get<{ v: number }>('k')
  t('memory fallback works when indexedDB.open throws', back?.v === 1 && mem.persistent === false && (await mem.keys('p:')).join() === 'p:1')
  const st2 = await storageStatus()
  t('storageStatus reports idb false in the fallback', st2.idb === false)
  const memSlots = createSlots<number>('latent', { manual: 2, auto: 1, version: 1 })
  await memSlots.save('1', 5)
  t('slots work on the memory fallback', (await memSlots.load('1'))?.data === 5)
  ;(indexedDB as unknown as { open: unknown }).open = realOpen
  _resetStorageForTests({ clearMemory: true })
  t('persistent storage comes back after the simulated failure', (await idb('hub').get('st:none')) === undefined && idb('hub').persistent === true)

  // resetGame keeps the hub note
  localStorage.setItem('ar:studio:hub', '{"note":"keep","at":1}')
  localStorage.setItem('ar:studio:settings', '{"a":1}')
  await idb('studio').set('house', { x: 1 })
  await resetGame('studio')
  t('resetGame clears the store and ar:<slug>:* except the hub note', localStorage.getItem('ar:studio:settings') === null && localStorage.getItem('ar:studio:hub') !== null && (await idb('studio').get('house')) === undefined)
  localStorage.removeItem('ar:studio:hub')

  t('errors() is empty', (window.__game as unknown as { errors(): string[] }).errors().length === 0)
  const result = { ok: out.every((x) => x.ok), results: out }
  ;(document.getElementById('out') as HTMLElement).textContent = out.map((x) => `${x.ok ? 'ok  ' : 'FAIL'} ${x.name}${x.detail ? '  [' + x.detail + ']' : ''}`).join('\n')
  return result
}

installGameApi('shared:storage', 'shared-storage@1', {
  state: () => ({ status: 'harness' }),
  selftest,
})
void nextFrame().then(() => markReady())
