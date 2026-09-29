import { el } from './dom';
import { LoadSaveModal } from './LoadSaveModal';
import { weaponPreviewSvg } from './paperdoll';
import { injectHudStyles } from './styles';
import { CLASSES } from '../data/classes';
import { exhaustive } from '../types/exhaustive';
import type { CharacterState } from '../persistence/CharacterState';
import type { ClassId } from '../types/ids';

// Exhaustive rather than a plain list, so a new class is a compile error here
// rather than a class nobody is ever offered.
const CLASS_IDS = exhaustive<ClassId>()(['warrior', 'wizard', 'ranger']);
const DEFAULT_NAME = 'Adventurer';

export interface CharacterCreateOptions {
  parent: HTMLElement;
  onBegin: (name: string, classId: ClassId) => void;
  /** A character brought back from a save file or code instead of made here. */
  onLoad: (character: CharacterState) => void;
}

/**
 * The first screen: a name, a class, and a button.
 *
 * Plain DOM, like the rest of the HUD. The name box has to be a real `<input>`
 * for a phone's keyboard to behave, and nothing here needs a renderer — which
 * is what lets the boot flow show this screen before one exists.
 *
 * It is also the first thing a new phone or browser shows, so bringing a save
 * back is offered here: a player moving devices should not have to make a
 * character only to replace it.
 */
class CharacterCreate {
  readonly root: HTMLElement;
  private readonly cards = new Map<ClassId, HTMLElement>();
  private readonly begin: HTMLButtonElement;
  private readonly nameInput: HTMLInputElement;
  private readonly parent: HTMLElement;
  private loadSave: LoadSaveModal | null = null;
  private selected: ClassId | null = null;

  constructor(options: CharacterCreateOptions) {
    injectHudStyles();
    this.parent = options.parent;
    this.root = el('div', 'create');
    this.root.append(el('h1', 'create__title', 'Create Your Character'));

    this.nameInput = el('input', 'create__name');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = DEFAULT_NAME;
    this.nameInput.maxLength = 20;
    this.root.append(this.nameInput);

    const cards = el('div', 'create__cards');
    for (const classId of CLASS_IDS) {
      const definition = CLASSES[classId];
      const card = el('button', 'create__card');
      card.type = 'button';
      card.dataset.class = classId;
      card.append(
        el('div', 'create__card-name', definition.name),
        weaponPreviewSvg(definition.startingWeaponId, definition.startingOffhandId ?? null),
        el('div', 'create__card-text', definition.description),
      );
      card.addEventListener('click', () => this.select(classId));
      this.cards.set(classId, card);
      cards.append(card);
    }
    this.root.append(cards);

    this.begin = el('button', 'hud-button create__begin', 'Begin Adventure');
    this.begin.type = 'button';
    this.begin.dataset.action = 'begin';
    this.begin.disabled = true;
    this.begin.addEventListener('click', () => {
      if (!this.selected) {
        return;
      }
      const typed = this.nameInput.value.trim();
      options.onBegin(typed.length > 0 ? typed : DEFAULT_NAME, this.selected);
    });
    this.root.append(this.begin);

    const load = el('button', 'hud-button create__load', 'Load a Save');
    load.type = 'button';
    load.dataset.action = 'open-load-save';
    load.addEventListener('click', () => this.openLoadSave(options.onLoad));
    this.root.append(load);

    options.parent.append(this.root);
  }

  private openLoadSave(onLoad: (character: CharacterState) => void): void {
    this.loadSave?.close();
    // Beside the screen rather than in it, since the screen scrolls on a short
    // phone and a panel inside it would scroll away with it.
    this.loadSave = new LoadSaveModal(
      {
        current: null,
        onLoad,
        onClose: () => {
          this.loadSave = null;
        },
      },
      'hud-modal create__modal',
    );
    this.parent.append(this.loadSave.root);
  }

  private select(classId: ClassId): void {
    this.selected = classId;
    this.cards.forEach((card, id) => card.classList.toggle('is-selected', id === classId));
    this.begin.disabled = false;
  }

  destroy(): void {
    this.loadSave?.close();
    this.root.remove();
  }
}

let screen: CharacterCreate | null = null;

export function mountCharacterCreate(options: CharacterCreateOptions): void {
  if (screen) {
    return;
  }
  screen = new CharacterCreate(options);
}

export function unmountCharacterCreate(): void {
  screen?.destroy();
  screen = null;
}
