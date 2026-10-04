import { describe, expect, it } from 'vitest';
import { MAX_GATHER_SKILL_LEVEL } from '../../src/config/constants';
import { ENEMIES } from '../../src/data/enemies';
import { ENEMY_ABILITIES, type EnemyAbilityDefinition } from '../../src/data/enemyAbilities';
import { ARMOR_TYPE_CLASSES, ITEMS, arrowDamage, isBow, itemValue } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { OUTFITTER_OFFERS } from '../../src/data/outfitter';
import { QUESTS } from '../../src/data/quests';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { SHOP_STOCK } from '../../src/data/shop';
import { ZONES } from '../../src/data/zones';
import { mitigatedDamage } from '../../src/systems/CombatSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import type { Gear } from '../../src/systems/InventorySystem';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import type { EnemyId, ItemId, RecipeId, ResourceNodeId, ZoneId } from '../../src/types/ids';

/**
 * Band 9-12's made tier (G3, decision 139): coldiron, mirehide, bog oak and
 * pike, landed whole before the band's zones so each zone agent finds its
 * ids and drawings under it. `deadEnds` holds that nothing here leads
 * nowhere; what is here is what makes it a tier rather than a reskin of
 * steel: where every piece reaches, what the step is worth in the duels, and
 * the rules the lower tiers set that this one keeps.
 */

const COLDIRON = [
  'coldiron-helmet',
  'coldiron-chestplate',
  'coldiron-legs',
  'coldiron-shield',
] as const;
const MIREHIDE = ['mirehide-cowl', 'mirehide-vest', 'mirehide-leggings'] as const;
const FENHIDE = ['fenhide-cowl', 'fenhide-vest', 'fenhide-leggings'] as const;
const TOOLS = ['coldiron-pickaxe', 'coldiron-axe', 'coldiron-pole'] as const;

/**
 * The band's raw four, and where the plan puts each (`v2_plan.md`, "The
 * shape"): nothing yields them until those zones land, so the trace below
 * stops at the material rather than at a node, and names the zone the way
 * the plan does. A zone phase turns a name here into a node or a table.
 */
const RAW_FROM_THE_BAND: Record<string, ItemId> = {
  'Karn Tholl': 'coldiron-ore',
  'Lorhal, off its lurkers': 'mire-hide',
  'Lorhal, its drowned banks': 'bog-oak',
  'Lorhal, its deep water': 'raw-pike',
};
const RAW = new Set<ItemId>(Object.values(RAW_FROM_THE_BAND));

const recipeOf = (itemId: ItemId) =>
  Object.values(RECIPES).find((recipe) => recipe.outputItemId === itemId) ?? null;

const levelOf = (itemId: ItemId): number => RECIPES[itemId as RecipeId].requiredLevel;

const armourOf = (itemId: ItemId): number => {
  const item = ITEMS[itemId];
  return item.kind === 'equipment' ? (item.armorValue ?? 0) : 0;
};
const weightOf = (itemId: ItemId): number => ITEMS[itemId].weight ?? 0;
const sum = (ids: readonly ItemId[], of: (id: ItemId) => number): number =>
  ids.reduce((total, id) => total + of(id), 0);

/** Which zones a node is spawned in, which is the only place that is said. */
const zonesWorking = (nodeId: ResourceNodeId): ZoneId[] =>
  Object.values(ZONES)
    .filter((zone) => zone.nodeSpawns.some((spawn) => spawn.nodeId === nodeId))
    .map((zone) => zone.id);

/**
 * Where an item comes into the game, traced through what it is made of: the
 * walk `deadEnds.test.ts` and `deepCut.test.ts` make, with one more kind of
 * end. A material nothing yields yet is reported as itself, so a piece's
 * sources name the band's raw four beside the old world's nodes and kills.
 */
function sourcesOf(itemId: ItemId, seen: Set<ItemId> = new Set()): Set<string> {
  const sources = new Set<string>();
  if (seen.has(itemId)) return sources;
  seen.add(itemId);

  for (const node of Object.values(RESOURCE_NODES)) {
    if (node.yieldItemId === itemId) {
      zonesWorking(node.id).forEach((zoneId) => sources.add(`gather:${zoneId}`));
    }
  }
  for (const table of Object.values(LOOT_TABLES)) {
    if (table.entries.some((entry) => entry.itemId === itemId)) sources.add(`kill:${table.id}`);
  }
  if (RAW.has(itemId)) sources.add(`raw:${itemId}`);
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.outputItemId !== itemId) continue;
    for (const input of recipe.inputs) {
      sourcesOf(input.itemId, seen).forEach((source) => sources.add(source));
    }
  }
  return sources;
}

describe('where the tier reaches', () => {
  /**
   * The steel tier's web with the hold on the end of it: every coldiron piece
   * is the hold's ore and the Deep Cut's coal in the bar, the quarry's iron
   * and the Deep Cut's coal again in the steel it is riveted with, and the
   * road west's hardwood in the charcoal it is drawn over. Traced rather than
   * read back, so padding a row with a fifth bar and dropping a secondary
   * shows up as the web coming apart.
   */
  it('has Karn Tholl, the Deep Cut, the quarry and the road west behind every coldiron piece', () => {
    for (const itemId of COLDIRON) {
      expect([...sourcesOf(itemId)].sort(), itemId).toEqual([
        'gather:deep-cut',
        'gather:old-mill-road',
        'gather:quarry',
        'raw:coldiron-ore',
      ]);
      expect(RECIPES[itemId].inputs, itemId).toHaveLength(3);
    }
  });

  // The tin argument one band up: a coldiron piece still wants a steel bar,
  // so neither of the mines under the hold is retired the day it opens.
  it('keeps the quarry and the Deep Cut worth walking to after the hold opens', () => {
    for (const itemId of COLDIRON) {
      const inputs = RECIPES[itemId].inputs.map((input) => input.itemId);
      expect(inputs, itemId).toContain('steel-bar');
      expect(inputs, itemId).toContain('charcoal');
    }
    expect(RECIPES['coldiron-bar'].inputs.map((input) => input.itemId)).toContain('coal');
  });

  /**
   * The vat's second line reaches Lorhal through the hide and Karn Tholl
   * through the buckles, and both secondaries still come off the forge, which
   * is what keeps the tannery hanging off it rather than standing beside it.
   */
  it('has Lorhal, Karn Tholl, the Deep Cut and the road west behind every mirehide piece', () => {
    for (const itemId of MIREHIDE) {
      expect([...sourcesOf(itemId)].sort(), itemId).toEqual([
        'gather:deep-cut',
        'gather:old-mill-road',
        'raw:coldiron-ore',
        'raw:mire-hide',
      ]);
      const secondaries = RECIPES[itemId].inputs
        .map((input) => input.itemId)
        .filter((input) => input !== 'mirehide-leather');
      expect(secondaries.length, itemId).toBeGreaterThan(0);
      for (const secondary of secondaries) {
        expect(recipeOf(secondary)?.station, `${itemId} takes ${secondary}`).toBe('forge');
      }
    }
    expect(RECIPES['mirehide-leather'].inputs).toEqual([{ itemId: 'mire-hide', quantity: 1 }]);
  });

  // A coldiron arrow is Lorhal's bog oak and the hold's ore, and nothing but
  // the bench puts one together.
  it('puts Lorhal and Karn Tholl behind a coldiron arrow, off the bench alone', () => {
    expect([...sourcesOf('coldiron-arrows')].sort()).toEqual([
      'gather:deep-cut',
      'raw:bog-oak',
      'raw:coldiron-ore',
    ]);
    expect(RECIPES['coldiron-arrows'].station).toBe('bench');
    expect(RECIPES['coldiron-arrowheads'].station).toBe('forge');
    expect(RECIPES['bog-oak-shafts'].station).toBe('bench');
    for (const recipe of ['coldiron-arrowheads', 'bog-oak-shafts', 'coldiron-arrows'] as const) {
      expect(RECIPES[recipe].outputQuantity, recipe).toBe(15);
    }
  });

  /**
   * Nothing drops, sells, yields or trades the tier yet: the band's zones add
   * the nodes and the drops, and the hubs the tools' barter. Held so the pace
   * and the cap stay where they are until a zone moves them on purpose.
   */
  it('is handed out by nothing yet, so the pace and the cap are unmoved', () => {
    const everything = [
      ...COLDIRON,
      ...MIREHIDE,
      ...TOOLS,
      ...RAW,
      'coldiron-bar',
      'coldiron-arrows',
      'mirehide-leather',
      'cooked-pike',
    ] as ItemId[];
    for (const itemId of everything) {
      expect(
        Object.values(RESOURCE_NODES).some((node) => node.yieldItemId === itemId),
        itemId,
      ).toBe(false);
      expect(
        Object.values(LOOT_TABLES).some((table) =>
          table.entries.some((entry) => entry.itemId === itemId),
        ),
        itemId,
      ).toBe(false);
      expect(
        SHOP_STOCK.some((entry) => entry.itemId === itemId),
        itemId,
      ).toBe(false);
      expect(
        OUTFITTER_OFFERS.some((offer) => offer.itemId === itemId),
        itemId,
      ).toBe(false);
      expect(
        Object.values(QUESTS).some((quest) =>
          Object.values(quest.reward.gear ?? {}).includes(itemId),
        ),
        itemId,
      ).toBe(false);
    }
  });
});

/**
 * The ladder: the skills go to 20 (decision 131) and this is its first three
 * rungs past steel, at the stations that exist.
 */
describe('the ladder', () => {
  it('raises the skills to 20, and opens 11 to 13 of it', () => {
    expect(MAX_GATHER_SKILL_LEVEL).toBe(20);
    const levels = Object.values(RECIPES)
      .filter((recipe) => recipe.requiredLevel > 10)
      .map((recipe) => recipe.requiredLevel);
    expect(Math.min(...levels)).toBe(11);
    expect(Math.max(...levels)).toBe(13);
    for (const level of [11, 12, 13]) expect(levels, `${level}`).toContain(level);
  });

  it('is worked at the forge, the tannery, the bench and a fire', () => {
    const stations = {
      'coldiron-bar': 'forge',
      'coldiron-helmet': 'forge',
      'mirehide-leather': 'tannery',
      'mirehide-vest': 'tannery',
      'bog-oak-shafts': 'bench',
      'cooked-pike': 'fire',
    } as const;
    for (const [recipe, station] of Object.entries(stations)) {
      expect(RECIPES[recipe as RecipeId].station, recipe).toBe(station);
    }
  });

  // The smelt and the cure open the band, as steel's and fenhide's did, so a
  // smith or a tanner at 11 has something to climb on before a piece.
  it('opens each line on its cheapest row', () => {
    expect(levelOf('coldiron-bar')).toBe(11);
    expect(levelOf('mirehide-leather')).toBe(11);
    expect(levelOf('bog-oak-shafts')).toBe(11);
    expect(levelOf('cooked-pike')).toBe(11);
    for (const itemId of [...COLDIRON, ...MIREHIDE]) {
      expect(levelOf(itemId), itemId).toBeGreaterThanOrEqual(11);
    }
  });

  // A failure keeps the ore and the hide, as it does below; the pan burns.
  it('spends nothing on a failed smelt, cure or stitch, and burns a pike', () => {
    for (const recipe of Object.values(RECIPES).filter((row) => row.requiredLevel > 10)) {
      if (recipe.station === 'fire') expect(recipe.failureItemId, recipe.id).toBe('burnt-pike');
      else expect(recipe.failureItemId, recipe.id).toBeUndefined();
    }
  });
});

describe('what the tier is worth', () => {
  it('stops more and weighs more than steel, piece for piece', () => {
    const STEPS: Array<[ItemId, ItemId]> = [
      ['steel-helmet', 'coldiron-helmet'],
      ['steel-chestplate', 'coldiron-chestplate'],
      ['steel-legs', 'coldiron-legs'],
      ['steel-shield', 'coldiron-shield'],
    ];
    for (const [below, step] of STEPS) {
      expect(armourOf(step), step).toBeGreaterThan(armourOf(below));
      expect(weightOf(step), step).toBeGreaterThan(weightOf(below));
    }
  });

  /**
   * The fenhide rule one band up: cloth-class, so a wizard's, above the
   * fenhide it replaces, and short of the plate a smith of the same standing
   * makes, with intellect where the plate has strength. Its capstone shares
   * the plate's top level rather than passing it, since the band's three
   * recipe levels leave no fourth (decision 139).
   */
  it('keeps the leather a caster’s, above fenhide and short of the plate', () => {
    const plate = ['coldiron-helmet', 'coldiron-chestplate', 'coldiron-legs'] as const;
    expect(sum(MIREHIDE, armourOf)).toBeGreaterThan(sum(FENHIDE, armourOf));
    expect(sum(MIREHIDE, armourOf)).toBeLessThan(sum(plate, armourOf));
    expect(Math.max(...MIREHIDE.map(levelOf))).toBeGreaterThanOrEqual(
      Math.max(...plate.map(levelOf)),
    );
    const intellect = (id: ItemId): number => {
      const item = ITEMS[id];
      return item.kind === 'equipment' ? (item.intellectBonus ?? 0) : 0;
    };
    expect(sum(MIREHIDE, intellect)).toBeGreaterThan(sum(FENHIDE, intellect));
    for (const itemId of MIREHIDE) {
      const item = ITEMS[itemId];
      expect(item.kind === 'equipment' && item.armorType, itemId).toBe('cloth');
      expect(ARMOR_TYPE_CLASSES.cloth).toContain('wizard');
    }
  });

  // Worth more than what it swallows at the vat, the rule the tannery already
  // answers to; the forge's plate has never had to be.
  it('pays the vat more than the hide and the buckles it swallows', () => {
    for (const recipe of ['mirehide-leather', ...MIREHIDE] as const) {
      const paid = RECIPES[recipe].inputs.reduce(
        (total, input) => total + (itemValue(input.itemId) ?? 0) * input.quantity,
        0,
      );
      expect(itemValue(recipe) ?? 0, recipe).toBeGreaterThan(paid);
    }
  });

  /**
   * Two over steel rather than double it (decision 139): the line went crude
   * 1, iron 2, steel 4 and was capped at the chief's bow so the bow stays the
   * weapon, and three more doublings would put an arrow past every bow in the
   * game. So each tier's arrow is held under the best bow there is when it
   * lands, which is the king's longbow until the band's own.
   */
  it('adds more than a steel arrow and no more than the best bow in the game', () => {
    expect(arrowDamage('coldiron-arrows')).toBeGreaterThan(arrowDamage('steel-arrows'));
    const bows = Object.values(ITEMS).filter((item) => isBow(item.id));
    const best = Math.max(
      ...bows.map((bow) => (bow.kind === 'equipment' ? (bow.attackPowerBonus ?? 0) : 0)),
    );
    expect(arrowDamage('coldiron-arrows')).toBeLessThanOrEqual(best);
    // And fifteen sell for more than the log and the bar behind them, as the
    // line's rule is, with the halves priced at nothing.
    const paid = (itemValue('bog-oak') ?? 0) + (itemValue('coldiron-bar') ?? 0);
    expect((itemValue('coldiron-arrows') ?? 0) * 15).toBeGreaterThan(paid);
    expect(itemValue('bog-oak-shafts')).toBeNull();
    expect(itemValue('coldiron-arrowheads')).toBeNull();
  });

  // The rung above steel on the same floor, and still under the starting
  // weapons on attack power: a tool is never a stealth combat upgrade.
  it('makes the tools a fifth quicker again, and no better in a fight', () => {
    const STEEL_TOOLS = ['steel-pickaxe', 'steel-axe', 'steel-pole'] as const;
    const speedOf = (id: ItemId): number => {
      const item = ITEMS[id];
      return item.kind === 'equipment' ? (item.gatherSpeedBonus ?? 0) : 0;
    };
    const attackOf = (id: ItemId): number => {
      const item = ITEMS[id];
      return item.kind === 'equipment' ? (item.attackPowerBonus ?? 0) : 0;
    };
    TOOLS.forEach((tool, i) => {
      const below = STEEL_TOOLS[i] as ItemId;
      const item = ITEMS[tool];
      expect(item.kind === 'equipment' && item.toolFor, tool).toBe(
        ITEMS[below].kind === 'equipment' && ITEMS[below].toolFor,
      );
      expect(speedOf(tool), tool).toBeGreaterThan(speedOf(below));
      expect(attackOf(tool), tool).toBeLessThan(attackOf('rusty-sword'));
    });
  });

  // The band's meal heals more than the eel, over the same six seconds, and
  // its burnt half is worth less than either side of the trade it ruined.
  it('cooks into a better meal than the eel, and burns', () => {
    const heal = (id: ItemId): number => {
      const item = ITEMS[id];
      return item.kind === 'consumable' ? item.healAmount : 0;
    };
    expect(heal('cooked-pike')).toBeGreaterThan(heal('cooked-eel'));
    const pike = ITEMS['cooked-pike'];
    const eel = ITEMS['cooked-eel'];
    expect(pike.kind === 'consumable' && pike.healDurationMs).toBe(
      eel.kind === 'consumable' && eel.healDurationMs,
    );
    expect(itemValue('burnt-pike') ?? 0).toBeLessThan(itemValue('raw-pike') ?? 0);
  });
});

// --- The duels: the same model `EnemySystem.test.ts` holds the curve with,
// through the real stats and the real mitigation, at the band's levels.

interface Combatant {
  hp: number;
  attackPower: number;
  cooldownMs: number;
  armor: number;
}

function duel(player: Combatant, enemy: Combatant): 'player' | 'enemy' {
  const playerKillTime = (Math.ceil(enemy.hp / player.attackPower) - 1) * player.cooldownMs;
  const perHit = mitigatedDamage(enemy.attackPower, player.armor);
  const enemyKillTime = (Math.ceil(player.hp / perHit) - 1) * enemy.cooldownMs;
  return playerKillTime <= enemyKillTime ? 'player' : 'enemy';
}

function warrior(gear: Gear, level: number): Combatant {
  const stats = computeEffectiveStats('warrior', gear, level);
  return {
    hp: stats.maxHp,
    attackPower: stats.attackPower,
    cooldownMs: stats.attackCooldownMs,
    armor: stats.armor,
  };
}

function enemyAt(id: EnemyId, level: number): Combatant {
  const stats = scaleEnemyStats(ENEMIES[id], level);
  return {
    hp: stats.maxHp,
    attackPower: stats.attackPower,
    cooldownMs: ENEMIES[id].attackCooldownMs,
    armor: 0,
  };
}

function withAbility(
  enemy: Combatant,
  ability: EnemyAbilityDefinition,
  outcome: 'lands' | 'dodged',
): Combatant {
  const swings = ability.cooldownMs / enemy.cooldownMs;
  const spent = outcome === 'lands' ? ability.powerMultiplier : 0;
  const total = (swings - 1) * enemy.attackPower + enemy.attackPower * spent;
  return { ...enemy, attackPower: total / swings };
}

/**
 * What a warrior walks into the band wearing: everything the run-up to it
 * gives. The king's blade, since the barrow is the last zone before the band
 * and his is the best weapon in the world until the band's own; and the steel
 * set, or this tier's.
 */
const IN_STEEL: Gear = {
  helmet: 'steel-helmet',
  chest: 'steel-chestplate',
  pants: 'steel-legs',
  weapon: 'barrow-blade',
  offhand: 'steel-shield',
};
const IN_COLDIRON: Gear = {
  helmet: 'coldiron-helmet',
  chest: 'coldiron-chestplate',
  pants: 'coldiron-legs',
  weapon: 'barrow-blade',
  offhand: 'coldiron-shield',
};

/**
 * The band's creatures are the zones' to write; until they land, the wight
 * scaled to the band's levels stands in for them, since it is the hardest
 * common creature in the game and the fen's dead (G4) are its kin, and the
 * raider for a creature with no telegraph. A zone phase restates these
 * against its own rows.
 */
const chill = ENEMY_ABILITIES['grave-chill'];
const wight = (level: number, outcome: 'lands' | 'dodged'): Combatant =>
  withAbility(enemyAt('barrow-wight', level), chill, outcome);

describe('what the step is worth', () => {
  /**
   * The user's answer for G3: a piece gives the step the duels need, set so a
   * character geared in the tier beats the band's creatures at the band's
   * levels the way the curve is held now. A geared 11 beats an 11
   * comfortably, standing in its chill; sweats a 12, which it beats by
   * stepping out of each one and loses to standing in every one.
   */
  it('lets a level 11 in coldiron beat an 11 comfortably and sweat a 12', () => {
    const geared = warrior(IN_COLDIRON, 11);
    expect(duel(geared, wight(11, 'lands'))).toBe('player');
    expect(duel(geared, wight(11, 'dodged'))).toBe('player');
    expect(duel(geared, wight(12, 'dodged'))).toBe('player');
    expect(duel(geared, wight(12, 'lands'))).toBe('enemy');
    expect(duel(geared, enemyAt('fen-raider', 11))).toBe('player');
    expect(duel(geared, enemyAt('fen-raider', 12))).toBe('player');
  });

  // And steel is why: the same warrior in the tier below sweats the 11 and
  // loses the 12 however well they move, which is the step the tier is.
  it('is a step steel does not give', () => {
    const steel = warrior(IN_STEEL, 11);
    expect(duel(steel, wight(11, 'dodged'))).toBe('player');
    expect(duel(steel, wight(11, 'lands'))).toBe('enemy');
    expect(duel(steel, wight(12, 'dodged'))).toBe('enemy');
    expect(duel(steel, enemyAt('fen-raider', 11))).toBe('enemy');
  });

  // The tier carries the band and no further: a 13 in it loses to a 14 even
  // moving, which is what the next band's tier is for.
  it('runs out at the top of the band, where the next tier starts', () => {
    const top = warrior(IN_COLDIRON, 13);
    expect(duel(top, wight(13, 'dodged'))).toBe('player');
    expect(duel(top, wight(14, 'dodged'))).toBe('enemy');
  });
});
