import { Sheet } from './Sheet';
import { el, fillPercent } from './dom';
import { barFill } from '../systems/math';
import { paperdollSvg } from './paperdoll';
import { describeItemBonuses, describeItemName } from '../data/items';
import { COMBAT_SKILL_ORDER, SKILLS, SKILL_ORDER } from '../data/skills';
import { skillXpToNextLevel, type Skills } from '../systems/SkillSystem';
import { THEME } from '../ui/theme';
import type { PrimaryStat } from '../data/classes';
import type { Gear } from '../systems/InventorySystem';
import { exhaustive, mapKeys } from '../types/exhaustive';
import type { GearSlotId, SkillId } from '../types/ids';

const SLOT_ORDER = exhaustive<GearSlotId>()(['weapon', 'helmet', 'chest', 'pants']);
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
  gear: Gear;
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
  private readonly slots: Record<GearSlotId, SlotRow>;
  private readonly skills: Record<SkillId, SkillRow>;
  private gear: Gear = {
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

    this.slots = mapKeys(SLOT_ORDER, (slot) => {
      const button = el('button', 'hud-slot');
      button.type = 'button';
      button.dataset.slot = slot;
      const head = el('div', 'hud-slot__head');
      const bonuses = el('span', 'hud-slot__bonuses');
      head.append(el('span', undefined, SLOT_LABELS[slot]), bonuses);
      const item = el('div', 'hud-slot__item');
      button.append(head, item);
      button.addEventListener('click', () => onSlotClicked(slot, this.gear[slot] === null));
      this.body.append(button);
      return { button, item, bonuses };
    });

    // Two blocks, one record: the spread is what makes the pair cover SkillId,
    // and each list covers its own half by construction.
    this.skills = {
      ...this.buildSkillBlock('Skills', SKILL_ORDER),
      ...this.buildSkillBlock('Combat Skills', COMBAT_SKILL_ORDER),
    };
  }

  private buildSkillBlock<K extends SkillId>(
    title: string,
    skillIds: readonly K[],
  ): Record<K, SkillRow> {
    this.body.append(el('div', 'hud-section', title));
    return mapKeys(skillIds, (skillId) => {
      const row = el('div', 'hud-skill');
      const line = el('div', 'hud-skill__line');
      const value = el('span');
      line.append(el('span', undefined, SKILLS[skillId].name), value);
      const bar = el('div', 'hud-bar hud-skill__bar');
      const fill = el('div', 'hud-bar__fill');
      bar.append(fill);
      row.append(line, bar);
      this.body.append(row);
      return { value, fill };
    });
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
      line.textContent = lines[index] ?? '';
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
      // A capped skill has no next level to fill toward, and reads as full.
      row.fill.style.width = fillPercent(xpToNext > 0 ? barFill(skill.xp, xpToNext) : 1);
    }
  }

  /** Where a slot row sits on screen, for the picker that anchors to it. */
  slotBounds(slot: GearSlotId): DOMRect {
    return this.slots[slot].button.getBoundingClientRect();
  }
}
