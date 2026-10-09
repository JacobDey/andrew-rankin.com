// Public surface of the photo-render core. Lift this folder into src/shared/photo/ as-is.
export * from './spec.ts'
export * from './sampling.ts'
export * from './film.ts'
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
} from './PhotoRenderer.ts'
