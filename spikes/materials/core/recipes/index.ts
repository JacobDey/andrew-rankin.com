// id -> GLSL recipe source. Every recipe defines `Surface surface(vec2 uv)`.
import { RUSTY_MAILBOX, BRUSHED_ALUMINUM, CAST_IRON, GALVANIZED } from './metal'
import { ORANGE_PEEL, STRAWBERRY } from './food'
import { BRICK } from './stone'
import { CONCRETE, ASPHALT, TERRACOTTA, BEACH_SAND, GRANITE, MARBLE, POPCORN, CRACKED_MUD, FROST_GLASS } from './mineral'
import { GOLF_BALL, BASKETBALL, PEELING_PAINT, SPONGE, STYROFOAM, TOY_BRICK, VINYL, SANDPAPER } from './polymer'
import { DENIM, WOOL_KNIT, CORDUROY, BURLAP } from './textile'
import { OAK_BARK, BIRCH_BARK, CORK, LEATHER, MOSS_STONE, LEAF } from './organic'

/**
 * A recipe is either one GLSL string defining `Surface surface(vec2 uv)`, or a multi-pass recipe:
 * `fields` are separate programs each defining `vec4 field(vec2 uv)`, baked to float targets
 * first (field i may read fields 0..i-1); `surface` then reads them all at its own pixel with
 * F0() .. F3(). Fields are exact float32, so a split recipe matches its single-pass form. Split a recipe when it
 * needs more than ~25 noise calls (see NOTES.md, "Compile cost").
 */
export type RecipeDef = string | { fields: string[]; surface: string }

export const RECIPES: Record<string, RecipeDef> = {
  'rusty-mailbox': RUSTY_MAILBOX,
  'orange-peel': ORANGE_PEEL,
  'basketball': BASKETBALL,
  'oak-bark': OAK_BARK,
  'birch-bark': BIRCH_BARK,
  'concrete-sidewalk': CONCRETE,
  'asphalt': ASPHALT,
  'brick': BRICK,
  'terracotta-pot': TERRACOTTA,
  'leather-wallet': LEATHER,
  'denim': DENIM,
  'wool-knit': WOOL_KNIT,
  'corduroy': CORDUROY,
  'burlap': BURLAP,
  'cork-board': CORK,
  'sandpaper': SANDPAPER,
  'beach-sand': BEACH_SAND,
  'granite-countertop': GRANITE,
  'marble-slab': MARBLE,
  'brushed-aluminum': BRUSHED_ALUMINUM,
  'cast-iron-pan': CAST_IRON,
  'galvanized-steel': GALVANIZED,
  'peeling-paint': PEELING_PAINT,
  'popcorn-ceiling': POPCORN,
  'moss-on-stone': MOSS_STONE,
  'leaf': LEAF,
  'strawberry': STRAWBERRY,
  'sponge': SPONGE,
  'styrofoam': STYROFOAM,
  'cracked-mud': CRACKED_MUD,
  'frost-glass': FROST_GLASS,
  'toy-brick': TOY_BRICK,
  'vinyl-record': VINYL,
  'golf-ball': GOLF_BALL,
}
