import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ABILITIES } from '../../src/data/abilities';
import { ENEMIES } from '../../src/data/enemies';
import {
  CHANNEL_ENDED_EVENT,
  CHANNEL_PROGRESS_EVENT,
  CHANNEL_STARTED_EVENT,
  COMBAT_LOG_EVENT,
  NOTICE_EVENT,
} from '../../src/ui/uiEvents';
import { AbilityCaster } from '../../src/world/AbilityCaster';
import { Mob } from '../../src/world/Mob';
import type { Targeting } from '../../src/world/targeting';
import { testContext } from './context';

/**
 * The bar's decisions, with nothing selected unless a test says so.
 * `abilities.test.ts` casts in a real town until a spell lands; these are the
 * refusals, which are the branches that never reach the effect at all.
 */

beforeEach(() => {
  localStorage.clear();
});

function bar(target: Mob | null = null) {
  const kit = testContext({ classId: 'wizard' });
  const killed: Mob[] = [];
  const targeting: Targeting = {
    target,
    publishTarget: vi.fn(),
    pursueTarget: vi.fn(),
    clearTarget: vi.fn(),
    stopPursuit: vi.fn(),
  };
  const deps = {
    targeting,
    stopGathering: vi.fn(),
    resolveKill: (mob: Mob) => killed.push(mob),
    publishAbilityState: vi.fn(),
  };
  return { ...kit, deps, killed, caster: new AbilityCaster(kit.ctx, deps) };
}

function ratAt(x: number, y: number): Mob {
  return new Mob(x, y, ENEMIES.rat, 1, () => 0.5);
}

/** Stands still long enough for whatever is being cast to go off. */
function waitOutTheCast(caster: AbilityCaster): void {
  caster.update(ABILITIES.fireball.castTimeMs);
}

describe('what a cast is refused for', () => {
  it('belonging to another class, silently — the bar never drew that button', () => {
    const { caster, emitted } = bar();

    caster.cast('power-slash');

    expect(caster.lastCastAt.has('power-slash')).toBe(false);
    expect(emitted).toHaveLength(0);
  });

  it('an empty pool, with a reason', () => {
    const { caster, player, emissions } = bar(ratAt(0, 0));
    player.spendMana(player.maxMana);

    caster.cast('fireball');

    expect(caster.lastCastAt.has('fireball')).toBe(false);
    expect(emissions(NOTICE_EVENT)).toEqual([['Not enough mana.']]);
  });

  it('nothing selected to throw it at', () => {
    const { caster, emissions } = bar();

    caster.cast('fireball');

    expect(emissions(NOTICE_EVENT)).toEqual([['Fireball needs a target.']]);
  });

  it('a target beyond the spell’s own reach, which is not the weapon’s', () => {
    const { caster, emissions } = bar(ratAt(ABILITIES.fireball.range + 10, 0));

    caster.cast('fireball');

    expect(emissions(NOTICE_EVENT)).toEqual([['Your target is too far away.']]);
  });

  it('a cooldown that has not run out, counted off the world’s clock', () => {
    const rat = ratAt(10, 0);
    // Too fat to die to the casts below: a corpse would refuse the next one
    // for having no target, which is a different rule.
    rat.hp = 1000;
    const kit = bar(rat);
    kit.caster.cast('fireball');
    waitOutTheCast(kit.caster);
    kit.player.restoreToFull();

    kit.ctx.now = ABILITIES.fireball.cooldownMs - 1;
    kit.caster.cast('fireball');
    const refused = kit.emissions(NOTICE_EVENT).length;
    kit.ctx.now = ABILITIES.fireball.cooldownMs;
    kit.caster.cast('fireball');
    waitOutTheCast(kit.caster);

    expect(refused).toBe(1);
    expect(kit.emissions(NOTICE_EVENT)).toHaveLength(1);
  });

  it('being dead', () => {
    const { caster, player, emitted } = bar(ratAt(10, 0));
    player.takeDamage(player.maxHp);

    caster.cast('fireball');

    expect(caster.lastCastAt.has('fireball')).toBe(false);
    expect(emitted).toHaveLength(0);
  });
});

describe('a cast that goes through', () => {
  it('draws a bolt from the caster to the target, and hands a corpse to the funnel', () => {
    const rat = ratAt(10, 0);
    const kit = bar(rat);
    // Fireball fizzles a fifth of the time before skill, so cast until one
    // lands rather than letting a spell failure read as a missing bolt.
    for (let cast = 0; cast < 40 && rat.isAlive(); cast += 1) {
      rat.hp = 1;
      kit.player.restoreToFull();
      kit.caster.lastCastAt.clear();
      kit.caster.cast('fireball');
      waitOutTheCast(kit.caster);
    }

    const events = kit.drain();
    expect(events.filter((event) => event.kind === 'bolt-cast').length).toBeGreaterThan(0);
    expect(kit.killed).toEqual([rat]);
    expect(kit.deps.stopGathering).toHaveBeenCalled();
    expect(kit.deps.publishAbilityState).toHaveBeenCalled();
  });

  it('costs the mana and the cooldown whether or not it lands', () => {
    // A fizzle is charged for in full — that is what makes Destruction worth
    // levelling — so this asserts the pair whichever way the roll goes.
    const kit = bar(ratAt(10, 0));
    const before = kit.player.mana;

    kit.caster.cast('fireball');

    expect(kit.player.mana).toBe(before - ABILITIES.fireball.manaCost);
    expect(kit.caster.lastCastAt.get('fireball')).toBe(kit.ctx.now);
  });
});

/**
 * A cast time is a window in which standing still is the whole cost. What is
 * committed at the press and what is decided at the end are deliberately
 * different lists, and most of these are about which is which.
 */
describe('a spell with a cast time', () => {
  const CAST_MS = ABILITIES.fireball.castTimeMs;

  it('does not land on the press, and does land when the clock runs out', () => {
    const kit = bar(ratAt(10, 0));

    kit.caster.cast('fireball');
    expect(kit.caster.isCasting()).toBe(true);
    expect(kit.drain()).toEqual([]);

    kit.caster.update(CAST_MS);
    expect(kit.caster.isCasting()).toBe(false);
    // A fizzle is a legal outcome, so what is asserted is that it resolved at
    // all — the log line only the resolution writes.
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'You cast Fireball.' }),
    );
  });

  it('opens the channel bar at the press and closes it when it lands', () => {
    const kit = bar(ratAt(10, 0));

    kit.caster.cast('fireball');
    expect(kit.emissions(CHANNEL_STARTED_EVENT)).toEqual([['Fireball']]);

    kit.caster.update(CAST_MS / 2);
    expect(kit.emissions(CHANNEL_PROGRESS_EVENT).at(-1)).toEqual([0.5]);
    expect(kit.emissions(CHANNEL_ENDED_EVENT)).toHaveLength(0);

    kit.caster.update(CAST_MS / 2);
    expect(kit.emissions(CHANNEL_ENDED_EVENT)).toHaveLength(1);
  });

  it('leaves the pool and the cooldown spent the moment the button goes down', () => {
    const kit = bar(ratAt(10, 0));
    const before = kit.player.mana;

    kit.caster.cast('fireball');

    expect(kit.player.mana).toBe(before - ABILITIES.fireball.manaCost);
    expect(kit.caster.lastCastAt.get('fireball')).toBe(kit.ctx.now);
  });

  /**
   * The whole point of the window. Everything was paid at the press, so an
   * interrupt costs the mana and the cooldown and delivers nothing — which is
   * what makes standing still a decision rather than a formality.
   */
  it('is broken by walking, and charged for anyway', () => {
    const kit = bar(ratAt(10, 0));
    kit.caster.cast('fireball');
    const spent = kit.player.mana;

    kit.player.moveTo(500, 500);
    kit.caster.update(CAST_MS);

    expect(kit.caster.isCasting()).toBe(false);
    expect(kit.player.mana).toBe(spent);
    expect(kit.drain().filter((event) => event.kind === 'bolt-cast')).toEqual([]);
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'Your Fireball is interrupted.' }),
    );
  });

  // Refused rather than begun and broken next frame: a spell that could never
  // finish should not take the mana with it.
  it('is refused outright while already walking', () => {
    const kit = bar(ratAt(10, 0));
    const before = kit.player.mana;
    kit.player.moveTo(500, 500);

    kit.caster.cast('fireball');

    expect(kit.caster.isCasting()).toBe(false);
    expect(kit.player.mana).toBe(before);
    expect(kit.emissions(NOTICE_EVENT)).toEqual([['You cannot cast while moving.']]);
  });

  it('is refused while one is already going off', () => {
    const kit = bar(ratAt(10, 0));
    kit.caster.cast('fireball');
    kit.caster.lastCastAt.clear();
    kit.player.restoreToFull();

    kit.caster.cast('fireball');

    expect(kit.emissions(NOTICE_EVENT)).toEqual([['You are already casting.']]);
  });

  /**
   * Range is asked again at the end because a cast takes over a second: a mob
   * that leashed home during it is out of reach of a spell that was in range
   * when it started.
   */
  it('misses a target that left while it was being cast', () => {
    // A fizzle never reaches the range question at all, so this re-casts until
    // one gets far enough to ask it. Nothing is drawn either way, which is the
    // half that holds on every attempt.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const rat = ratAt(10, 0);
      const kit = bar(rat);
      kit.caster.cast('fireball');

      rat.x = ABILITIES.fireball.range + 100;
      kit.caster.update(CAST_MS);

      expect(kit.drain().filter((event) => event.kind === 'bolt-cast')).toEqual([]);
      if (kit.emissions(NOTICE_EVENT).length > 0) {
        expect(kit.emissions(NOTICE_EVENT)).toEqual([['Your target is too far away.']]);
        return;
      }
    }
    throw new Error('forty casts of Fireball all fizzled');
  });

  // The panic button. A shield you have to stand still for is one you can never
  // get up once you need it, so it lands on the press like a swing does.
  it('leaves an instant spell instant, with no bar at all', () => {
    const kit = bar();

    kit.caster.cast('mana-shield');

    expect(kit.caster.isCasting()).toBe(false);
    expect(kit.emissions(CHANNEL_STARTED_EVENT)).toEqual([]);
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'You cast Mana Shield.' }),
    );
  });

  it('drops the cast when the caster dies mid-spell', () => {
    const kit = bar(ratAt(10, 0));
    kit.caster.cast('fireball');

    kit.player.takeDamage(kit.player.maxHp);
    kit.caster.update(CAST_MS);

    expect(kit.caster.isCasting()).toBe(false);
    expect(kit.drain().filter((event) => event.kind === 'bolt-cast')).toEqual([]);
  });
});

describe('what the bar draws', () => {
  it('is one state per ability of the class, and nobody else’s', () => {
    const { caster } = bar();

    expect(caster.states().map((state) => state.abilityId)).toEqual([
      'fireball',
      'mana-shield',
      'mend',
      'firestorm',
    ]);
  });

  it('sweeps a full cooldown down to nothing over the world’s clock', () => {
    const kit = bar(ratAt(10, 0));
    kit.caster.cast('fireball');

    const atCast = kit.caster.states()[0];
    kit.ctx.now = ABILITIES.fireball.cooldownMs / 2;
    const halfway = kit.caster.states()[0];
    kit.ctx.now = ABILITIES.fireball.cooldownMs;
    const ready = kit.caster.states()[0];

    expect(atCast?.cooldownRemaining).toBe(1);
    expect(halfway?.cooldownRemaining).toBeCloseTo(0.5);
    expect(ready?.cooldownRemaining).toBe(0);
    expect(atCast?.usable).toBe(false);
  });

  it('calls an ability unusable while the pool is short of it', () => {
    const { caster, player } = bar();
    player.spendMana(player.maxMana);

    expect(caster.states().every((state) => state.usable)).toBe(false);
  });
});
