import type { StandingMove } from './factions';
import type { ClassId, EnemyId, FactionRankId, ItemId, NpcId, QuestId, ZoneId } from '../types/ids';

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
  /**
   * Something to keep (F1): what the giver hands over at the end of a chain,
   * the same for every class, and good for nothing but a stand in the house.
   * Only a chain's last quest names one.
   */
  keepsake?: ItemId;
  /**
   * The house in Lampton (F1). Not stored anywhere when it is paid: whether
   * the house is somebody's is whether the quest that names it is done
   * (`ownsHouse`), so the one row that says so is the whole of the grant.
   */
  house?: true;
  /**
   * Standing moved with each faction (D3), once, on handing it in: whose work
   * it was, and anybody it was done against.
   */
  standing?: StandingMove;
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
  /**
   * A rank with a faction that has to be stood at before this is offered (D3):
   * work a person keeps for somebody they know. Drawn locked like a chain link,
   * naming the rank.
   */
  requiresRank?: FactionRankId;
  reward: QuestReward;
}

// The starter arc, and the chain it hangs off. The two collect quests walk a
// new character through the gather-cook loop and pay the armour the bandit
// table is least likely to hand over; the three that follow ask for something
// other than a bag, and between them they point at the two places nothing else
// points at — the quarry road, and the door at the back of the bandit camp.
// The upper band's five follow them.
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
      gear: { warrior: 'brown-helmet', wizard: 'brown-cloth-hat', ranger: 'brown-helmet' },
      standing: { company: 10 },
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
    reward: { copper: 60, xp: 40, standing: { company: 10 } },
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
      gear: { warrior: 'brown-chestplate', wizard: 'brown-robe', ranger: 'brown-chestplate' },
      standing: { company: 10 },
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
    reward: { copper: 200, xp: 150, standing: { company: 25 } },
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
    reward: { copper: 400, xp: 350, keepsake: 'pells-cart-bell', standing: { company: 50 } },
  },
  /*
   * The Company's, and the way the house becomes the player's (F1,
   * `data/house.ts`): held back by the starter arc's capstone, since the plot is
   * let to whoever has been useful, and asking for timber rather than coin, since
   * the roof wants mending before anybody lives under it. A gather errand a
   * level 3 does in town, paying the house and a little XP and no coin.
   */
  'a-roof-in-lampton': {
    id: 'a-roof-in-lampton',
    name: 'A Roof in Lampton',
    giverNpcId: 'quartermaster',
    description:
      "The Surveyor's House has stood empty since the survey went west, and the Company lets it to whoever is useful. You have been. Bring me twenty logs for the roof and it is yours.",
    objective: { kind: 'collect', itemId: 'logs', quantity: 20 },
    requires: ['the-cutthroat'],
    reward: { copper: 0, xp: 50, house: true, standing: { company: 25 } },
  },

  /*
   * The upper band's, and the starter arc's shape a band up: a chain that ends
   * on a named thing behind a rare key, and one errand off it. Given at Greyford
   * rather than in town, because the zones they send you to are the three round
   * the outpost and the two below the fen — and split between the two people
   * who stand there, so the chain crosses the yard: the outfitter wants what is
   * on the road, under the quarry and on the lurkers' backs, the fettler what
   * the raiders wear and what the king was buried in.
   *
   * Each kill objective asks for fewer than the grind through its zone's band
   * already makes, and every quest here together pays well under the climb from
   * the end of the starter arc to the cap. `tests/systems/progression.test.ts`
   * holds both.
   */
  'goblin-road': {
    id: 'goblin-road',
    name: 'The Road West',
    giverNpcId: 'outfitter',
    description:
      'Nothing comes up the road from town without the goblins going through it first. Put a dozen of them down and the carts can start coming this way again.',
    objective: { kind: 'kill', enemyId: 'goblin-scavenger', quantity: 12 },
    reward: { copper: 300, xp: 450, standing: { greyford: 40 } },
  },
  // The errand off the chain, as the quarry road is off the first one, and the
  // one that asks for what the Deep Cut is about: a seam rather than a fight.
  // Coal is behind mining 6, so it waits on the pick and not on the chain; and
  // on being known in the yard (D3), since it is a trade the outfitter offers
  // somebody worth trading with, which the road west's goblins earn.
  'cut-coal': {
    id: 'cut-coal',
    name: 'Coal from the Cut',
    giverNpcId: 'outfitter',
    description:
      'The seams under the quarry burn hotter than anything we cut up here. Bring me ten coal and I will know the pick in your hands is worth trading with.',
    objective: { kind: 'collect', itemId: 'coal', quantity: 10 },
    requiresRank: 'greyford-regular',
    reward: { copper: 250, xp: 350, standing: { greyford: 25 } },
  },
  /*
   * The link that pays gear, for the reason the starter arc's collect quests
   * do: each class is handed the chest its own tier drops least often — the
   * goblins' jerkin, and for a caster the fen's robe, off the marsh they are
   * standing in. It is a collect rather than the kill before it because a quest
   * that pays gear has to take in more weight than it hands back
   * (`CharacterController.test.ts`), and out here there is no shop to sell to
   * and no bank to put anything in when the pack is full.
   */
  'lurker-hides': {
    id: 'lurker-hides',
    name: 'Hides from the Fen',
    giverNpcId: 'outfitter',
    description:
      'Anything that lives in that marsh wears a hide the wet cannot get through. Eight of them off the lurkers and I will have something put by for you in return.',
    objective: { kind: 'collect', itemId: 'lurker-hide', quantity: 8 },
    requires: ['goblin-road'],
    reward: {
      copper: 250,
      xp: 400,
      gear: { warrior: 'studded-jerkin', wizard: 'fenweave-robe', ranger: 'studded-jerkin' },
      standing: { greyford: 25 },
    },
  },
  // Held back by the outfitter's work rather than by anything of the fettler's
  // own: the chain runs across the yard, so a locked row here names the quest
  // that opens it at the counter beside it.
  'blackwater-raiders': {
    id: 'blackwater-raiders',
    name: 'Raiders of Blackwater',
    giverNpcId: 'fettler',
    description:
      'The raiders in the fen wear better cloth than anybody finds in a marsh, and none of it was theirs. Put ten of them down and bring me word of what they carry.',
    objective: { kind: 'kill', enemyId: 'fen-raider', quantity: 10 },
    requires: ['lurker-hides'],
    reward: { copper: 400, xp: 650, standing: { greyford: 25 } },
  },
  // The capstone, and the barrow's equivalent of the cutthroat: the key is a 3%
  // drop off the raiders the quest before it sends you to, so this is what says
  // out loud that the door at the bottom of the fen exists. The Keepers count
  // the king laid as the mercy it is, his light being out, which earns back what
  // the ten raiders before it cost with them (decision 133).
  'the-barrow-king': {
    id: 'the-barrow-king',
    name: 'The Barrow King',
    giverNpcId: 'fettler',
    description:
      'Orlath was buried with more than anyone has ever dug up, and older work than any I know. One of those raiders carries the key to his barrow. Find it, then find him.',
    objective: { kind: 'kill', enemyId: 'barrow-king', quantity: 1 },
    requires: ['blackwater-raiders'],
    reward: {
      copper: 700,
      xp: 1200,
      keepsake: 'orlaths-seal-cast',
      standing: { greyford: 50, keepers: 50 },
    },
  },
};

export const QUEST_ORDER: QuestId[] = [
  'rat-bones',
  'quarry-road',
  'crab-feast',
  'bandit-trouble',
  'the-cutthroat',
  'a-roof-in-lampton',
  'goblin-road',
  'cut-coal',
  'lurker-hides',
  'blackwater-raiders',
  'the-barrow-king',
];
