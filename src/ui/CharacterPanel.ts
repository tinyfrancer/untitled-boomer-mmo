import Phaser from 'phaser';
import { describeItemBonuses, describeItemName } from '../data/items';
import { SKILLS, SKILL_ORDER } from '../data/skills';
import { ensurePlayerTexture } from '../scenes/generateTextures';
import { computeAppearance } from '../systems/AppearanceSystem';
import { skillXpToNextLevel, type Skills } from '../systems/SkillSystem';
import { THEME, fontPx, px } from './theme';
import type { GearSlotId, SkillId } from '../types/ids';

export const SLOT_ORDER: GearSlotId[] = ['weapon', 'helmet', 'chest', 'pants'];
export const SLOT_LABELS: Record<GearSlotId, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  chest: 'Chest',
  pants: 'Pants',
};

// Layout in CSS px; everything is multiplied by the ui scale at build time.
const TITLE_ROW = 22;
const STAT_ROW = 20;
const GAP = 6;
const SKILL_HEADER = 20;
// One line per skill — name, level, and a hairline XP bar sharing the row.
// Deliberately far tighter than a gear row: skills are read, never tapped.
const SKILL_ROW = 20;
const SKILL_BAR_HEIGHT = 3;

const EMPTY_GEAR: Record<GearSlotId, string | null> = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

export interface DisplayedStats {
  hp: number;
  maxHp: number;
  strength: number;
  intellect: number;
  attackPower: number;
}

export interface CharacterPanelState {
  gear: Record<GearSlotId, string | null>;
  stats: DisplayedStats;
  skills: Skills;
}

interface SlotRow {
  hit: Phaser.GameObjects.Rectangle;
  value: Phaser.GameObjects.Text;
  bonuses: Phaser.GameObjects.Text;
}

interface SkillRow {
  level: Phaser.GameObjects.Text;
  barFill: Phaser.GameObjects.Rectangle;
  barWidth: number;
}

export function characterPanelWidth(scale: number): number {
  return px(THEME.panelWidth.character, scale);
}

export function characterPanelHeight(scale: number): number {
  const cssHeight =
    THEME.padding * 2 +
    TITLE_ROW +
    GAP +
    THEME.paperdollSize +
    GAP +
    SLOT_ORDER.length * THEME.touchMin +
    GAP +
    SKILL_HEADER +
    SKILL_ORDER.length * SKILL_ROW;
  return px(cssHeight, scale);
}

/**
 * The character sheet: paperdoll, stats, and the four gear slots merged into one
 * panel. Clicking a filled slot unequips it; clicking an empty one asks for a
 * picker, so the sheet is self-sufficient without the inventory panel open.
 */
export class CharacterPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly paperdoll: Phaser.GameObjects.Image;
  private readonly slotRows: Record<GearSlotId, SlotRow>;
  private readonly skillRows: Record<SkillId, SkillRow>;
  private readonly statTexts: Phaser.GameObjects.Text[];
  private gear: Record<GearSlotId, string | null> = EMPTY_GEAR;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    onSlotClicked: (slot: GearSlotId, isEmpty: boolean) => void,
  ) {
    this.scene = scene;
    this.scale = scale;

    const width = characterPanelWidth(scale);
    const height = characterPanelHeight(scale);
    const pad = px(THEME.padding, scale);

    const background = scene.add
      .rectangle(0, 0, width, height, THEME.panelBg, THEME.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke);

    const title = scene.add.text(pad, pad, 'Character', {
      fontSize: fontPx(THEME.font.lg, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    // Paperdoll on the left, stat column beside it, so the sheet stays short
    // enough to fit the canvas when the ui scale is at its maximum.
    const bodyTop = pad + px(TITLE_ROW + GAP, scale);
    const dollSize = px(THEME.paperdollSize, scale);
    this.paperdoll = scene.add
      .image(pad + dollSize / 2, bodyTop + dollSize / 2, this.textureFor(EMPTY_GEAR))
      .setDisplaySize(dollSize, dollSize);

    const statX = pad + dollSize + px(GAP, scale);
    const statStyle = {
      fontSize: fontPx(THEME.font.sm, scale),
      color: THEME.color.muted,
    };
    this.statTexts = [0, 1, 2, 3].map((index) =>
      scene.add.text(statX, bodyTop + px(index * STAT_ROW, scale), '', statStyle),
    );

    this.slotRows = {} as Record<GearSlotId, SlotRow>;
    const slotObjects: Phaser.GameObjects.GameObject[] = [];
    const slotsTop = bodyTop + dollSize + px(GAP, scale);
    const rowHeight = px(THEME.touchMin, scale);

    SLOT_ORDER.forEach((slot, index) => {
      const rowY = slotsTop + index * rowHeight;
      // A full-width hit rect keeps the tap target at the accessibility minimum
      // even though the text inside it is much shorter.
      const hit = scene.add
        .rectangle(pad, rowY, width - pad * 2, rowHeight, 0xffffff, 0.05)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const label = scene.add.text(pad + px(GAP, scale), rowY + px(4, scale), SLOT_LABELS[slot], {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.dim,
      });
      // Bonuses share the label's line, right-aligned, so a long item name can
      // never push them off the panel edge.
      const bonuses = scene.add
        .text(width - pad - px(GAP, scale), rowY + px(4, scale), '', {
          fontSize: fontPx(THEME.font.xs, scale),
          color: THEME.color.muted,
        })
        .setOrigin(1, 0);
      const value = scene.add.text(pad + px(GAP, scale), rowY + px(18, scale), '', {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.muted,
      });

      this.slotRows[slot] = { hit, value, bonuses };
      slotObjects.push(hit, label, bonuses, value);
    });

    this.skillRows = {} as Record<SkillId, SkillRow>;
    const skillObjects: Phaser.GameObjects.GameObject[] = [];
    const skillsTop = slotsTop + SLOT_ORDER.length * rowHeight + px(GAP, scale);
    const barWidth = width - pad * 2;

    skillObjects.push(
      scene.add.text(pad, skillsTop, 'Skills', {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.text,
        fontStyle: 'bold',
      }),
    );

    SKILL_ORDER.forEach((skillId, index) => {
      const rowY = skillsTop + px(SKILL_HEADER + index * SKILL_ROW, scale);
      const name = scene.add.text(pad, rowY, SKILLS[skillId].name, {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.muted,
      });
      const level = scene.add
        .text(width - pad, rowY, '', {
          fontSize: fontPx(THEME.font.xs, scale),
          color: THEME.color.muted,
        })
        .setOrigin(1, 0);

      const barY = rowY + px(SKILL_ROW - SKILL_BAR_HEIGHT - 3, scale);
      const barBg = scene.add
        .rectangle(pad, barY, barWidth, px(SKILL_BAR_HEIGHT, scale), 0x000000, 0.5)
        .setOrigin(0, 0);
      const barFill = scene.add
        .rectangle(pad, barY, 0, px(SKILL_BAR_HEIGHT, scale), THEME.xpFill, 1)
        .setOrigin(0, 0);

      this.skillRows[skillId] = { level, barFill, barWidth };
      skillObjects.push(name, level, barBg, barFill);
    });

    this.container = scene.add
      .container(x, y, [
        background,
        title,
        this.paperdoll,
        ...this.statTexts,
        ...slotObjects,
        ...skillObjects,
      ])
      .setScrollFactor(0);

    SLOT_ORDER.forEach((slot) => {
      this.slotRows[slot].hit.on('pointerdown', () =>
        onSlotClicked(slot, this.gear[slot] === null),
      );
    });
  }

  private textureFor(gear: Record<GearSlotId, string | null>): string {
    return ensurePlayerTexture(this.scene, computeAppearance(gear));
  }

  update(state: CharacterPanelState): void {
    this.gear = state.gear;
    this.paperdoll.setTexture(this.textureFor(state.gear));
    const size = px(THEME.paperdollSize, this.scale);
    this.paperdoll.setDisplaySize(size, size);

    const { hp, maxHp, strength, intellect, attackPower } = state.stats;
    const lines = [
      `HP ${hp} / ${maxHp}`,
      `STR ${strength}`,
      `INT ${intellect}`,
      `ATK ${attackPower}`,
    ];
    this.statTexts.forEach((text, index) => text.setText(lines[index]));

    SLOT_ORDER.forEach((slot) => {
      const itemId = state.gear[slot];
      const row = this.slotRows[slot];
      row.value.setText(describeItemName(itemId));
      row.value.setColor(itemId ? THEME.color.equippable : THEME.color.dim);
      row.bonuses.setText(describeItemBonuses(itemId));
    });

    SKILL_ORDER.forEach((skillId) => {
      const skill = state.skills[skillId] ?? { level: 1, xp: 0 };
      const row = this.skillRows[skillId];
      const xpToNext = skillXpToNextLevel(skill.level);
      row.level.setText(`Lv ${skill.level}`);
      const ratio = xpToNext > 0 ? Phaser.Math.Clamp(skill.xp / xpToNext, 0, 1) : 1;
      row.barFill.width = row.barWidth * ratio;
    });
  }

  slotRowBounds(slot: GearSlotId): Phaser.Geom.Rectangle {
    return this.slotRows[slot].hit.getBounds();
  }

  get bottom(): number {
    return this.container.y + characterPanelHeight(this.scale);
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
