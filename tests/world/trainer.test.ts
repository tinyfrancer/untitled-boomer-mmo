import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { NPC_INTERACT_RADIUS } from '../../src/data/npcs';
import { ABILITIES } from '../../src/data/abilities';
import {
  ABILITY_STATE_CHANGED_EVENT,
  LEARNED_ABILITIES_CHANGED_EVENT,
  type AbilityState,
  COUNTER_OPENED_EVENT,
} from '../../src/ui/uiEvents';
import type { WorldNpc } from '../../src/world/ZoneWorld';

/**
 * The trainer as a place in town, and the bar as something that grows.
 *
 * The rule the third NPC is here to collect on is the one the second broke:
 * which counter a tap opens is a fact about the person tapped. What is new is
 * that a purchase changes what the player can *do*, so this is also where the
 * action bar's contents are held to what has been paid for.
 */

beforeEach(() => {
  localStorage.clear();
});

function npcNamed(world: ReturnType<typeof harness>['world'], id: string): WorldNpc {
  const npc = world.npcs.find((candidate) => candidate.npcId === id);
  if (!npc) throw new Error(`town has no ${id}`);
  return npc;
}

function atTheTrainer(options: { level?: number; currency?: number } = {}) {
  const kit = harness({ level: options.level ?? 2, learnedAbilities: [] });
  kit.state.currency = options.currency ?? 1000;
  const npc = npcNamed(kit.world, 'trainer');
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc, 'trainer');
  return kit;
}

function lastBar(kit: ReturnType<typeof harness>): AbilityState[] {
  const states = kit.emissions(ABILITY_STATE_CHANGED_EVENT).at(-1)?.[0];
  return (states ?? []) as AbilityState[];
}

describe('the trainer', () => {
  it('opens when the player is already standing at the counter', () => {
    const { world, emissions } = atTheTrainer();

    expect(world.counterNpc('trainer')).not.toBeNull();
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'trainer')).toHaveLength(1);
  });

  // Three people stand a few steps apart in town and each of them does one
  // thing. This is the assertion that would have caught a trainer teaching from
  // behind the bank's desk.
  it('opens neither of the other two counters', () => {
    const { emissions } = atTheTrainer();

    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'merchant')).toHaveLength(0);
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'banker')).toHaveLength(0);
  });

  it('is walked to when the tap comes from across the square', () => {
    const kit = harness({ level: 2 });
    const npc = npcNamed(kit.world, 'trainer');
    kit.world.teleport(npc.x, npc.y + NPC_INTERACT_RADIUS * 3);

    kit.world.approachNpc(npc, 'trainer');
    expect(kit.world.counterNpc('trainer')).toBeNull();

    kit.until(() => kit.world.counterNpc('trainer') !== null, 'the player reaches the trainer');
  });

  // Every counter in town is more than an interact radius from the next, so
  // which one a tap opens is never a question about pixels.
  it('stands clear of the other counters', () => {
    const { world } = harness();
    const people = world.npcs;

    for (const a of people) {
      for (const b of people) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(NPC_INTERACT_RADIUS);
      }
    }
  });
});

describe('what a lesson buys', () => {
  it('puts the ability on the bar it was missing from', () => {
    const kit = atTheTrainer();
    // The bar's state rides the tick's publish-on-change, so it takes a frame
    // to say anything at all.
    kit.tick(1);
    expect(lastBar(kit).map((state) => state.abilityId)).toEqual(['power-slash']);

    kit.world.handleLearnRequested('battle-fury');

    expect(kit.emissions(LEARNED_ABILITIES_CHANGED_EVENT).at(-1)).toEqual([['battle-fury']]);
    expect(lastBar(kit).map((state) => state.abilityId)).toEqual(['power-slash', 'battle-fury']);
  });

  it('takes the price out of the purse', () => {
    const kit = atTheTrainer({ currency: 1000 });
    const cost = ABILITIES['battle-fury'].training?.cost ?? 0;

    kit.world.handleLearnRequested('battle-fury');

    expect(kit.state.currency).toBe(1000 - cost);
  });

  /**
   * Defence in depth, and the reason the check is in the caster rather than
   * only in the bar: a request naming an unlearned ability is a claim, not a
   * proof — the button was drawn from a copy of the character, and a number key
   * names a slot without proving one exists.
   */
  it('will not cast what has not been bought', () => {
    const kit = atTheTrainer();

    kit.world.handleAbilityRequested('battle-fury');
    kit.tick(1);

    expect(lastBar(kit).map((state) => state.abilityId)).toEqual(['power-slash']);
  });

  it('casts it happily once it has been', () => {
    const kit = atTheTrainer();
    kit.world.handleLearnRequested('battle-fury');

    kit.world.handleAbilityRequested('battle-fury');
    kit.tick(1);

    const fury = lastBar(kit).find((state) => state.abilityId === 'battle-fury');
    // The cooldown sweep is the proof it went off: a refused press starts none.
    expect(fury?.cooldownRemaining).toBeGreaterThan(0);
  });
});
