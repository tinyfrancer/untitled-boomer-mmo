import { beforeEach, describe, expect, it } from 'vitest';
import { CONTEXT_ACTION_REQUESTED_EVENT } from '../../src/ui/uiEvents';
import { harness, nodeNamed } from './harness';
import { nth } from '../nth';

/**
 * The round trip, in a running zone: the world answers what is under the
 * pointer, and a line chosen back on the HUD channel reaches the same rules a
 * tap does.
 *
 * `ContextMenuSession.test.ts` covers what a menu says. What is only true with
 * a whole world under it is the other half — that asking costs nothing, and
 * that answering costs exactly what tapping would have.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('asking', () => {
  /**
   * The rule that separates this from a tap. A player mid-chop who right-clicks
   * a rat to see what it drops has not decided to stop chopping, and a camp
   * left running is not ended by reading a drop table.
   */
  it('changes nothing about what the player is already doing', () => {
    const { world, character } = harness();
    const tree = nodeNamed(world, 'tree');
    character.addItem('felling-axe', 1);
    world.handleEquipRequested('felling-axe');
    world.teleport(tree.x, tree.y + 40);
    world.startGathering(tree);

    world.inspect({ kind: 'mob', mob: nth(world.mobs) });

    expect(world.gatherState).not.toBeNull();
    expect(world.target).toBeNull();
  });
});

describe('answering', () => {
  it('selects and closes on the creature the menu was opened over', () => {
    const { world, bus } = harness();
    const rat = nth(world.mobs);

    world.inspect({ kind: 'mob', mob: rat });
    bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'attack');

    expect(world.target).toBe(rat);
  });

  it('drops the gather in progress, exactly as tapping the rat would', () => {
    const { world, character, bus } = harness();
    const tree = nodeNamed(world, 'tree');
    character.addItem('felling-axe', 1);
    world.handleEquipRequested('felling-axe');
    world.teleport(tree.x, tree.y + 40);
    world.startGathering(tree);

    world.inspect({ kind: 'mob', mob: nth(world.mobs) });
    bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'attack');

    expect(world.gatherState).toBeNull();
  });

  it('walks over and starts a gather when the line chosen was a node', () => {
    const { world, character, bus, until } = harness();
    const tree = nodeNamed(world, 'tree');
    character.addItem('felling-axe', 1);
    world.handleEquipRequested('felling-axe');
    world.teleport(tree.x + 150, tree.y);

    world.inspect({ kind: 'node', node: tree });
    bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'gather');

    until(() => world.gatherState !== null, 'the walk reached the tree');
  });

  it('is deaf to a line chosen after the zone was left', () => {
    const { world, bus } = harness();
    const rat = nth(world.mobs);

    world.inspect({ kind: 'mob', mob: rat });
    // Walking out is one of the three things that stop everything at once, and
    // what a menu was about is one of the things they stop.
    const signpost = nth(world.signposts);
    world.teleport(signpost.x, signpost.y);
    world.approachSignpost(signpost);
    bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'attack');

    expect(world.target).toBeNull();
  });

  it('stops listening once the world has been torn down', () => {
    const { world, bus } = harness();
    const rat = nth(world.mobs);
    world.inspect({ kind: 'mob', mob: rat });

    world.destroy();
    bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'attack');

    expect(world.target).toBeNull();
  });
});
