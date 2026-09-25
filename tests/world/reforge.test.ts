import { beforeEach, describe, expect, it } from 'vitest';
import { NPC_INTERACT_RADIUS } from '../../src/data/npcs';
import { REFORGES } from '../../src/data/reforges';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { NOTICE_EVENT, REFORGES_CHANGED_EVENT } from '../../src/ui/uiEvents';
import { harness } from './harness';

/**
 * The fettler's counter, driven as a place.
 *
 * `tests/systems/ReforgeSystem.test.ts` holds what the tables claim; this is the
 * half only a running zone can answer — that the counter opens and shuts on the
 * same distances every other one does, that nothing is spent when a reforge is
 * refused, and that a piece reworked while it is being *worn* actually changes
 * what the character is.
 */

beforeEach(() => {
  localStorage.clear();
});

function atTheFettler(options: { level?: number } = {}) {
  const kit = harness({ zoneId: 'greyford', level: options.level ?? 9 });
  const fettler = kit.world.npcs.find((npc) => npc.npcId === 'fettler');
  if (!fettler) throw new Error('greyford has no fettler');
  kit.world.teleport(fettler.x, fettler.y + 40);
  kit.tick(1);
  return { ...kit, fettler };
}

/** Worn steel, a spare helmet to burn, and the stone to do it with. */
function kitted(kit: ReturnType<typeof atTheFettler>) {
  kit.state.gear = { ...kit.state.gear, helmet: 'steel-helmet' };
  kit.state.inventory = { 'brown-helmet': 1, 'reforging-stone': 1 };
  kit.world.approachNpc(kit.fettler);
  kit.tick(1);
}

describe('the counter', () => {
  it('opens on a tap and shuts when the player walks off', () => {
    const kit = atTheFettler();
    kit.world.approachNpc(kit.fettler);
    kit.tick(1);
    expect(kit.world.counterNpc('reforger')).not.toBeNull();

    kit.world.teleport(kit.fettler.x + NPC_INTERACT_RADIUS * 4, kit.fettler.y);
    kit.tick(2);
    expect(kit.world.counterNpc('reforger')).toBeNull();
  });

  it('reworks a worn piece, spending the stone and the spare', () => {
    const kit = atTheFettler();
    kitted(kit);

    kit.world.handleReforgeRequested('steel-helmet');

    const rolled = kit.state.reforges['steel-helmet'];
    expect(rolled, 'nothing was reforged').toBeTruthy();
    expect(kit.state.inventory['reforging-stone'] ?? 0).toBe(0);
    expect(kit.state.inventory['brown-helmet'] ?? 0).toBe(0);
    // And the HUD is told, since a reforge moves numbers the sheet draws
    // without the gear having changed at all.
    expect(kit.emissions(REFORGES_CHANGED_EVENT).at(-1)).toMatchObject([
      { 'steel-helmet': rolled },
    ]);
  });

  /**
   * The point of the whole feature: what the character *is* moves, and by
   * exactly what the table said it would.
   */
  it('changes what the character is worth wearing', () => {
    const kit = atTheFettler();
    kitted(kit);
    const before = computeEffectiveStats(kit.state.classId, kit.state.gear, kit.state.level);

    kit.world.handleReforgeRequested('steel-helmet');
    const rolled = kit.state.reforges['steel-helmet'];
    if (!rolled) throw new Error('nothing was reforged');

    const after = computeEffectiveStats(
      kit.state.classId,
      kit.state.gear,
      kit.state.level,
      kit.state.reforges,
    );
    const { from, to, take, give } = REFORGES[rolled];
    // Only the two stats the reforge named moved, and by what it said.
    if (from === 'armor') expect(after.armor).toBe(before.armor - take);
    if (to === 'armor') expect(after.armor).toBe(before.armor + give);
    if (from === 'health') expect(after.maxHp).toBe(before.maxHp - take);
    if (to === 'health') expect(after.maxHp).toBe(before.maxHp + give);
    expect(after).not.toEqual(before);
  });

  // Once, and for good. The second ask is refused with the piece named rather
  // than silently ignored, since a permanent thing has to say it is permanent.
  it('refuses a second reforge on the same piece and keeps the stone', () => {
    const kit = atTheFettler();
    kitted(kit);
    kit.world.handleReforgeRequested('steel-helmet');

    kit.character.addItem('reforging-stone', 1);
    kit.character.addItem('brown-helmet', 1);
    const was = kit.state.reforges['steel-helmet'];

    kit.world.handleReforgeRequested('steel-helmet');

    expect(kit.state.reforges['steel-helmet']).toBe(was);
    expect(kit.state.inventory['reforging-stone']).toBe(1);
    expect(kit.state.inventory['brown-helmet']).toBe(1);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain('already');
  });

  /**
   * All or nothing, which matters more here than anywhere else in the game: a
   * reforge cannot be undone by doing it again, so a half-applied one is not
   * something a player can work their way out of.
   */
  it('spends nothing at all when there is no stone', () => {
    const kit = atTheFettler();
    kit.state.gear = { ...kit.state.gear, helmet: 'steel-helmet' };
    kit.state.inventory = { 'brown-helmet': 1 };
    kit.world.approachNpc(kit.fettler);
    kit.tick(1);

    kit.world.handleReforgeRequested('steel-helmet');

    expect(kit.state.reforges['steel-helmet']).toBeUndefined();
    expect(kit.state.inventory['brown-helmet']).toBe(1);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain('Stone');
  });

  it('spends nothing when there is nothing to feed it', () => {
    const kit = atTheFettler();
    kit.state.gear = { ...kit.state.gear, helmet: 'steel-helmet' };
    kit.state.inventory = { 'reforging-stone': 1 };
    kit.world.approachNpc(kit.fettler);
    kit.tick(1);

    kit.world.handleReforgeRequested('steel-helmet');

    expect(kit.state.reforges['steel-helmet']).toBeUndefined();
    expect(kit.state.inventory['reforging-stone']).toBe(1);
  });

  /**
   * The ask/decide split, which is what keeps a panel in an HTML overlay from
   * outliving the thing it was about: a row tapped after the counter shut names
   * an item id that nothing answers.
   */
  it('does nothing at all once the counter is shut', () => {
    const kit = atTheFettler();
    kitted(kit);
    kit.world.teleport(kit.fettler.x + NPC_INTERACT_RADIUS * 4, kit.fettler.y);
    kit.tick(2);

    kit.world.handleReforgeRequested('steel-helmet');

    expect(kit.state.reforges['steel-helmet']).toBeUndefined();
    expect(kit.state.inventory['reforging-stone']).toBe(1);
  });

  /**
   * The duplicate case, which is half of why this exists: the crown that drops
   * every single time was pure vendor fodder, and here it is the fuel for the
   * one being worn.
   */
  it('burns a duplicate unique into the one you are wearing', () => {
    const kit = atTheFettler();
    kit.state.gear = { ...kit.state.gear, helmet: 'barrow-crown' };
    kit.state.inventory = { 'barrow-crown': 1, 'reforging-stone': 1 };
    kit.world.approachNpc(kit.fettler);
    kit.tick(1);

    kit.world.handleReforgeRequested('barrow-crown');

    expect(kit.state.reforges['barrow-crown']).toBeTruthy();
    expect(kit.state.inventory['barrow-crown'] ?? 0).toBe(0);
    // The one on your head is still there — only the spare went in.
    expect(kit.state.gear.helmet).toBe('barrow-crown');
  });

  // The cheapest thing that fits, chosen for the player: a panel asking which of
  // four helmets to melt is a second decision on top of the one that matters.
  it('feeds the least valuable piece that fits', () => {
    const kit = atTheFettler();
    kit.state.gear = { ...kit.state.gear, helmet: 'steel-helmet' };
    kit.state.inventory = {
      'brown-helmet': 1,
      'studded-helmet': 1,
      'barrow-crown': 1,
      'reforging-stone': 1,
    };
    kit.world.approachNpc(kit.fettler);
    kit.tick(1);

    kit.world.handleReforgeRequested('steel-helmet');

    expect(kit.state.inventory['brown-helmet'] ?? 0).toBe(0);
    expect(kit.state.inventory['studded-helmet']).toBe(1);
    expect(kit.state.inventory['barrow-crown']).toBe(1);
  });
});
