import type { CreatureShapeId, EnemyId, NpcId } from '../types/ids';
import { variantId } from './compile';
import type { SpriteDef } from './format';
import { fighterSprite, standingSprite, type Build, type Getup } from './outfit';
import {
  BANDANA,
  BREECHES,
  CAP,
  CLOAKED_PLATE,
  GREAVES,
  STUDDED_JERKIN,
  VEST,
} from './sprites/armour';
import { GOBLIN_EARS } from './sprites/hair';
import { APRON_DOWN, APRON_RIGHT, APRON_UP, CORDED, ROBE, TUNIC } from './sprites/people';
import { PLACEHOLDERS } from './sprites/placeholders';
import { CRAB } from './sprites/crab';
import { LURKER } from './sprites/lurker';
import { RAT } from './sprites/rat';
import { BEARDED_AXE, DAGGER, GAFF, MAUL, ROUND_SHIELD, RUSTY_SWORD } from './sprites/weapons';
import { offhandAs, wieldedAs, wornAs } from './wardrobe';

/**
 * Who is drawn with which sprite.
 *
 * Partial on purpose: anything not in a table is drawn as its kind's
 * placeholder (`docs/architecture/art.md`), so a new creature or person is on
 * screen the day its row is, and drawing it properly is a line here. The kind
 * a creature falls back to is read off its `shape`, the same bargain the 3D
 * view made: what it is decides what it looks like.
 *
 * The player is not here: what they look like is what they chose and what they
 * have on, put together in `outfit.ts` whenever that changes.
 */

// A townsperson in a tunic of their own colour, holding what the getup says.
const townsperson = (
  cloth: Getup['cloth'],
  look: Getup['look'],
  rest: Partial<Getup> = {},
): Getup => ({
  garment: TUNIC,
  cloth,
  robed: false,
  look,
  helmet: null,
  chest: null,
  legs: null,
  weapon: null,
  offhand: null,
  ...rest,
});

const APRON = {
  down: [{ grid: APRON_DOWN, x: 12, y: 23 }],
  up: [{ grid: APRON_UP, x: 12, y: 30 }],
  right: [{ grid: APRON_RIGHT, x: 19, y: 23 }],
};

/**
 * The six who stand in a town, each told from the others at a glance, which is
 * the job `NPC_APPEARANCES` gave their colours in 3D: two of them stand in one
 * yard at Greyford, and three either side of one crossroads in town.
 */
const TOWNSFOLK: Readonly<Record<NpcId, Getup>> = {
  // A grey-haired merchant in ochre under a leather apron.
  shopkeeper: townsperson(
    'ochre',
    { skin: 'fair', hair: 'grey', hairstyle: 'cropped' },
    {
      extra: APRON,
    },
  ),
  // A clerk's coat in a green nobody else wears, and a head shaved clean.
  banker: townsperson('teal', { skin: 'pale', hair: 'black', hairstyle: 'shaved' }),
  // An old soldier in the plate they fought in, holding what a warrior starts with.
  trainer: townsperson(
    'crimson',
    { skin: 'tan', hair: 'grey', hairstyle: 'bearded' },
    {
      chest: wornAs('iron-chestplate'),
      weapon: wieldedAs('rusty-sword'),
    },
  ),
  // Kitted for the road the board's work is out on: a cap, studded leather, a shield.
  quartermaster: townsperson(
    'forest',
    { skin: 'fair', hair: 'red', hairstyle: 'cropped' },
    {
      helmet: wornAs('brown-helmet'),
      chest: wornAs('studded-jerkin'),
      offhand: offhandAs('brown-shield'),
    },
  ),
  // Leather over canvas: everything they deal in arrives on somebody's back.
  outfitter: townsperson(
    'linen',
    { skin: 'deep', hair: 'black', hairstyle: 'tied' },
    {
      chest: { piece: VEST, ramp: 'leather' },
    },
  ),
  // Sooted and dark beside the outfitter, and the one person holding a hammer.
  fettler: townsperson(
    'masonry',
    { skin: 'tan', hair: 'black', hairstyle: 'bearded' },
    {
      extra: APRON,
      weapon: { art: MAUL, blade: 'metal' },
    },
  ),
};

/** Every townsperson as a sprite, for the sheet the game compiles at boot. */
export const TOWNSFOLK_SPRITES: readonly SpriteDef[] = Object.entries(TOWNSFOLK).map(
  ([npcId, getup]) => standingSprite(npcId, getup),
);

/**
 * The creatures built like people, each on the figure in what it wears and
 * with what it carries, which is mostly what it drops (`data/lootTables.ts`):
 * told apart across a field by their colours and their builds, as their 3D
 * colours told them (`NPC_APPEARANCES`). A boss is drawn bigger than his men,
 * a goblin smaller (`Build`).
 */
const FOES: Readonly<Partial<Record<EnemyId, { getup: Getup; build: Build }>>> = {
  // An outlaw in undyed cloth under a brown jerkin, a red rag over the face
  // and the knife it throws when it cannot reach you.
  bandit: {
    getup: townsperson(
      'linen',
      { skin: 'fair', hair: 'brown', hairstyle: 'cropped' },
      {
        helmet: { piece: BANDANA, ramp: 'red' },
        chest: wornAs('brown-chestplate'),
        legs: { piece: BREECHES, ramp: 'leather' },
        weapon: { art: DAGGER },
      },
    ),
    build: 'man',
  },
  // Their chief, a head taller, in a merchant's coat he did not pay for, the
  // cutthroat's bandana and cutlass he drops.
  'bandit-chief': {
    getup: townsperson(
      'ochre',
      { skin: 'tan', hair: 'black', hairstyle: 'cropped' },
      {
        helmet: wornAs('cutthroats-bandana'),
        chest: { piece: STUDDED_JERKIN, ramp: 'leather' },
        legs: { piece: BREECHES, ramp: 'leather' },
        weapon: wieldedAs('cutthroats-blade'),
      },
    ),
    build: 'boss',
  },
  // Green, bald and pinched, its eyes catching the light, in rags, swinging
  // an axe it found.
  'goblin-scavenger': {
    getup: townsperson(
      'ochre',
      { skin: 'fair', hair: 'black', hairstyle: 'shaved' },
      { skin: 'skinGoblin', extra: GOBLIN_EARS, eyes: 'yellow', weapon: { art: BEARDED_AXE } },
    ),
    build: 'goblin',
  },
  // The same goblin gone pale underground, sooted, in a leather cap, with the
  // pick it works the seam with.
  'goblin-miner': {
    getup: townsperson(
      'masonry',
      { skin: 'fair', hair: 'black', hairstyle: 'shaved' },
      {
        skin: 'skinGoblinPale',
        extra: GOBLIN_EARS,
        eyes: 'yellow',
        helmet: { piece: CAP, ramp: 'leather' },
        weapon: wieldedAs('pickaxe'),
      },
    ),
    build: 'goblin',
  },
  // Oilskin against the water under a fenweave hood, and a boat's gaff.
  'fen-raider': {
    getup: townsperson(
      'oilskin',
      { skin: 'tan', hair: 'black', hairstyle: 'bearded' },
      {
        helmet: wornAs('fenweave-hood'),
        legs: wornAs('fenweave-leggings'),
        weapon: { art: GAFF },
      },
    ),
    build: 'man',
  },
  // Bone under a grave-shroud and a linen wrap, lank grey hair, eyes lit
  // green, and the sword and shield it was buried with gone to verdigris.
  'barrow-wight': {
    getup: {
      ...townsperson(
        'grave',
        { skin: 'fair', hair: 'grey', hairstyle: 'long' },
        {
          helmet: { piece: BANDANA, ramp: 'linen' },
          weapon: { art: RUSTY_SWORD, blade: 'grave' },
          offhand: { art: ROUND_SHIELD, ramp: 'grave' },
          skin: 'bone',
          eyes: 'nature',
        },
      ),
      garment: CORDED(ROBE),
      robed: true,
    },
    build: 'man',
  },
  // Their king, bigger than any of them, crowned, in plate gone green under a
  // cloak gone dark, and the leaf blade he drops.
  'barrow-king': {
    getup: townsperson(
      'grave',
      { skin: 'fair', hair: 'grey', hairstyle: 'bearded' },
      {
        helmet: wornAs('barrow-crown'),
        chest: { piece: CLOAKED_PLATE, ramp: 'grave' },
        legs: { piece: GREAVES, ramp: 'grave' },
        weapon: wieldedAs('barrow-blade'),
        cloak: 'violet',
        skin: 'bone',
        eyes: 'nature',
      },
    ),
    build: 'boss',
  },
};

/** Every humanoid creature as a sprite, for the sheet the game compiles at boot. */
export const FOE_SPRITES: readonly SpriteDef[] = Object.entries(FOES).flatMap(([enemyId, foe]) =>
  foe ? [fighterSprite(enemyId, foe.getup, foe.build)] : [],
);

const CREATURE_SPRITES: Readonly<Partial<Record<EnemyId, string>>> = {
  rat: RAT.id,
  crab: CRAB.id,
  'cave-crawler': variantId(CRAB.id, 'cave'),
  'bog-lurker': LURKER.id,
  ...Object.fromEntries(Object.keys(FOES).map((enemyId) => [enemyId, enemyId])),
};

/** A person who stands behind a counter. */
export function npcSprite(npcId: NpcId): string {
  return npcId;
}

/** A creature, falling back on the kind of body its shape says it has. */
export function creatureSprite(enemyId: EnemyId, shape: CreatureShapeId): string {
  const drawn = CREATURE_SPRITES[enemyId];
  if (drawn) return drawn;
  return shape === 'humanoid' ? PLACEHOLDERS.person.id : PLACEHOLDERS.beast.id;
}
