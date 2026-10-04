import { describe, expect, it } from 'vitest';
import { MAX_GATHER_SKILL_LEVEL } from '../../src/config/constants';
import type { ItemId } from '../../src/types/ids';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import {
  BONUS_YIELD_PER_LEVEL,
  advanceGather,
  beginGather,
  canGather,
  gatherDurationMs,
  rollGatherQuantity,
} from '../../src/systems/GatherSystem';
import { addSkillXp, createInitialSkills, type Skills } from '../../src/systems/SkillSystem';
import type { Gear } from '../../src/systems/InventorySystem';

const TREE = RESOURCE_NODES.tree;
const POND = RESOURCE_NODES['fishing-spot'];

const gearWith = (weapon: ItemId | null): Gear => ({
  helmet: null,
  chest: null,
  pants: null,
  weapon,
  offhand: null,
});

const AXE = gearWith('felling-axe');
const POLE = gearWith('fishing-pole');
const SWORD = gearWith('rusty-sword');

// Levels a single skill by awarding it enough XP, rather than hand-building a
// state object, so these stay honest if the curve changes.
function skillsAt(skill: 'woodcutting' | 'fishing' | 'cooking', level: number): Skills {
  let skills = createInitialSkills();
  while (skills[skill].level < level) {
    skills = addSkillXp(skills, skill, 100).skills;
  }
  return skills;
}

describe('canGather', () => {
  it('allows gathering with the matching tool equipped', () => {
    expect(canGather(TREE, createInitialSkills(), AXE)).toEqual({ ok: true });
    expect(canGather(POND, createInitialSkills(), POLE)).toEqual({ ok: true });
  });

  it('refuses with no tool, naming what is needed', () => {
    const result = canGather(TREE, createInitialSkills(), gearWith(null));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('Felling Axe');
  });

  it("refuses another skill's tool", () => {
    expect(canGather(TREE, createInitialSkills(), POLE).ok).toBe(false);
    expect(canGather(POND, createInitialSkills(), AXE).ok).toBe(false);
  });

  it('refuses a combat weapon, so gathering costs you your sword', () => {
    expect(canGather(TREE, createInitialSkills(), SWORD).ok).toBe(false);
  });

  it('refuses when the skill level is below the requirement', () => {
    const gated = { ...TREE, requiredLevel: 5 };
    const result = canGather(gated, createInitialSkills(), AXE);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('level 5');

    expect(canGather(gated, skillsAt('woodcutting', 5), AXE)).toEqual({ ok: true });
  });
});

describe('gatherDurationMs', () => {
  it('is the base time at level 1', () => {
    expect(gatherDurationMs(TREE, 1)).toBe(TREE.baseGatherMs);
  });

  // What the old cap of 10 bought at 5% a level, stretched over 20 (decision
  // 139): the cap moved and what a capped skill buys did not.
  it('falls to 52.5% of the base at the level 20 cap', () => {
    expect(gatherDurationMs(TREE, MAX_GATHER_SKILL_LEVEL)).toBe(
      Math.round(TREE.baseGatherMs * 0.525),
    );
  });

  // The skill alone never meets the floor, so every tool above steel still
  // buys something at the cap: the floor is for the two terms together.
  it('leaves the floor to the tool, even at the cap', () => {
    expect(gatherDurationMs(TREE, MAX_GATHER_SKILL_LEVEL)).toBeGreaterThan(
      gatherDurationMs(TREE, MAX_GATHER_SKILL_LEVEL, 0.2),
    );
  });

  it('never speeds up so far that a gather becomes instant', () => {
    expect(gatherDurationMs(TREE, MAX_GATHER_SKILL_LEVEL, 1)).toBeGreaterThan(0);
  });
});

describe('advanceGather', () => {
  it('reports progress while in range and unfinished', () => {
    const state = beginGather(TREE, 1);
    const outcome = advanceGather(state, TREE.baseGatherMs / 4, 0);
    expect(outcome.status).toBe('gathering');
    expect(outcome.status === 'gathering' && outcome.progress).toBeCloseTo(0.25);
  });

  it('accumulates elapsed time across frames', () => {
    let state = beginGather(TREE, 1);
    for (let i = 0; i < 3; i++) {
      const outcome = advanceGather(state, 500, 0);
      expect(outcome.status).toBe('gathering');
      if (outcome.status === 'gathering') state = outcome.state;
    }
    expect(state.elapsedMs).toBe(1500);
  });

  it('completes once the duration is reached', () => {
    const state = beginGather(TREE, 1);
    expect(advanceGather(state, TREE.baseGatherMs, 0).status).toBe('complete');
  });

  it('cancels when the player walks out of range', () => {
    const state = beginGather(TREE, 1);
    expect(advanceGather(state, 100, TREE.interactRadius + 1)).toEqual({
      status: 'cancelled',
      reason: 'out-of-range',
    });
  });

  it('still gathers at exactly the interact radius', () => {
    const state = beginGather(TREE, 1);
    expect(advanceGather(state, 100, TREE.interactRadius).status).toBe('gathering');
  });

  it('cancels out of range even on the frame it would have completed', () => {
    const state = beginGather(TREE, 1);
    expect(advanceGather(state, TREE.baseGatherMs, 9999).status).toBe('cancelled');
  });

  it('does not mutate the state it is given', () => {
    const state = beginGather(TREE, 1);
    advanceGather(state, 500, 0);
    expect(state.elapsedMs).toBe(0);
  });
});

describe('rollGatherQuantity', () => {
  it('always yields one at level 1, whatever the roll', () => {
    expect(rollGatherQuantity(1, 0, () => 0)).toBe(1);
    expect(rollGatherQuantity(1, 0, () => 0.99)).toBe(1);
  });

  it('can yield a bonus at higher levels', () => {
    expect(rollGatherQuantity(10, 0, () => 0)).toBe(2);
    expect(rollGatherQuantity(10, 0, () => 0.99)).toBe(1);
  });

  it('pays a mastery pool at level 1, where the skill term is worth nothing', () => {
    expect(rollGatherQuantity(1, 0.3, () => 0.2)).toBe(2);
    expect(rollGatherQuantity(1, 0.3, () => 0.4)).toBe(1);
  });

  it('adds the two terms into one roll rather than rolling twice', () => {
    // 9 levels of skill bonus plus a 0.1 pool, against a roll that sits between
    // either term alone and their sum: two rolls could never produce this.
    const skillOnly = BONUS_YIELD_PER_LEVEL * 9;
    const between = skillOnly + 0.05;
    expect(rollGatherQuantity(10, 0, () => between)).toBe(1);
    expect(rollGatherQuantity(1, 0.1, () => between)).toBe(1);
    expect(rollGatherQuantity(10, 0.1, () => between)).toBe(2);
  });

  it('never yields three, however deep both terms are', () => {
    expect(rollGatherQuantity(50, 1, () => 0)).toBe(2);
  });
});
