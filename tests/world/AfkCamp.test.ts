import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { AFK_ANCHOR_RADIUS, AFK_ENGAGE_RADIUS } from '../../src/systems/AfkSystem';
import { OUT_OF_COMBAT_DELAY_MS } from '../../src/systems/RegenSystem';
import type { EnemyId, ItemId } from '../../src/types/ids';
import { AFK_STATE_CHANGED_EVENT } from '../../src/ui/uiEvents';
import { AfkCamp } from '../../src/world/AfkCamp';
import { Mob } from '../../src/world/Mob';
import { ResourceNode } from '../../src/world/ResourceNode';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { RECIPES, type CraftingRecipe, type StationId } from '../../src/data/recipes';
import type { Targeting } from '../../src/world/targeting';
import { testContext } from './context';

/**
 * The camp with no zone around it. `afk.test.ts` proves it fights and gives the
 * controls back in a real town; what is only cheap here is what it does with a
 * mob placed exactly where the rule turns over — at the anchor's edge, or with
 * the character too hurt to pull.
 */

beforeEach(() => {
  localStorage.clear();
});

function ratAt(x: number, y: number): Mob {
  return new Mob(x, y, ENEMIES.rat, 1, () => 0.5);
}

function camped(mobs: Mob[] = [], nodes: ResourceNode[] = [], stations: StationId[] = []) {
  const kit = testContext();
  let target: Mob | null = null;
  let gathering = false;
  const pursued: Mob[] = [];
  const worked: ResourceNode[] = [];
  const crafted: CraftingRecipe[] = [];
  const eaten: ItemId[] = [];
  const awarded: number[] = [];
  const credited: Array<{ enemyId: EnemyId; count: number }> = [];
  const targeting: Targeting = {
    get target() {
      return target;
    },
    publishTarget: vi.fn(),
    pursueTarget(mob) {
      target = mob;
      pursued.push(mob);
    },
    clearTarget() {
      target = null;
    },
    stopPursuit: vi.fn(),
    // The stub answers `target` off a local rather than off the world, which is
    // the whole reason the camp can be asked these questions at all.
  };
  const deps = {
    mobs,
    nodes,
    targeting,
    stopGathering: vi.fn(),
    closeCounters: vi.fn(),
    eat: (itemId: ItemId) => eaten.push(itemId),
    // The world walks over and starts the channel; here that is just the record
    // of which node was chosen, plus the flag the loop reads back.
    gatherAt: (node: ResourceNode) => {
      worked.push(node);
      gathering = true;
    },
    stationsInReach: () => stations,
    craft: (recipe: CraftingRecipe) => {
      crafted.push(recipe);
      gathering = true;
    },
    isChanneling: () => gathering,
    awardXp: (reward: number) => awarded.push(reward),
    creditKill: (enemyId: EnemyId, count: number) => {
      credited.push({ enemyId, count });
      return [];
    },
  };
  return {
    ...kit,
    deps,
    targeting,
    pursued,
    worked,
    crafted,
    eaten,
    awarded,
    credited,
    selected: () => target,
    /** Ends the channel the way a spent node or a full pack does. */
    stopGathering: () => {
      gathering = false;
    },
    camp: new AfkCamp(kit.ctx, deps),
  };
}

describe('settling in', () => {
  it('gives up the two things a hand on the mouse was doing, and parks the session', () => {
    const { camp, deps, state, emissions } = camped();

    camp.toggle();

    expect(camp.active).toBe(true);
    expect(deps.stopGathering).toHaveBeenCalled();
    expect(deps.closeCounters).toHaveBeenCalled();
    expect(state.afk).toMatchObject({ zoneId: 'town' });
    expect(emissions(AFK_STATE_CHANGED_EVENT)).toEqual([[true]]);
  });

  it('clears the parked session on the way out', () => {
    const { camp, state, emissions } = camped();
    camp.toggle();

    camp.toggle();

    expect(camp.active).toBe(false);
    expect(state.afk).toBeNull();
    expect(emissions(AFK_STATE_CHANGED_EVENT)).toEqual([[true], [false]]);
  });

  it('says nothing when set to what it already is', () => {
    const { camp, emitted } = camped();

    camp.set(false);

    expect(emitted).toHaveLength(0);
  });
});

describe('holding the camp', () => {
  it('does nothing at all until it is switched on', () => {
    const { camp, pursued } = camped([ratAt(10, 0)]);

    camp.update();

    expect(pursued).toHaveLength(0);
  });

  it('picks the nearest mob in reach and closes on it', () => {
    const far = ratAt(AFK_ENGAGE_RADIUS - 10, 0);
    const near = ratAt(40, 0);
    const { camp, pursued } = camped([far, near]);
    camp.toggle();

    camp.update();

    expect(pursued).toEqual([near]);
  });

  it('leaves a mob out of reach alone rather than touring the zone', () => {
    const { camp, pursued, targeting } = camped([ratAt(AFK_ENGAGE_RADIUS + 10, 0)]);
    camp.toggle();

    camp.update();

    expect(pursued).toHaveLength(0);
    expect(targeting.stopPursuit).toHaveBeenCalled();
  });

  it('drops a fight that has been dragged off the spot it was left at', () => {
    const dragged = ratAt(40, 0);
    const kit = camped([dragged]);
    kit.camp.toggle();
    kit.camp.update();
    expect(kit.selected()).toBe(dragged);

    dragged.setPosition(AFK_ANCHOR_RADIUS * 2, 0);
    kit.camp.update();

    expect(kit.selected()).toBeNull();
  });

  it('stands down and eats rather than pulling while badly hurt', () => {
    const { camp, character, player, eaten, selected } = camped([ratAt(40, 0)]);
    character.addItem('cooked-fish', 1);
    camp.toggle();
    player.takeDamage(player.maxHp - 1);
    // The hit that hurt them also put them in combat, and food is
    // out-of-combat only — so this is the first frame after the lockout,
    // which regen has barely dented.
    player.update(OUT_OF_COMBAT_DELAY_MS + 1, {
      grid: [[0]],
      blockingTiles: new Set(),
      worldWidth: 1000,
      worldHeight: 1000,
      blockers: [],
    });

    camp.update();

    expect(selected()).toBeNull();
    expect(eaten).toEqual(['cooked-fish']);
  });
});

describe('a camp that was left running when the tab closed', () => {
  it('pays nothing, and reports nothing, when there was no session', () => {
    const { camp, awarded } = camped();

    expect(camp.resolveParked()).toBeNull();
    expect(awarded).toHaveLength(0);
  });

  it('credits the offline kills in full, and clears the session either way', () => {
    const { camp, state, awarded, credited } = camped();
    // Long enough that the camp is worth reporting on; what it earns per hour
    // is OfflineAfkSystem's business and is tested there.
    state.afk = {
      startedAt: new Date(Date.now() - 3600_000).toISOString(),
      zoneId: 'town',
      station: null,
    };

    const result = camp.resolveParked();

    expect(result?.report.kills).toBeGreaterThan(0);
    expect(awarded).toEqual([result?.report.xp]);
    expect(credited).toEqual([{ enemyId: result?.report.enemyId, count: result?.report.kills }]);
    expect(state.afk).toBeNull();
  });

  /**
   * The half of a making camp's payout that runs the other way. Paying out the
   * bars without taking the ore would mint metal, so `resolveParked` spends
   * what the report says the night spent — and tin is one rock in, one bar out,
   * with a failed roll costing nothing, so the two sides add up to what was in
   * the pack whatever the dice did.
   */
  it('spends what a night at the forge worked through, not just hands the bars over', () => {
    const { camp, character, state } = camped();
    character.addItem('tin-ore', 8);
    state.afk = {
      startedAt: new Date(Date.now() - 3600_000).toISOString(),
      zoneId: 'town',
      station: 'forge',
    };

    const result = camp.resolveParked();

    expect(result?.report.crafts).toBeGreaterThan(0);
    expect(character.itemCount('tin-bar')).toBe(result?.report.crafts);
    expect(character.itemCount('tin-ore') + character.itemCount('tin-bar')).toBe(8);
  });

  it('cannot pay twice, however many times a load asks', () => {
    const { camp, state } = camped();
    state.afk = {
      startedAt: new Date(Date.now() - 3600_000).toISOString(),
      zoneId: 'town',
      station: null,
    };

    camp.resolveParked();

    expect(camp.resolveParked()).toBeNull();
  });
});

/**
 * The camp with a tool in its hands rather than a weapon.
 *
 * What it works is read off the weapon slot every frame — a gathering tool *is*
 * that slot — so there is no mode to set and nothing new in the save. These
 * cover the turns in that rule; `afk.test.ts` drives a real town to prove it
 * actually chops.
 */
describe('a gathering camp', () => {
  const treeAt = (x: number, y: number): ResourceNode =>
    new ResourceNode(x, y, RESOURCE_NODES.tree);

  /** How many times the full-pack warning was said, on either channel. */
  const warnings = (emitted: { args: unknown[] }[]): number =>
    emitted.filter((entry) => JSON.stringify(entry.args).includes('nothing you find will be kept'))
      .length;

  function chopping(nodes: ResourceNode[], mobs: Mob[] = []) {
    const kit = camped(mobs, nodes);
    kit.character.addItem('felling-axe', 1);
    kit.character.equip('felling-axe');
    return kit;
  }

  it('works the nearest tree rather than picking a fight', () => {
    const near = treeAt(40, 0);
    const kit = chopping([treeAt(200, 0), near]);

    kit.camp.toggle();
    kit.camp.update();

    expect(kit.worked).toEqual([near]);
    expect(kit.selected()).toBeNull();
  });

  it('says which skill it settled in to, rather than just "camp"', () => {
    const kit = chopping([treeAt(40, 0)]);
    kit.camp.toggle();

    expect(kit.emitted.some((entry) => JSON.stringify(entry.args).includes('chop wood'))).toBe(
      true,
    );
  });

  // Settling in beside the tree you were already chopping must not stop you
  // chopping it — which is why only the fighting camp gives the channel up.
  it('leaves a channel already running alone', () => {
    const kit = chopping([treeAt(40, 0)]);
    kit.camp.toggle();
    expect(kit.deps.stopGathering).not.toHaveBeenCalled();
  });

  it('leaves the channel to finish rather than restarting it every frame', () => {
    const kit = chopping([treeAt(40, 0)]);
    kit.camp.toggle();
    kit.camp.update();
    kit.camp.update();
    kit.camp.update();

    expect(kit.worked).toHaveLength(1);
  });

  // The whole point of a camp over a tap: a tree is four swings and then
  // fifteen seconds of nothing, so it moves to the next one in the stand.
  it('moves to the next tree when the one it was on is chopped out', () => {
    const first = treeAt(40, 0);
    const second = treeAt(120, 0);
    const kit = chopping([first, second]);
    kit.camp.toggle();
    kit.camp.update();

    kit.stopGathering();
    while (!first.consumeCharge()) {
      /* chop it out */
    }
    kit.camp.update();

    expect(kit.worked).toEqual([first, second]);
  });

  it('waits beside a stand that is entirely chopped out', () => {
    const tree = treeAt(40, 0);
    const kit = chopping([tree]);
    kit.camp.toggle();
    while (!tree.consumeCharge()) {
      /* chop it out */
    }
    kit.camp.update();

    expect(kit.worked).toEqual([]);
    expect(kit.selected()).toBeNull();
  });

  /**
   * Being hit breaks the channel, so a woodcutter that ignored the thing
   * chewing on it would stand there re-arming a gather it could never finish
   * until it died.
   */
  it('drops the axe work to answer anything already chasing it', () => {
    const rat = ratAt(60, 0);
    const kit = chopping([treeAt(40, 0)], [rat]);
    kit.camp.toggle();
    rat.engage();
    kit.camp.update();

    expect(kit.selected()).toBe(rat);
    expect(kit.worked).toEqual([]);
  });

  // A fishing pole in a zone with no water is a camp with nothing to fish,
  // not one that should stand still until the tab closes.
  it('falls back to fighting where the tool has no work at all', () => {
    const rat = ratAt(60, 0);
    const kit = chopping([], [rat]);
    kit.camp.toggle();
    kit.camp.update();

    expect(kit.selected()).toBe(rat);
  });

  /**
   * A full pack does not stop the camp, it only stops it keeping anything: the
   * swing happened and the skill is what the swing teaches, so standing still
   * would cost the whole session rather than the logs. What it actually cost is
   * itemised on the away report.
   */
  it('keeps working a node it has no room for, and says so once', () => {
    const tree = treeAt(40, 0);
    const kit = chopping([tree]);
    kit.character.addItem('logs', kit.character.carryCapacity());
    kit.camp.toggle();
    kit.camp.update();
    kit.stopGathering();
    kit.camp.update();

    expect(kit.worked).toEqual([tree, tree]);
    // Once, at the toggle — the latch is what stops the frame after it saying
    // the same thing again, and every frame after that.
    expect(warnings(kit.emitted)).toBe(1);
  });

  // Said at the toggle rather than discovered on the away report in the
  // morning: settling in with a full pack is allowed, but nobody means to.
  it('warns up front when settling in with a pack that is already full', () => {
    const kit = chopping([treeAt(40, 0)]);
    kit.character.addItem('logs', kit.character.carryCapacity());

    kit.camp.toggle();

    const said = JSON.stringify(kit.emitted);
    expect(said).toContain('You settle in to chop wood.');
    expect(said).toContain('nothing you find will be kept');
  });

  it('says nothing of the sort when there is room', () => {
    const kit = chopping([treeAt(40, 0)]);
    kit.camp.toggle();
    expect(JSON.stringify(kit.emitted)).not.toContain('nothing you find will be kept');
  });
});

/**
 * The camp with a station under it rather than a tool in it.
 *
 * The turns worth holding cheaply are the ones about *order*: a station beats a
 * tool, anything already chewing beats both, and a bench is the one job a full
 * pack is no warning about. `afk.test.ts` drives a real forge to prove it
 * actually smelts.
 */
describe('a making camp', () => {
  const TIN = RECIPES['tin-bar'];

  function smelting(mobs: Mob[] = [], nodes: ResourceNode[] = []) {
    const kit = camped(mobs, nodes, ['forge']);
    kit.character.addItem('tin-ore', 8);
    return kit;
  }

  it('puts the first thing on the bench rather than picking a fight', () => {
    const kit = smelting([ratAt(60, 0)]);

    kit.camp.toggle();
    kit.camp.update();

    expect(kit.crafted).toEqual([TIN]);
    expect(kit.selected()).toBeNull();
  });

  it('says which skill it settled in to', () => {
    const kit = smelting();
    kit.camp.toggle();

    expect(kit.emitted.some((entry) => JSON.stringify(entry.args).includes('smith'))).toBe(true);
  });

  // The channel re-arms itself down the stack, so re-issuing it every frame
  // would put the same ore back on a cold clock forever.
  it('leaves the job running rather than restarting it every frame', () => {
    const kit = smelting();
    kit.camp.toggle();
    kit.camp.update();
    kit.camp.update();
    kit.camp.update();

    expect(kit.crafted).toHaveLength(1);
  });

  // The rule the whole loop is ordered around: being hit breaks the channel, so
  // a smith that ignored the thing chewing on it would stand at the forge
  // re-arming a job it could never finish until it died.
  it('answers something already chasing before it touches the bench', () => {
    const rat = ratAt(60, 0);
    const kit = smelting([rat]);
    kit.camp.toggle();
    rat.engage();

    kit.camp.update();

    expect(kit.crafted).toEqual([]);
    expect(kit.selected()).toBe(rat);
  });

  // The tool is still there and still read — it is simply second. Once the ore
  // is gone the pickaxe is what is left, which is what stops the precedence
  // from being a trap.
  it('gives the tool in hand its turn back once the ore is gone', () => {
    const kit = camped([], [new ResourceNode(40, 0, RESOURCE_NODES['tin-vein'])], ['forge']);
    kit.character.addItem('pickaxe', 1);
    kit.character.equip('pickaxe');
    kit.character.addItem('tin-ore', 1);

    kit.camp.toggle();
    kit.camp.update();
    expect(kit.crafted).toEqual([TIN]);

    kit.character.removeItem('tin-ore', 1);
    kit.stopGathering();
    kit.camp.update();

    expect(kit.worked).toHaveLength(1);
  });

  // A making camp spends what it is carrying to make what it makes, so a full
  // pack is a bench getting lighter rather than a haul about to be lost.
  it('says nothing about a full pack, which is not what a bench is', () => {
    const kit = smelting();
    kit.character.addItem('logs', kit.character.carryCapacity());

    kit.camp.toggle();

    expect(JSON.stringify(kit.emitted)).not.toContain('nothing you find will be kept');
  });
});
