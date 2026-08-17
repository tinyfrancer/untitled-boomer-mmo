import type { ItemId, LootTableId } from '../types/ids';

export interface LootTableEntry {
  itemId: ItemId;
  chance: number;
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
      { itemId: 'cooked-fish', chance: 0.15 },
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
      // Scavengers, so what they have eaten off is what they carry: the one
      // thing on the table nothing here made.
      { itemId: 'cooked-fish', chance: 0.12 },
    ],
    currency: { min: 18, max: 46, chance: 0.92 },
  },
  /**
   * The only table in the game whose contents come off nothing else.
   *
   * The bandana always drops, because a fight this long has to be worth
   * something every time and it is the one piece both classes can wear. The two
   * weapons are the chase, and there are two of them so the run is worth making
   * whoever you rolled — a warrior selling a wand is still selling 150 copper.
   */
  'bandit-chief': {
    id: 'bandit-chief',
    entries: [
      { itemId: 'cutthroats-bandana', chance: 1 },
      { itemId: 'cutthroats-blade', chance: 0.2 },
      { itemId: 'stolen-wand', chance: 0.2 },
    ],
    // A chief's purse: several times what the men outside are carrying.
    currency: { min: 60, max: 120, chance: 1 },
  },

  // A beast, so parts and nothing else. One entry, at a rate that makes a hide
  // the reason to bother rather than a consolation: a lurker is a long fight.
  'bog-lurker': {
    id: 'bog-lurker',
    entries: [{ itemId: 'lurker-hide', chance: 0.55 }],
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
      { itemId: 'raw-eel', chance: 0.18 },
    ],
    currency: { min: 22, max: 54, chance: 0.92 },
  },
};
