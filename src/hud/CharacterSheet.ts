import { Sheet } from './Sheet';
import { el, row, sectionHeader } from './dom';
import { setSkillProgress, skillRow, type SkillRow } from './skillRows';
import { drawPortrait } from './hudArt';
import { playerGetup, portrait } from '../art/outfit';
import { bindItemCard } from './itemCard';
import { BONUS_NAMES, describeBonuses, describeItemName } from '../data/items';
import { reforgedBonuses, reforgedName, type Reforges } from '../systems/ReforgeSystem';
import { COMBAT_SKILL_ORDER, SKILLS, SKILL_ORDER } from '../data/skills';
import { skillXpToNextLevel, type Skills } from '../systems/SkillSystem';
import { damageReduction } from '../systems/CombatSystem';
import { THEME } from '../ui/theme';
import type { PrimaryStat } from '../data/classes';
import type { Quiver } from '../systems/QuiverSystem';
import { isQuiver } from '../data/items';
import { NO_GEAR, type Gear } from '../systems/InventorySystem';
import { exhaustive, mapKeys } from '../types/exhaustive';
import type { ClassId, GearSlotId, SkillId } from '../types/ids';
import type { Look } from '../data/looks';

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
  // Everything worn, added up. It was the largest number on most armour and
  // appeared on no panel, so what a helmet's +2 went into could not be read.
  armor: number;
}

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
 * The character sheet: the figure as the world draws it in what is worn, stats,
 * the four gear slots and the skill lists. Clicking a filled slot unequips it; clicking an empty one asks for a
 * picker, so the sheet is self-sufficient without the bag open. A skill's row
 * opens its page in the skills book, which is where what it does is said.
 */
export class CharacterSheet extends Sheet {
  private readonly doll: HTMLCanvasElement;
  private readonly classId: ClassId;
  private readonly look: Look;
  private drawnGear = '';
  private readonly statLines: HTMLElement[];
  private readonly slots: Record<GearSlotId, SlotRow>;
  private readonly skills: Record<SkillId, SkillRow>;
  private gear: Gear = NO_GEAR;

  constructor(
    classId: ClassId,
    look: Look,
    onSlotClicked: (slot: GearSlotId, isEmpty: boolean) => void,
    onSkillClicked: (skillId: SkillId) => void,
  ) {
    super('Character', THEME.panelWidth.character);
    this.classId = classId;
    this.look = look;

    const top = el('div', 'hud-char__top');
    const frame = el('div', 'hud-char__doll');
    this.doll = el('canvas', 'hud-paperdoll');
    frame.append(this.doll);
    this.drawDoll();
    const stats = el('div', 'hud-char__stats');
    this.statLines = [0, 1, 2, 3, 4, 5].map(() => el('div'));
    stats.append(...this.statLines);
    top.append(frame, stats);
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
    this.drawDoll();

    const { hp, maxHp, strength, intellect, agility, attackPower, attackStat, armor } = state.stats;
    const lines = [
      `${BONUS_NAMES.health} ${hp} / ${maxHp}`,
      `${BONUS_NAMES.strength} ${strength}`,
      `${BONUS_NAMES.intellect} ${intellect}`,
      `${BONUS_NAMES.agility} ${agility}`,
      `${BONUS_NAMES.attackPower} ${attackPower} (${BONUS_NAMES[attackStat]})`,
      armourLine(armor),
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

  /**
   * The figure the world draws for this character (decision 107), compiled
   * again only when what is worn changes, as the world compiles its own.
   */
  private drawDoll(): void {
    const worn = JSON.stringify(this.gear);
    if (worn === this.drawnGear) return;
    this.drawnGear = worn;
    this.doll.dataset.gear = worn;
    drawPortrait(
      this.doll,
      portrait(playerGetup(this.classId, this.look, this.gear)),
      THEME.paperdollScale,
    );
  }

  /** Where a slot row sits on screen, for the picker that anchors to it. */
  slotBounds(slot: GearSlotId): DOMRect {
    return this.slots[slot].button.getBoundingClientRect();
  }
}

/**
 * Armour with what it buys, off the curve a hit is cut by, since a total alone
 * says nothing: 12 stops an eighth of a blow, and twice that is not twice as
 * much.
 */
function armourLine(armor: number): string {
  const share = Math.round(damageReduction(armor) * 100);
  return share > 0
    ? `${BONUS_NAMES.armor} ${armor} (stops ${share}% of a hit)`
    : `${BONUS_NAMES.armor} ${armor}`;
}
