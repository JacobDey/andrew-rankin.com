// @shared/photo: the physically motivated still-photo renderer (three.js, WebGL2). See README.md and
// docs/architecture.md section 4.10.
export * from './spec.ts'
export type { CameraSpec as PhotoSpec } from './spec.ts'
export * from './sampling.ts'
export * from './film.ts'
export * from './latent.ts'
export { MotionRecorder } from './motion.ts'
export { PhotoRenderer, latentStats } from './PhotoRenderer.ts'
export type {
  PhotoScene,
  SubFrameInfo,
  CameraPose,
  CaptureOptions,
  CaptureProgress,
  CaptureResult,
  CaptureMeta,
  LatentStats,
  PhotoCaps,
  ShutterProfile,
  PhotoEmitter,
  Exposure,
} from './PhotoRenderer.ts'
export { FinderPreview } from './finder.ts'
export { photoSpecFromProfile } from './bridge.ts'
export { selftest } from './selftest.ts'
export type { Check } from './selftest.ts'
