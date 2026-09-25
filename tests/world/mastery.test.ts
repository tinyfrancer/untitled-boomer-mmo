import { beforeEach, describe, expect, it } from 'vitest';
import { harness, nodeNamed } from './harness';
import { MASTERY_TIERS } from '../../src/data/mastery';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { RECIPES } from '../../src/data/recipes';
import { masteryXp } from '../../src/systems/MasterySystem';
import {
  AFK_TOGGLE_REQUESTED_EVENT,
  MASTERY_CHANGED_EVENT,
  MASTERY_TIER_REACHED_EVENT,
} from '../../src/ui/uiEvents';

/**
 * What actually fills a pool, driven through the real channels rather than
 * asserted off the reducer: a swing at a tree and a fish over a fire both have
 * to reach `awardMastery`, and the two paths are separate lines of code.
 */

beforeEach(() => {
  localStorage.clear();
});

function chopping(): ReturnType<typeof harness> {
  const kit = harness();
  const tree = nodeNamed(kit.world, 'tree');
  kit.character.addItem('felling-axe', 1);
  kit.world.handleEquipRequested('felling-axe');
  kit.world.teleport(tree.x, tree.y + 40);
  kit.world.startGathering(tree);
  return kit;
}

describe('a gather', () => {
  it('teaches the node the xp the swing paid the skill', () => {
    const kit = chopping();
    kit.until(() => masteryXp(kit.state.mastery, 'tree') > 0, 'a tree pool to open');

    expect(masteryXp(kit.state.mastery, 'tree')).toBe(RESOURCE_NODES.tree.xpReward);
  });

  it('teaches it again on the next swing, since the channel re-arms', () => {
    const kit = chopping();
    kit.until(
      () => masteryXp(kit.state.mastery, 'tree') >= RESOURCE_NODES.tree.xpReward * 2,
      'two swings to land',
    );

    expect(masteryXp(kit.state.mastery, 'tree')).toBe(RESOURCE_NODES.tree.xpReward * 2);
  });

  it('teaches an unattended camp the node even when the haul will not fit', () => {
    // A full pack means different things to the two of them. An attended player
    // is stopped before the swing lands, so there is nothing to teach; a camp
    // keeps working and loses the haul, and the swing is still what taught it.
    const kit = harness();
    const tree = nodeNamed(kit.world, 'tree');
    kit.character.addItem('felling-axe', 1);
    kit.world.handleEquipRequested('felling-axe');
    kit.character.addItem('iron-ore', 400);
    // Anchored at the tree: a camp works the nearest ready node inside its
    // anchor radius, and the anchor is wherever it was settled.
    kit.world.teleport(tree.x, tree.y + 40);
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);

    kit.until(
      () => masteryXp(kit.state.mastery, 'tree') > 0,
      'a camp swing to land on a full pack',
    );

    expect(kit.state.inventory.logs ?? 0).toBe(0);
  });

  it('teaches an attended player nothing on a swing a full pack stopped', () => {
    const kit = chopping();
    kit.character.addItem('iron-ore', 400);
    kit.until(() => kit.world.gatherState === null, 'the channel to stop on a full pack');

    expect(masteryXp(kit.state.mastery, 'tree')).toBe(0);
  });

  it('fills only the pool for the node worked', () => {
    const kit = chopping();
    kit.until(() => masteryXp(kit.state.mastery, 'tree') > 0, 'a tree pool to open');

    expect(masteryXp(kit.state.mastery, 'fishing-spot')).toBe(0);
    expect(masteryXp(kit.state.mastery, 'tin-vein')).toBe(0);
  });

  it('publishes the pools so a sheet can redraw from them', () => {
    const kit = chopping();
    kit.until(() => masteryXp(kit.state.mastery, 'tree') > 0, 'a tree pool to open');

    const published = kit.emissions(MASTERY_CHANGED_EVENT);
    expect(published.length).toBeGreaterThan(0);
    expect(published.at(-1)?.[0]).toEqual(kit.state.mastery);
  });
});

describe('crossing a rung', () => {
  it('says so once, naming what was mastered and the rung reached', () => {
    const second = MASTERY_TIERS[1]!;
    const kit = harness();
    const tree = nodeNamed(kit.world, 'tree');
    kit.character.addItem('felling-axe', 1);
    kit.world.handleEquipRequested('felling-axe');
    // Parked one swing under the rung, so the next one crosses it.
    kit.state.mastery = { tree: second.threshold - RESOURCE_NODES.tree.xpReward };
    kit.world.teleport(tree.x, tree.y + 40);
    kit.world.startGathering(tree);

    kit.until(
      () => kit.emissions(MASTERY_TIER_REACHED_EVENT).length > 0,
      'the rung to be announced',
    );

    const [reached] = kit.emissions(MASTERY_TIER_REACHED_EVENT)[0] as [
      { targetId: string; targetName: string; tierName: string; rank: number },
    ];
    expect(reached.targetId).toBe('tree');
    expect(reached.targetName).toBe(RESOURCE_NODES.tree.name);
    expect(reached.tierName).toBe(second.name);
    expect(reached.rank).toBe(2);
  });

  it('stays quiet for a swing that crosses nothing', () => {
    const kit = chopping();
    kit.until(() => masteryXp(kit.state.mastery, 'tree') > 0, 'a swing to land');

    // The first rung is free and already stood on, so nothing was crossed.
    expect(kit.emissions(MASTERY_TIER_REACHED_EVENT)).toHaveLength(0);
  });

  it('persists the save on a crossing, which a closed tab must not undo', () => {
    const second = MASTERY_TIERS[1]!;
    const kit = harness();
    const tree = nodeNamed(kit.world, 'tree');
    kit.character.addItem('felling-axe', 1);
    kit.world.handleEquipRequested('felling-axe');
    kit.state.mastery = { tree: second.threshold - RESOURCE_NODES.tree.xpReward };
    kit.world.teleport(tree.x, tree.y + 40);
    kit.world.startGathering(tree);

    kit.until(
      () => kit.emissions(MASTERY_TIER_REACHED_EVENT).length > 0,
      'the rung to be announced',
    );

    const saved = JSON.parse(localStorage.getItem(localStorage.key(0) as string) as string);
    expect(saved.mastery.tree).toBeGreaterThanOrEqual(second.threshold);
  });
});

describe('a craft', () => {
  function cooking(): ReturnType<typeof harness> {
    const kit = harness();
    // Twelve rather than five, which is the whole of a flake worth fixing: the
    // burn rate at cooking 1 is 40%, so a stack of five is burnt through
    // entirely about one run in a hundred and the pool below never opens. The
    // roll is deliberately left alone — the test beneath this one holds the
    // relationship however the rolls fall — so what changes is the stack.
    kit.character.addItem('raw-fish', 12);
    kit.character.addItem('logs', 1);
    kit.world.handleLightFireRequested();
    kit.world.handleCookRequested('raw-fish');
    return kit;
  }

  it('teaches the recipe behind a success', () => {
    const kit = cooking();
    kit.until(() => masteryXp(kit.state.mastery, 'cooked-fish') > 0, 'a fish to come off the fire');

    // Credited in whole recipe rewards, whatever the burn rate did on the way.
    expect(masteryXp(kit.state.mastery, 'cooked-fish') % RECIPES['cooked-fish'].xpReward).toBe(0);
  });

  it('teaches nothing about the recipe for a burn', () => {
    // A botched fish teaches nothing about the fish, which is the same line
    // `result.xp` already draws — so a pool is fed by what came off the fire
    // rather than by time spent at it. The dice are left unloaded, so this holds
    // the relationship rather than forcing an outcome: however the rolls fell,
    // the pool is exactly the successes.
    const kit = cooking();
    kit.until(() => (kit.state.inventory['raw-fish'] ?? 0) === 0, 'the stack to be cooked through');

    const cooked = kit.state.inventory['cooked-fish'] ?? 0;
    const burnt = kit.state.inventory['burnt-fish'] ?? 0;
    expect(cooked + burnt).toBeGreaterThan(0);
    expect(masteryXp(kit.state.mastery, 'cooked-fish')).toBe(
      cooked * RECIPES['cooked-fish'].xpReward,
    );
  });
});
