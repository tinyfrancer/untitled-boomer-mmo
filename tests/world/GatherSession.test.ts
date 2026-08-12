import { beforeEach, describe, expect, it } from 'vitest';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { RECIPES, FIRE_BURN_MS, STATION_RADIUS } from '../../src/data/recipes';
import {
  CHANNEL_ENDED_EVENT,
  CHANNEL_STARTED_EVENT,
  INVENTORY_CHANGED_EVENT,
  NOTICE_EVENT,
} from '../../src/ui/uiEvents';
import { GatherSession } from '../../src/world/GatherSession';
import type { WorldStation } from '../../src/world/zoneEntities';
import { ResourceNode } from '../../src/world/ResourceNode';
import { testContext } from './context';

/**
 * The hands rather than the weapon. `gathering.test.ts` and `cooking.test.ts`
 * drive these through a real zone in game time; what is only worth stating here
 * is the set of refusals, and the one rule that joins the four — that a fire
 * within reach is what makes a pan legal.
 */

beforeEach(() => {
  localStorage.clear();
});

function session(options: { camping?: boolean; stations?: WorldStation[] } = {}) {
  const kit = testContext();
  return {
    ...kit,
    gathering: new GatherSession(kit.ctx, {
      stations: options.stations ?? [],
      isCamping: () => options.camping ?? false,
    }),
  };
}

function treeAt(x: number, y: number): ResourceNode {
  return new ResourceNode(x, y, RESOURCE_NODES.tree);
}

describe('the channel', () => {
  it('refuses a node the player has no tool for, and starts nothing', () => {
    const { gathering, emissions } = session();

    gathering.start(treeAt(0, 0));

    expect(gathering.state).toBeNull();
    expect(emissions(CHANNEL_STARTED_EVENT)).toHaveLength(0);
    expect(emissions(NOTICE_EVENT)).toHaveLength(1);
  });

  it('refuses a node that has been worked out', () => {
    const { gathering, character, emissions } = session();
    character.addItem('felling-axe', 1);
    character.equip('felling-axe');
    const tree = treeAt(0, 0);
    while (tree.isAvailable()) tree.consumeCharge();

    gathering.start(tree);

    expect(gathering.state).toBeNull();
    expect(emissions(NOTICE_EVENT)).toEqual([['The Tree is spent.']]);
  });

  it('pays out, trains the skill and re-arms itself while charges remain', () => {
    const { gathering, character, ctx, emissions } = session();
    character.addItem('felling-axe', 1);
    character.equip('felling-axe');
    const tree = treeAt(0, 0);

    gathering.start(tree);
    for (let frame = 0; frame < 60 && character.itemCount('logs') === 0; frame += 1) {
      gathering.update(200);
    }

    expect(character.itemCount('logs')).toBeGreaterThan(0);
    expect(ctx.character.skillLevelOf('woodcutting')).toBeGreaterThanOrEqual(1);
    expect(gathering.state).not.toBeNull();
    expect(emissions(INVENTORY_CHANGED_EVENT)).toHaveLength(1);
  });

  it('breaks on a hit, and says so exactly once', () => {
    const { gathering, character, emissions } = session();
    character.addItem('felling-axe', 1);
    character.equip('felling-axe');
    gathering.start(treeAt(0, 0));

    gathering.interrupt();
    gathering.interrupt();

    expect(gathering.state).toBeNull();
    expect(emissions(NOTICE_EVENT)).toEqual([['You are interrupted!']]);
    expect(emissions(CHANNEL_ENDED_EVENT)).toHaveLength(1);
  });
});

describe('the fire', () => {
  it('needs logs to light', () => {
    const { gathering, emissions } = session();

    gathering.lightFire();

    expect(gathering.campfire).toBeNull();
    expect(emissions(NOTICE_EVENT)).toEqual([['You have no logs to burn.']]);
  });

  it('burns one log and replaces whatever was already lit', () => {
    const { gathering, character } = session();
    character.addItem('logs', 2);

    gathering.lightFire();
    const first = gathering.campfire;
    gathering.lightFire();

    expect(character.itemCount('logs')).toBe(0);
    expect(first?.isLit()).toBe(false);
    expect(gathering.campfire).not.toBe(first);
    expect(gathering.campfire?.isLit()).toBe(true);
  });

  it('is only in reach from beside it', () => {
    const { gathering, character, player } = session();
    character.addItem('logs', 1);
    gathering.lightFire();

    expect(gathering.isNearFire()).toBe(true);
    player.setPosition(STATION_RADIUS * 2, 0);
    expect(gathering.isNearFire()).toBe(false);
  });
});

describe('the pan', () => {
  it('refuses with nothing cookable in the bag', () => {
    const { gathering, emissions } = session();

    gathering.cook();

    expect(emissions(NOTICE_EVENT)).toEqual([['You have nothing to cook.']]);
  });

  it('refuses away from a fire, and spends nothing', () => {
    const { gathering, character, emissions } = session();
    character.addItem('raw-fish', 1);

    gathering.cook('raw-fish');

    expect(character.itemCount('raw-fish')).toBe(1);
    expect(emissions(NOTICE_EVENT)).toHaveLength(1);
  });

  it('turns one raw thing into one cooked or burnt thing beside a fire', () => {
    const { gathering, character } = session();
    character.addItem('logs', 1);
    character.addItem('raw-fish', 1);
    gathering.lightFire();

    gathering.cook('raw-fish');
    gathering.update(RECIPES['cooked-fish'].durationMs);

    expect(character.itemCount('raw-fish')).toBe(0);
    expect(character.itemCount('cooked-fish') + character.itemCount('burnt-fish')).toBe(1);
  });

  it('is a channel: the press starts it and spends nothing', () => {
    const { gathering, character, emissions } = session();
    character.addItem('logs', 1);
    character.addItem('raw-fish', 1);
    gathering.lightFire();

    gathering.cook('raw-fish');

    expect(gathering.cooking).not.toBeNull();
    expect(character.itemCount('raw-fish')).toBe(1);
    expect(emissions(CHANNEL_STARTED_EVENT)).toEqual([['Raw Fish']]);
  });

  // The pan and the gather are one bar and one channel, so neither can be
  // running behind the other.
  it('gives the bar up to a gather started on top of it', () => {
    const { gathering, character } = session();
    character.addItem('logs', 1);
    character.addItem('raw-fish', 1);
    character.addItem('felling-axe', 1);
    character.equip('felling-axe');
    gathering.lightFire();
    gathering.cook('raw-fish');

    gathering.start(treeAt(0, 0));

    expect(gathering.cooking).toBeNull();
    expect(gathering.state).not.toBeNull();
  });

  it('ends when the fire it was over goes out', () => {
    const { gathering, character, emissions } = session();
    character.addItem('logs', 1);
    character.addItem('raw-fish', 1);
    gathering.lightFire();
    gathering.cook('raw-fish');

    gathering.update(FIRE_BURN_MS + 1);

    expect(gathering.cooking).toBeNull();
    expect(gathering.campfire).toBeNull();
    expect(emissions(CHANNEL_ENDED_EVENT)).toHaveLength(1);
    expect(character.itemCount('raw-fish')).toBe(1);
  });
});

describe('eating', () => {
  it('does nothing at full health, rather than throwing the food away', () => {
    const { gathering, character, emissions } = session();
    character.addItem('cooked-fish', 1);

    gathering.eat('cooked-fish');

    expect(character.itemCount('cooked-fish')).toBe(1);
    expect(emissions(NOTICE_EVENT)).toEqual([['You are already at full health.']]);
  });

  it('spends the item on a buff when there is damage to heal', () => {
    const { gathering, character, player } = session();
    character.addItem('cooked-fish', 1);
    player.takeDamage(5);

    gathering.eat('cooked-fish');

    expect(character.itemCount('cooked-fish')).toBe(0);
    expect(player.isEating()).toBe(true);
  });

  it('ignores an item that is not food', () => {
    const { gathering, character, player, emitted } = session();
    character.addItem('rat-bones', 1);
    player.takeDamage(5);

    gathering.eat('rat-bones');

    expect(character.itemCount('rat-bones')).toBe(1);
    expect(emitted).toHaveLength(0);
  });
});

/**
 * What a full pack means depends on who is watching, and that is the whole of
 * the fork: an attended player is right there and can make room, so nothing is
 * destroyed while they do. An unattended one is not, and stopping the camp dead
 * would cost them a night's XP rather than one haul.
 */
describe('a pack with no room for the haul', () => {
  function chopping(options: { camping?: boolean } = {}) {
    const kit = session(options);
    kit.character.addItem('felling-axe', 1);
    kit.character.equip('felling-axe');
    return kit;
  }

  /** Runs one gather to completion on a node the player is standing on. */
  function chop(kit: ReturnType<typeof chopping>, node: ResourceNode): void {
    kit.gathering.start(node);
    kit.player.setPosition(node.x, node.y);
    kit.gathering.update(RESOURCE_NODES.tree.baseGatherMs + 100);
  }

  it('stops an attended player rather than destroying what they cut', () => {
    const kit = chopping();
    const tree = treeAt(0, 0);
    kit.character.addItem('logs', kit.character.carryCapacity());
    const before = kit.character.skillLevelOf('woodcutting');

    chop(kit, tree);

    expect(kit.gathering.state).toBeNull();
    expect(kit.emissions(NOTICE_EVENT)).toEqual([['Your pack is full.']]);
    // The node keeps its charge and the skill earns nothing: the gather did
    // not happen, so nothing about the world moved.
    expect(tree.isAvailable()).toBe(true);
    expect(kit.state.skills.woodcutting.xp).toBe(0);
    expect(kit.character.skillLevelOf('woodcutting')).toBe(before);
  });

  it('keeps an unattended one working, and trains the skill for it', () => {
    const kit = chopping({ camping: true });
    const tree = treeAt(0, 0);
    kit.character.addItem('logs', kit.character.carryCapacity());

    chop(kit, tree);

    // Still channelling, re-armed for the next swing.
    expect(kit.gathering.state).not.toBeNull();
    expect(kit.state.skills.woodcutting.xp).toBeGreaterThan(0);
  });

  it('loses the haul rather than pocketing it, either way', () => {
    const camped = chopping({ camping: true });
    camped.character.addItem('logs', camped.character.carryCapacity());
    const carried = camped.character.itemCount('logs');

    chop(camped, treeAt(0, 0));

    expect(camped.character.itemCount('logs')).toBe(carried);
  });
});
