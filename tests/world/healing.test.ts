import { beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES } from '../../src/data/abilities';
import { harness } from './harness';

/**
 * The first thing in the game that heals on demand.
 *
 * Food is a channel and regen is an out-of-combat lockout, so both are answers
 * to *having been* in a fight rather than to being in one. What is worth
 * holding here is the arithmetic around the ceiling: a heal cast at full has to
 * report that it restored nothing, or the number floating off the player is a
 * lie about a cooldown that is now spent.
 */

beforeEach(() => {
  localStorage.clear();
});

const SECOND_WIND = ABILITIES['second-wind'].effect;
const HEAL_AMOUNT = SECOND_WIND.kind === 'heal' ? SECOND_WIND.amount : 0;

describe('a heal', () => {
  it('puts health back and says how much', () => {
    const kit = harness({ level: 3 });
    kit.world.player.takeDamage(HEAL_AMOUNT + 5);
    const hurt = kit.world.player.hp;

    kit.world.handleAbilityRequested('second-wind');

    expect(kit.world.player.hp).toBe(hurt + HEAL_AMOUNT);
    const healed = kit.tick(1).filter((event) => event.kind === 'heal');
    expect(healed.some((event) => event.kind === 'heal' && event.amount === HEAL_AMOUNT)).toBe(
      true,
    );
  });

  it('never overheals past the ceiling', () => {
    const kit = harness({ level: 3 });
    kit.world.player.takeDamage(2);

    kit.world.handleAbilityRequested('second-wind');

    expect(kit.world.player.hp).toBe(kit.world.player.maxHp);
  });

  // The cooldown is spent either way — that is what makes pressing it at full a
  // mistake rather than a no-op — so what is floated has to be the truth.
  it('reports nothing restored when cast at full health', () => {
    const kit = harness({ level: 3 });
    kit.tick(1);

    kit.world.handleAbilityRequested('second-wind');
    const healed = kit.tick(1).filter((event) => event.kind === 'heal');

    expect(healed.every((event) => event.kind === 'heal' && event.amount === 0)).toBe(true);
    expect(kit.world.player.hp).toBe(kit.world.player.maxHp);
  });

  it('costs the warrior nothing but the cooldown', () => {
    const kit = harness({ level: 3 });
    kit.world.player.takeDamage(10);

    kit.world.handleAbilityRequested('second-wind');
    const first = kit.world.player.hp;
    kit.world.player.takeDamage(10);
    kit.world.handleAbilityRequested('second-wind');

    // The second press is inside the cooldown, so it heals nothing at all.
    expect(kit.world.player.hp).toBe(first - 10);
  });

  // The wizard's is the same effect bought differently: mana, a shorter
  // cooldown, and a cast window that being hit takes away.
  it('is a cast for the wizard, and spends mana on it', () => {
    const kit = harness({ classId: 'wizard', level: 3 });
    kit.world.player.takeDamage(20);
    const mana = kit.world.player.mana;

    kit.world.handleAbilityRequested('mend');

    expect(kit.world.player.mana).toBe(mana - ABILITIES.mend.manaCost);
    // Nothing has landed yet: the spell is still in its window.
    expect(kit.tick(1).filter((event) => event.kind === 'heal')).toEqual([]);
  });

  /**
   * Cast in a loop on purpose. `Mend` fizzles like every other spell and the
   * harness leaves the dice unloaded, so a single cast asserting that health
   * came back is a test that fails one run in seven for the one reason it is
   * not about.
   */
  it('lands eventually, and heals when it does', () => {
    const kit = harness({ classId: 'wizard', level: 3 });
    const frames = Math.ceil(ABILITIES.mend.castTimeMs / 200) + 2;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      kit.world.player.restoreToFull();
      kit.world.player.takeDamage(20);
      kit.world.lastAbilityAt.clear();
      const hurt = kit.world.player.hp;

      kit.world.handleAbilityRequested('mend');
      kit.tick(frames);

      if (kit.world.player.hp > hurt) {
        expect(kit.world.player.hp).toBe(kit.world.player.maxHp);
        return;
      }
    }
    throw new Error('40 casts of Mend all fizzled');
  });
});
