import { beforeEach, describe, expect, it } from 'vitest';
import { DULLED_PAIN_ARMOR, POTION_EFFECTS } from '../../src/data/potions';
import { RECIPES } from '../../src/data/recipes';
import { gatherDurationMs } from '../../src/systems/GatherSystem';
import {
  AFK_SET_REQUESTED_EVENT,
  DRINK_POTION_REQUESTED_EVENT,
  PLAYER_EFFECTS_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import type { ActiveEffect } from '../../src/systems/EffectSystem';
import { harness, nodeNamed } from './harness';

/**
 * Foraging, the still and the potions, driven as places (version 2 phase E2).
 *
 * `tests/systems/brewing.test.ts` holds what the tables claim; this is what
 * only a running zone can answer — that a sickle cuts a patch on the strand,
 * that the still at Greyford brews, that a potion is drunk at full health and
 * its clock runs on game time and outlives the world it was drunk in, and that
 * each one does its job while it lasts.
 */

beforeEach(() => {
  localStorage.clear();
});

// High enough that no roll fails and no second one comes off: this is about
// what a job makes, not the dice.
const SURE = (): number => 0.99;

describe('foraging', () => {
  it('cuts samphire on the strand with a sickle, and trains foraging', () => {
    const { world, character, until } = harness({ zoneId: 'beach' });
    const patch = nodeNamed(world, 'samphire');
    character.addItem('sickle', 1);
    world.handleEquipRequested('sickle');
    world.teleport(patch.x, patch.y + 40);
    world.startGathering(patch);

    until(() => character.itemCount('samphire') > 0, 'the patch to yield samphire');
    expect(character.state.skills.foraging.xp).toBeGreaterThan(0);
  });

  it('cuts quicker while a Samphire Tonic lasts', () => {
    const { world, character, bus } = harness({ zoneId: 'beach' });
    const patch = nodeNamed(world, 'samphire');
    character.addItem('sickle', 1);
    character.addItem('samphire-tonic', 1);
    world.handleEquipRequested('sickle');
    world.teleport(patch.x, patch.y + 40);

    world.startGathering(patch);
    const plain = world.gatherState?.durationMs ?? 0;
    world.stopGathering();
    bus.emit(DRINK_POTION_REQUESTED_EVENT, 'samphire-tonic');
    world.startGathering(patch);

    expect(plain).toBe(gatherDurationMs(patch.definition, 1));
    expect(world.gatherState?.durationMs).toBeLessThan(plain);
  });
});

describe('the still', () => {
  function atTheStill() {
    const kit = harness({ zoneId: 'greyford', level: 5, rolls: SURE });
    const still = kit.world.stations.find((station) => station.station === 'still');
    if (!still) throw new Error('greyford has no still');
    kit.world.teleport(still.x, still.y + 40);
    kit.tick(1);
    return { ...kit, still };
  }

  it('brews two samphire into a tonic, and trains brewing', () => {
    const kit = atTheStill();
    kit.state.inventory = { samphire: 4 };

    kit.world.handleCraftRequested('samphire-tonic');
    kit.until(
      () => (kit.state.inventory['samphire-tonic'] ?? 0) === 2,
      'the still to brew both',
      RECIPES['samphire-tonic'].durationMs * 4,
    );
    expect(kit.state.inventory.samphire ?? 0).toBe(0);
    expect(kit.state.skills.brewing.xp).toBeGreaterThan(0);
  });

  it('is a station idle settles to, herbs in the bag', () => {
    const kit = atTheStill();
    kit.state.inventory = { samphire: 6 };
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);

    kit.until(() => (kit.state.inventory['samphire-tonic'] ?? 0) > 0, 'idle to brew', 30000);
    expect(kit.state.afk).toMatchObject({ zoneId: 'greyford', station: 'still' });
  });
});

describe('a potion', () => {
  it('is drunk at full health, out of the bag, and shows on the row of icons', () => {
    const { world, character, bus, emissions, tick } = harness();
    character.addItem('keepers-draught', 2);
    expect(world.player.hp).toBe(world.player.maxHp);

    bus.emit(DRINK_POTION_REQUESTED_EVENT, 'keepers-draught');
    tick(1);

    expect(character.itemCount('keepers-draught')).toBe(1);
    const latest = emissions(PLAYER_EFFECTS_CHANGED_EVENT).at(-1)?.[0] as ActiveEffect[];
    expect(latest.map((effect) => effect.effectId)).toContain('keepers-watch');
  });

  it('runs on game time, and outlives the world it was drunk in', () => {
    const { bus, character, state, tick } = harness();
    character.addItem('bogbean-cordial', 1);
    bus.emit(DRINK_POTION_REQUESTED_EVENT, 'bogbean-cordial');
    tick(50); // ten seconds

    const left = state.potions.fortune ?? 0;
    expect(left).toBe(POTION_EFFECTS.fortune.durationMs - 10_000);
    // The clock is the character's, so a world built for the next zone reads it.
    const next = harness({ zoneId: 'beach' });
    next.state.potions = { ...state.potions };
    next.tick(1);
    expect(next.state.potions.fortune).toBeLessThan(left);
  });

  it('turns a hit with Dulled Pain, and stops when it runs out', () => {
    const { world, bus, character, tick } = harness();
    const bare = world.player.armor;
    character.addItem('meadowsweet-draught', 1);
    bus.emit(DRINK_POTION_REQUESTED_EVENT, 'meadowsweet-draught');
    tick(1);
    expect(world.player.armor).toBe(bare + DULLED_PAIN_ARMOR);

    tick(Math.ceil(POTION_EFFECTS['dulled-pain'].durationMs / 200) + 1);
    expect(world.player.armor).toBe(bare);
  });

  it('refuses what is not a potion, and spends nothing', () => {
    const { bus, character } = harness();
    character.addItem('cooked-fish', 1);
    bus.emit(DRINK_POTION_REQUESTED_EVENT, 'cooked-fish');
    expect(character.itemCount('cooked-fish')).toBe(1);
    expect(character.state.potions).toEqual({});
  });
});

describe("Keeper's Watch", () => {
  // A level 1 rat pays the same kill twice over: idle at half, then idle under
  // the watch at three-quarters.
  it('lifts what idle earns for a kill from a half to three-quarters', () => {
    const earned = (watching: boolean): number => {
      const kit = harness({ level: 3 });
      if (watching) kit.state.potions = { 'keepers-watch': 600_000 };
      const rat = kit.world.mobs.find((mob) => mob.level === 1);
      if (!rat) throw new Error('town has no level 1 rat');
      kit.world.teleport(rat.x - 40, rat.y);
      kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
      const before = kit.state.xp;
      kit.until(() => !rat.isAlive(), 'idle to kill the rat', 60000);
      return kit.state.xp - before;
    };
    const half = earned(false);
    const watched = earned(true);
    expect(watched).toBeGreaterThan(half);
  });
});
