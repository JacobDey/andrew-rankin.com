# @shared/storage

IndexedDB and localStorage persistence behind one API. No three, hub-safe. Owner: shared-platform. Spec: `docs/architecture.md` §3.8 and §4.2.

One IndexedDB database `andrew-rankin` (version 1) with every store (`hub texturedle darkroom plates latent lensbench studio filmcan`) created in the single upgrade; localStorage keys are `ar:<slug>:<key>` holding JSON. Every call is wrapped in try/catch. If storage is unavailable (private mode, quota, `indexedDB.open` throws) or disabled by `?embed=poster` / `?fresh=1`, that store transparently becomes an in-memory store and `persistent` reports `false`: show the GDD's "saves won't stick" note when `persistent` is false.

## Use

```ts
import { idb, local, createSlots, debouncedSave, writeHubNote, resetGame, applyResetFlag } from '@shared/storage'

await applyResetFlag('darkroom')                  // honours ?reset=1: first thing in main.ts
const kv = idb('darkroom'); await kv.set('print:7', blob); const b = await kv.get<Blob>('print:7')
local('darkroom').set('settings', { captions: true }); local('darkroom').get('settings', {})
const pins = createSlots<Snapshot>('darkroom', { prefix: 'pin', manual: 6, auto: 1, version: 1, migrate })
await pins.autosave(snapshot, { thumb }); const hit = await pins.load('1')
const save = debouncedSave(() => persist(), 500); save.request()   // flushes on hidden and pagehide
writeHubNote('darkroom', '4 prints on the line')                   // <= 28 chars
```

## API

`DB_NAME` `DB_VERSION` `STORES` `StoreName`; `idb(store): KV` (`persistent get set del keys clear`); `local(slug): LocalStore`; `storageStatus()`; `resetGame(slug)`; `writeHubNote` / `readHubNote`; `createSlots`; `debouncedSave`; `compressBytes` / `decompressBytes`; `packTyped` / `unpackTyped`; `filmcan` (`put list get remove`).

## Additions and deviations

- Additive exports: `applyResetFlag(slug)` (clears saves when `?reset=1`) and `_resetStorageForTests({ clearMemory?, dbBroken? })` (drops cached connections; used by the dev page).
- **Slot keys.** `createSlots` stores `{ v, data }` at `${prefix}:${id}` and `SlotMeta` at `${prefix}meta:${id}`. Manual ids are `'1'..'n'`; auto ids are always `'auto:1'..'auto:k'` (so §3.8's `pin:auto` is `pin:auto:1` here; `load('auto')` is accepted as `'auto:1'`). `autosave` fills free auto slots, then overwrites the oldest. `savedAt` is strictly increasing within a page, so fast saves still order correctly.
- `resetGame(slug)` clears `ar:<slug>:*` **except** `ar:<slug>:hub` and the whole IndexedDB store (so `seenHelp` is cleared too). `local(slug).clear()` clears everything for that slug, including the hub note: prefer `resetGame`.
- `writeHubNote` does nothing when storage is disabled (poster, fresh). A note over 28 characters is cut to 27 plus an ellipsis.
- `packTyped` header: `'ARPK'` + u32 length + JSON + 8-byte aligned payloads. Typed arrays (any `ArrayBufferView`, subarrays included) round-trip bit-exactly; `unpackTyped` returns fresh, aligned copies. Numbers `NaN`, `+/-Infinity` and `-0` are preserved; other scalars and JSON go in the header.
- `compressBytes` stores a one-byte header (`1` gzip, `0` stored); `decompressBytes` throws if a gzip blob is read where `DecompressionStream` is missing.
- `filmcan` keys: `item:<id>` (full item) and `meta:<id>` (no PNG); `list()` is newest first; ids use `crypto.getRandomValues`, never `Math.random`.
- A mid-session failure (quota, closed connection) flips only that store to memory for the rest of the page; earlier data stays on disk.

## Acceptance

`/src/shared/storage/dev/`: `__game.selftest()` runs 44 checks (Blob, Float32Array and nested JSON round-trips, key prefixes, slots including migration and the auto ring, hub notes, bit-exact pack/unpack, compression, debounce, film can, `resetGame`, and the memory fallback with `indexedDB.open` patched to throw). All pass.

```
node scripts/shoot.mjs /src/shared/storage/dev/ --eval "__game.selftest().then(r => r.ok)"
```
