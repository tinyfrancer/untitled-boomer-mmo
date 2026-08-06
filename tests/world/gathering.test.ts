import { beforeEach, describe, expect, it } from 'vitest';
import { harness, nodeNamed } from './harness';
import { NOTICE_EVENT } from '../../src/ui/uiEvents';

/**
 * The gathering channel end to end: what starts one, what it pays, and the four
 * things that end it. Only a running channel can show any of it, which is why
 * this used to be the slowest stretch of the browser smoke check.
 */

beforeEach(() => {
  localStorage.clear();
});

function refusals(emitted: { event: string; args: unknown[] }[]): string[] {
  return emitted.filter((e) => e.event === NOTICE_EVENT).map((e) => String(e.args[0]));
}

describe('starting a channel', () => {
  it('refuses outright without the right tool, rather than silently channelling', () => {
    const { world, emitted } = harness();
    const tree = nodeNamed(world, 'tree');

    // The starting sword chops nothing.
    world.teleport(tree.x, tree.y + 40);
    world.startGathering(tree);

    expect(world.gatherState).toBeNull();
    expect(refusals(emitted)).not.toHaveLength(0);
  });

  it('starts once the axe is equipped', () => {
    const { world, character } = harness();
    const tree = nodeNamed(world, 'tree');
    character.addItem('felling-axe', 1);
    world.handleEquipRequested('felling-axe');

    world.teleport(tree.x, tree.y + 40);
    world.startGathering(tree);

    expect(world.gatherState).not.toBeNull();
  });

  it('refuses a node the character has not levelled up to', () => {
    const { world, character, emitted } = harness({ zoneId: 'beach' });
    const spot = nodeNamed(world, 'ocean-fishing-spot');
    character.addItem('fishing-pole', 1);
    world.handleEquipRequested('fishing-pole');

    world.teleport(spot.x, spot.y - 64);
    world.startGathering(spot);

    expect(world.gatherState).toBeNull();
    expect(refusals(emitted).join(' ')).toContain('5');
  });
});

describe('a running channel', () => {
  function chopping(): ReturnType<typeof harness> {
    const kit = harness();
    const tree = nodeNamed(kit.world, 'tree');
    kit.character.addItem('felling-axe', 1);
    kit.world.handleEquipRequested('felling-axe');
    kit.world.teleport(tree.x, tree.y + 40);
    kit.world.startGathering(tree);
    return kit;
  }

  it('yields the node and trains its skill, then re-arms itself', () => {
    const { world, character, until } = chopping();

    until(() => character.itemCount('logs') > 0, 'the tree to yield logs');
    expect(character.state.skills.woodcutting.xp).toBeGreaterThan(0);
    // Auto-repeat is what makes gathering something you can leave running.
    expect(world.gatherState).not.toBeNull();
  });

  it('cancels when the player walks out of range', () => {
    const { world, until } = chopping();
    const tree = nodeNamed(world, 'tree');

    // North-east rather than south, which would walk out of the zone.
    world.teleport(tree.x + 400, tree.y - 400);

    until(() => world.gatherState === null, 'the channel to cancel out of range', 5000);
  });

  it('stops on a full pack instead of looping forever, and adds nothing', () => {
    const { world, character, until } = chopping();
    // Weight-1 bones, exactly to the brim.
    character.addItem('rat-bones', character.carryCapacity());

    until(() => world.gatherState === null, 'the full pack to stop the channel');
    expect(character.itemCount('logs')).toBe(0);
  });

  it('breaks when something lands a hit, so gathering never ignores a mob', () => {
    const { world, emitted, until } = chopping();
    const tree = nodeNamed(world, 'tree');
    // Bring the fight to the tree rather than the other way about: the channel
    // is already running and the staging must not cancel it. It has to be a rat
    // that can reach the grove without leashing, or it turns for home on the
    // first frame and never swings.
    const rat = world.mobs.find(
      (mob) => Math.hypot(mob.spawnX - tree.x, mob.spawnY - tree.y) < mob.definition.leashRadius,
    );
    if (!rat) throw new Error('no rat spawns within leash of the grove');

    rat.setPosition(world.player.x, world.player.y);
    rat.engage();

    until(() => world.gatherState === null, 'a hit to interrupt the channel');
    expect(refusals(emitted)).toContain('You are interrupted!');
  });
});

describe('fishing', () => {
  it('runs the same channel through a different tool and an endless node', () => {
    const { world, character, until } = harness();
    const spot = nodeNamed(world, 'fishing-spot');
    character.addItem('fishing-pole', 1);
    world.handleEquipRequested('fishing-pole');

    // On the shore north of the spot: the spot itself is on water, which the
    // player cannot stand on.
    world.teleport(spot.x, spot.y - 64);
    world.startGathering(spot);

    until(() => character.itemCount('raw-fish') > 0, 'a fish to be caught');
    expect(character.state.skills.fishing.xp).toBeGreaterThan(0);
    // A pond does not run out of fish.
    expect(spot.isAvailable()).toBe(true);
  });
});
