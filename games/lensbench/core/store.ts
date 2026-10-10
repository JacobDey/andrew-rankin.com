// App state, rolls and frames, persistence (lensbench.md §8, architecture §3.8).
import { idb, local, debouncedSave, type KV, type LocalStore } from '@shared/storage'
import { storageDisabled } from '@shared/core'
import { loadPreset } from '@shared/optics'
import { BODIES } from './catalog'
import type { AppState, CameraSpec, DevelopedFrame, FrameRecord, LatentImage, Progress, RollRecord, ShotRecord } from './types'

export function defaultCamera(): CameraSpec {
  return { v: 1, name: 'Pinhole tin', lens: loadPreset('pinhole'), body: 'tin', shutter: 'cap', stock: 'pan100', filter: 'none' }
}
export function defaultProgress(): Progress {
  return { v: 1, onboarded: false, spareKey: false, unlocked: [], tags: {}, accidents: {}, textSeed: 1, settings: { audio: true, haptics: true, quality: 'auto' } }
}
function defaultState(): AppState {
  return {
    place: 'bench', camera: defaultCamera(), ext: 0, fNumber: 224, shutterS: 0, timeOfDay: 13, worldT: 0, frozen: false,
    standpoint: 'shopStep', pos: [-24, 1.6, 5.4], yaw: (-84 * Math.PI) / 180, pitch: (2 * Math.PI) / 180, tripod: true, mirrorLocked: false,
    rollId: null, cocked: true, progress: defaultProgress(), selectedFrame: null,
  }
}

type Key = keyof AppState | '*' | 'frames'
let uid = 0
const newId = (p: string) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`

export interface Store {
  get(): AppState
  set(p: Partial<AppState>): void
  on(k: Key, fn: () => void): () => void
  fire(shot: ShotRecord, multiple: boolean): FrameRecord
  advance(): void
  rewind(): RollRecord | null
  // extras
  rolls: Map<string, RollRecord>
  frames: Map<string, FrameRecord>
  latents: Map<string, LatentImage>
  developed: Map<string, DevelopedFrame>
  roll(): RollRecord | null
  used(): number
  setLatent(id: string, l: LatentImage, meta: FrameRecord['meta']): void
  setDeveloped(rollId: string, dev: RollRecord['dev']): void
  frameList(): FrameRecord[]
  emit(k: Key): void
  load(): Promise<void>
  save(): void
  flush(): Promise<void>
  reset(): Promise<void>
  readonly persistent: boolean
}

export function createStore(): Store {
  let state = defaultState()
  const subs = new Map<Key, Set<() => void>>()
  const rolls = new Map<string, RollRecord>()
  const frames = new Map<string, FrameRecord>()
  const latents = new Map<string, LatentImage>()
  const developed = new Map<string, DevelopedFrame>()
  let kv: KV | null = null
  let ls: LocalStore | null = null
  const disabled = storageDisabled()
  try { if (!disabled) { kv = idb('lensbench'); ls = local('lensbench') } } catch { kv = null; ls = null }
  const dirty = new Set<string>()

  const emit = (k: Key) => {
    subs.get(k)?.forEach((f) => { try { f() } catch (e) { console.debug('[lensbench] sub', e) } })
    if (k !== '*') subs.get('*')?.forEach((f) => { try { f() } catch (e) { console.debug('[lensbench] sub', e) } })
  }
  const writer = debouncedSave(async () => {
    if (!ls || !kv) return
    try {
      ls.set('progress', state.progress)
      ls.set('camera', { camera: state.camera, ext: state.ext, N: state.fNumber, t: state.shutterS })
      ls.set('street', { timeOfDay: state.timeOfDay, standpoint: state.standpoint, pos: state.pos, yaw: state.yaw, pitch: state.pitch, tripod: state.tripod, rollId: state.rollId, cocked: state.cocked })
      for (const id of [...dirty]) {
        dirty.delete(id)
        if (id.startsWith('roll:')) { const r = rolls.get(id.slice(5)); if (r) await kv.set(id, r) }
        else if (id.startsWith('frame:')) {
          const f = frames.get(id.slice(6))
          if (f) {
            const l = latents.get(f.id)
            await kv.set(id, { record: { ...f, shots: f.shots.map((s) => ({ ...s, track: Array.from(s.track), aimNoShake: Array.from(s.aimNoShake) })) }, latent: l ? { ...l, data: l.data } : null })
          }
        }
      }
      // keep the newest 60 frames
      if (frames.size > 60) {
        const old = [...frames.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(0, frames.size - 60)
        for (const f of old) { frames.delete(f.id); latents.delete(f.id); developed.delete(f.id); await kv.del(`frame:${f.id}`) }
      }
    } catch (e) { console.debug('[lensbench] save failed', e) }
  }, 500)

  const store: Store = {
    get: () => state,
    set(p) {
      state = { ...state, ...p }
      for (const k of Object.keys(p) as (keyof AppState)[]) emit(k)
      writer.request()
    },
    on(k, fn) {
      let s = subs.get(k)
      if (!s) { s = new Set(); subs.set(k, s) }
      s.add(fn)
      return () => s?.delete(fn)
    },
    rolls, frames, latents, developed,
    roll: () => (state.rollId ? rolls.get(state.rollId) ?? null : null),
    used: () => store.roll()?.frames.length ?? 0,
    fire(shot, multiple) {
      let roll = store.roll()
      const body = BODIES[state.camera.body]
      if (roll && (roll.stock !== state.camera.stock || roll.body !== state.camera.body)) { store.rewind(); roll = null }
      if (!roll || roll.state !== 'loaded') {
        roll = { id: newId('r'), stock: state.camera.stock, body: state.camera.body, capacity: body.frames, frames: [], state: 'loaded' }
        rolls.set(roll.id, roll)
        state = { ...state, rollId: roll.id, cocked: true }
      }
      let frame: FrameRecord | undefined
      const lastId = roll.frames[roll.frames.length - 1]
      if ((multiple || !state.cocked) && lastId) frame = frames.get(lastId)
      if (frame && frame.status === 'exposed') {
        frame.shots.push(shot)
      } else if (frame && frame.status !== 'exposed') {
        frame.shots.push(shot); frame.status = 'exposed'; latents.delete(frame.id)
      } else {
        frame = { id: newId('f'), rollId: roll.id, index: roll.frames.length + 1, shots: [shot], status: 'exposed' }
        frames.set(frame.id, frame)
        roll.frames.push(frame.id)
      }
      dirty.add(`roll:${roll.id}`); dirty.add(`frame:${frame.id}`)
      state = { ...state, cocked: false }
      emit('frames'); emit('cocked'); emit('rollId')
      writer.request()
      return frame
    },
    advance() {
      const roll = store.roll()
      if (roll && roll.frames.length >= roll.capacity) { store.rewind() }
      state = { ...state, cocked: true }
      emit('cocked'); writer.request()
    },
    rewind() {
      const roll = store.roll()
      if (!roll) return null
      if (roll.frames.length === 0) { rolls.delete(roll.id); state = { ...state, rollId: null, cocked: true }; emit('rollId'); return null }
      roll.state = 'rewound'
      dirty.add(`roll:${roll.id}`)
      state = { ...state, rollId: null, cocked: true }
      emit('rollId'); emit('frames'); writer.request()
      return roll
    },
    setLatent(id, l, meta) {
      const f = frames.get(id)
      if (!f) return
      latents.set(id, l)
      f.status = f.status === 'developed' ? 'developed' : 'rendered'
      f.meta = meta
      dirty.add(`frame:${id}`)
      emit('frames'); writer.request()
    },
    setDeveloped(rollId, dev) {
      const r = rolls.get(rollId)
      if (!r) return
      r.state = 'developed'; r.dev = dev
      for (const fid of r.frames) { const f = frames.get(fid); if (f) { f.status = 'developed'; dirty.add(`frame:${fid}`) } }
      dirty.add(`roll:${rollId}`)
      emit('frames'); writer.request()
    },
    frameList: () => [...frames.values()].sort((a, b) => (a.rollId === b.rollId ? a.index - b.index : a.id.localeCompare(b.id))),
    emit,
    async load() {
      if (!ls || !kv) return
      try {
        const pr = ls.get<Progress | null>('progress', null)
        if (pr && pr.v === 1) state.progress = { ...defaultProgress(), ...pr }
        const cam = ls.get<{ camera: CameraSpec; ext: number; N: number; t: number } | null>('camera', null)
        if (cam && cam.camera && cam.camera.v === 1 && cam.camera.lens) state = { ...state, camera: cam.camera, ext: cam.ext || 0, fNumber: cam.N || 8, shutterS: cam.t ?? 0 }
        const st = ls.get<Partial<AppState> | null>('street', null)
        if (st) state = { ...state, ...(st as Partial<AppState>) }
        for (const k of await kv.keys('roll:')) { const r = await kv.get<RollRecord>(k); if (r) rolls.set(r.id, r) }
        for (const k of await kv.keys('frame:')) {
          const rec = await kv.get<{ record: FrameRecord & { shots: (ShotRecord & { track: number[]; aimNoShake: number[] })[] }; latent: LatentImage | null }>(k)
          if (!rec) continue
          const f: FrameRecord = { ...rec.record, shots: rec.record.shots.map((s) => ({ ...s, track: Float32Array.from(s.track), aimNoShake: Float32Array.from(s.aimNoShake) })) }
          frames.set(f.id, f)
          if (rec.latent) latents.set(f.id, { ...rec.latent, data: new Uint8Array(rec.latent.data) })
          else if (f.status !== 'exposed') f.status = 'exposed'
        }
        if (state.rollId && !rolls.has(state.rollId)) state = { ...state, rollId: null, cocked: true }
      } catch (e) { console.debug('[lensbench] load failed', e) }
    },
    save: () => writer.request(),
    flush: () => writer.flush(),
    async reset() {
      rolls.clear(); frames.clear(); latents.clear(); developed.clear()
      state = defaultState()
      try { ls?.clear(); await kv?.clear() } catch { /* ignore */ }
      emit('*'); emit('frames')
    },
    get persistent() { return !!kv && kv.persistent },
  }
  return store
}
