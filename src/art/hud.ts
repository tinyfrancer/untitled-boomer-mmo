import { compileSprite, frameKey, variantId, type CompiledFrame } from './compile';
import type { SpriteDef } from './format';
import { ICON_SPRITES } from './icons';
import {
  BUTTON,
  BUTTON_DOWN,
  BUTTON_OFF,
  BUTTON_RIM,
  PANEL,
  ROW,
  SLOT,
  type FrameAccent,
} from './sprites/frames';

/**
 * What the HUD is drawn with (B8, decision 111): its frames and its icons, as
 * the pictures the page hangs them by. The HUD is HTML, so these reach it as
 * images (`hud/hudArt.ts` writes each onto a canvas once a page), and nothing
 * here knows a page exists: it is the art's side of the bargain, compiled the
 * way the world's sprites are and tested the same.
 */

/** A frame, and how far in from each side the page cuts it. */
export interface HudFrame {
  sprite: string;
  /** Art pixels, which the HUD draws one to a CSS pixel. */
  slice: number;
}

const frame = (def: SpriteDef, slice: number, variant?: string): HudFrame => ({
  sprite: variant ? variantId(def.id, variant) : def.id,
  slice,
});

const PANEL_SLICE = 8;
const BUTTON_SLICE = 3;

/** Every frame the stylesheet can name, each a custom property of its own. */
export const HUD_FRAMES = {
  panel: frame(PANEL, PANEL_SLICE),
  'panel-gold': frame(PANEL, PANEL_SLICE, 'gold'),
  'panel-arcane': frame(PANEL, PANEL_SLICE, 'arcane'),
  'panel-purple': frame(PANEL, PANEL_SLICE, 'purple'),
  'panel-green': frame(PANEL, PANEL_SLICE, 'green'),
  'panel-fire': frame(PANEL, PANEL_SLICE, 'fire'),
  'panel-yellow': frame(PANEL, PANEL_SLICE, 'yellow'),
  'panel-red': frame(PANEL, PANEL_SLICE, 'red'),
  button: frame(BUTTON, BUTTON_SLICE),
  'button-down': frame(BUTTON_DOWN, BUTTON_SLICE),
  'button-off': frame(BUTTON_OFF, BUTTON_SLICE),
  'button-armed': frame(BUTTON, BUTTON_SLICE, 'armed'),
  'button-arcane': frame(BUTTON_RIM, BUTTON_SLICE, 'arcane'),
  'button-gold': frame(BUTTON_RIM, BUTTON_SLICE, 'gold'),
  'button-red': frame(BUTTON_RIM, BUTTON_SLICE, 'red'),
  row: frame(ROW, 1),
  slot: frame(SLOT, 1),
} as const satisfies Record<string, HudFrame>;

export type HudFrameName = keyof typeof HUD_FRAMES;

/** The panel a counter's accent names. */
export function accentPanel(accent: FrameAccent | null): HudFrameName {
  return accent ? `panel-${accent}` : 'panel';
}

/** Every sprite the HUD draws, which `sprites.test.ts` holds as it holds the world's. */
export const HUD_SPRITES: readonly SpriteDef[] = [
  PANEL,
  BUTTON,
  BUTTON_DOWN,
  BUTTON_OFF,
  BUTTON_RIM,
  ROW,
  SLOT,
  ...ICON_SPRITES,
];

/**
 * A frame's picture, compiled as the world compiles a sprite, in the open's
 * light (only the ground changes with the setting, and the HUD draws none).
 */
export function framePicture(name: HudFrameName): CompiledFrame {
  const { sprite } = HUD_FRAMES[name];
  const [base] = sprite.split('@');
  const def = HUD_SPRITES.find(({ id }) => id === base);
  if (!def) throw new Error(`no frame is drawn as ${sprite}`);
  const key = frameKey(sprite, 'still', null, 0);
  const picture = compileSprite(def, 'open').find((compiled) => compiled.key === key);
  if (!picture) throw new Error(`${sprite} has no still`);
  return picture;
}

/** Every icon's picture, each variant one of its own, for the page to pack onto one sheet. */
export function iconFrames(): CompiledFrame[] {
  return ICON_SPRITES.flatMap((def) => compileSprite(def, 'open'));
}
