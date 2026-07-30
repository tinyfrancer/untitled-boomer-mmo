import { Sheet } from './Sheet';
import { el } from './dom';
import { paperdollSvg } from './paperdoll';
import { describeItemBonuses, describeItemName } from '../data/items';
import { COMBAT_SKILL_ORDER, SKILLS, SKILL_ORDER } from '../data/skills';
import { skillXpToNextLevel, type Skills } from '../systems/SkillSystem';
import { THEME } from '../ui/theme';
import type { PrimaryStat } from '../data/classes';
import type { GearSlotId, SkillId } from '../types/ids';

export const SLOT_ORDER: GearSlotId[] = ['weapon', 'helmet', 'chest', 'pants'];
export const SLOT_LABELS: Record<GearSlotId, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  chest: 'Chest',
  pants: 'Pants',
};

export interface DisplayedStats {
  hp: number;
  maxHp: number;
  strength: number;
  intellect: number;
  attackPower: number;
  // Which stat the class turns into attack power. Shown beside ATK, because
  // "do both STR and INT apply?" is otherwise unanswerable from the sheet.
  attackStat: PrimaryStat;
}

export interface CharacterSheetState {
  gear: Record<GearSlotId, string | null>;
  stats: DisplayedStats;
  skills: Skills;
  // Combat skill caps ride the character's level, so the sheet needs it to know
  // when one of those bars is full.
  level: number;
}

interface SlotRow {
  button: HTMLButtonElement;
  item: HTMLElement;
  bonuses: HTMLElement;
}

interface SkillRow {
  value: HTMLElement;
  fill: HTMLElement;
}

/**
 * The character sheet: paperdoll, stats, the four gear slots and the skill
 * lists. Clicking a filled slot unequips it; clicking an empty one asks for a
 * picker, so the sheet is self-sufficient without the bag open.
 */
export class CharacterSheet extends Sheet {
  private readonly doll: HTMLElement;
  private readonly statLines: HTMLElement[];
  private readonly slots = {} as Record<GearSlotId, SlotRow>;
  private readonly skills = {} as Record<SkillId, SkillRow>;
  private gear: Record<GearSlotId, string | null> = {
    helmet: null,
    chest: null,
    pants: null,
    weapon: null,
  };

  constructor(onSlotClicked: (slot: GearSlotId, isEmpty: boolean) => void) {
    super('Character', THEME.panelWidth.character);

    const top = el('div', 'hud-char__top');
    this.doll = el('div', 'hud-char__doll');
    this.doll.append(paperdollSvg(this.gear));
    const stats = el('div', 'hud-char__stats');
    this.statLines = [0, 1, 2, 3].map(() => el('div'));
    stats.append(...this.statLines);
    top.append(this.doll, stats);
    this.body.append(top);

    for (const slot of SLOT_ORDER) {
      const button = el('button', 'hud-slot');
      button.type = 'button';
      button.dataset.slot = slot;
      const head = el('div', 'hud-slot__head');
      const bonuses = el('span', 'hud-slot__bonuses');
      head.append(el('span', undefined, SLOT_LABELS[slot]), bonuses);
      const item = el('div', 'hud-slot__item');
      button.append(head, item);
      button.addEventListener('click', () => onSlotClicked(slot, this.gear[slot] === null));
      this.slots[slot] = { button, item, bonuses };
      this.body.append(button);
    }

    this.buildSkillBlock('Skills', SKILL_ORDER);
    this.buildSkillBlock('Combat Skills', COMBAT_SKILL_ORDER);
  }

  private buildSkillBlock(title: string, skillIds: SkillId[]): void {
    this.body.append(el('div', 'hud-section', title));
    for (const skillId of skillIds) {
      const row = el('div', 'hud-skill');
      const line = el('div', 'hud-skill__line');
      const value = el('span');
      line.append(el('span', undefined, SKILLS[skillId].name), value);
      const bar = el('div', 'hud-bar hud-skill__bar');
      const fill = el('div', 'hud-bar__fill');
      bar.append(fill);
      row.append(line, bar);
      this.skills[skillId] = { value, fill };
      this.body.append(row);
    }
  }

  update(state: CharacterSheetState): void {
    this.gear = state.gear;
    this.doll.replaceChildren(paperdollSvg(state.gear));

    const { hp, maxHp, strength, intellect, attackPower, attackStat } = state.stats;
    const lines = [
      `HP ${hp} / ${maxHp}`,
      `STR ${strength}`,
      `INT ${intellect}`,
      `ATK ${attackPower} (${attackStat === 'strength' ? 'STR' : 'INT'})`,
    ];
    this.statLines.forEach((line, index) => {
      line.textContent = lines[index];
    });

    for (const slot of SLOT_ORDER) {
      const itemId = state.gear[slot];
      const row = this.slots[slot];
      row.item.textContent = describeItemName(itemId);
      row.item.classList.toggle('is-filled', itemId !== null);
      row.bonuses.textContent = describeItemBonuses(itemId);
    }

    for (const skillId of [...SKILL_ORDER, ...COMBAT_SKILL_ORDER]) {
      const skill = state.skills[skillId] ?? { level: 1, xp: 0 };
      const row = this.skills[skillId];
      const xpToNext = skillXpToNextLevel(skillId, skill.level, state.level);
      row.value.textContent =
        xpToNext > 0 ? `${skill.xp}/${xpToNext} · Lv ${skill.level}` : `Lv ${skill.level} (Max)`;
      const ratio = xpToNext > 0 ? Math.min(Math.max(skill.xp / xpToNext, 0), 1) : 1;
      row.fill.style.width = `${ratio * 100}%`;
    }
  }

  /** Where a slot row sits on screen, for the picker that anchors to it. */
  slotBounds(slot: GearSlotId): DOMRect {
    return this.slots[slot].button.getBoundingClientRect();
  }
}
