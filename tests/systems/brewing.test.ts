import { describe, expect, it } from 'vitest';
import { ITEMS, potionEffectOf, toolItemFor } from '../../src/data/items';
import { POTION_EFFECTS, POTION_EFFECT_IDS } from '../../src/data/potions';
import { STATION_PERSISTS, STATION_SKILLS } from '../../src/data/recipes';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { SHOP_STOCK } from '../../src/data/shop';
import { SKILL_ORDER } from '../../src/data/skills';
import { ZONES } from '../../src/data/zones';
import { migrateCharacterState } from '../../src/persistence/migrations';
import {
  FIRST_VERSION_2_STATE,
  createNewCharacter,
  type AfkSession,
} from '../../src/persistence/CharacterState';
import { recipesAt } from '../../src/systems/CraftingSystem';
import { carryCapacity } from '../../src/systems/EncumbranceSystem';
import { idlePlan } from '../../src/systems/IdlePlanSystem';
import { itemUses } from '../../src/systems/ItemUseSystem';
import { rollLootTable } from '../../src/systems/LootSystem';
import { resolveOfflineAfk } from '../../src/systems/OfflineAfkSystem';
import {
  drinkPotion,
  fortuneDropMultiplier,
  potionArmor,
  potionEffects,
  potionGatherSpeed,
  spendPotionTime,
} from '../../src/systems/PotionSystem';
import { createInitialSkills } from '../../src/systems/SkillSystem';
import type { ItemId, ResourceNodeId, ZoneId } from '../../src/types/ids';

/**
 * Foraging, brewing and the four potions (version 2 phase E2), and the claims
 * that make them a line rather than eight more rows.
 *
 * The sweeps cover a good deal by construction: `deadEnds` that every herb is
 * brewed and every potion drunk, `CraftingSystem` that every row at the still is
 * brewing, the art tests that every herb, potion and patch is drawn, the spawn
 * sweeps where the patches and the still stand. The fight potion is held by the
 * duels in `EnemySystem.test.ts`. What is here would still pass if the line
 * quietly stopped being one.
 */

const HERBS: ResourceNodeId[] = ['samphire', 'meadowsweet', 'bog-myrtle', 'bogbean'];
const POTIONS: ItemId[] = POTION_EFFECT_IDS.map((effectId) => POTION_EFFECTS[effectId].itemId);

const zonesGrowing = (nodeId: ResourceNodeId): ZoneId[] =>
  Object.values(ZONES)
    .filter((zone) => zone.nodeSpawns.some((spawn) => spawn.nodeId === nodeId))
    .map((zone) => zone.id);

describe('foraging', () => {
  it('is a gathering skill with a tool of its own, sold beside the other three', () => {
    expect(SKILL_ORDER).toContain('foraging');
    const sickle = toolItemFor('foraging');
    expect(sickle?.id).toBe('sickle');
    expect(SHOP_STOCK.find((entry) => entry.itemId === 'sickle')?.requires).toBeUndefined();
  });

  // The ladder every gathering skill climbs, one rung a band.
  it('climbs from the strand to the fen', () => {
    expect(HERBS.map((id) => RESOURCE_NODES[id].requiredLevel)).toEqual([1, 4, 6, 8]);
    for (const id of HERBS) expect(RESOURCE_NODES[id].skill).toBe('foraging');
  });

  // The user's answer: the fen and the mill road's bank, a low one on the
  // strand, and none in Lampton.
  it('grows on the strand, the mill road and in the fen, and never in Lampton', () => {
    expect(zonesGrowing('samphire')).toEqual(['beach']);
    expect(zonesGrowing('meadowsweet')).toEqual(['old-mill-road']);
    expect(zonesGrowing('bog-myrtle')).toEqual(['blackwater-fen']);
    expect(zonesGrowing('bogbean')).toEqual(['blackwater-fen']);
    expect(ZONES.town.nodeSpawns.some((spawn) => HERBS.includes(spawn.nodeId))).toBe(false);
  });
});

describe('the still', () => {
  it('is worked with brewing, stands at Greyford and is there in the morning', () => {
    expect(STATION_SKILLS.still).toBe('brewing');
    expect(STATION_PERSISTS.still).toBe(true);
    expect(ZONES.greyford.stationSpawns?.some((spawn) => spawn.station === 'still')).toBe(true);
    expect(recipesAt('still').map((recipe) => recipe.outputItemId)).toEqual(POTIONS);
  });

  /**
   * The tin vein's argument made again: the upper two potions each want a herb
   * from the rung below, so the strand's samphire and the mill road's
   * meadowsweet are still worth cutting once the fen is open.
   */
  it('keeps every herb worth cutting after the next opens', () => {
    const takers = (herb: ItemId) =>
      recipesAt('still').filter((recipe) => recipe.inputs.some((i) => i.itemId === herb));
    expect(takers('samphire').map((r) => r.id)).toEqual(['samphire-tonic', 'keepers-draught']);
    expect(takers('meadowsweet').map((r) => r.id)).toEqual([
      'meadowsweet-draught',
      'bogbean-cordial',
    ]);
  });

  // A failed brew spends nothing, as a bar does: the herbs were the walk.
  it('keeps the herbs when a brew fails', () => {
    for (const recipe of recipesAt('still')) expect(recipe.failureItemId).toBeUndefined();
  });

  // The still never makes anyone rich: a potion sells for a little over the
  // herbs behind it, so what it is worth is what it does.
  it('sells a potion for a little over its herbs', () => {
    for (const recipe of recipesAt('still')) {
      const herbs = recipe.inputs.reduce(
        (sum, input) => sum + (ITEMS[input.itemId].value ?? 0) * input.quantity,
        0,
      );
      const value = ITEMS[recipe.outputItemId].value ?? 0;
      expect(value, recipe.id).toBeGreaterThan(herbs);
      expect(value, recipe.id).toBeLessThanOrEqual(herbs * 1.5);
    }
  });
});

describe('a potion', () => {
  it('is one of each kind, and its card says what it does and for how long', () => {
    expect(new Set(POTIONS.map((id) => potionEffectOf(id))).size).toBe(4);
    for (const id of POTIONS) {
      expect(itemUses(id).some((line) => line.startsWith('Drink: '))).toBe(true);
      expect(itemUses(id).some((line) => line.endsWith(' min'))).toBe(true);
    }
  });

  it('starts its clock from full when drunk, and a second does not stack', () => {
    const once = drinkPotion({}, 'samphire-tonic');
    expect(once?.['quick-hands']).toBe(POTION_EFFECTS['quick-hands'].durationMs);
    const later = spendPotionTime(once ?? {}, 60_000);
    const again = drinkPotion(later, 'samphire-tonic');
    expect(again?.['quick-hands']).toBe(POTION_EFFECTS['quick-hands'].durationMs);
    expect(drinkPotion({}, 'cooked-fish')).toBeNull();
  });

  it('runs out, and does nothing once it has', () => {
    const drunk = drinkPotion({}, 'meadowsweet-draught') ?? {};
    expect(potionArmor(drunk)).toBeGreaterThan(0);
    const spent = spendPotionTime(drunk, POTION_EFFECTS['dulled-pain'].durationMs);
    expect(spent).toEqual({});
    expect(potionArmor(spent)).toBe(0);
    expect(potionGatherSpeed(spent)).toBe(0);
  });

  it('shows on the row of icons with the time it has left', () => {
    const timers = { fortune: 1000, 'quick-hands': 2000 };
    expect(potionEffects(timers).map((effect) => effect.effectId)).toEqual([
      'quick-hands',
      'fortune',
    ]);
  });
});

describe('Fortune', () => {
  // Every roll lands a tenth past the table's own chance for the lurker's hide,
  // so the hide comes only with luck; and luck never makes anything more than
  // certain.
  it('makes each drop likelier, and nothing more than certain', () => {
    const hide = LOOT_TABLES['bog-lurker'].entries.find((entry) => entry.itemId === 'lurker-hide');
    if (!hide) throw new Error('the lurker drops no hide');
    const roll = () => hide.chance * 1.1;
    const unlucky = rollLootTable('bog-lurker', roll, 1);
    const lucky = rollLootTable('bog-lurker', roll, fortuneDropMultiplier({ fortune: 1000 }));
    expect(unlucky.drops.some((drop) => drop.itemId === 'lurker-hide')).toBe(false);
    expect(lucky.drops.some((drop) => drop.itemId === 'lurker-hide')).toBe(true);
    expect(rollLootTable('bog-lurker', () => 0.9999, 1000).drops.length).toBe(
      LOOT_TABLES['bog-lurker'].entries.length,
    );
  });
});

describe('a night away', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');
  const HOUR = 3_600_000;
  const parked = (zoneId: ZoneId, awayMs = HOUR): AfkSession => ({
    startedAt: new Date(NOW - awayMs).toISOString(),
    zoneId,
    station: null,
    restedMs: 0,
  });
  const base = {
    now: NOW,
    classId: 'warrior' as const,
    characterLevel: 5,
    inventory: {},
    capacity: carryCapacity(50),
    skills: createInitialSkills(),
    quiver: null,
    rng: () => 0.99,
  };

  /**
   * Keeper's Watch pays a night away three-quarters rather than half for the
   * minutes it had left, under the same ceiling: an hour of it over an hour away
   * is half as much again.
   */
  it('pays more XP for the time Keeper’s Watch had left, and only for that', () => {
    const fight = { ...base, gear: { ...createNewCharacter('A', 'warrior').gear } };
    const plain = resolveOfflineAfk(parked('old-mill-road'), fight);
    const watched = resolveOfflineAfk(parked('old-mill-road'), {
      ...fight,
      potions: { 'keepers-watch': HOUR },
    });
    const half = resolveOfflineAfk(parked('old-mill-road'), {
      ...fight,
      potions: { 'keepers-watch': HOUR / 2 },
    });
    expect(plain.kills).toBe(watched.kills);
    expect(watched.xp).toBe(Math.floor(plain.xp * 1.5));
    expect(half.xp).toBeGreaterThan(plain.xp);
    expect(half.xp).toBeLessThan(watched.xp);
  });

  // Ten minutes away, short of the one-level ceiling a night of gathering is
  // held to, so what is counted is the speed rather than the ceiling.
  it('cuts more herbs while a Samphire Tonic had time left', () => {
    const forager = {
      ...base,
      skills: { ...createInitialSkills(), foraging: { level: 9, xp: 0 } },
      gear: { helmet: null, chest: null, pants: null, weapon: 'sickle' as const, offhand: null },
    };
    const away = 10 * 60_000;
    const plain = resolveOfflineAfk(parked('beach', away), forager);
    const quick = resolveOfflineAfk(parked('beach', away), {
      ...forager,
      potions: { 'quick-hands': away },
    });
    expect(plain.capped).toBe(false);
    expect(plain.gathers).toBeGreaterThan(0);
    expect(quick.gathers).toBeGreaterThan(plain.gathers);
  });

  // The fight and luck potions are for a hand on the controls.
  it('pays nothing for the fight or the luck potion', () => {
    const fight = { ...base, gear: { ...createNewCharacter('A', 'warrior').gear } };
    const plain = resolveOfflineAfk(parked('old-mill-road'), fight);
    const drunk = resolveOfflineAfk(parked('old-mill-road'), {
      ...fight,
      potions: { 'dulled-pain': HOUR, fortune: HOUR },
    });
    expect(drunk).toEqual(plain);
  });

  it('is said on the idle panel, and which potions count away', () => {
    const character = createNewCharacter('A', 'warrior');
    const plan = idlePlan({
      ...character,
      level: 5,
      stations: [],
      potionsRunning: ['keepers-watch', 'fortune'],
    });
    expect(plan.potions).toHaveLength(2);
    expect(plan.potions[0]).toMatch(/^Keeper's Watch: .*away too/);
    expect(plan.potions[1]).toMatch(/^Fortune: .*game open only/);
  });
});

describe('a save from before brewing', () => {
  it('learns the two skills at 1 and has drunk nothing', () => {
    const now = createNewCharacter('A', 'ranger') as unknown as Record<string, unknown>;
    const skills = { ...(now.skills as Record<string, unknown>) };
    delete skills.foraging;
    delete skills.brewing;
    // The version E2's step migrates from: the one before it, not the latest.
    const before = { ...now, version: FIRST_VERSION_2_STATE + 5, skills };
    delete (before as Record<string, unknown>).potions;

    const migrated = migrateCharacterState(before);
    expect(migrated?.skills.foraging).toEqual({ level: 1, xp: 0 });
    expect(migrated?.skills.brewing).toEqual({ level: 1, xp: 0 });
    expect(migrated?.potions).toEqual({});
  });
});
