import type { Look } from '../data/looks';
import type { Gear } from '../systems/InventorySystem';
import type { ClassId, HairColourId, SkinToneId } from '../types/ids';
import { compileFrame } from './compile';
import { rekeyed, type Grid, type Placed, type SpriteDef } from './format';
import type { SharedRampId } from './palette';
import type { PerView } from './sprites/armour';
import {
  HEAD_X,
  HEAD_Y,
  TIER_STEPS,
  breathing,
  dyeKey,
  dyed,
  fourWays,
  hurtFrames,
  legs,
  personSprite,
  striding,
  type Arms,
  type Dress,
  type Materials,
  type Moment,
  type View,
} from './sprites/figure';
import { HAIRSTYLE_ART } from './sprites/hair';
import {
  CORDED,
  FALLEN,
  FALLEN_ROBED,
  PLAIN_SLEEVES,
  ROBE,
  TUNIC,
  falling,
  worn,
  type Garment,
} from './sprites/people';
import { QUIVER } from './sprites/weapons';
import { offhandAs, wieldedAs, wornAs, type Offhand, type Wield, type Worn } from './wardrobe';

/**
 * A person put together from what they are (decision 107): the figure in a
 * class's garment, in a look, with a piece on each slot that has one and a
 * weapon in the hand, compiled into one sprite.
 *
 * Put together at the level of the grids rather than stacked as sprites at
 * draw time, so the compiler outlines the figure once, round its silhouette,
 * rather than round every layer: armour drawn as a sprite over a sprite is a
 * figure made of outlined blocks, the disjointed look decision 105 mended. Each
 * slot is dyed into a ramp of its own (`dyed`), which is what lets a steel helm
 * sit over studded legs.
 *
 * The player's is made again whenever what they have on changes, which is
 * rare; everyone else's once, at boot.
 */

/** A person as they are drawn: garment, look, and what each slot holds. */
export interface Getup {
  /** The garment under everything, what it is dyed, and whether it reaches the ankles. */
  garment: Garment;
  cloth: SharedRampId;
  robed: boolean;
  look: Look;
  helmet: (Worn & { ramp: SharedRampId }) | null;
  chest: (Worn & { ramp: SharedRampId }) | null;
  legs: (Worn & { ramp: SharedRampId }) | null;
  weapon: Wield | null;
  offhand: (Offhand & { ramp: SharedRampId }) | null;
  /** Anything else on the body over the garment: an apron. */
  extra?: PerView;
}

/** What a class starts in, under whatever it puts on (decision 105). */
export const CLASS_DRESS: Readonly<Record<ClassId, Pick<Getup, 'garment' | 'cloth' | 'robed'>>> = {
  warrior: { garment: TUNIC, cloth: 'blue', robed: false },
  wizard: { garment: CORDED(ROBE), cloth: 'violet', robed: true },
  ranger: { garment: TUNIC, cloth: 'forest', robed: false },
};

export const SKIN_RAMPS: Readonly<Record<SkinToneId, SharedRampId>> = {
  pale: 'skinPale',
  fair: 'skin',
  tan: 'skinTan',
  deep: 'skinDeep',
};

export const HAIR_RAMPS: Readonly<Record<HairColourId, SharedRampId>> = {
  brown: 'hair',
  black: 'hairBlack',
  fair: 'hairFair',
  red: 'hairRed',
  grey: 'hairGrey',
};

// Grey hair is drawn a step lighter than its ramp's middle, or it reads as dark.
const LIFTED: Readonly<Record<string, string>> = { h: 'i', i: 'j', j: 'k', k: 'Z' };

// A face in a hood's shadow is a step darker.
const SHADED_FACE: Readonly<Record<string, string>> = { d: 'c', c: 'b' };

/** The player: their class's garment, their look, and what they have on. */
export function playerGetup(classId: ClassId, look: Look, gear: Gear): Getup {
  return {
    ...CLASS_DRESS[classId],
    look,
    helmet: wornAs(gear.helmet),
    chest: wornAs(gear.chest),
    legs: wornAs(gear.pants),
    weapon: wieldedAs(gear.weapon),
    offhand: offhandAs(gear.offhand),
  };
}

/** Every part a slot puts on, dyed into that slot's ramp. */
function dyedParts(parts: readonly Placed[] | undefined, role: 'helm' | null): Placed[] {
  if (!parts) return [];
  return parts.map((part) => (role ? { ...part, grid: dyed(part.grid, role) } : part));
}

/** A table of swaps into the tier's keys, made into the same swaps into a dyed role's. */
function dyedSwaps(
  swaps: Readonly<Record<string, string>>,
  role: 'greaves' | 'helm',
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(swaps).map(([key, to]) => {
      const step = TIER_STEPS[to];
      return [key, step === undefined ? to : dyeKey(role, step)];
    }),
  );
}

interface Put {
  dress: Dress;
  materials: Materials;
  fallen: Grid;
  rest: Omit<Moment, 'stance' | 'bob'>;
}

/** The getup as the figure kit takes it: a dress, the ramps its roles are, and how it falls. */
function put(getup: Getup): Put {
  const { look, helmet, chest, legs: pants, weapon, offhand } = getup;
  const style = HAIRSTYLE_ART[look.hairstyle];
  const lift = look.hair === 'grey' ? LIFTED : {};
  const face = helmet?.piece.shadesFace ? { ...lift, ...SHADED_FACE } : lift;
  const garment = chest?.piece.garment ? chest.piece.garment(getup.garment) : getup.garment;
  const quivered = offhand?.art === 'quiver';
  const views: readonly View[] = ['down', 'up', 'right'];
  const each = (build: (view: View) => Placed[]): Record<View, Placed[]> =>
    Object.fromEntries(views.map((view) => [view, build(view)])) as Record<View, Placed[]>;

  const body = each((view) => [
    worn(view, garment),
    ...dyedParts(chest?.piece.body?.[view], null),
    ...(getup.extra?.[view] ?? []),
    ...(quivered && view === 'down' ? [{ grid: QUIVER.strap, x: 12, y: 22 }] : []),
    { grid: rekeyed(style.head[view], face), x: HEAD_X, y: HEAD_Y },
    ...style.below[view].map((part) => ({ ...part, grid: rekeyed(part.grid, lift) })),
    ...dyedParts(helmet?.piece.head?.[view], 'helm'),
    ...(quivered && view === 'up' ? [{ grid: QUIVER.up, x: 17, y: 15 }] : []),
  ]);
  const behind = each((view) => [
    ...dyedParts(chest?.piece.behind?.[view], null),
    ...(quivered && view === 'down' ? [{ grid: QUIVER.down, x: 9, y: 15 }] : []),
    ...(quivered && view === 'right' ? [{ grid: QUIVER.right, x: 8, y: 16 }] : []),
  ]);
  const over = each((view) => [
    ...dyedParts(chest?.piece.over?.[view], null),
    ...dyedParts(helmet?.piece.over?.[view], 'helm'),
  ]);
  const legSwaps = pants?.piece.legs ? dyedSwaps(pants.piece.legs, 'greaves') : {};
  const arms: Arms = {
    main: weapon?.art ?? null,
    off: offhand && offhand.art !== 'quiver' ? offhand.art : null,
  };
  const dress: Dress = {
    behind,
    legs: (view, stance) =>
      legs(view, stance).map((part) => ({ ...part, grid: rekeyed(part.grid, legSwaps) })),
    body,
    over,
    sleeves: chest?.piece.sleeves ?? PLAIN_SLEEVES,
    arms,
  };
  const materials: Materials = {
    skin: SKIN_RAMPS[look.skin],
    hair: HAIR_RAMPS[look.hair],
    cloth: getup.cloth,
    cloak: 'crimson',
    leather: 'leather',
    trousers: 'wood',
    metal: 'metal',
    trim: 'gold',
    wood: 'wood',
    glow: offhand?.glow ?? weapon?.gem ?? 'arcane',
    gear: chest?.ramp ?? 'tier',
    helm: helmet?.ramp ?? 'tier',
    greaves: pants?.ramp ?? 'tier',
    shield: offhand?.ramp ?? 'tier',
    blade: weapon?.blade ?? 'metal',
    haft: weapon?.haft ?? 'wood',
    fitting: weapon?.fitting ?? 'gold',
    gem: weapon?.gem ?? 'arcane',
  };
  const rest: Put['rest'] =
    weapon?.art.hold === 'planted' ? { main: 'staff', off: 'rest' } : { main: 'rest', off: 'rest' };
  return { dress, materials, fallen: fallenBody(getup, legSwaps, lift), rest };
}

// What lies where it fell, from above: the weapon gone from beside it.
const EMPTY_HANDED: Readonly<Record<string, string>> = Object.fromEntries(
  [...'sxwvpfq'].map((key) => [key, '.']),
);
const UNCLOAKED: Readonly<Record<string, string>> = { '5': '.', '6': '.', '7': '.', '9': '.' };
const BARE_HEADED: Readonly<Record<string, string>> = { '5': 'h', '6': 'i', '7': 'j', '9': 'h' };
const HOOD_STEPS: Readonly<Record<string, string>> = { '9': 'A', '5': 'B', '6': 'C', '7': 'D' };
const HAIR_STEPS: Readonly<Record<string, string>> = { h: 'A', i: 'B', j: 'C', k: 'D', Z: 'E' };
const SCALP: Readonly<Record<string, string>> = { h: 'b', i: 'c', j: 'd', k: 'd', Z: 'd' };
const TORSO: Readonly<Record<string, string>> = {
  '0': 'A',
  '1': 'B',
  '2': 'C',
  '3': 'D',
  '4': 'E',
};

/** The body lying where it fell, in what it had on. */
function fallenBody(getup: Getup, legSwaps: Readonly<Record<string, string>>, lift: object): Grid {
  const { chest, helmet, look } = getup;
  const robed = chest?.piece.garment ? chest.piece.robed === true : getup.robed;
  let body = rekeyed(robed ? FALLEN_ROBED : FALLEN, EMPTY_HANDED);
  const covered = helmet?.piece.covers === true;
  if (robed) {
    body = rekeyed(body, covered ? dyedSwaps(HOOD_STEPS, 'helm') : BARE_HEADED);
  } else {
    body = rekeyed(body, chest?.piece.cloak ? {} : UNCLOAKED);
  }
  if (covered) body = rekeyed(body, dyedSwaps(HAIR_STEPS, 'helm'));
  else if (look.hairstyle === 'shaved') body = rekeyed(body, SCALP);
  else body = rekeyed(body, lift as Record<string, string>);
  if (chest) body = rekeyed(body, TORSO);
  return rekeyed(body, legSwaps);
}

/**
 * A getup as a sprite, with everything a person can do: a breath and a
 * stride, a blow as the weapon in hand makes it, a spell from the other hand,
 * a shot if it holds a bow, a flinch and a fall.
 */
export function getupSprite(id: string, getup: Getup): SpriteDef {
  const { dress, materials, fallen, rest } = put(getup);
  const hold = getup.weapon?.art.hold ?? null;
  const shielded = getup.offhand?.art !== 'quiver' && getup.offhand?.art.kind === 'shield';
  const animations: SpriteDef['animations'] = {
    idle: fourWays(dress, breathing(rest)),
    walk: fourWays(dress, striding(rest)),
    attack: fourWays(dress, attackOf(hold)),
    ...(hold === 'drawn' || shielded ? {} : { cast: fourWays(dress, castOf(hold)) }),
    ...(hold === 'drawn' ? { shoot: fourWays(dress, SHOOT) } : {}),
    hurt: hurtFrames(dress, rest),
    death: falling(dress, fallen, rest),
  };
  return personSprite(id, materials, animations);
}

/** A getup standing and breathing, and nothing else: somebody behind a counter. */
export function standingSprite(id: string, getup: Getup): SpriteDef {
  const { dress, materials, rest } = put(getup);
  return personSprite(id, materials, { idle: fourWays(dress, breathing(rest)) });
}

function attackOf(hold: 'swung' | 'planted' | 'drawn' | null): Moment[] {
  switch (hold) {
    // The staff lifted and brought down on the ground ahead, its head flaring
    // as it lands; a pole cast the same way, with nothing to flare.
    case 'planted':
      return [
        { stance: 'stand', bob: -1, main: 'staffUp', off: 'rest' },
        { stance: 'stride', bob: 1, main: 'staff', off: 'rest', flare: true },
        { stance: 'stand', bob: 0, main: 'staff', off: 'rest' },
      ];
    // With no arrow to loose: the bow swung out ahead, the hand behind it.
    case 'drawn':
      return [
        { stance: 'stand', bob: -1, main: 'rest', off: 'bow' },
        { stance: 'stride', bob: 1, main: 'draw', off: 'bow' },
        { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
      ];
    // Up over the shoulder, then down and across; the body rises onto its toes
    // for the one and drops into a stride for the other. A fist swings the same.
    default:
      return [
        { stance: 'stand', bob: -1, main: 'raised', off: 'rest' },
        { stance: 'stride', bob: 1, main: 'struck', off: 'rest' },
        { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
      ];
  }
}

/** The other hand opened, lit, and the spell leaving it, and a staff with it. */
function castOf(hold: 'swung' | 'planted' | 'drawn' | null): Moment[] {
  const main = hold === 'planted' ? 'staff' : 'rest';
  return [
    { stance: 'stand', bob: 0, main, off: 'palm' },
    { stance: 'stand', bob: -1, main, off: 'palm', flare: true },
    { stance: 'stand', bob: 0, main, off: 'rest' },
  ];
}

// Nock and draw, loose, and let the bow down.
const SHOOT: Moment[] = [
  { stance: 'stand', bob: 0, main: 'draw', off: 'bow', nocked: true },
  { stance: 'stand', bob: 0, main: 'loose', off: 'bow' },
  { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
];

/** The id the player's figure is drawn under, whatever they have on. */
export const PLAYER_SPRITE = 'player';

/** The player as they stand: their class, their look, and what they have on. */
export function playerSprite(classId: ClassId, look: Look, gear: Gear): SpriteDef {
  return getupSprite(PLAYER_SPRITE, playerGetup(classId, look, gear));
}

/**
 * A person standing facing the viewer, as pixels: the picture the creation
 * screen shows of a class in a look, drawn by the same compile the world's are.
 */
export function portrait(getup: Getup): {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
} {
  const def = standingSprite('portrait', getup);
  const idle = def.animations.idle;
  const frame = idle && 'down' in idle ? idle.down[0] : undefined;
  if (!frame) throw new Error('a person stands facing the viewer');
  return { width: def.width, height: def.height, pixels: compileFrame(def, frame, 'open') };
}
