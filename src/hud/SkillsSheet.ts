import { Sheet } from './Sheet';
import { el, fillPercent, row, sectionHeader } from './dom';
import { bindItemCard } from './itemCard';
import { itemIconEl } from './hudArt';
import { setSkillProgress, skillRow } from './skillRows';
import { MASTERY_TIERS } from '../data/mastery';
import { COMBAT_SKILL_ORDER, SKILLS, SKILL_ORDER } from '../data/skills';
import {
  masteryRule,
  skillPage,
  type BookEntry,
  type BookMastery,
  type SkillBookState,
} from '../systems/SkillBookSystem';
import { createInitialSkills, skillLevel, skillXpToNextLevel } from '../systems/SkillSystem';
import { THEME } from '../ui/theme';
import type { SkillId } from '../types/ids';

/**
 * The skills book: an index of every skill, and a page for each one saying what
 * it does and everything it works or makes (decision 86). Mastery lives here,
 * beside the row each pool belongs to, where it had a page of its own before
 * (decision 89).
 *
 * One sheet with two views rather than a sheet per skill, because the HUD holds
 * one open sheet at a time and a page is reached from two places — the index,
 * and a skill's row on the character sheet — and Back always goes to the index,
 * which is the one place every page is reached from.
 *
 * Everything drawn comes out of `skillPage`, so this file decides only how a
 * page looks. It draws only while it is showing: combat skills gain XP on every
 * hit, and a hidden page redrawn each time would be work nobody sees.
 */
export class SkillsSheet extends Sheet {
  private readonly back: HTMLButtonElement;
  private state: SkillBookState = { skills: createInitialSkills(), level: 1, mastery: {} };
  private page: SkillId | null = null;
  private showing = false;
  private stale = true;

  constructor() {
    super('Skills', THEME.panelWidth.skills);
    this.back = el('button', 'hud-button hud-sheet__back', '‹ Back');
    this.back.type = 'button';
    this.back.dataset.action = 'skills-back';
    this.back.addEventListener('click', () => this.showIndex());
    this.head.prepend(this.back);
  }

  /** Which skill's page is up, or null for the index. */
  openPage(): SkillId | null {
    return this.page;
  }

  update(state: SkillBookState): void {
    this.state = state;
    this.stale = true;
    if (this.showing) this.draw(false);
  }

  showIndex(): void {
    this.page = null;
    this.draw(true);
  }

  showPage(skillId: SkillId): void {
    this.page = skillId;
    this.draw(true);
  }

  override setVisible(visible: boolean): void {
    super.setVisible(visible);
    this.showing = visible;
    if (visible && this.stale) this.draw(false);
  }

  /**
   * A redraw of the same view keeps its place, since a page being read while
   * the skill trains should not jump back to its top on every swing; a new view
   * starts at the top.
   */
  private draw(fromTop: boolean): void {
    const scroll = fromTop ? 0 : this.body.scrollTop;
    this.stale = false;
    this.back.classList.toggle('hud-hidden', this.page === null);
    this.setTitle(this.page ? SKILLS[this.page].name : 'Skills');
    this.root.dataset.page = this.page ?? '';
    this.body.replaceChildren(...(this.page ? this.pageView(this.page) : this.indexView()));
    this.body.scrollTop = scroll;
  }

  private indexView(): HTMLElement[] {
    return [
      sectionHeader('Skills'),
      ...SKILL_ORDER.map((skillId) => this.indexRow(skillId)),
      sectionHeader('Combat Skills'),
      ...COMBAT_SKILL_ORDER.map((skillId) => this.indexRow(skillId)),
    ];
  }

  private indexRow(skillId: SkillId): HTMLElement {
    const { skills, level } = this.state;
    const skill = skillRow(SKILLS[skillId].name, () => this.showPage(skillId));
    skill.root.dataset.skill = skillId;
    const current = skillLevel(skills, skillId);
    const xpToNext = skillXpToNextLevel(skillId, current, level);
    setSkillProgress(skill, current, skills[skillId]?.xp ?? 0, xpToNext);
    return skill.root;
  }

  private pageView(skillId: SkillId): HTMLElement[] {
    const page = skillPage(skillId, this.state);
    // The row that was tapped to get here, repeated at the top of the page so
    // the level and the bar are where the eye left them.
    const progress = skillRow(page.name);
    setSkillProgress(progress, page.level, page.xp, page.xpToNext);

    const intro = el('div', 'hud-sheet__intro');
    intro.append(...page.about.map((sentence) => el('p', undefined, sentence)));

    const view = [progress.root, intro];
    if (page.entriesTitle) {
      view.push(
        sectionHeader(page.entriesTitle),
        el('div', 'hud-book__rule', masteryRule()),
        ...page.entries.map((entry) => entryView(entry, page.name)),
      );
    }
    return view;
  }
}

/**
 * One node or recipe: what it is and the level it opens at, then a line each
 * for what goes in and comes out, the result's numbers and the XP and where,
 * then its mastery. Asked about, it is the thing it makes, as a station's row
 * is — what a helmet is worth wearing is the question a page of recipes raises.
 */
function entryView(entry: BookEntry, skillName: string): HTMLElement {
  const wrapper = el('div', 'hud-book-entry');
  wrapper.dataset.entry = entry.id;
  const head = row({
    className: 'hud-list-row',
    label: entry.name,
    // A locked row says what it is waiting on, since grey alone says only that
    // something is.
    value: entry.unlocked
      ? `Lv ${entry.requiredLevel}`
      : `Needs ${skillName} ${entry.requiredLevel}`,
    valueClass: 'hud-list-row__value',
    icon: itemIconEl(entry.resultItemId),
  });
  wrapper.append(head.root, ...entry.lines.map((line) => el('div', 'hud-list-row__note', line)));
  if (entry.mastery) {
    wrapper.append(masteryView(entry.mastery));
  } else {
    wrapper.classList.add('is-locked');
    wrapper.dataset.locked = entry.id;
  }
  bindItemCard(wrapper, entry.resultItemId);
  return wrapper;
}

function masteryView(mastery: BookMastery): HTMLElement {
  const { progress, xp } = mastery;
  const line = skillRow('Mastery');
  line.root.classList.add('hud-book-entry__mastery');
  // The rank out of five, which is what makes a pool readable next to a
  // sibling's at a glance — the raw totals differ by an order of magnitude
  // between a tree and a chestplate. A maxed pool goes on filling with nothing
  // left to fill toward, so it shows its total and reads as full.
  line.value.textContent = progress.maxed
    ? `${progress.tier.name} · ${xp} XP`
    : `${progress.tier.name} · rank ${progress.tier.rank} / ${MASTERY_TIERS.length}`;
  line.fill.style.width = fillPercent(progress.maxed ? 1 : progress.ratio);
  return line.root;
}
