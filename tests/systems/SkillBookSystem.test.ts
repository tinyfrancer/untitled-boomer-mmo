import { describe, expect, it } from 'vitest';
import { MAX_GATHER_SKILL_LEVEL } from '../../src/config/constants';
import { MASTERY_TARGET_IDS, MASTERY_TIERS } from '../../src/data/mastery';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { COMBAT_SKILL_ORDER, SKILL_ORDER } from '../../src/data/skills';
import { ZONES } from '../../src/data/zones';
import { describeItemBonuses } from '../../src/data/items';
import {
  masteryRule,
  skillBookKind,
  skillPage,
  type SkillBookState,
} from '../../src/systems/SkillBookSystem';
import { createInitialSkills, type Skills } from '../../src/systems/SkillSystem';
import type { SkillId } from '../../src/types/ids';

const EVERY_SKILL: SkillId[] = [...SKILL_ORDER, ...COMBAT_SKILL_ORDER];

function state(levels: Partial<Record<SkillId, number>> = {}, level = 1): SkillBookState {
  const skills: Skills = createInitialSkills();
  for (const [skillId, skillLevel] of Object.entries(levels) as [SkillId, number][]) {
    skills[skillId] = { level: skillLevel, xp: 0 };
  }
  return { skills, level, mastery: {} };
}

describe('the skills book', () => {
  /**
   * The book is the one place a player can see everything a skill leads to, so
   * a node or recipe missing from it is a thing the player can only find by
   * accident. Swept over the pools, which are generated from the same two
   * tables: each one is on exactly one page, and it is its own skill's.
   */
  it('lists every node and recipe once, on the page of the skill that works it', () => {
    const seen = new Map<string, SkillId>();
    for (const skillId of EVERY_SKILL) {
      for (const entry of skillPage(skillId, state()).entries) {
        expect(seen.has(entry.id), `${entry.id} is on two pages`).toBe(false);
        seen.set(entry.id, skillId);
      }
    }
    expect([...seen.keys()].sort()).toEqual([...MASTERY_TARGET_IDS].sort());
    for (const [id, skillId] of seen) {
      const row =
        RESOURCE_NODES[id as keyof typeof RESOURCE_NODES] ?? RECIPES[id as keyof typeof RECIPES];
      expect(row?.skill).toBe(skillId);
    }
  });

  it('orders each page by the level a row opens at', () => {
    for (const skillId of EVERY_SKILL) {
      const levels = skillPage(skillId, state()).entries.map((entry) => entry.requiredLevel);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  it('draws a locked row rather than hiding it, and starts no pool on it', () => {
    const page = skillPage('smithing', state({ smithing: 5 }, 3));
    const helmet = page.entries.find((entry) => entry.id === 'iron-helmet');
    const chest = page.entries.find((entry) => entry.id === 'iron-chestplate');
    expect(helmet?.unlocked).toBe(true);
    expect(helmet?.mastery?.progress.tier.name).toBe(MASTERY_TIERS[0]?.name);
    expect(chest?.unlocked).toBe(false);
    expect(chest?.mastery).toBeNull();
  });

  it('gives a recipe its inputs, what it makes and that thing’s numbers', () => {
    const helmet = skillPage('smithing', state()).entries.find(
      (entry) => entry.id === 'iron-helmet',
    );
    expect(helmet?.lines).toContain('Iron Bar ×2, Tin Bar, Bone Char → Iron Helmet');
    expect(helmet?.lines).toContain(describeItemBonuses('iron-helmet'));
    expect(helmet?.lines).toContain(`${RECIPES['iron-helmet'].xpReward} XP`);
  });

  it('says how many a job makes, and what a failure leaves where it leaves one', () => {
    const shafts = skillPage('fletching', state()).entries.find(
      (entry) => entry.id === 'arrow-shafts',
    );
    expect(shafts?.lines[0]).toBe('Logs → 15 Arrow Shafts');
    const fish = skillPage('cooking', state()).entries.find((entry) => entry.id === 'cooked-fish');
    expect(fish?.lines).toContain('12 XP · a failure makes Burnt Fish');
  });

  it('names the zones a node grows in, read off the zones that spawn it', () => {
    for (const skillId of SKILL_ORDER) {
      for (const entry of skillPage(skillId, state()).entries) {
        if (!(entry.id in RESOURCE_NODES)) continue;
        const zones = Object.values(ZONES)
          .filter((zone) => zone.nodeSpawns.some((spawn) => spawn.nodeId === entry.id))
          .map((zone) => zone.name);
        expect(entry.lines).toContain(`Found in: ${zones.join(', ')}`);
      }
    }
    const deep = skillPage('fishing', state()).entries.find(
      (entry) => entry.id === 'deep-fishing-spot',
    );
    expect(deep?.lines).toContain('Found in: Blackwater Fen');
  });

  it('names the station a making skill is worked at, and the zone it stands in', () => {
    expect(skillPage('smithing', state()).about).toContain('Worked at the Forge (Lampton).');
    expect(skillPage('cooking', state()).about).toContain('Worked at a campfire.');
  });

  it('gives each kind of skill its kind of page', () => {
    expect(skillBookKind('woodcutting')).toBe('gathering');
    expect(skillBookKind('smithing')).toBe('making');
    for (const skillId of COMBAT_SKILL_ORDER) {
      const page = skillPage(skillId, state());
      expect(page.kind).toBe('combat');
      expect(page.entries).toEqual([]);
      expect(page.entriesTitle).toBeNull();
      expect(page.about.length).toBeGreaterThan(0);
    }
  });
});

describe('what a level buys, as a page says it', () => {
  it('reads a gathering level off the curve the swing uses', () => {
    const about = skillPage('woodcutting', state({ woodcutting: 3 })).about.join(' ');
    expect(about).toContain('Each level makes a gather 2.5% quicker and adds a 1.5% chance');
    expect(about).toContain('At level 3: 5% quicker, and a 3% chance of a second.');
    expect(about).toContain(`At ${MAX_GATHER_SKILL_LEVEL}, the most: 48% quicker`);
    expect(about).toContain('Needs a Felling Axe in hand.');
  });

  it('says a first level buys nothing yet rather than printing noughts', () => {
    const about = skillPage('mining', state()).about.join(' ');
    expect(about).toContain('At level 1: nothing yet.');
    expect(about).not.toContain('0% quicker');
  });

  it('reads a making level off the failure curve, and says when failing stops', () => {
    const about = skillPage('smithing', state({ smithing: 5 })).about.join(' ');
    expect(about).toContain('takes 5 points off the chance a job fails, and from level 9 none do');
    expect(about).toContain('At level 5: 20% of jobs fail.');
    expect(skillPage('smithing', state({ smithing: 9 })).about).toContain(
      'At level 9: no job fails.',
    );
  });

  it('says what a failure costs only where every recipe of the skill agrees', () => {
    expect(skillPage('smithing', state()).about).toContain(
      'A failure costs only the time, and keeps what went in.',
    );
    expect(skillPage('cooking', state()).about).toContain('A failure spends what went in.');
  });

  it('measures a combat skill against its cap for this character and the most there is', () => {
    const about = skillPage('one-handed', state({ 'one-handed': 12 }, 3)).about.join(' ');
    expect(about).toContain('30 for you now');
    expect(about).toContain('At level 12: +');
    expect(about).toContain('At 90, the most: +17% damage and a 20% critical chance.');
  });

  it('gives block its shield and parry its weapon', () => {
    const block = skillPage('block', state({ block: 30 }, 3)).about.join(' ');
    expect(block).toMatch(/At level 30: [\d.]+%, or [\d.]+% with a shield\./);
    expect(skillPage('parry', state()).about.join(' ')).toContain('with a weapon in hand');
  });

  it('gives destruction its fizzle as well as its damage', () => {
    const about = skillPage('destruction', state({ destruction: 20 }, 2)).about.join(' ');
    expect(about).toContain('3 points off at level 20');
    expect(about).toContain('never below 2%');
  });

  /**
   * Said once over a page's rows from the rank table, so a retune moves the words
   * with it. The first rank pays nothing and is left out rather than named.
   */
  it('explains mastery from the rank table', () => {
    const rule = masteryRule();
    for (const tier of MASTERY_TIERS.filter((rung) => rung.bonusChance > 0)) {
      expect(rule).toContain(`${tier.name} ${Math.round(tier.bonusChance * 100)}%`);
    }
    expect(rule).not.toContain(MASTERY_TIERS[0]?.name);
  });
});
