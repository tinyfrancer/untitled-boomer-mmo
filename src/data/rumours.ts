import type { EnemyId, NpcId, RumourId, SecretId } from '../types/ids';

/**
 * What a rumour leads to: a secret to walk up to, or a creature to put down.
 * Only things that exist (decision 132, the dead-end rule's shape): the rest of
 * `docs/lore/places.md`'s rumours wait in the lore for Part G to build what they
 * lead to.
 */
export type RumourLead =
  { kind: 'secret'; secretId: SecretId } | { kind: 'creature'; enemyId: EnemyId };

/**
 * Something somebody says that leads somewhere (D2). Told in conversation, as
 * an effect on the answer that says it (`data/dialog.ts`), and noted in the
 * Whispers journal from then on; whether it has been followed is derived from
 * the secrets found and the kills.
 */
export interface RumourDefinition {
  id: RumourId;
  /** Who tells it: an answer of theirs carries it, which a test holds. */
  teller: NpcId;
  /** The rumour as the journal keeps it, in the teller's words, cut short. */
  line: string;
  leads: RumourLead;
}

const secret = (secretId: SecretId): RumourLead => ({ kind: 'secret', secretId });
const creature = (enemyId: EnemyId): RumourLead => ({ kind: 'creature', enemyId });

/**
 * Every rumour, a zone at a time from the strand outward. One for each of the
 * fifteen secrets and one for each of the two bosses, started from the lines in
 * `docs/lore/places.md` where it has one, and written there where it did not.
 */
export const RUMOURS: Record<RumourId, RumourDefinition> = {
  'stone-older-than-town': {
    id: 'stone-older-than-town',
    teller: 'shopkeeper',
    line: "That stone was here before the town was. Dig round the foot of it if you don't believe me.",
    leads: secret('lamp-stone'),
  },
  'his-majesty': {
    id: 'his-majesty',
    teller: 'shopkeeper',
    line: "Something in the Wet Boot's cellar is bigger than a rat. The regulars call it His Majesty.",
    leads: secret('cellar-hatch'),
  },
  'walk-to-the-candle': {
    id: 'walk-to-the-candle',
    teller: 'trainer',
    line: 'Off the end of the spit there is a way out to the nearest Candle, along the top of something under the water.',
    leads: secret('warden-niche'),
  },
  'blasting-crew': {
    id: 'blasting-crew',
    teller: 'shopkeeper',
    line: 'The blasting crew broke into a little stone room behind the face this spring, and sold what was in it for beer money.',
    leads: secret('broken-cell'),
  },
  'hall-wall': {
    id: 'hall-wall',
    teller: 'quartermaster',
    line: "Whatever the Red Rags keep in the wall of the hall they sleep in, they don't keep in the Company's bank.",
    leads: secret('lamp-niche'),
  },
  'old-gold': {
    id: 'old-gold',
    teller: 'banker',
    line: 'Old gold, heavier than ours, with a king on it nobody can put a name to. Nobody comes by coin like that honestly.',
    leads: secret('strongbox'),
  },
  'pay-cart': {
    id: 'pay-cart',
    teller: 'quartermaster',
    line: 'Hollis was a Company guard, and went off the east road eight years ago with the pay-cart he was guarding.',
    leads: creature('bandit-chief'),
  },
  'walls-of-the-barrow': {
    id: 'walls-of-the-barrow',
    teller: 'fettler',
    line: "The old ones carved what they had on the barrow's walls. Look along the gallery.",
    leads: secret('sea-light-frieze'),
  },
  'blue-lantern': {
    id: 'blue-lantern',
    teller: 'fettler',
    line: "Orlath's lantern burned blue, the fenfolk say. It went out this summer.",
    leads: creature('barrow-king'),
  },
  'coin-in-the-pond': {
    id: 'coin-in-the-pond',
    teller: 'outfitter',
    line: 'On a still day there is carved stone under the millpond, off the south bank between two of the willows.',
    leads: secret('pond-shrine'),
  },
  'mill-books': {
    id: 'mill-books',
    teller: 'banker',
    line: "The first charter's village kept its books at the mill, and never sent them east.",
    leads: secret('charter-ledger'),
  },
  'dressed-stones': {
    id: 'dressed-stones',
    teller: 'outfitter',
    line: "The ford's stones are dressed square, and two stand up in the water like they used to hold something up.",
    leads: secret('bridge-keystone'),
  },
  'fettler-buys': {
    id: 'fettler-buys',
    teller: 'outfitter',
    line: 'The fettler buys anything old and never asks where it came from.',
    leads: secret('back-room'),
  },
  'things-in-the-mere': {
    id: 'things-in-the-mere',
    teller: 'fettler',
    line: 'The raiders throw good things into the mere in the west of the fen, off its south shore.',
    leads: secret('drowned-village'),
  },
  'lights-on-posts': {
    id: 'lights-on-posts',
    teller: 'trainer',
    line: 'Lights on posts out over the water in the fen, and nobody tending them.',
    leads: secret('kept-lantern'),
  },
  'goblins-stopped': {
    id: 'goblins-stopped',
    teller: 'outfitter',
    line: "The goblins stopped digging at one wall at the bottom of the Deep Cut. Goblins don't stop digging.",
    leads: secret('sealed-door'),
  },
  'sum-in-the-rock': {
    id: 'sum-in-the-rock',
    teller: 'quartermaster',
    line: "There's a sum cut into the rock down the Deep Cut, past where the goblins have been, with a name on it.",
    leads: secret('makers-mark'),
  },
};
