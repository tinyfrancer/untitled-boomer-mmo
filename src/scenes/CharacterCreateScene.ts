import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { computeAppearance } from '../systems/AppearanceSystem';
import { THEME, fontPx, px, scenePxScale } from '../ui/theme';
import { ensurePlayerTexture } from './generateTextures';
import type { ClassId } from '../types/ids';
import { createNewCharacter, saveService } from '../persistence';

const CLASS_IDS: ClassId[] = ['warrior', 'wizard'];
const DEFAULT_NAME = 'Adventurer';
const SELECTED_STROKE_COLOR = 0xffee58;
const UNSELECTED_STROKE_COLOR = 0x555577;

const NO_GEAR = { helmet: null, chest: null, pants: null, weapon: null };

interface ClassCard {
  background: Phaser.GameObjects.Rectangle;
}

export class CharacterCreateScene extends Phaser.Scene {
  private nameInput!: HTMLInputElement;
  private selectedClassId: ClassId | null = null;
  private readonly classCards = new Map<ClassId, ClassCard>();
  private beginButtonText!: Phaser.GameObjects.Text;
  private uiScale = 1;

  constructor() {
    super('CharacterCreate');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.uiScale = scenePxScale(this);

    this.add
      .text(this.scale.width / 2, px(48, this.uiScale), 'Create Your Character', {
        fontSize: fontPx(THEME.font.xl, this.uiScale),
        color: THEME.color.text,
      })
      .setOrigin(0.5);

    this.createNameInput();
    this.createClassCards();
    this.createBeginButton();
  }

  private createNameInput(): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = DEFAULT_NAME;
    input.maxLength = 20;
    // Styled in CSS px directly: DOM elements sit above the canvas and are not
    // subject to the Scale Manager's transform.
    input.style.cssText = 'width:220px;padding:8px 10px;font-size:16px;text-align:center;';
    this.nameInput = input;
    this.add.dom(this.scale.width / 2, px(110, this.uiScale), input);
  }

  private createClassCards(): void {
    const scale = this.uiScale;
    const cardWidth = px(200, scale);
    const cardHeight = px(200, scale);
    const gap = px(24, scale);
    const totalWidth = CLASS_IDS.length * cardWidth + (CLASS_IDS.length - 1) * gap;
    const startX = this.scale.width / 2 - totalWidth / 2 + cardWidth / 2;
    const y = px(280, scale);

    CLASS_IDS.forEach((classId, index) => {
      const classDef = CLASSES[classId];
      const x = startX + index * (cardWidth + gap);

      const background = this.add
        .rectangle(x, y, cardWidth, cardHeight, 0x2a2a4a, 1)
        .setStrokeStyle(px(2, scale), UNSELECTED_STROKE_COLOR)
        .setInteractive({ useHandCursor: true });
      background.on('pointerdown', () => this.selectClass(classId));

      this.add
        .text(x, y - cardHeight / 2 + px(20, scale), classDef.name, {
          fontSize: fontPx(THEME.font.lg, scale),
          color: THEME.color.text,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      // Classes now look alike apart from the weapon they start holding, so the
      // preview is the naked figure plus that starting weapon.
      const previewSize = px(THEME.paperdollSize, scale);
      const preview = ensurePlayerTexture(
        this,
        computeAppearance({ ...NO_GEAR, weapon: classDef.startingWeaponId }),
      );
      this.add
        .image(x, y - px(10, scale), preview)
        .setDisplaySize(previewSize, previewSize)
        .setOrigin(0.5);

      this.add
        .text(x, y + cardHeight / 2 - px(34, scale), classDef.description, {
          fontSize: fontPx(THEME.font.xs, scale),
          color: THEME.color.muted,
          wordWrap: { width: cardWidth - px(20, scale) },
          align: 'center',
        })
        .setOrigin(0.5);

      this.classCards.set(classId, { background });
    });
  }

  private selectClass(classId: ClassId): void {
    this.selectedClassId = classId;
    this.classCards.forEach((card, id) => {
      card.background.setStrokeStyle(
        px(2, this.uiScale),
        id === classId ? SELECTED_STROKE_COLOR : UNSELECTED_STROKE_COLOR,
      );
    });
    this.updateBeginButtonState();
  }

  private createBeginButton(): void {
    const scale = this.uiScale;
    const y = px(430, scale);
    const background = this.add
      .rectangle(this.scale.width / 2, y, px(220, scale), px(THEME.touchMin, scale), 0x333333, 1)
      .setStrokeStyle(px(2, scale), UNSELECTED_STROKE_COLOR)
      .setInteractive({ useHandCursor: true });
    background.on('pointerdown', () => this.tryBeginAdventure());

    this.beginButtonText = this.add
      .text(this.scale.width / 2, y, 'Begin Adventure', {
        fontSize: fontPx(THEME.font.lg, scale),
        color: THEME.color.dim,
      })
      .setOrigin(0.5);
  }

  private updateBeginButtonState(): void {
    const ready = this.selectedClassId !== null;
    this.beginButtonText.setColor(ready ? THEME.color.text : THEME.color.dim);
  }

  private tryBeginAdventure(): void {
    if (!this.selectedClassId) {
      return;
    }

    const rawName = this.nameInput.value.trim();
    const name = rawName.length > 0 ? rawName : DEFAULT_NAME;
    const character = createNewCharacter(name, this.selectedClassId);

    saveService.save(character);
    this.registry.set('character', character);
    this.scene.start('Zone');
  }
}
