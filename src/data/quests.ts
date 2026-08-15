import type { ClassId, EnemyId, ItemId, NpcId, QuestId, ZoneId } from '../types/ids';

/**
 * What a quest asks for.
 *
 * The split that matters is not what the three name but what each *counts*. A
 * `collect` objective counts the bag, which goes down as well as up and is
 * handed over at the counter; the other two count a lifetime tally that only
 * ever climbs and has already been paid by the time it is reported. That is the
 * whole reason `QuestEntry` carries a baseline, and why it means nothing for the
 * first of them — see `QuestSystem`.
 */
export type QuestObjective =
  | { kind: 'collect'; itemId: ItemId; quantity: number }
  | { kind: 'kill'; enemyId: EnemyId; quantity: number }
  // No quantity: "go there twice" is not a quest anybody writes, so one arrival
  // is the whole of what this asks.
  | { kind: 'visit'; zoneId: ZoneId };

export interface QuestReward {
  copper: number;
  xp: number;
  /**
   * Keyed by class, because the two classes can't wear the same armour type —
   * a single item id here would hand half the game a reward it can't equip.
   *
   * Optional, and most of the table leaves it out. Gear is what the opening
   * quest of an arc pays, to cover the slots the bandit camp is least likely to
   * fill on its own; a piece on every row would out-drop the camp the gear is
   * supposed to come from, and turn the shopkeeper into the armourer.
   */
  gear?: Record<ClassId, ItemId>;
}

export interface QuestDefinition {
  id: QuestId;
  name: string;
  giverNpcId: NpcId;
  description: string;
  // Turning in consumes exactly this when it is a `collect`, so that objective
  // doubles as the price. A kill and a visit are paid for by the time they are
  // reported, and cost nothing at the counter.
  objective: QuestObjective;
  /**
   * Quests that have to be *finished* before this one is offered at all.
   *
   * Absent means offered from the first conversation, which is the shape
   * `ShopStockEntry.requires` and `ZoneDefinition.requiresKey` both use: the
   * table reads as a list of what is held back rather than of what is open.
   * A locked quest is still drawn, for the reason a gated shelf row is — what
   * is not offered yet is the reason to come back.
   */
  requires?: QuestId[];
  reward: QuestReward;
}

// The starter arc, and the chain it hangs off. The two collect quests walk a
// new character through the gather-cook loop and pay the armour the bandit
// table is least likely to hand over; the three that follow ask for something
// other than a bag, and between them they point at the two places nothing else
// points at — the quarry road, and the door at the back of the bandit camp.
export const QUESTS: Record<QuestId, QuestDefinition> = {
  'rat-bones': {
    id: 'rat-bones',
    name: 'Bones for the Broth',
    giverNpcId: 'shopkeeper',
    description: 'Bring me ten rat bones from the town rats and I will see you fitted out.',
    objective: { kind: 'collect', itemId: 'rat-bones', quantity: 10 },
    reward: {
      copper: 120,
      xp: 90,
      gear: { warrior: 'brown-helmet', wizard: 'brown-cloth-hat' },
    },
  },
  // The one errand off the chain, and the only quest in the game that asks for
  // nothing but the walk. It is what tells a new character the quarry is there
  // at all — and it pays for the pickaxe on the shelf behind the shopkeeper.
  'quarry-road': {
    id: 'quarry-road',
    name: 'The Quarry Road',
    giverNpcId: 'shopkeeper',
    description:
      'There is a new cut in the hills north of town. Walk up and see what they are pulling out of it — I will pay for the news.',
    objective: { kind: 'visit', zoneId: 'quarry' },
    reward: { copper: 60, xp: 40 },
  },
  'crab-feast': {
    id: 'crab-feast',
    name: 'A Feast of Crab',
    giverNpcId: 'shopkeeper',
    description:
      'Twenty cooked crab, if you please. You will want a fire and a steady hand at the pan.',
    objective: { kind: 'collect', itemId: 'cooked-crab', quantity: 20 },
    requires: ['rat-bones'],
    reward: {
      copper: 240,
      xp: 180,
      gear: { warrior: 'brown-chestplate', wizard: 'brown-robe' },
    },
  },
  // Deliberately fewer bandits than a full armour set costs: a kill objective
  // should ride on a grind the player is already making rather than start a
  // second one. `tests/systems/progression.test.ts` holds that.
  'bandit-trouble': {
    id: 'bandit-trouble',
    name: 'Trouble on the Road',
    giverNpcId: 'shopkeeper',
    description:
      'The camp on the road has taken three carts of mine this month. Put twelve of them down and the road is worth using again.',
    objective: { kind: 'kill', enemyId: 'bandit', quantity: 12 },
    requires: ['crab-feast'],
    reward: { copper: 200, xp: 150 },
  },
  // The capstone, and the only thing in the game that says out loud that the
  // hideout exists: the key is a 3% drop, so without this the door behind the
  // camp is found by accident or not at all.
  'the-cutthroat': {
    id: 'the-cutthroat',
    name: 'The Cutthroat',
    giverNpcId: 'shopkeeper',
    description:
      'Hollis is the one giving the orders, and he keeps a locked door between himself and the road. Find the key on one of his men, then find him.',
    objective: { kind: 'kill', enemyId: 'bandit-chief', quantity: 1 },
    requires: ['bandit-trouble'],
    reward: { copper: 400, xp: 350 },
  },
};

export const QUEST_ORDER: QuestId[] = [
  'rat-bones',
  'quarry-road',
  'crab-feast',
  'bandit-trouble',
  'the-cutthroat',
];
