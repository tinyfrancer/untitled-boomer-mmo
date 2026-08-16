import type { QuestObjective } from './quests';
import type { BountyId, NpcId } from '../types/ids';

/**
 * What a bounty asks for: a quest's objective, less the one that cannot be
 * asked for twice.
 *
 * Written as a narrowing of `QuestObjective` rather than as a union of its own,
 * because a bounty counts exactly what a quest counts — the bag for a `collect`,
 * a lifetime tally for a `kill` — and every helper that reads one
 * (`objectiveTally`, `objectiveQuantity`, `describeObjective`) reads the other
 * unchanged. What the narrowing *says* is the rule: a `visit` is not work. It is
 * finished by walking somewhere, and something repeatable that is finished by
 * walking somewhere is a coin faucet with no work in it.
 */
export type BountyObjective = Extract<QuestObjective, { kind: 'kill' | 'collect' }>;

/** Coin and XP, and never gear: what the world drops stays the world's to give. */
export interface BountyReward {
  copper: number;
  xp: number;
}

export interface BountyDefinition {
  id: BountyId;
  name: string;
  /** The line on the board, in the voice of whoever is paying for it. */
  description: string;
  postedByNpcId: NpcId;
  objective: BountyObjective;
  /**
   * The level this is posted at. Absent means posted from the first visit,
   * which is the shape `ShopStockEntry.requires`, `AbilityDefinition.training`
   * and `ZoneDefinition.requiresKey` all use: the table reads as a list of what
   * is held back rather than of what is open.
   *
   * A level and never a quest, unlike the shelf's gate. A bounty is standing
   * work rather than a story, so nothing about it should wait on a story being
   * told — and a level is the one thing every character is guaranteed to reach.
   */
  requiredLevel?: number;
  reward: BountyReward;
}

/**
 * The standing work, and the first thing in the game that pays the same player
 * twice.
 *
 * Three rules hold the numbers, and they are held by
 * `tests/systems/BountySystem.test.ts` rather than by this comment, since the
 * table is hand-written:
 *
 * - **A kill bounty pays less XP than the kills it names already pay.** It is a
 *   bonus on a grind somebody was already making, not a reason to make a
 *   different one — which is what keeps the action bar, and not the board, the
 *   thing that makes play fast.
 * - **A gather bounty pays more than the vendor would.** A contract nobody would
 *   take over walking six steps to the shopkeeper is a row that may as well not
 *   be drawn.
 * - **And less than the shopkeeper charges for the same thing**, which is the
 *   one that is not obvious: the shop sells logs, so a timber order paying more
 *   per log than the shelf charges is coin printed by walking between two people
 *   standing forty feet apart. The spread that stops it is the same vendor
 *   spread `SHOP_STOCK` was already built around.
 *
 * The gates are chosen against where the work *is* rather than spread evenly:
 * each kill bounty opens about when its zone stops being dangerous, and the
 * smith's order sits at 4 because a bar behind mining 5 and smithing 4 is the
 * deepest thing anybody can be asked to bring.
 */
export const BOUNTIES: Record<BountyId, BountyDefinition> = {
  'rat-cull': {
    id: 'rat-cull',
    name: 'Rat Cull',
    description: 'The cellars are overrun again. Fifteen of them and I stop hearing about it.',
    postedByNpcId: 'quartermaster',
    objective: { kind: 'kill', enemyId: 'rat', quantity: 15 },
    reward: { copper: 60, xp: 40 },
  },
  // The only coin a tree has ever been worth beyond its vendor price, and the
  // reason woodcutting is worth levelling for something other than firewood.
  'timber-order': {
    id: 'timber-order',
    name: 'Timber Order',
    description: 'Fifteen logs for the palisade. Cut, not bought — I know what the shop charges.',
    postedByNpcId: 'quartermaster',
    objective: { kind: 'collect', itemId: 'logs', quantity: 15 },
    reward: { copper: 90, xp: 30 },
  },
  'shore-patrol': {
    id: 'shore-patrol',
    name: 'Shore Patrol',
    description: 'A dozen crabs off the shore before somebody loses a foot to one.',
    postedByNpcId: 'quartermaster',
    objective: { kind: 'kill', enemyId: 'crab', quantity: 12 },
    requiredLevel: 2,
    reward: { copper: 100, xp: 65 },
  },
  'ore-order': {
    id: 'ore-order',
    name: 'Ore Order',
    description: 'Twelve tin out of the new cut. The smith is waiting on it and so am I.',
    postedByNpcId: 'quartermaster',
    objective: { kind: 'collect', itemId: 'tin-ore', quantity: 12 },
    requiredLevel: 2,
    reward: { copper: 110, xp: 45 },
  },
  'road-contract': {
    id: 'road-contract',
    name: 'Road Contract',
    description: 'Ten off the camp on the east road. They come back; so does the contract.',
    postedByNpcId: 'quartermaster',
    objective: { kind: 'kill', enemyId: 'bandit', quantity: 10 },
    requiredLevel: 3,
    reward: { copper: 140, xp: 90 },
  },
  // The deepest ask on the board: iron behind mining 5, bars behind smithing 4,
  // and a walk to the forge between them. It pays like it.
  'smith-order': {
    id: 'smith-order',
    name: "Smith's Order",
    description: 'Five iron bars, finished. Bring the metal worked and I will pay for the work.',
    postedByNpcId: 'quartermaster',
    objective: { kind: 'collect', itemId: 'iron-bar', quantity: 5 },
    requiredLevel: 4,
    reward: { copper: 220, xp: 110 },
  },
};

/** Board order, so the panel does not reshuffle as levels are reached. */
export const BOUNTY_ORDER: BountyId[] = [
  'rat-cull',
  'timber-order',
  'shore-patrol',
  'ore-order',
  'road-contract',
  'smith-order',
];
