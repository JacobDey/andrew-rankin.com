// window.__game for Sunny 16 (studio.md §13.1, architecture §3.7).
import * as THREE from 'three'
import { sunPosition, daylightStudio, moonPosition } from '@shared/sun'
import type { Engine } from '../core/engine'
import type { Physics } from '../core/physics'
import type { Store } from '../core/store'
import type { Hud } from '../hud/hud'
import type { Rooms } from '../core/rooms'
import type { YardModule } from '../yard/yard'
import type { CameraApi } from '../camera/camera'
import type { Workshop } from '../camera/workshop'
import type { Darkroom, PrintRecord } from '../darkroom/darkroom'
import type { Hall } from '../house/hall'
import type { Postcards } from '../house/postcards'
import type { House } from '../house/architecture'
import type { CameraBuild, CameraSettings, PrintMeta, RoomId, ShotRecord } from '../core/contracts'
import { PRESETS, dropTime } from '../camera/spec'
import { DAY_OF_YEAR, LAT } from '../core/engine'

interface Parts { e: Engine; ph: Physics; store: Store; hud: Hud; rooms: Rooms; yard: YardModule; camera: CameraApi; workshop: Workshop; darkroom: Darkroom; hall: Hall; postcards: Postcards; house: House }

export function buildTestApi(p: Parts) {
  const { e, ph, store, rooms, yard, camera, darkroom, hall, postcards, house } = p
  const parseTime = (h: number | string) => {
    if (typeof h === 'number') return h
    const [a, b] = h.split(':').map(Number)
    return a + (b || 0) / 60
  }
  const records = new Map<string, ShotRecord>()
  e.bus.on('shot', ({ record }) => records.set(record.id, record))
  return {
    state() {
      const r = camera.roll()
      return {
        room: rooms.current as RoomId,
        day: e.day.hours,
        sun: { ...e.sun(), dir: e.sun().dir.toArray(), moonDir: e.sun().moonDir.toArray() },
        camera: camera.spec(),
        settings: { ...camera.settings },
        roll: r,
        pocket: store.house.pocket.length,
        postcards: postcards.states(),
        prints: store.house.prints.length,
        fps: Math.round(e.fps),
        drawCalls: e.renderer.info.render.calls,
        tris: e.renderer.info.render.triangles,
        awakeBodies: ph.awake(),
        simT: e.sim.t,
        dot: yard.dot.state(),
        swingAngle: yard.swing.angle(),
        sprinkler: yard.sprinkler.on,
        drops: yard.sprinkler.aliveAt(e.sim.t),
        finder: camera.finderOn,
        fridge: store.house.fridge,
        owned: store.house.owned,
      }
    },
    async poster() {
      // hero: overview at 18:45, roof lifted, swing mid-arc, sprinkler on, lantern lit, basement glowing
      e.day.set(18.75, 'api')
      yard.swing.pull(0.45)
      yard.sprinkler.set(true)
      yard.lantern.set(0.3, 0.15, 0, 0.4)
      camera.finder(false)
      await rooms.go('overview', { instant: true })
      house.setRoofLifted(true, true)
      p.hud.setHidden(true)
      e.step(1200)
      e.snapExposure()
      e.render()
    },
    seed(n: number) {
      void n // the seed is fixed at boot (?seed=N); streams are per subsystem
    },
    setQuality(q: string) {
      void q
    },
    pause() {
      e.paused = true
    },
    resume() {
      e.paused = false
    },
    step(ms: number) {
      e.step(ms)
    },
    async goto(room: RoomId) {
      camera.finder(false)
      await rooms.go(room, { instant: true })
      e.step(16)
    },
    view(name: string) {
      if (name === 'overview') void rooms.go('overview', { instant: true })
      else if (name.startsWith('yard')) {
        if (rooms.current !== 'yard') void rooms.go('yard', { instant: true })
        yard.setView(name as 'yard-wide' | 'yard-rainbow' | 'yard-lantern')
      } else void rooms.go(name as RoomId, { instant: true })
      e.step(16)
    },
    setTime(h: number | string) {
      e.day.set(parseTime(h), 'api')
      e.snapExposure()
    },
    toy(id: string, action: string, arg?: unknown) {
      if (id === 'swing' && action === 'pull') yard.swing.pull(Number(arg ?? 0.5))
      else if (id === 'sprinkler') yard.sprinkler.set(action !== 'off')
      else if (id === 'lantern' && action === 'knot') yard.lantern.setKnot(Number(arg))
      else if (id === 'lantern' && action === 'push') {
        const [a, b] = (arg as [number, number]) ?? [0.4, 0.1]
        yard.lantern.set(a, b, 0, 0)
      } else if (id === 'lantern' && action === 'gel') yard.lantern.setGel(Number(arg ?? 1))
      else if (id === 'whirligig') yard.whirligig.poke()
      else if (id === 'dot' && action === 'sit') yard.dot.sit(Number(arg ?? 3))
    },
    throwBall(from: [number, number, number], vel: [number, number, number]) {
      const b = yard.props.ball.body
      b.setTranslation({ x: from[0], y: from[1], z: from[2] }, true)
      b.setLinvel({ x: vel[0], y: vel[1], z: vel[2] }, true)
      yard.props.ball.prevPos.set(from[0], from[1], from[2])
    },
    poke(name: string) {
      const b = yard.byName(name)
      if (b) b.body.applyImpulse({ x: 0, y: Math.min(1.5, 4 * b.mass), z: 0.3 }, true)
      if (name === 'whirligig') yard.whirligig.poke()
    },
    build(preset: 'pinhole' | 'box' | 'field' | 'portrait' | CameraBuild) {
      const b = typeof preset === 'string' ? PRESETS[preset] : preset
      return camera.setBuild({ ...b, accessories: [...b.accessories] })
    },
    unlockAll() {
      postcards.unlockAll()
    },
    placeTripod(pos: [number, number], yawDeg: number, pitchDeg: number, height?: number) {
      camera.placeTripod(pos, yawDeg, pitchDeg, height)
    },
    aim(target: [number, number, number]) {
      camera.aim(target)
    },
    handheld(on: boolean) {
      camera.setHandheld(on)
    },
    settings(s: Partial<CameraSettings>) {
      camera.set(s)
    },
    finder(on: boolean) {
      if (on && rooms.current !== 'yard') void rooms.go('yard', { instant: true })
      camera.finder(on)
      e.step(16)
    },
    async shoot(o?: { bulbSeconds?: number; noWind?: boolean }) {
      if (!camera.roll()) camera.loadFilm()
      return camera.shoot(o)
    },
    wind() {
      camera.wind()
    },
    unload() {
      return camera.unload()
    },
    develop(rollId?: string, o?: { tempC?: number; push?: number; cueRatio?: number }) {
      return darkroom.develop(rollId, o)
    },
    print(frameId: string, o?: { lampS?: number; grade?: number; kind?: 'contact' | 'enlargement' }) {
      return darkroom.print(frameId, o)
    },
    pin(printId: string, slot?: number) {
      hall.pin(printId, slot)
    },
    mail(printId: string, postcardId: string) {
      return postcards.mail(printId, postcardId, { instant: true })
    },
    async photos() {
      const prints: PrintMeta[] = []
      for (const id of store.house.prints) {
        const pr = await store.get<PrintRecord>('print:' + id)
        if (pr) prints.push(pr.meta)
      }
      return { frames: [...records.values()], prints }
    },
    printPixels(printId: string) {
      return darkroom.printPixels(printId)
    },
    evaluate(postcardId: string, rec: ShotRecord) {
      return postcards.evaluate(postcardId, rec)
    },
    calib() {
      const noon = sunPosition(DAY_OF_YEAR, LAT, 13, { clockOffsetH: 1 })
      const dl = daylightStudio(noon, moonPosition(noon))
      const L = (0.18 * dl.horizLux) / Math.PI
      const ev = Math.log2((L * 100) / 12.5)
      const f = 100
      const pin = Math.sqrt(2.44 * 0.00055 * f)
      const drop = dropTime(40, 6.8) * 1000
      const swingPeriod = 2 * Math.PI * Math.sqrt(yard.swing.L / 9.81)
      return {
        sunNoonElev: noon.elevDeg, ev100Noon: ev, pinholeOptMm: pin, dropT40cm: drop, swingPeriod,
        noonEvOk: Math.abs(ev - 15.4) <= 0.4, pinholeOk: Math.abs(pin - 0.37) <= 0.01, dropOk: Math.abs(drop - 9.6) <= 0.3, swingOk: Math.abs(swingPeriod - 3.11) <= 0.1,
        sunOk: Math.abs(noon.elevDeg - 57.4) <= 0.3,
      }
    },
    async resetSave() {
      await store.clear()
    },
    /** measure the swing period over 3 swings (calibration helper) */
    measureSwing() {
      yard.swing.pull(0.2)
      const ys: number[] = []
      let prev = yard.swing.body.body.linvel().x
      let crossings = 0
      const t0 = e.sim.t
      let tFirst = 0
      while (crossings < 7 && e.sim.t - t0 < 20) {
        e.sim.advance(1 / 120)
        const v = yard.swing.body.body.linvel().x
        if (prev < 0 && v >= 0) {
          crossings++
          if (crossings === 1) tFirst = e.sim.t
          ys.push(e.sim.t)
        }
        prev = v
      }
      return ys.length >= 4 ? (ys[3] - tFirst) / 3 : NaN
    },
    vec: (x: number, y: number, z: number) => new THREE.Vector3(x, y, z),
  }
}
