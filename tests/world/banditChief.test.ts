import { beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness';
import { ENEMIES } from '../../src/data/enemies';
import { AFK_TOGGLE_REQUESTED_EVENT, KILLS_CHANGED_EVENT } from '../../src/ui/uiEvents';
import type { Mob } from '../../src/world/Mob';

/**
 * The named mob at the back of the hideout: what a fight with him is, and the
 * two rules that only exist because he is one of a kind.
 */

const CHIEF = 'bandit-chief';

function hideout(level = 3): Harness {
  return harness({ zoneId: 'bandit-hideout', level });
}

function chiefIn(kit: Harness): Mob {
  const chief = kit.world.mobs.find((mob) => mob.definition.id === CHIEF);
  if (!chief) throw new Error('the hideout has no chief');
  return chief;
}

beforeEach(() => {
  localStorage.clear();
});

describe('the chief', () => {
  it('stands in the hideout, alone and above everything else in it', () => {
    const kit = hideout();
    const chief = chiefIn(kit);

    expect(kit.world.mobs.filter((mob) => mob.definition.id === CHIEF)).toHaveLength(1);
    expect(chief.level).toBe(4);
    expect(chief.maxHp).toBeGreaterThan(
      Math.max(...kit.world.mobs.filter((mob) => mob !== chief).map((mob) => mob.maxHp)),
    );
  });

  // Deep enough in that arriving is not walking into him: the entrance hall and
  // the corridor are both clear, and his own men stand between.
  it('is not within reach of the way in', () => {
    const kit = hideout();
    const chief = chiefIn(kit);
    const spawn = kit.world.spawnPoint;

    expect(Math.hypot(chief.x - spawn.x, chief.y - spawn.y)).toBeGreaterThan(
      ENEMIES[CHIEF].aggroRadius ?? 0,
    );
  });

  it('swings back, like everything else that is hit', () => {
    const kit = hideout();
    const chief = chiefIn(kit);

    kit.world.teleport(chief.x, chief.y - 40);
    kit.world.setTarget(chief);

    kit.until(() => chief.isEngaged(), 'the chief to answer');
    kit.until(() => kit.world.player.hp < kit.world.player.maxHp, 'the chief to land a hit');
  });

  /**
   * A boss kill is credited like any other, through the one funnel every path
   * to a corpse goes down — which is what gives him a slayer chain of his own
   * without a line written for it.
   */
  it('credits its own kill counter and pays out its own table', () => {
    // Well past the fight's own level: standing in his chamber pulls one of his
    // men too, and the point of this is what a corpse is worth rather than
    // whether the fight is winnable — which the duel tests hold.
    const kit = hideout(10);
    const chief = chiefIn(kit);

    kit.world.teleport(chief.x, chief.y - 40);
    kit.world.setTarget(chief);
    kit.until(() => !chief.isAlive(), 'the chief to go down', 240000);

    expect(kit.state.kills[CHIEF]).toBe(1);
    expect(kit.emissions(KILLS_CHANGED_EVENT).at(-1)).toEqual([{ [CHIEF]: 1 }]);
    // The bandana is the one guaranteed drop, so a kill always shows it.
    expect(kit.character.itemCount('cutthroats-bandana')).toBe(1);
    expect(kit.state.currency).toBeGreaterThan(0);
  });

  /**
   * The rule that keeps the table worth running for. A camp settled in the
   * chamber fights the men and leaves him alone — sixty offline kills would turn
   * a drop worth making the trip for into a stack of them.
   */
  it('is never what an unattended camp picks a fight with', () => {
    const kit = hideout();
    const chief = chiefIn(kit);
    // Parked right on top of him, which is the case a distance check would miss.
    kit.world.teleport(chief.x, chief.y);
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
    expect(kit.world.afkActive).toBe(true);

    kit.tick(40);

    expect(kit.world.target).not.toBe(chief);
    expect(chief.hp).toBe(chief.maxHp);
  });

  // Not picking him is not the same as ignoring him. He aggros on sight, and a
  // camp that stood there while he swung would simply die.
  it('is fought back once he starts it', () => {
    const kit = hideout();
    const chief = chiefIn(kit);
    kit.world.teleport(chief.x, chief.y - 300);
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);

    chief.engage();
    kit.until(() => kit.world.target === chief, 'the camp to answer the chief');
  });
});
