import type { CreatureShapeId, EnemyId, NpcId } from '../types/ids';
import type { SpriteDef } from './format';
import { standingSprite, type Getup } from './outfit';
import { APRON_DOWN, APRON_RIGHT, APRON_UP, TUNIC } from './sprites/people';
import { PLACEHOLDERS } from './sprites/placeholders';
import { RAT } from './sprites/rat';
import { VEST } from './sprites/armour';
import { MAUL } from './sprites/weapons';
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

const CREATURE_SPRITES: Readonly<Partial<Record<EnemyId, string>>> = {
  rat: RAT.id,
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
