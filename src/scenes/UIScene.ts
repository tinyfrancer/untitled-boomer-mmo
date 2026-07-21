import Phaser from 'phaser';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { ITEMS } from '../data/items';
import { TargetFrame } from '../ui/TargetFrame';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import {
  LEVEL_UP_EVENT,
  MOVE_VECTOR_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  XP_GAINED_EVENT,
} from '../ui/uiEvents';
import { xpToNextLevel } from '../systems/LevelingSystem';
import type { CharacterState } from '../persistence/CharacterState';

const XP_BAR_WIDTH = 200;
const XP_BAR_HEIGHT = 14;

export class UIScene extends Phaser.Scene {
  private targetFrame!: TargetFrame;
  private levelText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private levelUpToast!: Phaser.GameObjects.Text;

  constructor() {
    super('UI');
  }

  create(): void {
    const character = this.registry.get('character') as CharacterState | undefined;

    this.targetFrame = new TargetFrame(this, 16, 16);
    this.createXpBar(character);
    this.createLevelUpToast();
    this.createGearPanel(character);
    this.createJoystick();

    this.game.events.on(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
    this.game.events.on(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
    this.game.events.on(XP_GAINED_EVENT, this.handleXpGained, this);
    this.game.events.on(LEVEL_UP_EVENT, this.handleLevelUp, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
      this.game.events.off(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
      this.game.events.off(XP_GAINED_EVENT, this.handleXpGained, this);
      this.game.events.off(LEVEL_UP_EVENT, this.handleLevelUp, this);
    });
  }

  private createXpBar(character?: CharacterState): void {
    const x = 16;
    const y = this.scale.height - 32;

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

  private createGearPanel(character?: CharacterState): void {
    const gear = character?.gear ?? { weapon: null, armor: null };

    const width = 164;
    const x = this.scale.width - width - 16;
    const y = 16;

    this.add.rectangle(x, y, width, 60, 0x000000, 0.55).setOrigin(0, 0).setScrollFactor(0);
    this.add
      .text(x + 8, y + 6, 'Gear', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' })
      .setScrollFactor(0);
    this.add
      .text(x + 8, y + 24, `Weapon: ${this.describeItem(gear.weapon)}`, {
        fontSize: '11px',
        color: '#cccccc',
      })
      .setScrollFactor(0);
    this.add
      .text(x + 8, y + 40, `Armor: ${this.describeItem(gear.armor)}`, {
        fontSize: '11px',
        color: '#cccccc',
      })
      .setScrollFactor(0);
  }

  private createJoystick(): void {
    const x = this.scale.width - 90;
    const y = this.scale.height - 90;
    new VirtualJoystick(this, x, y, (vx, vy) => {
      this.game.events.emit(MOVE_VECTOR_EVENT, vx, vy);
    });
  }

  private describeItem(itemId: string | null): string {
    if (!itemId) {
      return '(empty)';
    }
    return ITEMS[itemId]?.name ?? itemId;
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
}
