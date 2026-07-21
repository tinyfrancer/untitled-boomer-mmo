import Phaser from 'phaser';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { GearPanel, GEAR_PANEL_HEIGHT, GEAR_PANEL_WIDTH } from '../ui/GearPanel';
import { InventoryPanel, INVENTORY_PANEL_WIDTH } from '../ui/InventoryPanel';
import { StatsPanel } from '../ui/StatsPanel';
import { TargetFrame } from '../ui/TargetFrame';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import {
  EQUIP_ITEM_REQUESTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  MOVE_VECTOR_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
} from '../ui/uiEvents';
import { xpToNextLevel } from '../systems/LevelingSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import type { CharacterState } from '../persistence/CharacterState';
import type { ClassId, GearSlotId } from '../types/ids';

const XP_BAR_WIDTH = 200;
const XP_BAR_HEIGHT = 14;
const DEFAULT_GEAR: Record<GearSlotId, string | null> = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

export class UIScene extends Phaser.Scene {
  private targetFrame!: TargetFrame;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private levelUpToast!: Phaser.GameObjects.Text;
  private gearPanel!: GearPanel;
  private inventoryPanel!: InventoryPanel;
  private statsPanel!: StatsPanel;
  private classId: ClassId = 'warrior';

  constructor() {
    super('UI');
  }

  create(): void {
    const character = this.registry.get('character') as CharacterState | undefined;
    this.classId = character?.classId ?? 'warrior';

    this.targetFrame = new TargetFrame(this, 16, 16);
    this.createXpBar(character);
    this.createLevelUpToast();
    this.createStatsPanel(character);
    this.createGearPanel(character);
    this.createInventoryPanel(character);
    this.createPanelToggleButtons();
    this.createJoystick();

    this.game.events.on(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
    this.game.events.on(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
    this.game.events.on(XP_GAINED_EVENT, this.handleXpGained, this);
    this.game.events.on(LEVEL_UP_EVENT, this.handleLevelUp, this);
    this.game.events.on(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
    this.game.events.on(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);

    this.input.keyboard?.on('keydown-I', () => this.inventoryPanel.toggle());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
      this.game.events.off(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
      this.game.events.off(XP_GAINED_EVENT, this.handleXpGained, this);
      this.game.events.off(LEVEL_UP_EVENT, this.handleLevelUp, this);
      this.game.events.off(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
      this.game.events.off(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
    });
  }

  private createXpBar(character?: CharacterState): void {
    const x = 16;
    const y = this.scale.height - 32;

    this.nameText = this.add
      .text(x, y - 34, character?.name ?? 'Adventurer', {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setScrollFactor(0);
    this.levelText = this.add
      .text(x, y - 18, 'Level 1', { fontSize: '13px', color: '#ffffff' })
      .setScrollFactor(0);
    this.add
      .rectangle(x, y, XP_BAR_WIDTH, XP_BAR_HEIGHT, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.xpBarFill = this.add
      .rectangle(x, y, 0, XP_BAR_HEIGHT, 0x42a5f5, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    const level = character?.level ?? 1;
    const xp = character?.xp ?? 0;
    this.handleXpGained(level, xp, xpToNextLevel(level));
  }

  private createLevelUpToast(): void {
    this.levelUpToast = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 80, '', {
        fontSize: '28px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);
  }

  private createStatsPanel(character?: CharacterState): void {
    this.statsPanel = new StatsPanel(this, 16, 96);
    const stats = computeEffectiveStats(this.classId, character?.gear ?? DEFAULT_GEAR);
    this.statsPanel.update({
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      strength: stats.strength,
      intellect: stats.intellect,
      attackPower: stats.attackPower,
    });
  }

  private createGearPanel(character?: CharacterState): void {
    const x = this.scale.width - GEAR_PANEL_WIDTH - 16;
    this.gearPanel = new GearPanel(this, x, 16, (slot) =>
      this.game.events.emit(UNEQUIP_SLOT_REQUESTED_EVENT, slot),
    );
    this.gearPanel.update(character?.gear ?? DEFAULT_GEAR);
  }

  private createInventoryPanel(character?: CharacterState): void {
    const x = this.scale.width - INVENTORY_PANEL_WIDTH - 16;
    const y = 16 + GEAR_PANEL_HEIGHT + 8;
    this.inventoryPanel = new InventoryPanel(this, x, y, (itemId) =>
      this.game.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId),
    );
    this.inventoryPanel.update(character?.inventory ?? {});
  }

  private createPanelToggleButtons(): void {
    const buttonSize = 22;
    const gap = 4;
    const x = 16;
    const y = this.nameText.y - buttonSize - 6;

    this.createToggleButton(x, y, 'C', () => this.statsPanel.toggle());
    this.createToggleButton(x + (buttonSize + gap), y, 'G', () => this.gearPanel.toggle());
    this.createToggleButton(x + (buttonSize + gap) * 2, y, 'I', () =>
      this.inventoryPanel.toggle(),
    );
  }

  private createToggleButton(x: number, y: number, label: string, onClick: () => void): void {
    const size = 22;
    this.add
      .rectangle(x, y, size, size, 0x333333, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x888888)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    this.add
      .text(x + size / 2, y + size / 2, label, { fontSize: '12px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  private createJoystick(): void {
    const x = this.scale.width - 90;
    const y = this.scale.height - 90;
    new VirtualJoystick(this, x, y, (vx, vy) => {
      this.game.events.emit(MOVE_VECTOR_EVENT, vx, vy);
    });
  }

  private handleTargetSelected = (name: string, hp: number, maxHp: number): void => {
    this.targetFrame.show(name, hp, maxHp);
  };

  private handleTargetCleared = (): void => {
    this.targetFrame.hide();
  };

  private handleXpGained = (level: number, xp: number, xpToNext: number): void => {
    this.levelText.setText(
      level >= MAX_CHARACTER_LEVEL ? `Level ${level} (Max)` : `Level ${level}`,
    );
    const ratio = xpToNext > 0 ? Phaser.Math.Clamp(xp / xpToNext, 0, 1) : 1;
    this.xpBarFill.width = XP_BAR_WIDTH * ratio;
  };

  private handleLevelUp = (level: number): void => {
    this.levelUpToast.setText(`Level Up! Level ${level}`);
    this.levelUpToast.setAlpha(1);
    this.tweens.add({
      targets: this.levelUpToast,
      alpha: 0,
      duration: 1500,
      delay: 500,
    });
  };

  private handleGearChanged = (gear: Record<GearSlotId, string | null>): void => {
    this.gearPanel.update(gear);
    const stats = computeEffectiveStats(this.classId, gear);
    this.statsPanel.update({
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      strength: stats.strength,
      intellect: stats.intellect,
      attackPower: stats.attackPower,
    });
  };

  private handleInventoryChanged = (inventory: Record<string, number>): void => {
    this.inventoryPanel.update(inventory);
  };
}
