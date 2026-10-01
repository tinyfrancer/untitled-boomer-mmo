import type { ItemId, LootTableId } from '../types/ids';

export interface LootTableEntry {
  itemId: ItemId;
  chance: number;
  /**
   * How many drop when it does, rolled evenly between the two; absent is one.
   * Arrows are the only thing that comes by the handful, since one is spent a
   * shot and a pocketful of them is what a body is carrying.
   */
  quantity?: { min: number; max: number };
}

/**
 * The handful every humanoid carries, since anything with pockets and a fight
 * in it has a few arrows about it (decision 64). One row for all of them rather
 * than one written into each table, so the rate is one number and the rule is
 * one test: `tests/systems/EnemySystem.test.ts` fails any humanoid that is not a
 * boss and carries none. The count rises with the band, because so does what a
 * creature there takes to kill.
 */
function arrows(min: number, max: number): LootTableEntry {
  return { itemId: 'crude-arrows', chance: 0.5, quantity: { min, max } };
}

export interface CurrencyDrop {
  min: number;
  max: number;
  chance: number;
}

export interface LootTable {
  id: LootTableId;
  entries: LootTableEntry[];
  // Copper carried by the creature — humanoids only; animals drop parts.
  currency?: CurrencyDrop;
}

export const LOOT_TABLES: Record<LootTableId, LootTable> = {
  rat: {
    id: 'rat',
    entries: [
      { itemId: 'rat-bones', chance: 0.6 },
      { itemId: 'rat-meat', chance: 0.5 },
    ],
  },
  crab: {
    id: 'crab',
    entries: [{ itemId: 'crab-meat', chance: 0.85 }],
  },
  bandit: {
    id: 'bandit',
    // The only gear and coin in the game, and it covers both armor types on
    // purpose: the shop sells tools only, so this table plus the two quest
    // rewards is the whole of a wizard's — and a warrior's — armor supply.
    entries: [
      { itemId: 'cooked-fish', chance: 0.4 },
      { itemId: 'brown-chestplate', chance: 0.06 },
      { itemId: 'brown-helmet', chance: 0.06 },
      { itemId: 'brown-legs', chance: 0.06 },
      { itemId: 'brown-robe', chance: 0.06 },
      { itemId: 'brown-cloth-hat', chance: 0.06 },
      { itemId: 'brown-cloth-pants', chance: 0.06 },
      { itemId: 'brown-axe', chance: 0.04 },
      // The offhand, at the same rate as the rest of the set: the camp is the
      // whole of anyone's armour supply, and a slot nothing drops into is a
      // slot nobody fills.
      { itemId: 'brown-shield', chance: 0.06 },
      { itemId: 'apprentice-orb', chance: 0.06 },
      // The ranger's first step up, at the axe's rate beside it.
      { itemId: 'hunting-bow', chance: 0.04 },
      arrows(2, 6),
      // The way into the hideout, and the rarest thing on the table by a
      // distance: it is meant to be a run of bandits rather than an errand.
      { itemId: 'hideout-key', chance: 0.03 },
    ],
    // Humanoids carry coin; the beasts above never do.
    currency: { min: 8, max: 25, chance: 0.9 },
  },
  /**
   * What the road west pays, and it pays in the two things the camp already
   * does — coin and a wearable set — at the next step up of each.
   *
   * The coin is roughly double a bandit's, which is most of why anyone walks out
   * here: the studded set is three rows on a table and will be finished long
   * before the purse stops being the reason to come back. The set itself is
   * leather alone, so this is a warrior's upgrade and a wizard's payday — the
   * cloth half of the world's supply is what the fen is for, and until it exists
   * the bandit table is still the only place a caster is dressed from.
   */
  'goblin-scavenger': {
    id: 'goblin-scavenger',
    entries: [
      { itemId: 'studded-helmet', chance: 0.06 },
      { itemId: 'studded-jerkin', chance: 0.05 },
      { itemId: 'studded-legs', chance: 0.055 },
      // Cut from the same hide as the set, for the hand a bow leaves free.
      { itemId: 'studded-quiver', chance: 0.05 },
      // Scavengers, so what they have eaten off is what they carry: the one
      // thing on the table nothing here made.
      { itemId: 'cooked-fish', chance: 0.4 },
      arrows(3, 7),
    ],
    currency: { min: 18, max: 46, chance: 0.92 },
  },
  /**
   * The only table in the game whose contents come off nothing else.
   *
   * The bandana always drops, because a fight this long has to be worth
   * something every time and it is the one piece every class can wear. The
   * three weapons are the chase, one a class, so the run is worth making
   * whoever you rolled — a warrior selling a staff is still selling 150 copper.
   */
  'bandit-chief': {
    id: 'bandit-chief',
    entries: [
      { itemId: 'cutthroats-bandana', chance: 1 },
      { itemId: 'cutthroats-blade', chance: 0.2 },
      { itemId: 'stolen-staff', chance: 0.2 },
      { itemId: 'poachers-bow', chance: 0.2 },
    ],
    // A chief's purse: several times what the men outside are carrying.
    currency: { min: 60, max: 120, chance: 1 },
  },

  /**
   * A beast, so parts and nothing else — but the one beast table in the game
   * whose part is not vendor trash.
   *
   * A shell is an input to every steel piece, which is what makes the thing in
   * the way of the coal worth killing rather than worth walking around. It drops
   * often, because a crawler is a long fight and the steel set needs five of
   * them.
   */
  'cave-crawler': {
    id: 'cave-crawler',
    entries: [{ itemId: 'crawler-shell', chance: 0.6 }],
  },
  /**
   * Coin, what they were digging with, and what they were eating — and **no ore
   * at all**, which is the one thing about this table that was decided rather
   * than filled in.
   *
   * The Deep Cut's whole claim is that everything worth having down here is
   * behind the pick rather than behind a door. A table that dropped coal would
   * be the way round the only gate the zone has, and iron ore is no better: the
   * plate tier is traceable to both veins and a rat precisely because nothing
   * else in the game hands out either rock, and a creature that did would quietly
   * make a smith out of somebody who never learned to mine.
   *
   * So what is on it is a tool and a weapon. The maul is the first weapon
   * upgrade in the game that comes off something repeatable — everything above a
   * brown axe until now was one boss behind a 3% key — and the pick is the joke
   * that pays for itself: a miner who came down here without one can take a
   * goblin's.
   */
  'goblin-miner': {
    id: 'goblin-miner',
    entries: [
      { itemId: 'goblin-maul', chance: 0.05 },
      { itemId: 'pickaxe', chance: 0.08 },
      // Rats in a mine, and a goblin with a fire.
      { itemId: 'cooked-rat', chance: 0.5 },
      arrows(3, 7),
    ],
    currency: { min: 20, max: 50, chance: 0.92 },
  },

  // A beast, so parts and nothing else: the hide, at a rate that makes it the
  // reason to bother rather than a consolation, since a lurker is a long fight,
  // and whatever it had last eaten out of the pool it was lying in.
  'bog-lurker': {
    id: 'bog-lurker',
    entries: [
      { itemId: 'lurker-hide', chance: 0.55 },
      { itemId: 'raw-eel', chance: 0.3 },
    ],
  },
  /**
   * Where cloth comes from, and the whole reason a caster walks out here.
   *
   * The three pieces are rarer than the goblins' studded set is, because they
   * are the only source of their armour type in the world where studded sits
   * above a leather tier a warrior already has. Coin is a shade over the
   * goblins', which is what keeps the walk south worth making for either class.
   */
  'fen-raider': {
    id: 'fen-raider',
    entries: [
      { itemId: 'fenweave-hood', chance: 0.05 },
      { itemId: 'fenweave-robe', chance: 0.04 },
      { itemId: 'fenweave-leggings', chance: 0.045 },
      // What they eat out of the pools they are standing in.
      { itemId: 'raw-eel', chance: 0.4 },
      // The way into the barrow, at the hideout key's own 3%: the rarest thing
      // on any table in the game, and meant to be a run of raiders rather than
      // an errand. It is on the zone *before* the door for the reason the
      // hideout's is on the camp outside it — a key found somewhere unrelated to
      // what it opens is a key nobody connects to a place.
      { itemId: 'barrow-key', chance: 0.03 },
      arrows(3, 8),
    ],
    currency: { min: 22, max: 54, chance: 0.92 },
  },
  /**
   * Grave goods: the arm the man was buried holding, and the silver on his eyes.
   *
   * Two entries and the best purse in the game, which is the table saying what
   * the zone is. There is no armour set on it on purpose — the fen already
   * carries the best cloth anything repeatable drops and the forge the best
   * plate, and a fourth set here would undo one of those two rather than add
   * anything. What the barrow has that neither of them does is the **off hand**:
   * the slot that filled once in the starter band and then never again for
   * anybody who did not take up a hammer, and never at all for a caster.
   */
  'barrow-wight': {
    id: 'barrow-wight',
    entries: [
      { itemId: 'grave-shield', chance: 0.05 },
      { itemId: 'grave-lantern', chance: 0.05 },
      { itemId: 'grave-quiver', chance: 0.05 },
      arrows(4, 9),
    ],
    // Half again the raider's, and the deepest purse anything repeatable
    // carries. Coin is most of why the wights are worth clearing rather than
    // walking past: the bank's shelf price climbs, and this is what pays it.
    currency: { min: 34, max: 78, chance: 0.95 },
  },
  /**
   * The second table in the game whose contents come off nothing else, and it is
   * the chief's argument one band up.
   *
   * The crown always drops, because a fight this long has to be worth something
   * every time and it is the one piece every class can wear. The three weapons
   * are the chase, one a class, so the run is worth making whoever you rolled.
   */
  'barrow-king': {
    id: 'barrow-king',
    entries: [
      { itemId: 'barrow-crown', chance: 1 },
      { itemId: 'barrow-blade', chance: 0.2 },
      { itemId: 'barrow-staff', chance: 0.2 },
      { itemId: 'barrow-longbow', chance: 0.2 },
    ],
    // A king's hoard, and several times what the men in his chamber carry.
    currency: { min: 180, max: 320, chance: 1 },
  },
};
