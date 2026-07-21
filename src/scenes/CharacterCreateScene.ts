import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import type { ClassId } from '../types/ids';
import { createNewCharacter, saveService } from '../persistence';

const CLASS_IDS: ClassId[] = ['warrior', 'wizard'];
const DEFAULT_NAME = 'Adventurer';
const SELECTED_STROKE_COLOR = 0xffee58;
const UNSELECTED_STROKE_COLOR = 0x555577;

interface ClassCard {
  background: Phaser.GameObjects.Rectangle;
}

export class CharacterCreateScene extends Phaser.Scene {
  private nameInput!: HTMLInputElement;
  private selectedClassId: ClassId | null = null;
  private readonly classCards = new Map<ClassId, ClassCard>();
  private beginButtonText!: Phaser.GameObjects.Text;

  constructor() {
    super('CharacterCreate');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add
      .text(this.scale.width / 2, 48, 'Create Your Character', {
        fontSize: '24px',
        color: '#ffffff',
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
    input.style.cssText = 'width:220px;padding:6px 8px;font-size:14px;text-align:center;';
    this.nameInput = input;
    this.add.dom(this.scale.width / 2, 120, input);
  }

  private createClassCards(): void {
    const cardWidth = 180;
    const cardHeight = 140;
    const gap = 24;
    const totalWidth = CLASS_IDS.length * cardWidth + (CLASS_IDS.length - 1) * gap;
    const startX = this.scale.width / 2 - totalWidth / 2 + cardWidth / 2;
    const y = 260;

    CLASS_IDS.forEach((classId, index) => {
      const classDef = CLASSES[classId];
      const x = startX + index * (cardWidth + gap);

      const background = this.add
        .rectangle(x, y, cardWidth, cardHeight, 0x2a2a4a, 1)
        .setStrokeStyle(2, UNSELECTED_STROKE_COLOR)
        .setInteractive({ useHandCursor: true });
      background.on('pointerdown', () => this.selectClass(classId));

      this.add
        .text(x, y - cardHeight / 2 + 22, classDef.name, {
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y + 10, classDef.description, {
          fontSize: '11px',
          color: '#cccccc',
          wordWrap: { width: cardWidth - 24 },
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
        2,
        id === classId ? SELECTED_STROKE_COLOR : UNSELECTED_STROKE_COLOR,
      );
    });
    this.updateBeginButtonState();
  }

  private createBeginButton(): void {
    const y = 380;
    const background = this.add
      .rectangle(this.scale.width / 2, y, 200, 44, 0x333333, 1)
      .setStrokeStyle(2, UNSELECTED_STROKE_COLOR)
      .setInteractive({ useHandCursor: true });
    background.on('pointerdown', () => this.tryBeginAdventure());

    this.beginButtonText = this.add
      .text(this.scale.width / 2, y, 'Begin Adventure', {
        fontSize: '16px',
        color: '#888888',
      })
      .setOrigin(0.5);
  }

  private updateBeginButtonState(): void {
    const ready = this.selectedClassId !== null;
    this.beginButtonText.setColor(ready ? '#ffffff' : '#888888');
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
    this.scene.start('Town');
  }
}
