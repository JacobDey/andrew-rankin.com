// @shared/fluid: tray shallow-water liquid. Pure TS (no three, no DOM).
// Facade for the games:
export { TrayFluid, sloshFrequency, wallSlapToGain } from './trayFluid'
export type { TrayFluidOptions, FluidStepReport, FluidSnapshot } from './trayFluid'
export { TrayBody } from './trayBody'
export type { TrayBodyOptions, AutoRockOptions } from './trayBody'
export { ScalarField } from './scalarField'
// Spike-level classes, ported unchanged (plus an optional per-cell floor on ShallowWater):
export { ShallowWater, EDGE_RIM, EDGE_SPOUT } from './shallowWater'
export type { ShallowWaterOptions } from './shallowWater'
export { TrayRig } from './trayRig'
export type { TrayRigOptions, TrayGravity, Clunk } from './trayRig'
export { FluidTray } from './fluidTray'
export type { FluidTrayOptions, Corner, PourState, TrayEvents, TrayStats, TraySnapshot } from './fluidTray'
export { PaperChem } from './paperChem'
export type { PaperOptions, Kinetics } from './paperChem'
export { latentFromLuminance, luminanceFromRGBA, testPattern } from './latent'
