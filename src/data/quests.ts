import type { ClassId, ItemId, NpcId, QuestId } from '../types/ids';

export interface QuestObjective {
  itemId: ItemId;
  quantity: number;
}

export interface QuestReward {
  copper: number;
  xp: number;
  // Keyed by class, because the two classes can't wear the same armour type —
  // a single item id here would hand half the game a reward it can't equip.
  gear: Record<ClassId, ItemId>;
}

export interface QuestDefinition {
  id: QuestId;
  name: string;
  giverNpcId: NpcId;
  description: string;
  // Turning in consumes exactly this, so the objective doubles as the price.
  objective: QuestObjective;
  reward: QuestReward;
}

// The starter arc. Between them the two quests walk a new character through all
// three zones and the gather-cook loop, and the gear they pay out covers the
// two slots the bandit table is least likely to fill on its own.
export const QUESTS: Record<QuestId, QuestDefinition> = {
  'rat-bones': {
    id: 'rat-bones',
    name: 'Bones for the Broth',
    giverNpcId: 'shopkeeper',
    description: 'Bring me ten rat bones from the town rats and I will see you fitted out.',
    objective: { itemId: 'rat-bones', quantity: 10 },
    reward: {
      copper: 120,
      xp: 90,
      gear: { warrior: 'brown-helmet', wizard: 'brown-cloth-hat' },
    },
  },
  'crab-feast': {
    id: 'crab-feast',
    name: 'A Feast of Crab',
    giverNpcId: 'shopkeeper',
    description:
      'Twenty cooked crab, if you please. You will want a fire and a steady hand at the pan.',
    objective: { itemId: 'cooked-crab', quantity: 20 },
    reward: {
      copper: 240,
      xp: 180,
      gear: { warrior: 'brown-chestplate', wizard: 'brown-robe' },
    },
  },
};

export const QUEST_ORDER: QuestId[] = ['rat-bones', 'crab-feast'];
