import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { ZONES } from '../../src/data/zones';
import { THEME } from '../../src/ui/theme';
import { ContextMenuSession } from '../../src/world/ContextMenuSession';
import { Mob } from '../../src/world/Mob';
import { ResourceNode } from '../../src/world/ResourceNode';
import type { WorldNpc, WorldSignpost } from '../../src/world/ZoneWorld';
import { nth } from '../nth';
import { testContext } from './context';

/**
 * The menu behind a right click, as the world sees it: what it offers, and what
 * it does with the answer.
 *
 * The thing worth pinning here is the shape of the wire. The HUD is handed a
 * description and hands back an action id, and this holds the only reference to
 * the rat in between — so a menu can be answered late, answered wrongly, or
 * answered about something that has since died, and none of those may reach the
 * simulation.
 */

const SIGNPOST: WorldSignpost = {
  x: 0,
  y: 0,
  exit: nth(ZONES.town.exits, 0),
  label: 'Beach',
};
const KEEPER: WorldNpc = { x: 0, y: 0, npcId: 'shopkeeper' };
const TELLER: WorldNpc = { x: 0, y: 0, npcId: 'banker' };

beforeEach(() => {
  localStorage.clear();
});

function session(options: { level?: number } = {}) {
  const kit = testContext({ level: options.level });
  const perform = vi.fn();
  return { ...kit, perform, menu: new ContextMenuSession(kit.ctx, { perform }) };
}

function rat(level = 1): Mob {
  return new Mob(100, 100, ENEMIES.rat, level, () => 0.5);
}

describe('what a menu offers', () => {
  it('names the creature at its level, in the colour the target frame uses', () => {
    const { menu } = session({ level: 1 });

    const subject = menu.open({ kind: 'mob', mob: rat(3) });

    expect(subject?.title).toBe('Rat (3)');
    expect(subject?.titleColor).toBe(THEME.color.con.deadly);
    expect(subject?.actions).toEqual([{ id: 'attack', label: 'Attack' }]);
  });

  // Everything a card shows is settled when it opens, so it can be left up
  // while the rat it describes wanders off — and a rat is a rat.
  it('carries the drop table with it rather than promising to fetch one', () => {
    const { menu } = session();

    const subject = menu.open({ kind: 'mob', mob: rat() });

    expect(subject?.loot?.drops?.map((drop) => drop.itemId)).toContain('rat-bones');
  });

  it("labels a gather with the skill's own verb", () => {
    const { menu } = session();
    const tree = new ResourceNode(0, 0, RESOURCE_NODES.tree);

    expect(menu.open({ kind: 'node', node: tree })?.actions).toEqual([
      { id: 'gather', label: 'Chop wood' },
    ]);
  });

  it('says where a signpost goes on the line that walks you there', () => {
    const { menu } = session();

    const subject = menu.open({ kind: 'signpost', signpost: SIGNPOST });

    expect(subject?.title).toBe('Beach Signpost');
    expect(subject?.actions).toEqual([{ id: 'travel', label: 'Travel to Beach' }]);
  });

  it('has nothing to say about open grass', () => {
    const { menu } = session();

    expect(menu.open({ kind: 'ground', point: { x: 10, y: 10 } })).toBeNull();
  });

  /**
   * The line an NPC offers is a fact about the person and not about their being
   * an NPC. Before the banker existed every one of them said "Shop", which the
   * second person to stand in a town would have inherited.
   */
  it('offers each counter its own line rather than the shop twice', () => {
    const { menu } = session();

    expect(menu.open({ kind: 'npc', npc: KEEPER })?.actions).toEqual([
      { id: 'shop', label: 'Shop' },
    ]);
    expect(menu.open({ kind: 'npc', npc: TELLER })?.actions).toEqual([
      { id: 'bank', label: 'Bank' },
    ]);
  });

  // A creature has no drop table until it is a creature; a tree is not one.
  it('offers Loot only for something that can be killed', () => {
    const { menu } = session();

    expect(menu.open({ kind: 'npc', npc: KEEPER })?.loot).toBeUndefined();
    expect(menu.open({ kind: 'mob', mob: rat() })?.loot).toBeDefined();
  });
});

describe('answering a menu', () => {
  it('does to the subject exactly what a tap on it would have done', () => {
    const { menu, perform } = session();
    const mob = rat();

    menu.open({ kind: 'mob', mob });
    menu.run('attack');

    expect(perform).toHaveBeenCalledWith({ kind: 'mob', mob });
  });

  it('spends the menu, so one press is worth one action', () => {
    const { menu, perform } = session();

    menu.open({ kind: 'mob', mob: rat() });
    menu.run('attack');
    menu.run('attack');

    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('ignores an action that names something other than what was pressed', () => {
    const { menu, perform } = session();

    menu.open({ kind: 'signpost', signpost: SIGNPOST });
    menu.run('attack');

    expect(perform).not.toHaveBeenCalled();
  });

  // Two NPCs share a subject kind and not an action, so the guard has to
  // compare the *role's* line rather than the kind's.
  it('will not bank at the shopkeeper or shop at the banker', () => {
    const { menu, perform } = session();

    menu.open({ kind: 'npc', npc: KEEPER });
    menu.run('bank');
    expect(perform).not.toHaveBeenCalled();

    menu.open({ kind: 'npc', npc: TELLER });
    menu.run('shop');
    expect(perform).not.toHaveBeenCalled();

    menu.open({ kind: 'npc', npc: TELLER });
    menu.run('bank');
    expect(perform).toHaveBeenCalledWith({ kind: 'npc', npc: TELLER });
  });

  // The gap between opening a menu and choosing a line is as long as the player
  // takes to read it, and a mob can die inside it. Walking over to attack a
  // corpse is the visible half; crediting the kill twice is not.
  it('refuses to attack something that died while the menu was open', () => {
    const { menu, perform } = session();
    const mob = rat();

    menu.open({ kind: 'mob', mob });
    mob.takeDamage(mob.maxHp);
    menu.run('attack');

    expect(perform).not.toHaveBeenCalled();
  });

  it('forgets the subject when the world it belonged to stops', () => {
    const { menu, perform } = session();

    menu.open({ kind: 'mob', mob: rat() });
    menu.clear();
    menu.run('attack');

    expect(perform).not.toHaveBeenCalled();
  });

  it('does nothing for an action nobody opened a menu for', () => {
    const { menu, perform } = session();

    menu.run('gather');

    expect(perform).not.toHaveBeenCalled();
  });
});
