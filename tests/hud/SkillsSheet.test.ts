import { describe, expect, it } from 'vitest';
import { SkillsSheet } from '../../src/hud/SkillsSheet';
import { MASTERY_TIERS } from '../../src/data/mastery';
import { COMBAT_SKILL_ORDER, SKILLS, SKILL_ORDER } from '../../src/data/skills';
import { skillPage, type SkillBookState } from '../../src/systems/SkillBookSystem';
import { createInitialSkills } from '../../src/systems/SkillSystem';
import type { MasteryXp } from '../../src/systems/MasterySystem';

function bookState(mastery: MasteryXp = {}): SkillBookState {
  const skills = createInitialSkills();
  skills.smithing = { level: 5, xp: 40 };
  skills.woodcutting = { level: 2, xp: 10 };
  return { skills, level: 3, mastery };
}

function shown(state = bookState()): SkillsSheet {
  const sheet = new SkillsSheet();
  sheet.update(state);
  sheet.setVisible(true);
  return sheet;
}

const text = (node: Element | null | undefined): string => node?.textContent ?? '';

function indexRow(sheet: SkillsSheet, skillId: string): HTMLButtonElement {
  const button = sheet.body.querySelector<HTMLButtonElement>(`.hud-skill[data-skill="${skillId}"]`);
  if (!button) throw new Error(`no ${skillId} row`);
  return button;
}

describe('the skills book', () => {
  it('opens on an index of every skill, each row saying its level and XP', () => {
    const sheet = shown();
    const rows = [...sheet.body.querySelectorAll<HTMLElement>('.hud-skill')];
    expect(rows.map((row) => row.dataset.skill)).toEqual([...SKILL_ORDER, ...COMBAT_SKILL_ORDER]);
    expect(text(indexRow(sheet, 'smithing'))).toContain('Lv 5 · 40 /');
    expect(text(indexRow(sheet, 'smithing'))).toContain('XP');
    expect(text(sheet.head)).toContain('Skills');
  });

  it('turns to a page on a tap, and back to the index from its head', () => {
    const sheet = shown();
    indexRow(sheet, 'smithing').click();
    expect(sheet.openPage()).toBe('smithing');
    expect(text(sheet.head.querySelector('.hud-sheet__title'))).toBe(SKILLS.smithing.name);
    const back = sheet.head.querySelector<HTMLButtonElement>('[data-action="skills-back"]');
    expect(back?.classList.contains('hud-hidden')).toBe(false);

    back?.click();
    expect(sheet.openPage()).toBeNull();
    expect(back?.classList.contains('hud-hidden')).toBe(true);
    expect(sheet.body.querySelectorAll('.hud-skill[data-skill]')).toHaveLength(
      SKILL_ORDER.length + COMBAT_SKILL_ORDER.length,
    );
  });

  it('says on a page what the skill is and what training buys', () => {
    const sheet = shown();
    sheet.showPage('smithing');
    const intro = text(sheet.body.querySelector('.hud-sheet__intro'));
    for (const sentence of skillPage('smithing', bookState()).about) {
      expect(intro).toContain(sentence);
    }
  });

  /**
   * Every row, the locked ones greyed rather than hidden (decision 86), and a
   * locked row says what it waits on — grey alone says only that it waits.
   */
  it('draws every recipe, greying the ones out of reach and naming their level', () => {
    const sheet = shown();
    sheet.showPage('smithing');
    const entries = [...sheet.body.querySelectorAll<HTMLElement>('.hud-book-entry')];
    expect(entries).toHaveLength(skillPage('smithing', bookState()).entries.length);

    const chest = sheet.body.querySelector('.hud-book-entry[data-entry="iron-chestplate"]');
    expect(chest?.classList.contains('is-locked')).toBe(true);
    expect(text(chest)).toContain('Needs Smithing 7');
    expect(text(chest)).toContain('Iron Bar ×4, Tin Bar ×2, Bone Char ×2 → Iron Chestplate');

    const helmet = sheet.body.querySelector('.hud-book-entry[data-entry="iron-helmet"]');
    expect(helmet?.classList.contains('is-locked')).toBe(false);
    expect(text(helmet)).toContain('Lv 5');
  });

  it('puts each pool beside its row, and says once what mastery is', () => {
    const sheet = shown(bookState({ tree: 600 }));
    sheet.showPage('woodcutting');
    const tree = sheet.body.querySelector('.hud-book-entry[data-entry="tree"]');
    expect(text(tree?.querySelector('.hud-book-entry__mastery'))).toContain(
      `Apprentice · rank 2 / ${MASTERY_TIERS.length}`,
    );
    // A locked row cannot have started a pool, and draws none.
    const willow = sheet.body.querySelector('.hud-book-entry[data-entry="willow"]');
    expect(willow?.querySelector('.hud-book-entry__mastery')).toBeNull();
    expect(sheet.body.querySelectorAll('.hud-book__rule')).toHaveLength(1);
    expect(text(sheet.body.querySelector('.hud-book__rule'))).toContain('mastery of its own');
  });

  it('gives a combat skill its page with no list under it', () => {
    const sheet = shown();
    sheet.showPage('block');
    expect(text(sheet.body.querySelector('.hud-sheet__intro'))).toContain('shield');
    expect(sheet.body.querySelector('.hud-book-entry')).toBeNull();
    expect(sheet.body.querySelector('.hud-book__rule')).toBeNull();
  });

  /**
   * Combat skills gain XP on every hit, so a hidden book redrawn each time is
   * work nobody sees. It catches up when it is shown.
   */
  it('draws only while showing, and catches up when shown', () => {
    const sheet = new SkillsSheet();
    sheet.update(bookState());
    sheet.setVisible(true);
    sheet.setVisible(false);
    const later = bookState();
    later.skills.smithing = { level: 6, xp: 0 };
    sheet.update(later);
    expect(text(indexRow(sheet, 'smithing'))).toContain('Lv 5');

    sheet.setVisible(true);
    expect(text(indexRow(sheet, 'smithing'))).toContain('Lv 6');
  });
});
