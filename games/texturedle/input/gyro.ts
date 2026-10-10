// "Hold like a loupe" (texturedle.md §4, SHOULD): phone tilt, opt-in from a tap.
// 5:1 reduction (25° of phone gives 5° of stage), low-pass α = 0.15, calibrated
// to the pose at enable time. iOS asks permission inside the tap.

export interface Gyro { enable(): Promise<boolean>; disable(): void; readonly on: boolean; recalibrate(): void }

export function createGyro(onTilt: (x: number, y: number) => void): Gyro {
  let on = false
  let b0: number | null = null
  let g0 = 0
  let fx = 0, fy = 0
  const handler = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return
    if (b0 === null) { b0 = e.beta; g0 = e.gamma }
    let x = (e.gamma - g0) / 5
    let y = -(e.beta - b0) / 5
    const l = Math.hypot(x, y)
    if (l > 5) { x *= 5 / l; y *= 5 / l }
    fx += (x - fx) * 0.15
    fy += (y - fy) * 0.15
    onTilt(fx, fy)
  }
  return {
    get on() { return on },
    async enable() {
      const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
      try {
        if (D && typeof D.requestPermission === 'function') {
          const r = await D.requestPermission()
          if (r !== 'granted') return false
        }
      } catch { return false }
      if (typeof window.DeviceOrientationEvent === 'undefined') return false
      b0 = null
      window.addEventListener('deviceorientation', handler)
      on = true
      return true
    },
    disable() { window.removeEventListener('deviceorientation', handler); on = false; onTilt(0, 0) },
    recalibrate() { b0 = null },
  }
}
