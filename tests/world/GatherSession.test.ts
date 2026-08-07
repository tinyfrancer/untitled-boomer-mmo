import { beforeEach, describe, expect, it } from 'vitest';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { FIRE_COOK_RADIUS } from '../../src/data/recipes';
import {
  GATHER_ENDED_EVENT,
  GATHER_STARTED_EVENT,
  INVENTORY_CHANGED_EVENT,
  NOTICE_EVENT,
} from '../../src/ui/uiEvents';
import { GatherSession } from '../../src/world/GatherSession';
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

function session() {
  const kit = testContext();
  return { ...kit, gathering: new GatherSession(kit.ctx) };
}

function treeAt(x: number, y: number): ResourceNode {
  return new ResourceNode(x, y, RESOURCE_NODES.tree);
}

describe('the channel', () => {
  it('refuses a node the player has no tool for, and starts nothing', () => {
    const { gathering, emissions } = session();

    gathering.start(treeAt(0, 0));

    expect(gathering.state).toBeNull();
    expect(emissions(GATHER_STARTED_EVENT)).toHaveLength(0);
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
    expect(emissions(GATHER_ENDED_EVENT)).toHaveLength(1);
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
    player.setPosition(FIRE_COOK_RADIUS * 2, 0);
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

    expect(character.itemCount('raw-fish')).toBe(0);
    expect(character.itemCount('cooked-fish') + character.itemCount('burnt-fish')).toBe(1);
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
