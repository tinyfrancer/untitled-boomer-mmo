import Phaser from 'phaser';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { CharacterPanel, characterPanelHeight, characterPanelWidth } from '../ui/CharacterPanel';
import { ActionBar } from '../ui/ActionBar';
import { GatherProgressBar } from '../ui/GatherProgressBar';
import { InventoryPanel, inventoryPanelWidth } from '../ui/InventoryPanel';
import { SlotPicker } from '../ui/SlotPicker';
import { TargetFrame } from '../ui/TargetFrame';
import { THEME, fontPx, px, scenePxScale } from '../ui/theme';
import {
  ACTIONS_CHANGED_EVENT,
  COOK_REQUESTED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  type AvailableActions,
  GATHER_PROGRESS_EVENT,
  GATHER_REFUSED_EVENT,
  GATHER_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  SKILL_XP_GAINED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  type SkillProgressInfo,
  type TargetInfo,
} from '../ui/uiEvents';
import { xpToNextLevel } from '../systems/LevelingSystem';
import { itemsForSlot } from '../systems/InventorySystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import { SKILLS } from '../data/skills';
import type { CharacterState } from '../persistence/CharacterState';
import type { ClassId, GearSlotId } from '../types/ids';

const DEFAULT_GEAR: Record<GearSlotId, string | null> = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

// Everything the HUD renders. Kept here so a resize can tear the panels down and
// rebuild them at the new scale without asking ZoneScene to re-send anything.
interface HudModel {
  name: string;
  level: number;
  xp: number;
  gear: Record<GearSlotId, string | null>;
  inventory: Record<string, number>;
  skills: Skills;
  hp: number;
  characterPanelVisible: boolean;
  inventoryPanelVisible: boolean;
  actions: AvailableActions;
}

export class UIScene extends Phaser.Scene {
  private targetFrame!: TargetFrame;
  private levelText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private xpBarWidth = 0;
  private levelUpToast!: Phaser.GameObjects.Text;
  private characterPanel!: CharacterPanel;
  private inventoryPanel!: InventoryPanel;
  private gatherBar!: GatherProgressBar;
  private actionBar!: ActionBar;
  private slotPicker: SlotPicker | null = null;
  private classId: ClassId = 'warrior';
  private uiScale = 1;
  private model: HudModel = {
    name: 'Adventurer',
    level: 1,
    xp: 0,
    gear: DEFAULT_GEAR,
    inventory: {},
    skills: createInitialSkills(),
    hp: 0,
    characterPanelVisible: true,
    inventoryPanelVisible: false,
    actions: { canLightFire: false, canCook: false },
  };

  constructor() {
    super('UI');
  }

  create(): void {
    const character = this.registry.get('character') as CharacterState | undefined;
    this.classId = character?.classId ?? 'warrior';
    this.model = {
      ...this.model,
      name: character?.name ?? 'Adventurer',
      level: character?.level ?? 1,
      xp: character?.xp ?? 0,
      gear: character?.gear ?? DEFAULT_GEAR,
      inventory: character?.inventory ?? {},
      skills: character?.skills ?? createInitialSkills(),
      hp: computeEffectiveStats(
        this.classId,
        character?.gear ?? DEFAULT_GEAR,
        character?.level ?? 1,
      ).maxHp,
    };

    this.buildHud();

    this.game.events.on(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
    this.game.events.on(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
    this.game.events.on(XP_GAINED_EVENT, this.handleXpGained, this);
    this.game.events.on(LEVEL_UP_EVENT, this.handleLevelUp, this);
    this.game.events.on(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
    this.game.events.on(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
    this.game.events.on(PLAYER_HP_CHANGED_EVENT, this.handlePlayerHpChanged, this);
    this.game.events.on(PLAYER_DIED_EVENT, this.handlePlayerDied, this);
    this.game.events.on(SKILL_XP_GAINED_EVENT, this.handleSkillXpGained, this);
    this.game.events.on(GATHER_STARTED_EVENT, this.handleGatherStarted, this);
    this.game.events.on(GATHER_PROGRESS_EVENT, this.handleGatherProgress, this);
    this.game.events.on(GATHER_ENDED_EVENT, this.handleGatherEnded, this);
    this.game.events.on(GATHER_REFUSED_EVENT, this.handleGatherRefused, this);
    this.game.events.on(ACTIONS_CHANGED_EVENT, this.handleActionsChanged, this);

    this.input.keyboard?.on('keydown-I', this.toggleInventoryPanel, this);
    this.input.keyboard?.on('keydown-C', this.toggleCharacterPanel, this);

    // Panel sizes are derived from how large the canvas is on screen, so they
    // have to be rebuilt whenever that changes.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
      this.game.events.off(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
      this.game.events.off(XP_GAINED_EVENT, this.handleXpGained, this);
      this.game.events.off(LEVEL_UP_EVENT, this.handleLevelUp, this);
      this.game.events.off(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
      this.game.events.off(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
      this.game.events.off(PLAYER_HP_CHANGED_EVENT, this.handlePlayerHpChanged, this);
      this.game.events.off(PLAYER_DIED_EVENT, this.handlePlayerDied, this);
      this.game.events.off(SKILL_XP_GAINED_EVENT, this.handleSkillXpGained, this);
      this.game.events.off(GATHER_STARTED_EVENT, this.handleGatherStarted, this);
      this.game.events.off(GATHER_PROGRESS_EVENT, this.handleGatherProgress, this);
      this.game.events.off(GATHER_ENDED_EVENT, this.handleGatherEnded, this);
      this.game.events.off(GATHER_REFUSED_EVENT, this.handleGatherRefused, this);
      this.game.events.off(ACTIONS_CHANGED_EVENT, this.handleActionsChanged, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }

  // Panel positions are derived from the canvas size, which under Scale.RESIZE
  // changes with the window — rebuild the whole HUD at the new size.
  private handleResize = (): void => {
    this.slotPicker?.close();
    this.slotPicker = null;
    this.children.removeAll(true);
    this.buildHud();
  };

  private buildHud(): void {
    this.uiScale = scenePxScale();
    const margin = px(THEME.margin, this.uiScale);

    this.targetFrame = new TargetFrame(this, margin, margin, this.uiScale);
    this.createXpBar();
    this.createLevelUpToast();
    this.createCharacterPanel();
    this.createInventoryPanel();
    this.createPanelToggleButtons();
    this.createGatherBar();
    this.createActionBar();

    this.refreshCharacterPanel();
    this.inventoryPanel.update(this.model.inventory);
    this.characterPanel.setVisible(this.model.characterPanelVisible);
    this.inventoryPanel.setVisible(this.model.inventoryPanelVisible);
    this.handleXpGained(this.model.level, this.model.xp, xpToNextLevel(this.model.level));
  }

  // Player info sits top-left under the target frame.
  private playerBlockTop(): number {
    return px(THEME.margin, this.uiScale) * 2 + px(52, this.uiScale);
  }

  private createXpBar(): void {
    const scale = this.uiScale;
    const margin = px(THEME.margin, scale);
    const barHeight = px(THEME.xpBar.height, scale);
    this.xpBarWidth = px(THEME.xpBar.width, scale);
    const top = this.playerBlockTop();

    this.add
      .text(margin, top, this.model.name, {
        fontSize: fontPx(THEME.font.md, scale),
        color: THEME.color.text,
        fontStyle: 'bold',
      })
      .setScrollFactor(0);
    this.levelText = this.add
      .text(margin, top + px(20, scale), 'Level 1', {
        fontSize: fontPx(THEME.font.md, scale),
        color: THEME.color.text,
      })
      .setScrollFactor(0);

    const barY = top + px(40, scale);
    this.add
      .rectangle(margin, barY, this.xpBarWidth, barHeight, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.xpBarFill = this.add
      .rectangle(margin, barY, 0, barHeight, THEME.xpFill, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  private createLevelUpToast(): void {
    this.levelUpToast = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - px(80, this.uiScale), '', {
        fontSize: fontPx(THEME.font.xl, this.uiScale),
        color: THEME.color.levelUp,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);
  }

  private createCharacterPanel(): void {
    const margin = px(THEME.margin, this.uiScale);
    const x = this.scale.width - characterPanelWidth(this.uiScale) - margin;
    this.characterPanel = new CharacterPanel(this, x, margin, this.uiScale, (slot, isEmpty) => {
      if (isEmpty) {
        this.openSlotPicker(slot);
      } else {
        this.game.events.emit(UNEQUIP_SLOT_REQUESTED_EVENT, slot);
      }
    });
  }

  private createInventoryPanel(): void {
    const margin = px(THEME.margin, this.uiScale);
    const x = this.scale.width - inventoryPanelWidth(this.uiScale) - margin;
    const y = margin + characterPanelHeight(this.uiScale) + px(THEME.padding, this.uiScale);
    this.inventoryPanel = new InventoryPanel(
      this,
      x,
      y,
      this.uiScale,
      (itemId) => this.game.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId),
      (itemId) => this.game.events.emit(EAT_ITEM_REQUESTED_EVENT, itemId),
    );
  }

  // Bottom centre, clear of the gather bar above it.
  private createActionBar(): void {
    this.actionBar = new ActionBar(
      this,
      this.scale.width / 2 - px(108, this.uiScale),
      this.scale.height - px(THEME.touchMin + THEME.margin, this.uiScale),
      this.uiScale,
      [
        {
          id: 'light-fire',
          label: 'Light Fire',
          onClick: () => this.game.events.emit(LIGHT_FIRE_REQUESTED_EVENT),
        },
        {
          id: 'cook',
          label: 'Cook',
          onClick: () => this.game.events.emit(COOK_REQUESTED_EVENT),
        },
      ],
    );
    this.applyActions();
  }

  private applyActions(): void {
    this.actionBar.setAvailable('light-fire', this.model.actions.canLightFire);
    this.actionBar.setAvailable('cook', this.model.actions.canCook);
  }

  private openSlotPicker(slot: GearSlotId): void {
    this.slotPicker?.close();
    const bounds = this.characterPanel.slotRowBounds(slot);
    this.slotPicker = new SlotPicker(
      this,
      bounds.x - characterPanelWidth(this.uiScale) - px(THEME.padding, this.uiScale),
      bounds.y,
      this.uiScale,
      slot,
      itemsForSlot(this.model.inventory, slot),
      (itemId) => this.game.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId),
    );
  }

  private createPanelToggleButtons(): void {
    const scale = this.uiScale;
    const size = px(THEME.touchMin, scale);
    const gap = px(THEME.padding, scale);
    const x = px(THEME.margin, scale);
    const y = this.playerBlockTop() + px(40 + THEME.xpBar.height, scale) + gap;

    this.createToggleButton(x, y, size, 'C', () => this.toggleCharacterPanel());
    this.createToggleButton(x + size + gap, y, size, 'I', () => this.toggleInventoryPanel());
  }

  private createToggleButton(
    x: number,
    y: number,
    size: number,
    label: string,
    onClick: () => void,
  ): void {
    this.add
      .rectangle(x, y, size, size, THEME.buttonBg, THEME.buttonAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, this.uiScale), 0x888888)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    this.add
      .text(x + size / 2, y + size / 2, label, {
        fontSize: fontPx(THEME.font.md, this.uiScale),
        color: THEME.color.text,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  // Centred just below the player, who the camera keeps centred anyway.
  private createGatherBar(): void {
    this.gatherBar = new GatherProgressBar(
      this,
      this.scale.width / 2 - px(60, this.uiScale),
      this.scale.height / 2 + px(60, this.uiScale),
      this.uiScale,
    );
  }

  private toggleCharacterPanel(): void {
    this.characterPanel.toggle();
    this.model.characterPanelVisible = this.characterPanel.isVisible();
    if (!this.model.characterPanelVisible) {
      this.slotPicker?.close();
      this.slotPicker = null;
    }
  }

  private toggleInventoryPanel(): void {
    this.inventoryPanel.toggle();
    this.model.inventoryPanelVisible = this.inventoryPanel.isVisible();
  }

  private refreshCharacterPanel(): void {
    const stats = computeEffectiveStats(this.classId, this.model.gear, this.model.level);
    this.characterPanel.update({
      gear: this.model.gear,
      stats: {
        hp: Math.min(this.model.hp, stats.maxHp),
        maxHp: stats.maxHp,
        strength: stats.strength,
        intellect: stats.intellect,
        attackPower: stats.attackPower,
      },
      skills: this.model.skills,
    });
  }

  private handleTargetSelected = (target: TargetInfo): void => {
    this.targetFrame.show(target);
  };

  private handleTargetCleared = (): void => {
    this.targetFrame.hide();
  };

  private handleXpGained = (level: number, xp: number, xpToNext: number): void => {
    this.model.level = level;
    this.model.xp = xp;
    this.levelText.setText(
      level >= MAX_CHARACTER_LEVEL ? `Level ${level} (Max)` : `Level ${level}`,
    );
    const ratio = xpToNext > 0 ? Phaser.Math.Clamp(xp / xpToNext, 0, 1) : 1;
    this.xpBarFill.width = this.xpBarWidth * ratio;
  };

  private handleLevelUp = (level: number): void => {
    this.model.level = level;
    this.refreshCharacterPanel();
    this.showToast(`Level Up! Level ${level}`, THEME.color.levelUp);
  };

  private handlePlayerDied = (): void => {
    this.showToast('You have died.', THEME.color.playerDamage);
  };

  private showToast(message: string, color: string): void {
    this.levelUpToast.setText(message);
    this.levelUpToast.setColor(color);
    this.levelUpToast.setAlpha(1);
    this.tweens.add({
      targets: this.levelUpToast,
      alpha: 0,
      duration: 1500,
      delay: 500,
    });
  }

  private handleGearChanged = (gear: Record<GearSlotId, string | null>): void => {
    this.model.gear = gear;
    this.slotPicker?.close();
    this.slotPicker = null;
    this.refreshCharacterPanel();
  };

  private handleInventoryChanged = (inventory: Record<string, number>): void => {
    this.model.inventory = inventory;
    this.inventoryPanel.update(inventory);
  };

  private handleSkillXpGained = (progress: SkillProgressInfo): void => {
    this.model.skills = {
      ...this.model.skills,
      [progress.skillId]: { level: progress.level, xp: progress.xp },
    };
    this.refreshCharacterPanel();
    if (progress.leveledUp) {
      this.showToast(
        `${SKILLS[progress.skillId].name} Level ${progress.level}!`,
        THEME.color.skillUp,
      );
    }
  };

  private handleGatherStarted = (label: string): void => {
    this.gatherBar.show(label);
  };

  private handleGatherProgress = (progress: number): void => {
    this.gatherBar.setProgress(progress);
  };

  private handleGatherEnded = (): void => {
    this.gatherBar.hide();
  };

  private handleActionsChanged = (actions: AvailableActions): void => {
    this.model.actions = actions;
    this.applyActions();
  };

  private handleGatherRefused = (reason: string): void => {
    this.showToast(reason, THEME.color.muted);
  };

  private handlePlayerHpChanged = (hp: number): void => {
    this.model.hp = hp;
    this.refreshCharacterPanel();
  };
}
