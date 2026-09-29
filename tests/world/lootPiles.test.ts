import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness, type Harness } from './harness';
import { itemWeight } from '../../src/data/items';
import { createNewCharacter } from '../../src/persistence';
import { LOOT_PILE_LIFETIME_MS, rollLootTable } from '../../src/systems/LootSystem';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import {
  AFK_SET_REQUESTED_EVENT,
  CONTEXT_ACTION_REQUESTED_EVENT,
  INVENTORY_CHANGED_EVENT,
  NOTICE_EVENT,
} from '../../src/ui/uiEvents';
import { GameContext } from '../../src/world/GameContext';
import type { Mob } from '../../src/world/Mob';
import type { ItemId } from '../../src/types/ids';
import { recordingBus } from './harness';

/**
 * Loot that is not lost (act three, phase 10; decisions 62-63): a kill whose
 * drops a full pack refuses leaves them in a pile where it fell, for a minute,
 * and a tap takes what fits.
 *
 * Every test here loads the dice at zero, so a town rat drops both of what it
 * can — its bones and its meat, a pound each — and a pile's contents are a fact
 * rather than a roll.
 */

beforeEach(() => {
  localStorage.clear();
});

// A pound apiece, like both things a rat drops, so "room for one" means one.
const FILLER: ItemId = 'crab-meat';

function loaded(): Harness {
  return harness({ rolls: () => 0 });
}

/** Fills the pack to within `spare` of its capacity. */
function fillPack(kit: Pick<Harness, 'character'>, spare = 0): void {
  expect(itemWeight(FILLER)).toBe(1);
  const room = kit.character.carryCapacity() - kit.character.carriedWeight();
  kit.character.addItem(FILLER, room - spare);
}

/** Kills a rat where it stands, through the funnel both kill paths end in. */
function kill(kit: Pick<Harness, 'world'>, mob: Mob): void {
  mob.takeDamage(mob.maxHp);
  kit.world.resolveKill(mob);
}

function ratOf(kit: Pick<Harness, 'world'>, index = 0): Mob {
  const rat = kit.world.mobs.filter((mob) => mob.definition.id === 'rat')[index];
  if (!rat) throw new Error('town has too few rats');
  return rat;
}

const RAT_DROPS = rollLootTable('rat', () => 0).drops;

describe('a pile is left', () => {
  it('holding exactly what the pack refused, where the creature fell', () => {
    const kit = loaded();
    fillPack(kit, 1);
    const rat = ratOf(kit);

    kill(kit, rat);

    expect(RAT_DROPS).toHaveLength(2);
    const [pile] = kit.world.lootPiles;
    expect(kit.world.lootPiles).toHaveLength(1);
    // The first drop fitted in the one pound of room; only the second is here.
    expect(kit.character.itemCount(nth(RAT_DROPS, 0).itemId)).toBe(1);
    expect(pile?.contents()).toEqual([nth(RAT_DROPS, 1)]);
    expect({ x: pile?.x, y: pile?.y }).toEqual({ x: rat.x, y: rat.y });
  });

  it('as a moment the ear hears, and a notice the player reads', () => {
    const kit = loaded();
    fillPack(kit);
    const rat = ratOf(kit);

    kill(kit, rat);
    const events = kit.tick(1);

    expect(events.filter((event) => event.kind === 'loot-left')).toEqual([
      { kind: 'loot-left', at: { x: rat.x, y: rat.y } },
    ]);
    expect(kit.emissions(NOTICE_EVENT).flat().join(' ')).toContain('left where it fell');
  });

  it('by nothing that fitted', () => {
    const kit = loaded();

    kill(kit, ratOf(kit));

    expect(kit.world.lootPiles).toHaveLength(0);
    expect(kit.tick(1).some((event) => event.kind === 'loot-left')).toBe(false);
  });

  it('once per kill, even on the same spot as another', () => {
    const kit = loaded();
    fillPack(kit);
    const first = ratOf(kit, 0);
    const second = ratOf(kit, 1);
    second.setPosition(first.x, first.y);

    kill(kit, first);
    kill(kit, second);

    expect(kit.world.lootPiles).toHaveLength(2);
    expect(kit.world.lootPiles.map((pile) => pile.contents())).toEqual([RAT_DROPS, RAT_DROPS]);
  });

  it('never under a camp, which loses the drop the way it always did', () => {
    const kit = loaded();
    fillPack(kit);
    const rat = ratOf(kit);
    kit.world.teleport(rat.x - 40, rat.y);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
    expect(kit.world.afkActive).toBe(true);

    kill(kit, rat);

    expect(kit.world.lootPiles).toHaveLength(0);
    expect(kit.tick(1).some((event) => event.kind === 'loot-left')).toBe(false);
  });
});

describe('taking from a pile', () => {
  it('walks over and takes all of it when there is room', () => {
    const kit = loaded();
    fillPack(kit);
    const rat = ratOf(kit);
    kill(kit, rat);
    const pile = nth(kit.world.lootPiles);
    kit.character.removeItem(FILLER, 10);
    kit.world.teleport(pile.x - 300, pile.y);

    kit.world.tap({ kind: 'pile', pile });
    kit.until(() => kit.world.lootPiles.length === 0, 'the pile is taken up');

    for (const drop of RAT_DROPS) {
      expect(kit.character.itemCount(drop.itemId)).toBe(drop.quantity);
    }
    expect(pile.isGone()).toBe(true);
    expect(kit.emissions(INVENTORY_CHANGED_EVENT).length).toBeGreaterThan(0);
  });

  it('takes what fits and leaves the rest, still the player’s', () => {
    const kit = loaded();
    fillPack(kit);
    kill(kit, ratOf(kit));
    const pile = nth(kit.world.lootPiles);
    kit.character.removeItem(FILLER, 1);
    kit.world.teleport(pile.x, pile.y);

    kit.world.tap({ kind: 'pile', pile });

    expect(kit.character.itemCount(nth(RAT_DROPS, 0).itemId)).toBe(1);
    expect(pile.contents()).toEqual([nth(RAT_DROPS, 1)]);
    expect(kit.world.lootPiles).toEqual([pile]);
    expect(kit.emissions(NOTICE_EVENT).flat().join(' ')).toContain('still on the ground');

    // And the rest is there to come back for once there is room.
    kit.character.removeItem(FILLER, 1);
    kit.world.tap({ kind: 'pile', pile });
    expect(kit.world.lootPiles).toHaveLength(0);
  });

  it('takes nothing, and leaves the pile whole, when there is no room at all', () => {
    const kit = loaded();
    fillPack(kit);
    kill(kit, ratOf(kit));
    const pile = nth(kit.world.lootPiles);
    kit.world.teleport(pile.x, pile.y);

    kit.world.tap({ kind: 'pile', pile });

    expect(pile.contents()).toEqual(RAT_DROPS);
    expect(kit.emissions(NOTICE_EVENT).flat().join(' ')).toContain('too full to take any');
  });

  it('from the context menu, which describes what is in it', () => {
    const kit = loaded();
    fillPack(kit);
    kill(kit, ratOf(kit));
    const pile = nth(kit.world.lootPiles);
    kit.character.removeItem(FILLER, 10);
    kit.world.teleport(pile.x - 200, pile.y);

    const menu = kit.world.inspect({ kind: 'pile', pile });
    expect(menu?.title).toBe('Loot Pile');
    expect(menu?.actions).toEqual([{ id: 'take', label: 'Take' }]);
    expect(menu?.details.held).toEqual(RAT_DROPS);

    kit.bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'take');
    kit.until(() => kit.world.lootPiles.length === 0, 'the menu’s Take empties the pile');
  });

  it('does nothing for a pile that lapsed while the menu was up', () => {
    const kit = loaded();
    fillPack(kit);
    kill(kit, ratOf(kit));
    const pile = nth(kit.world.lootPiles);
    kit.world.inspect({ kind: 'pile', pile });

    kit.tick(LOOT_PILE_LIFETIME_MS / 200);
    kit.character.removeItem(FILLER, 10);
    kit.bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'take');

    expect(kit.world.player.hasMoveTarget()).toBe(false);
    expect(kit.character.itemCount(nth(RAT_DROPS, 0).itemId)).toBe(0);
  });
});

describe('how long a pile lies', () => {
  it('a minute of game time, and not a frame more', () => {
    const kit = loaded();
    fillPack(kit);
    kill(kit, ratOf(kit));

    kit.tick(LOOT_PILE_LIFETIME_MS / 200 - 1);
    expect(kit.world.lootPiles).toHaveLength(1);
    kit.tick(1);
    expect(kit.world.lootPiles).toHaveLength(0);
  });

  it('from the kill, whatever has been taken out of it since', () => {
    const kit = loaded();
    fillPack(kit);
    kill(kit, ratOf(kit));
    const pile = nth(kit.world.lootPiles);

    kit.tick(LOOT_PILE_LIFETIME_MS / 400);
    kit.character.removeItem(FILLER, 1);
    kit.world.teleport(pile.x, pile.y);
    kit.world.tap({ kind: 'pile', pile });
    expect(pile.contents()).toHaveLength(1);

    kit.tick(LOOT_PILE_LIFETIME_MS / 400);
    expect(kit.world.lootPiles).toHaveLength(0);
  });

  it('through the player’s death, since the respawn is in the same zone', () => {
    let die = 0;
    const kit = harness({ rolls: () => die });
    fillPack(kit);
    const rat = ratOf(kit);
    kill(kit, rat);
    const pile = nth(kit.world.lootPiles);

    // Standing on a live rat with one hit point left, as `ZoneWorld.test.ts`
    // stages a death — with the dice turned over, since a zero is a parry.
    die = 0.99;
    const killer = ratOf(kit, 1);
    kit.world.teleport(killer.x - 40, killer.y);
    kit.world.player.takeDamage(kit.world.player.hp - 1);
    killer.engage();
    const events = kit.tickUntil((seen) =>
      seen.some((e) => e.kind === 'death' && e.on === 'player'),
    );

    expect(events).toContainEqual({ kind: 'death', on: 'player' });
    expect(kit.world.lootPiles).toEqual([pile]);
    expect(pile.contents()).toEqual(RAT_DROPS);
  });

  it('only as long as the zone does: walking out and back finds nothing', () => {
    const state = createNewCharacter('Tester', 'warrior');
    const game = new GameContext({
      character: state,
      events: recordingBus([]),
      rng: () => 0.5,
      rolls: () => 0,
    });
    const town = game.currentWorld;
    fillPack(game);
    kill({ world: town }, ratOf({ world: town }));
    expect(town.lootPiles).toHaveLength(1);

    const walkOut = (edge: 'south' | 'north'): void => {
      const world = game.currentWorld;
      const { width, height } = zoneWorldSize(world.zone);
      world.player.setPosition(width / 2, edge === 'south' ? height : 0);
      let changed = false;
      for (let i = 0; i < 2; i += 1) changed = game.update(200).zoneChanged || changed;
      expect(changed, `walking out of ${world.zone.id} by the ${edge}`).toBe(true);
    };
    walkOut('south');
    expect(game.currentWorld.zone.id).toBe('beach');
    walkOut('north');

    expect(game.currentWorld.zone.id).toBe('town');
    expect(game.currentWorld).not.toBe(town);
    expect(game.currentWorld.lootPiles).toHaveLength(0);
  });
});
