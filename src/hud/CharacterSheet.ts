import { Sheet } from './Sheet';
import { el, row, sectionHeader } from './dom';
import { setSkillProgress, skillRow, type SkillRow } from './skillRows';
import { paperdollSvg } from './paperdoll';
import { bindItemCard } from './itemCard';
import { describeBonuses, describeItemName } from '../data/items';
import { reforgedBonuses, reforgedName, type Reforges } from '../systems/ReforgeSystem';
import { COMBAT_SKILL_ORDER, SKILLS, SKILL_ORDER } from '../data/skills';
import { skillXpToNextLevel, type Skills } from '../systems/SkillSystem';
import { THEME } from '../ui/theme';
import type { PrimaryStat } from '../data/classes';
import type { Quiver } from '../systems/QuiverSystem';
import { isQuiver } from '../data/items';
import { NO_GEAR, type Gear } from '../systems/InventorySystem';
import { exhaustive, mapKeys } from '../types/exhaustive';
import type { GearSlotId, SkillId } from '../types/ids';

const SLOT_ORDER = exhaustive<GearSlotId>()(['weapon', 'offhand', 'helmet', 'chest', 'pants']);
export const SLOT_LABELS: Record<GearSlotId, string> = {
  weapon: 'Weapon',
  offhand: 'Offhand',
  helmet: 'Helmet',
  chest: 'Chest',
  pants: 'Pants',
};

export interface DisplayedStats {
  hp: number;
  maxHp: number;
  strength: number;
  intellect: number;
  agility: number;
  attackPower: number;
  // Which stat attack power is built on: the class's own, or agility under a
  // bow. Shown beside ATK, because "does my strength count?" is otherwise
  // unanswerable from the sheet — and for a warrior holding a bow the answer
  // has changed.
  attackStat: PrimaryStat;
}

const STAT_LABELS: Record<PrimaryStat, string> = {
  strength: 'Strength',
  intellect: 'Intellect',
  agility: 'Agility',
};

export interface CharacterSheetState {
  gear: Gear;
  // What the fettler did to any of it, which changes both the name a slot row
  // shows and the numbers under it. The sheet is where somebody checks what a
  // reforge actually bought them.
  reforges: Reforges;
  stats: DisplayedStats;
  // What is in the quiver, which the offhand row says beside the quiver's name
  // since a slot holds one item and a quiver holds a stack.
  quiver: Quiver | null;
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

/**
 * The character sheet: paperdoll, stats, the four gear slots and the skill
 * lists. Clicking a filled slot unequips it; clicking an empty one asks for a
 * picker, so the sheet is self-sufficient without the bag open. A skill's row
 * opens its page in the skills book, which is where what it does is said.
 */
export class CharacterSheet extends Sheet {
  private readonly doll: HTMLElement;
  private readonly statLines: HTMLElement[];
  private readonly slots: Record<GearSlotId, SlotRow>;
  private readonly skills: Record<SkillId, SkillRow>;
  private gear: Gear = NO_GEAR;

  constructor(
    onSlotClicked: (slot: GearSlotId, isEmpty: boolean) => void,
    onSkillClicked: (skillId: SkillId) => void,
  ) {
    super('Character', THEME.panelWidth.character);

    const top = el('div', 'hud-char__top');
    this.doll = el('div', 'hud-char__doll');
    this.doll.append(paperdollSvg(this.gear));
    const stats = el('div', 'hud-char__stats');
    this.statLines = [0, 1, 2, 3, 4].map(() => el('div'));
    stats.append(...this.statLines);
    top.append(this.doll, stats);
    this.body.append(top);

    this.slots = mapKeys(SLOT_ORDER, (slot) => {
      const button = el('button', 'hud-slot');
      button.type = 'button';
      button.dataset.slot = slot;
      const head = row({
        className: 'hud-slot__head',
        label: SLOT_LABELS[slot],
        valueClass: 'hud-slot__bonuses',
      });
      const item = el('div', 'hud-slot__item');
      button.append(head.root, item);
      // Read when asked rather than bound to a piece, since the button outlives
      // everything worn in it; an empty slot has nothing to ask about.
      bindItemCard(button, () => this.gear[slot]);
      button.addEventListener('click', () => onSlotClicked(slot, this.gear[slot] === null));
      this.body.append(button);
      return { button, item, bonuses: head.value };
    });

    // Two blocks, one record: the spread is what makes the pair cover SkillId,
    // and each list covers its own half by construction.
    this.skills = {
      ...this.buildSkillBlock('Skills', SKILL_ORDER, onSkillClicked),
      ...this.buildSkillBlock('Combat Skills', COMBAT_SKILL_ORDER, onSkillClicked),
    };
  }

  private buildSkillBlock<K extends SkillId>(
    title: string,
    skillIds: readonly K[],
    onSkillClicked: (skillId: SkillId) => void,
  ): Record<K, SkillRow> {
    this.body.append(sectionHeader(title));
    return mapKeys(skillIds, (skillId) => {
      const skill = skillRow(SKILLS[skillId].name, () => onSkillClicked(skillId));
      skill.root.dataset.skill = skillId;
      this.body.append(skill.root);
      return skill;
    });
  }

  update(state: CharacterSheetState): void {
    this.gear = state.gear;
    this.doll.replaceChildren(paperdollSvg(state.gear));

    const { hp, maxHp, strength, intellect, agility, attackPower, attackStat } = state.stats;
    const lines = [
      `Health ${hp} / ${maxHp}`,
      `${STAT_LABELS.strength} ${strength}`,
      `${STAT_LABELS.intellect} ${intellect}`,
      `${STAT_LABELS.agility} ${agility}`,
      `Attack ${attackPower} (${STAT_LABELS[attackStat]})`,
    ];
    this.statLines.forEach((line, index) => {
      line.textContent = lines[index] ?? '';
    });

    for (const slot of SLOT_ORDER) {
      const itemId = state.gear[slot];
      const row = this.slots[slot];
      const reforgeId = itemId ? (state.reforges[itemId] ?? null) : null;
      row.item.textContent = itemId ? reforgedName(itemId, reforgeId) : describeItemName(itemId);
      if (isQuiver(itemId)) {
        const { quiver } = state;
        row.item.textContent += quiver
          ? ` — ${quiver.count} ${describeItemName(quiver.itemId)}`
          : ' — empty';
      }
      row.item.classList.toggle('is-filled', itemId !== null);
      row.bonuses.textContent = describeBonuses(reforgedBonuses(itemId, reforgeId), itemId);
    }

    for (const skillId of [...SKILL_ORDER, ...COMBAT_SKILL_ORDER]) {
      const skill = state.skills[skillId] ?? { level: 1, xp: 0 };
      const xpToNext = skillXpToNextLevel(skillId, skill.level, state.level);
      setSkillProgress(this.skills[skillId], skill.level, skill.xp, xpToNext);
    }
  }

  /** Where a slot row sits on screen, for the picker that anchors to it. */
  slotBounds(slot: GearSlotId): DOMRect {
    return this.slots[slot].button.getBoundingClientRect();
  }
}
