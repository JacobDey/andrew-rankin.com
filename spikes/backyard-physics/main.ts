/**
 * Backyard physics spike: demo page. Wires the reusable core (PhysicsWorld, Grabber, Player,
 * InputController, createBackyard) to a renderer, a HUD and window.__spike test hooks.
 */
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three'
import { createBackyard, type Backyard } from './core/backyard'
import { Grabber, type HoldPose } from './core/grabber'
import { InputController } from './core/input'
import { PhysicsWorld, type BodyBinding } from './core/physics-world'
import { Player } from './core/player'
import { createTireSwing } from './core/props/swing'
import { QUALITY, autoQuality, isTouchDevice, type Quality } from './core/quality'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const params = new URLSearchParams(location.search)

interface SpikeApi {
  ready: boolean
  [k: string]: unknown
}
declare global {
  interface Window {
    __spike: SpikeApi
  }
}
window.__spike = { ready: false }

async function main(): Promise<void> {
  const quality: Quality = autoQuality()
  const touch = isTouchDevice()
  if (touch) document.body.classList.add('touch')
  ;($('quality') as HTMLSelectElement).value = quality.name

  // ------------------------------------------------------------------ renderer
  const canvas = $('view') as HTMLCanvasElement
  const renderer = new WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.62
  renderer.shadowMap.enabled = quality.shadowMapSize > 0
  // three r186 removed PCFSoftShadowMap; PCF + shadow.radius gives the soft edge.
  renderer.shadowMap.type = PCFShadowMap
  const scene = new Scene()
  const camera = new PerspectiveCamera(70, 1, 0.05, 1500)

  // ------------------------------------------------------------------ physics + scene
  const t0 = performance.now()
  const pw = await PhysicsWorld.create({ maxSubSteps: quality.maxSubSteps, solverIterations: quality.solverIterations })
  const tRapier = performance.now() - t0
  const cloth = params.get('cloth') === 'rapier' ? 'rapier' : 'verlet'
  const swingJoints = params.get('rope') === 'multibody' ? 'multibody' : 'impulse'
  const startHour = Number(params.get('t') ?? 16)
  const yard: Backyard = createBackyard(pw, scene, { quality, cloth, swingJoints, timeOfDay: startHour })
  const tBuild = performance.now() - t0 - tRapier

  if (params.has('paused')) pw.paused = true
  const grabber = new Grabber(pw, { mode: params.get('grab') === 'joint' ? 'joint' : 'spring' })
  const player = new Player(pw, yard.spawn.position, yard.spawn.yaw, {
    ignore: (c) => {
      const hb = grabber.heldBody
      return !!hb && c.parent()?.handle === hb.handle
    },
  })
  // The player's chest pushes the laundry (kinematic: no reaction impulse).
  const chest = { center: new Vector3(), radius: 0.28, body: null }
  yard.clothSpheres.push(chest)
  pw.onBeforeStep(() => {
    const t = player.body.translation()
    chest.center.set(t.x, t.y + 0.35, t.z)
  }, 'chest')

  // ------------------------------------------------------------------ interaction state
  const pointer = new Vector2() // CSS px of the active grab pointer
  let dragging = false // a pointer is directly dragging the held prop
  let carrying = false // held prop sticks to the view after a tap
  let pressAt = { x: 0, y: 0, t: 0 }
  let hovered: BodyBinding | null = null
  const ray = new Raycaster()
  const ndc = new Vector2()
  const origin = new Vector3()
  const dir = new Vector3()
  const camQ = new Quaternion()
  const pose: HoldPose = { orientation: new Quaternion(), stiffness: 160, damping: 22 }
  let raised = false

  const rayFrom = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect()
    ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    origin.copy(ray.ray.origin)
    dir.copy(ray.ray.direction)
  }
  const centerRay = () => {
    origin.copy(camera.position)
    dir.set(0, 0, -1).applyQuaternion(camera.quaternion)
  }

  const heldTag = () => grabber.held?.binding.tag ?? ''
  const hint = (text: string, ms = 2200) => {
    const el = $('hint')
    el.textContent = text
    el.classList.add('show')
    clearTimeout((hint as unknown as { t?: number }).t)
    ;(hint as unknown as { t?: number }).t = window.setTimeout(() => el.classList.remove('show'), ms)
  }

  function setRaised(on: boolean): void {
    raised = on && heldTag() === 'camera'
    const obj = yard.props.camera?.binding.object
    // Looking through the finder: the prop is at your eye, so don't draw it.
    if (obj) obj.visible = !raised
    updateButtons()
  }
  const startCarry = () => {
    carrying = true
    dragging = false
    if (heldTag() === 'camera') {
      grabber.setPose(pose)
      hint('Box camera in hand. C or Snap to shoot. G to put it down.')
    } else {
      grabber.setHoldDistance(Math.min(grabber.held?.distance ?? 1.4, 1.5))
      hint('Carrying. F or Throw to throw, G to drop.')
    }
    updateButtons()
  }
  const drop = (fling = false) => {
    grabber.setPose(null)
    grabber.setHandOverride(null)
    grabber.release(fling)
    carrying = false
    dragging = false
    setRaised(false)
  }
  const throwHeld = () => {
    if (!grabber.held) {
      // Nothing in hand: pick up what's under the crosshair.
      centerRay()
      if (grabber.grab(origin, dir, player.body)) startCarry()
      return
    }
    centerRay()
    dir.y += 0.12
    const m = grabber.held.mass
    // Light things fly further: ~9 m/s for the ball, slower for heavy props.
    const speed = Math.max(2.5, Math.min(11, 9 * Math.sqrt(0.5 / Math.max(0.3, m))))
    grabber.setPose(null)
    grabber.setHandOverride(null)
    grabber.throw(dir, speed)
    carrying = false
    dragging = false
    updateButtons()
  }

  // ------------------------------------------------------------------ input
  const input = new InputController(canvas, {
    press(x, y) {
      if (carrying) return 'look' // carrying: drags look around, buttons act
      rayFrom(x, y)
      const b = grabber.grab(origin, dir, player.body)
      if (!b) return 'look'
      pointer.set(x, y)
      pressAt = { x, y, t: performance.now() }
      dragging = true
      canvas.classList.add('grabbing')
      return 'grab'
    },
    drag(x, y) {
      pointer.set(x, y)
    },
    release(x, y) {
      canvas.classList.remove('grabbing')
      const quick = performance.now() - pressAt.t < 260 && Math.hypot(x - pressAt.x, y - pressAt.y) < 8
      if (quick && grabber.held) startCarry()
      else drop(true)
    },
    hover(x, y) {
      pointer.set(x, y)
    },
    pinch(d) {
      if (grabber.held && heldTag() !== 'camera') grabber.nudgeHoldDistance(d)
      else if (player.mode === 'orbit') player.zoom(d * 4)
    },
    key(code, down) {
      if (!down) return
      if (code === 'KeyF') throwHeld()
      else if (code === 'KeyG') drop(false)
      else if (code === 'KeyO') toggleMode()
      else if (code === 'KeyC') snap()
      else if (code === 'KeyE') setRaised(!raised)
      else if (code === 'KeyV') toggleWater()
      else if (code === 'KeyT') setClock(yard.timeOfDay + 1 > 21.5 ? 5.5 : yard.timeOfDay + 1)
      else if (code === 'KeyP') pw.paused = !pw.paused
      else if (code === 'KeyH' || code === 'Slash') ($('help') as HTMLDialogElement).showModal()
    },
  })

  // ------------------------------------------------------------------ HUD
  const sunInput = $('sun') as HTMLInputElement
  const clockOut = $('clock') as HTMLOutputElement
  const fmt = (h: number) => {
    const hh = Math.floor(h)
    const mm = Math.floor((h - hh) * 60)
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  const setClock = (h: number) => {
    yard.setTimeOfDay(h)
    sunInput.value = String(h)
    clockOut.textContent = fmt(h)
    // Eye adaptation, roughly: open up as the light fails.
    const s = yard.sunState
    renderer.toneMappingExposure = 0.55 + 0.9 * (1 - Math.min(1, s.skyIntensity * 1.15))
  }
  sunInput.addEventListener('input', () => setClock(Number(sunInput.value)))
  setClock(startHour)

  const toggleMode = () => {
    player.setMode(player.mode === 'walk' ? 'orbit' : 'walk')
    if (player.mode === 'orbit' && carrying) drop(false)
    camera.fov = player.mode === 'walk' ? 70 : 50
    camera.updateProjectionMatrix()
    yard.resize(canvas.clientHeight * renderer.getPixelRatio(), camera.fov)
    updateButtons()
  }
  const toggleWater = () => {
    yard.water = yard.water > 0 ? 0 : 1
    updateButtons()
  }
  const updateButtons = () => {
    $('btn-mode').textContent = player.mode === 'walk' ? 'Orbit' : 'Walk'
    $('btn-snap').hidden = heldTag() !== 'camera'
    $('btn-raise').hidden = heldTag() !== 'camera'
    $('btn-raise').textContent = raised ? 'Lower' : 'Raise'
    $('finder').classList.toggle('on', raised && heldTag() === 'camera')
    $('btn-throw').textContent = grabber.held ? 'Throw' : 'Pick up'
    $('btn-water').textContent = yard.water > 0 ? 'Water off' : 'Water on'
    $('crosshair').classList.toggle('on', player.mode === 'walk' && !raised && (carrying || input.locked || touch))
  }
  $('btn-mode').addEventListener('click', toggleMode)
  $('btn-throw').addEventListener('click', throwHeld)
  $('btn-snap').addEventListener('click', () => snap())
  $('btn-raise').addEventListener('click', () => setRaised(!raised))
  $('btn-water').addEventListener('click', toggleWater)
  $('btn-help').addEventListener('click', () => ($('help') as HTMLDialogElement).showModal())
  ;($('quality') as HTMLSelectElement).addEventListener('change', (e) => {
    const p = new URLSearchParams(location.search)
    p.set('q', (e.target as HTMLSelectElement).value)
    location.search = p.toString()
  })
  const jumpBtn = $('btn-jump')
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    input.buttons.jump = true
  })
  const runBtn = $('btn-run')
  runBtn.addEventListener('click', () => {
    input.buttons.run = !input.buttons.run
    runBtn.classList.toggle('on', input.buttons.run)
  })
  updateButtons()

  // ------------------------------------------------------------------ photo from the box camera
  const photoRT = new WebGLRenderTarget(512, 512, { samples: quality.antialias ? 4 : 0 })
  photoRT.texture.colorSpace = SRGBColorSpace
  const lensCam = new PerspectiveCamera(48, 1, 0.05, 1500)
  const lensPos = new Vector3()
  const lensQ = new Quaternion()
  const photoCanvas = document.createElement('canvas')
  photoCanvas.width = photoCanvas.height = 512
  let photos = 0
  const viewCam = new PerspectiveCamera(48, 1, 0.05, 1500)
  /** Put a camera at the box camera's lens (interpolated physics pose). */
  function lensPose(target: PerspectiveCamera): void {
    const cam = yard.props.camera
    if (!cam) return
    pw.interpolatedPose(cam.binding, lensPos, lensQ)
    target.position.copy(cam.lensOffset).applyQuaternion(lensQ).add(lensPos)
    target.quaternion.copy(lensQ)
    target.updateMatrixWorld()
  }
  function snap(): string | null {
    const cam = yard.props.camera
    if (!cam || heldTag() !== 'camera') {
      hint('Pick up the box camera first (it is on the picnic table).')
      return null
    }
    lensPose(lensCam)
    renderer.setRenderTarget(photoRT)
    renderer.render(scene, lensCam)
    renderer.setRenderTarget(null)
    const px = new Uint8Array(512 * 512 * 4)
    renderer.readRenderTargetPixels(photoRT, 0, 0, 512, 512, px)
    const ctx = photoCanvas.getContext('2d')!
    const img = ctx.createImageData(512, 512)
    // Flip Y; add a gentle box-camera vignette.
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const si = ((511 - y) * 512 + x) * 4
        const di = (y * 512 + x) * 4
        const dx = (x - 256) / 256
        const dy = (y - 256) / 256
        const v = 1 - 0.35 * Math.pow(Math.min(1, (dx * dx + dy * dy) / 1.6), 1.4)
        img.data[di] = px[si] * v
        img.data[di + 1] = px[si + 1] * v
        img.data[di + 2] = px[si + 2] * v
        img.data[di + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    const url = photoCanvas.toDataURL('image/jpeg', 0.88)
    ;($('photo') as HTMLImageElement).src = url
    $('photo-caption').textContent = `Backyard, ${fmt(yard.timeOfDay)}`
    const pol = $('polaroid')
    pol.hidden = false
    pol.style.animation = 'none'
    void pol.offsetWidth
    pol.style.animation = ''
    photos++
    return url
  }

  // ------------------------------------------------------------------ resize
  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    yard.resize(h * renderer.getPixelRatio(), camera.fov)
  }
  window.addEventListener('resize', resize)
  resize()

  // ------------------------------------------------------------------ frame loop
  let last = performance.now()
  let fpsAcc = 0
  let fpsN = 0
  let fps = 0
  let renderMsEma = 0
  let frameMsEma = 0
  let hoverTimer = 0
  const handLocal = new Vector3()
  const loop = (now: number) => {
    const frameDt = Math.min(0.1, (now - last) / 1000)
    last = now
    frameOnce(frameDt)
    fpsAcc += frameDt
    fpsN++
    if (fpsAcc > 0.5) {
      fps = fpsN / fpsAcc
      fpsAcc = 0
      fpsN = 0
      const s = pw.stats()
      $('stats').textContent = `${fps.toFixed(0)} FPS · PHYS ${s.stepTotalMs.toFixed(2)} MS · ${s.awake}/${s.dynamic} AWAKE · ${quality.name}`
    }
    requestAnimationFrame(loop)
  }

  function frameOnce(frameDt: number): void {
    const f0 = performance.now()
    const inp = input.consume()
    player.applyInput(inp)
    // Camera first (look is per frame), then aim the hand from it.
    player.applyToCamera(camera)
    camera.updateMatrixWorld()
    if (grabber.held) {
      if (dragging) {
        rayFrom(pointer.x, pointer.y)
        grabber.aim(origin, dir, frameDt)
      } else if (carrying) {
        if (heldTag() === 'camera') {
          // Hip carry, or raised to the eye with E (the viewfinder pose).
          handLocal.set(raised ? 0 : 0.17, raised ? -0.02 : -0.2, raised ? -0.14 : -0.42)
          camQ.copy(camera.quaternion)
          pose.orientation.copy(camQ)
          grabber.setHandOverride(handLocal.applyQuaternion(camQ).add(camera.position))
          centerRay()
          grabber.aim(origin, dir, frameDt)
        } else {
          centerRay()
          grabber.aim(origin, dir, frameDt)
        }
      }
      // Dropped something too far (e.g. walked away from a heavy prop): let go.
      const h = grabber.held
      if (h) {
        const t = h.binding.body.translation()
        if (Math.hypot(t.x - h.target.x, t.y - h.target.y, t.z - h.target.z) > 2.5) drop(false)
      }
    } else if (!touch && !input.locked) {
      hoverTimer += frameDt
      if (hoverTimer > 0.05) {
        hoverTimer = 0
        rayFrom(pointer.x, pointer.y)
        hovered = grabber.probe(origin, dir, player.body)
        canvas.classList.toggle('can-grab', !!hovered)
      }
    }
    pw.update(frameDt)
    yard.update(frameDt)
    // Re-apply the camera with the interpolated player position of this frame.
    player.applyToCamera(camera)
    const r0 = performance.now()
    if (raised && yard.props.camera && heldTag() === 'camera') {
      // Through the finder: the view IS the physical camera's pose, wobble and all.
      lensPose(viewCam)
      // Match the CSS finder square (min(62vh, 78vw)) to the photo's 48 deg square frame.
      const H = canvas.clientHeight
      const finderPx = Math.min(0.62 * H, 0.78 * canvas.clientWidth)
      viewCam.fov = (2 * Math.atan((Math.tan((24 * Math.PI) / 180) * H) / finderPx) * 180) / Math.PI
      viewCam.aspect = camera.aspect
      viewCam.updateProjectionMatrix()
      renderer.render(scene, viewCam)
    } else renderer.render(scene, camera)
    const r1 = performance.now()
    renderMsEma += (r1 - r0 - renderMsEma) * 0.05
    frameMsEma += (r1 - f0 - frameMsEma) * 0.05
  }

  // ------------------------------------------------------------------ test hooks
  const cssSize = () => [canvas.clientWidth, canvas.clientHeight]
  window.__spike = {
    ready: true,
    pw,
    yard,
    player,
    grabber,
    renderer,
    camera,
    scene,
    quality,
    timings: { rapierInitMs: +tRapier.toFixed(1), buildMs: +tBuild.toFixed(1) },
    state: () => {
      const s = pw.stats()
      const p = player.body.translation()
      return {
        ...s,
        stepMs: +s.stepMs.toFixed(3),
        stepTotalMs: +s.stepTotalMs.toFixed(3),
        fps: +fps.toFixed(1),
        renderMs: +renderMsEma.toFixed(2),
        frameMs: +frameMsEma.toFixed(2),
        clock: yard.timeOfDay,
        player: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        yaw: +player.yaw.toFixed(3),
        mode: player.mode,
        held: heldTag() || null,
        carrying,
        photos,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        ...yard.info(),
        ball: (() => {
          const b = yard.props.ball?.body.translation()
          return b ? [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] : null
        })(),
        tire: (() => {
          const b = yard.props.swing?.tire.body.translation()
          return b ? [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)] : null
        })(),
        fallenDominoes: yard.props.dominoes.filter((d) => {
          const r = d.body.rotation()
          return 1 - 2 * (r.x * r.x + r.z * r.z) < 0.7
        }).length,
      }
    },
    /** Advance n fixed steps synchronously and render one frame. */
    step: (n = 1) => {
      for (let i = 0; i < n; i++) pw.stepOnce()
      pw.syncVisuals(1)
      yard.update(n * pw.dt)
      player.applyToCamera(camera, 1)
      renderer.render(scene, camera)
      return pw.steps
    },
    /** Run n real frames through the normal loop body with a fixed dt. */
    frames: (n = 60, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) frameOnce(dt)
      return pw.steps
    },
    setTime: (h: number) => setClock(h),
    teleport: (x: number, y: number, z: number, yaw?: number, pitch?: number) => {
      player.teleport(x, y, z, yaw, pitch)
      player.applyToCamera(camera, 1)
    },
    look: (yaw: number, pitch: number) => {
      player.yaw = yaw
      player.pitch = pitch
    },
    orbit: (on: boolean, o?: { target?: [number, number, number]; distance?: number; yaw?: number; pitch?: number }) => {
      if ((player.mode === 'orbit') !== on) toggleMode()
      if (o?.target) player.orbit.target.set(...o.target)
      if (o?.distance) player.orbit.distance = o.distance
      if (o?.yaw !== undefined) player.orbit.yaw = o.yaw
      if (o?.pitch !== undefined) player.orbit.pitch = o.pitch
    },
    /** Grab at CSS pixel (x, y) like a pointer press; returns the tag or null. */
    grabAt: (x: number, y: number) => {
      player.applyToCamera(camera, 1)
      camera.updateMatrixWorld()
      rayFrom(x, y)
      const b = grabber.grab(origin, dir, player.body)
      if (b) {
        dragging = true
        pointer.set(x, y)
      }
      return b ? b.tag : null
    },
    /** Pick up whatever is under the screen centre and carry it. */
    pickUp: () => {
      throwHeld()
      return heldTag() || null
    },
    pickUpTag: (tag: string) => {
      const b = pw.findByTag(tag)[0]
      if (!b) return null
      const t = b.body.translation()
      centerRay()
      grabber.grabBinding(b, undefined, Math.min(1.3, origin.distanceTo(new Vector3(t.x, t.y, t.z))))
      startCarry()
      return heldTag()
    },
    moveHand: (x: number, y: number) => pointer.set(x, y),
    release: (fling = true) => drop(fling),
    throwHeld: () => throwHeld(),
    raise: (on = true) => setRaised(on),
    snap: () => {
      const u = snap()
      return u ? u.length : 0
    },
    toggleMode: () => toggleMode(),
    setWater: (w: number) => {
      yard.water = w
      updateButtons()
    },
    /** Throw the ball from the camera along the view. */
    throwBall: (speed = 9, upDeg = 6) => {
      const b = yard.props.ball
      if (!b) return false
      centerRay()
      const p = origin.clone().addScaledVector(dir, 0.6)
      b.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true)
      const d = dir.clone()
      d.y += Math.tan((upDeg * Math.PI) / 180)
      d.normalize().multiplyScalar(speed)
      b.body.setLinvel({ x: d.x, y: d.y, z: d.z }, true)
      b.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      pw.teleported(b)
      return true
    },
    pushSwing: (ix = 0, iy = 0, iz = -25) => {
      yard.props.swing?.push(ix, iy, iz)
    },
    knockDomino: (i = 0, strength = 0.25) => {
      const d = yard.props.dominoes[i]
      if (!d) return false
      const r = d.body.rotation()
      const fwd = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w))
      const t = d.body.translation()
      d.body.applyImpulseAtPoint({ x: fwd.x * strength, y: 0, z: fwd.z * strength }, { x: t.x, y: t.y + 0.12, z: t.z }, true)
      return true
    },
    /**
     * A/B the tire swing rope in a fresh, isolated world: 'multibody' vs 'impulse' joints.
     * Pushes the tyre with an impulse AND (separately) a force, then measures cost and stretch.
     */
    ropeBench: async (joints: 'multibody' | 'impulse', steps = 300, push: 'impulse' | 'force' = 'impulse') => {
      const w2 = await PhysicsWorld.create({ solverIterations: quality.solverIterations })
      const R = w2.R
      const tree = w2.addStatic([R.ColliderDesc.ball(0.1)], 0, 3.4, 0)
      w2.addStatic([R.ColliderDesc.cuboid(10, 0.5, 10)], 0, -0.5, 0)
      const g = new (scene.constructor as unknown as { new (): import('three').Scene })()
      const sw = createTireSwing(w2, g as unknown as import('three').Group, { anchor: new Vector3(0, 3.36, 0), anchorBody: tree, joints })
      w2.stepOnce()
      const tb = sw.tire.body
      if (push === 'impulse') tb.applyImpulse({ x: 0, y: 0, z: -30 }, true)
      else {
        tb.addForce({ x: 0, y: 0, z: -30 / w2.dt }, true)
        w2.stepOnce()
        tb.resetForces(true)
      }
      let maxStretch = 0
      let maxZ = 0
      const a = performance.now()
      for (let i = 0; i < steps; i++) {
        w2.stepOnce()
        const st = sw.stretch()
        if (st > maxStretch) maxStretch = st
        maxZ = Math.max(maxZ, Math.abs(tb.translation().z))
      }
      const ms = (performance.now() - a) / steps
      w2.dispose()
      return { joints, push, msPerStep: +ms.toFixed(3), maxStretchCm: +(maxStretch * 100).toFixed(2), maxSwingM: +maxZ.toFixed(2) }
    },
    /** Rapier's own profiler + per-hook timings over n steps. Mutates the sim. */
    profile: (n = 120) => pw.profile(n),
    /** Physics-only benchmark: n fixed steps, returns ms per step. Mutates the sim. */
    bench: (n = 300) => {
      const a = performance.now()
      let world = 0
      for (let i = 0; i < n; i++) {
        pw.stepOnce()
        world += pw.stats().stepMs
      }
      const total = (performance.now() - a) / n
      return { msPerStep: +total.toFixed(3), emaWorldStepMs: +(world / n).toFixed(3), awake: pw.stats().awake }
    },
    /** Render-only benchmark: n renders of the current frame. */
    renderBench: (n = 20) => {
      const gl = renderer.getContext()
      const a = performance.now()
      for (let i = 0; i < n; i++) renderer.render(scene, camera)
      gl.finish()
      return { msPerFrame: +((performance.now() - a) / n).toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }
    },
    /** Cost of a full snapshot + restore (Rapier world + registered external state). */
    snapshotBench: (n = 10) => {
      let tSnap = 0
      let tRestore = 0
      let bytes = 0
      for (let i = 0; i < n; i++) {
        const a = performance.now()
        const sn = pw.snapshot()
        const b = performance.now()
        pw.restore(sn)
        const c = performance.now()
        tSnap += b - a
        tRestore += c - b
        bytes = sn.data.length
      }
      return { snapshotMs: +(tSnap / n).toFixed(2), restoreMs: +(tRestore / n).toFixed(2), rapierBytes: bytes }
    },
    /** Snapshot -> run n -> hash; restore -> run n -> hash. Equal hashes = deterministic replay. */
    determinism: (n = 240) => {
      const snap0 = pw.snapshot()
      const bytes = snap0.data.length
      const ta = performance.now()
      for (let i = 0; i < n; i++) pw.stepOnce()
      const h1 = pw.hash()
      pw.restore(snap0)
      for (let i = 0; i < n; i++) pw.stepOnce()
      const h2 = pw.hash()
      return { h1, h2, same: h1 === h2, snapshotBytes: bytes, ms: +(performance.now() - ta).toFixed(1) }
    },
    css: cssSize,
    quality_presets: QUALITY,
  }

  $('loader').classList.add('gone')
  if (!sessionStorageGet('seen-help')) {
    hint(touch ? 'Left thumb walks, drag to look, tap a thing to pick it up.' : 'WASD to walk, drag to look, press and drag a thing to grab it.', 4500)
    sessionStorageSet('seen-help', '1')
  }
  requestAnimationFrame((t) => {
    last = t
    requestAnimationFrame(loop)
  })
}

function sessionStorageGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k)
  } catch {
    return null
  }
}
function sessionStorageSet(k: string, v: string): void {
  try {
    sessionStorage.setItem(k, v)
  } catch {
    /* private mode */
  }
}

main().catch((err) => {
  console.error(err)
  const l = $('loader')
  l.classList.add('error')
  l.textContent = `The film jammed. ${err instanceof Error ? err.message : String(err)}`
})
