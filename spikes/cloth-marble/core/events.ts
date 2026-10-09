// Probe events: the physics emits these; audio, haptics, HUD and the "Field
// Notes" evidence system consume them. Plain data, no callbacks, so physics
// stays deterministic and testable.

export type ProbeEventType =
  /** marble hit the surface hard enough to bounce (strength = normal speed mm/s) */
  | 'impact'
  /** small non-bouncing normal impulse while rolling: rattle (strength = mm/s) */
  | 'tick'
  /** marble hit the frame edge (strength = mm/s) */
  | 'wall'
  /** a cloth region broke static friction (strength = slipped mm summed this frame) */
  | 'slip'
  /** coarse cloth caught on a sharp peak (strength = snag field 0..1) */
  | 'snag'
  /** a snag tore free (strength = stretch at release, mm) */
  | 'snagRelease'

export interface ProbeEvent {
  type: ProbeEventType
  /** 'marble' or a cloth id */
  source: string
  x: number
  y: number
  strength: number
  /** simulation time (s) */
  t: number
  /** material tag under the event (recipe channel, e.g. rust weight 0..1) */
  tag?: number
}
