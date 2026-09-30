import { TILE_SIZE } from '../config/constants';

/**
 * How much animation each kind of sprite may have, fixed in advance.
 *
 * Animation is where drawing by hand creeps: one more frame in a walk looks
 * better, and then every figure owes it in four directions and every armour
 * layer owes it again. So the counts are decided once, here, per kind, and
 * `sprites.test.ts` holds every sprite to them exactly: a walk has four frames,
 * not three and not five. The timing lives here too, which is what lets the
 * renderer play any creature's walk on one clock without asking the creature.
 */

/** The size of a tile in art pixels (decision 100), and the unit of every sprite. */
export const TILE_PIXELS = 32;

/**
 * How many simulation units an art pixel covers: two, a tile being 64 of those
 * and 32 of these. Nothing in the simulation changes for the art; this is the
 * one place the two are related.
 */
export const ART_PIXEL = TILE_SIZE / TILE_PIXELS;

export type SpriteKind =
  'tile' | 'scatter' | 'mark' | 'person' | 'beast' | 'prop' | 'effect' | 'icon' | 'frame';

export const SPRITE_KINDS: readonly SpriteKind[] = [
  'tile',
  'scatter',
  'mark',
  'person',
  'beast',
  'prop',
  'effect',
  'icon',
  'frame',
];

export type AnimationId =
  // One frame that stands for the thing: a tile, a node, an icon.
  | 'still'
  // A node that has been taken: a stump, a worked-out vein.
  | 'spent'
  // Something that moves on its own and never stops: water, a fire.
  | 'loop'
  // A one-off effect, played through once.
  | 'play'
  | 'idle'
  | 'walk'
  | 'attack'
  | 'cast'
  | 'shoot'
  | 'hurt'
  | 'death';

export interface AnimationBudget {
  frames: number;
  frameMs: number;
  loops: boolean;
  /**
   * `four` is drawn facing down, up, left and right; `one` is drawn once and
   * shown whichever way the thing faced. A body falling is seen from above,
   * so it falls the same way whichever way it was looking.
   */
  facings: 'four' | 'one';
}

export interface KindBudget {
  /** The sizes a sprite of this kind may be, in art pixels. */
  sizes: readonly (readonly [number, number])[];
  /** Whether the compiler draws a one-pixel outline round the silhouette. */
  outlined: boolean;
  /** Whether every pixel must be filled: a tile with a hole shows the void. */
  opaque: boolean;
  /** What every sprite of the kind must have, being what the rest falls back to. */
  required: readonly AnimationId[];
  animations: Readonly<Partial<Record<AnimationId, AnimationBudget>>>;
}

const once = (frames: number, frameMs: number, facings: 'four' | 'one'): AnimationBudget => ({
  frames,
  frameMs,
  loops: false,
  facings,
});

const looping = (frames: number, frameMs: number, facings: 'four' | 'one'): AnimationBudget => ({
  frames,
  frameMs,
  loops: true,
  facings,
});

const STILL = once(1, 0, 'one');

// What a person and a beast share. Two idle frames are a breath, which is
// what separates a figure standing from a figure paused; four are a stride,
// left foot, pass, right foot, pass. Three to a blow is wind-up, strike and
// recover, and the strike is what a `swing` moment lands on.
const IDLE = looping(2, 500, 'four');
const WALK = looping(4, 150, 'four');
const STRIKE = once(3, 100, 'four');
const HURT = once(1, 150, 'four');
const DEATH = once(3, 150, 'one');

export const BUDGET: Readonly<Record<SpriteKind, KindBudget>> = {
  tile: {
    sizes: [[TILE_PIXELS, TILE_PIXELS]],
    outlined: false,
    opaque: true,
    required: [],
    animations: { still: STILL, loop: looping(4, 250, 'one') },
  },
  // What lies on the ground and does nothing: a tuft, a flower, a reed, a
  // pebble, a shell. Baked into the ground with it (`art/scatter.ts`) and never
  // moving, but outlined as a prop is, since on ground already textured in its
  // own ramp a tuft with no edge is not there at all.
  scatter: {
    sizes: [
      [8, 8],
      [16, 16],
    ],
    outlined: true,
    opaque: false,
    required: ['still'],
    animations: { still: STILL },
  },
  // What lies on the ground and moves there: the rings spreading over a
  // fishing spot. Light on water rather than a thing standing, so it is not
  // outlined, which drew the rings as loops of dark wire; and it loops on the
  // water's own clock, so it moves in step with what it lies on.
  mark: {
    sizes: [[TILE_PIXELS, TILE_PIXELS]],
    outlined: false,
    opaque: false,
    required: ['loop'],
    animations: { loop: looping(4, 250, 'one') },
  },
  // The player, an NPC, and every creature built like one: a bandit, a
  // goblin, a wight. A tile wide and half again as tall; the larger size is
  // for a boss, which is drawn bigger rather than scaled up.
  person: {
    sizes: [
      [32, 48],
      [48, 64],
    ],
    outlined: true,
    opaque: false,
    required: ['idle'],
    animations: {
      idle: IDLE,
      walk: WALK,
      attack: STRIKE,
      cast: once(3, 120, 'four'),
      shoot: STRIKE,
      hurt: HURT,
      death: DEATH,
    },
  },
  // Fur and shell. It fights with what it has, so it neither casts nor shoots.
  beast: {
    sizes: [
      [32, 32],
      [48, 48],
      [64, 64],
    ],
    outlined: true,
    opaque: false,
    required: ['idle'],
    animations: { idle: IDLE, walk: WALK, attack: STRIKE, hurt: HURT, death: DEATH },
  },
  // Nodes, stations, signposts, furniture. A building is not a prop: it is
  // put together from parts in the rooms it already has.
  prop: {
    sizes: [
      [16, 16],
      [32, 32],
      [32, 48],
      [32, 64],
      [64, 32],
      [64, 64],
    ],
    outlined: true,
    opaque: false,
    required: [],
    animations: { still: STILL, spent: STILL, loop: looping(4, 150, 'one') },
  },
  // Not outlined: a spark or a flash is light, and light has no edge.
  effect: {
    sizes: [
      [16, 16],
      [32, 32],
      [64, 64],
    ],
    outlined: false,
    opaque: false,
    required: [],
    animations: { play: once(4, 60, 'one') },
  },
  icon: {
    sizes: [
      [16, 16],
      [32, 32],
    ],
    outlined: true,
    opaque: false,
    required: [],
    animations: { still: STILL },
  },
  // The HUD's chrome: a panel's iron, a button's stone, a slot sunk into a
  // panel. Cut in nine by the page (`border-image`), so its corners are drawn
  // once and its edges and middle stretched, which is why every edge is the
  // same all along (`hud.test.ts` in tests/art holds it). It draws its own
  // edge, which is what a frame is, so the compiler outlines none.
  frame: {
    sizes: [
      [8, 8],
      [16, 16],
      [24, 24],
    ],
    outlined: false,
    opaque: false,
    required: ['still'],
    animations: { still: STILL },
  },
};
