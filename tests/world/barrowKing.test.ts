import { beforeEach, describe, expect, it } from 'vitest';
import { harness, type Harness } from './harness';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { ENEMIES } from '../../src/data/enemies';
import { ENEMY_ABILITIES } from '../../src/data/enemyAbilities';
import {
  AFK_SET_REQUESTED_EVENT,
  COMBAT_LOG_EVENT,
  KILLS_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import type { Mob } from '../../src/world/Mob';

/**
 * The barrow, driven rather than read.
 *
 * `sunkenBarrow.test.ts` holds the tables; this holds that the zone actually
 * runs — which is a different question, and the one the hideout has had a file
 * for since it shipped. Two things down here have never been exercised anywhere:
 * a **telegraphed ability on something that respawns** (every one before this
 * hung off a boss), and a second locked zone reached from a different direction.
 */

const KING = 'barrow-king';
const WIGHT = 'barrow-wight';

function barrow(level = MAX_CHARACTER_LEVEL): Harness {
  return harness({ zoneId: 'sunken-barrow', level });
}

function kingIn(kit: Harness): Mob {
  const king = kit.world.mobs.find((mob) => mob.definition.id === KING);
  if (!king) throw new Error('the barrow has no king');
  return king;
}

/** The wight furthest from the king, which is the one met on the way in. */
function nearestWight(kit: Harness): Mob {
  const wights = kit.world.mobs.filter((mob) => mob.definition.id === WIGHT);
  const first = [...wights].sort((a, b) => a.y - b.y)[0];
  if (!first) throw new Error('the barrow has no wights');
  return first;
}

beforeEach(() => {
  localStorage.clear();
});

describe('the barrow', () => {
  it('builds nine dead things, one of them the king', () => {
    const kit = barrow();
    const king = kingIn(kit);

    expect(kit.world.mobs).toHaveLength(9);
    expect(kit.world.mobs.filter((mob) => mob.definition.id === KING)).toHaveLength(1);
    expect(king.level).toBe(8);
    expect(king.maxHp).toBeGreaterThan(
      Math.max(...kit.world.mobs.filter((mob) => mob !== king).map((mob) => mob.maxHp)),
    );
  });

  /**
   * Arriving is not walking into anything. The mouth runs the whole north edge
   * because a traveller lands anywhere along it, and the respawn is the middle of
   * the map — so both have to be outside everything's reach, which is the
   * difference between a zone that is hard and one that is a wasted key.
   */
  it('leaves the mouth and the respawn clear of everything in it', () => {
    const kit = barrow();
    const spawn = kit.world.spawnPoint;

    kit.world.mobs.forEach((mob) => {
      const reach = (mob.definition.aggroRadius ?? 0) + mob.definition.wander.radius;
      expect(
        Math.hypot(mob.x - spawn.x, mob.y - spawn.y),
        `${mob.definition.id} is standing on the respawn`,
      ).toBeGreaterThan(reach);
    });

    // Nothing wanders into the mouth either, which is the band the road arrives
    // on rather than a point: stepped for a while so a drifting wight is caught.
    kit.tick(200);
    kit.world.mobs.forEach((mob) => {
      expect(mob.y, `${mob.definition.id} wandered into the mouth`).toBeGreaterThan(
        ENEMIES[mob.definition.id].aggroRadius ?? 0,
      );
    });
  });

  /**
   * He swings back, and what that is worth saying about is *how fast*. A level 9
   * with nothing on kills in about a second down here — one Wail is 83 against 88
   * HP unmitigated — so the zone's gate is not the door at all: the door is a 3%
   * key, and the gate is the armour. `EnemySystem.test.ts` holds the fight a
   * character in the run-up's own gear actually gets; this holds what the gear is
   * for, which nothing measuring an armoured duel can say.
   */
  it('kills an unarmoured character rather than trading with one', () => {
    const kit = barrow();
    const king = kingIn(kit);

    kit.world.teleport(king.x, king.y - 40);
    kit.world.setTarget(king);

    kit.until(() => king.isEngaged(), 'the king to answer');
    const drawn = kit.tickUntil((events) =>
      events.some((event) => event.kind === 'death' && event.on === 'player'),
    );
    expect(drawn).toContainEqual({ kind: 'death', on: 'player' });

    // And a corpse gets up where it fell rather than in another zone: the barrow
    // is the walk back through the fen, so dying here cannot be a way home.
    expect({ x: kit.world.player.x, y: kit.world.player.y }).toEqual(kit.world.spawnPoint);
    expect(kit.world.player.hp).toBe(kit.world.player.maxHp);
  });

  /**
   * A boss kill is credited through the one funnel every path to a corpse goes
   * down, which is what gives him a slayer chain with no line written for it.
   *
   * Killed off one swing rather than fought, for the reason the chief's is:
   * standing in his chamber pulls four wights as well as a Wail, and a test about
   * what a corpse is worth should not also be a bet on surviving the fight.
   */
  it('credits its own kill counter and pays out its own table', () => {
    const kit = barrow();
    const king = kingIn(kit);

    kit.world.teleport(king.x, king.y - 40);
    kit.world.setTarget(king);
    king.hp = 1;
    kit.until(() => !king.isAlive(), 'the king to go down', 20000);

    expect(kit.state.kills[KING]).toBe(1);
    expect(kit.emissions(KILLS_CHANGED_EVENT).at(-1)).toEqual([
      expect.objectContaining({ [KING]: 1 }),
    ]);
    // The crown is the one guaranteed drop, so a kill always shows it.
    expect(kit.character.itemCount('barrow-crown')).toBe(1);
    expect(kit.state.currency).toBeGreaterThan(0);
  });

  /**
   * The rule that keeps a unique table worth running for, and the reason `boss`
   * is a rule rather than a label. A camp settled in his chamber fights the
   * wights and leaves him alone — sixty offline kills would turn a crown worth
   * making the trip for into a stack of them.
   */
  it('is never what an unattended camp picks a fight with', () => {
    const kit = barrow();
    const king = kingIn(kit);
    // Parked right on top of him, which is the case a distance check would miss.
    kit.world.teleport(king.x, king.y);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
    expect(kit.world.afkActive).toBe(true);

    kit.tick(40);

    expect(kit.world.target).not.toBe(king);
    expect(king.hp).toBe(king.maxHp);
  });

  // Not picking him is not the same as ignoring him: he aggros on sight, and a
  // camp that stood there while he swung would simply die.
  it('is fought back once he starts it', () => {
    const kit = barrow();
    const king = kingIn(kit);
    kit.world.teleport(king.x, king.y - 300);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);

    king.engage();
    kit.until(() => kit.world.target === king, 'the camp to answer the king');
  });

  // And the wights are not a boss, so a camp does take them on — which is what
  // makes the barrow campable at all once the door is open.
  it('leaves an unattended camp the wights to fight', () => {
    const kit = barrow();
    const wight = nearestWight(kit);
    kit.world.teleport(wight.x, wight.y + 60);
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);

    kit.until(() => kit.world.target === wight, 'the camp to pick the wight');
  });
});

/**
 * The Grave Chill, and the thing about it nothing else in the game has tested:
 * it hangs off a **common** creature.
 *
 * Every telegraphed ability before this belonged to something one of a kind
 * behind a locked door or to a bandit's thrown knife, so the cadence has only
 * ever been driven on a fight a player has once. This is the same cadence on
 * something that comes back in thirteen seconds, which is what makes the wights
 * a zone rather than a wall.
 */
describe('a wight winds up', () => {
  const CHILL = ENEMY_ABILITIES['grave-chill'];

  /** Toe to toe with one, with the fight already started. */
  function toeToToe(): { kit: Harness; wight: Mob } {
    const kit = barrow();
    const wight = nearestWight(kit);
    kit.world.teleport(wight.x - 40, wight.y);
    kit.world.setTarget(wight);
    wight.engage();
    return { kit, wight };
  }

  it('shouts before it lands, in the world and in the log', () => {
    const { kit, wight } = toeToToe();
    const drawn = kit.tickUntil(() => wight.windUp !== null);

    expect(wight.windUp?.abilityId).toBe('grave-chill');
    expect(drawn).toContainEqual({
      kind: 'float',
      at: { x: wight.x, y: wight.y },
      text: 'Grave Chill',
      tone: 'player-damage',
    });
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'Barrow Wight winds up Grave Chill!' }),
    );
  });

  // The whole mechanic, and the reason the chambers are as wide as they are: a
  // Chill reaches half again as far as a Cleave, so leaving is a walk.
  it('misses whoever left while it was being wound up', () => {
    const { kit, wight } = toeToToe();
    kit.until(() => wight.windUp !== null, 'the wight to wind up');

    kit.world.teleport(wight.x - CHILL.range - 200, wight.y);
    kit.until(() => wight.windUp === null, 'the chill to land or miss');

    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'You step out of Grave Chill.' }),
    );
  });

  // And a step back is not leaving. This is the difference between the chief's
  // reach and a wight's, stated where a player would learn it.
  it('still lands on whoever only backed out of swinging distance', () => {
    const { kit, wight } = toeToToe();
    kit.until(() => wight.windUp !== null, 'the wight to wind up');

    kit.world.teleport(wight.x - (ENEMIES[WIGHT].attackRange + 20), wight.y);
    kit.until(() => wight.windUp === null, 'the chill to land');

    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).not.toContainEqual(
      expect.objectContaining({ text: 'You step out of Grave Chill.' }),
    );
  });
});
