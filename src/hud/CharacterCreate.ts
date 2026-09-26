import { el } from './dom';
import { weaponPreviewSvg } from './paperdoll';
import { injectHudStyles } from './styles';
import { CLASSES } from '../data/classes';
import { exhaustive } from '../types/exhaustive';
import type { ClassId } from '../types/ids';

// Exhaustive rather than a plain list, so a new class is a compile error here
// rather than a class nobody is ever offered.
const CLASS_IDS = exhaustive<ClassId>()(['warrior', 'wizard', 'ranger']);
const DEFAULT_NAME = 'Adventurer';

export interface CharacterCreateOptions {
  parent: HTMLElement;
  onBegin: (name: string, classId: ClassId) => void;
}

/**
 * The first screen: a name, a class, and a button.
 *
 * Plain DOM, like the rest of the HUD. The name box has to be a real `<input>`
 * for a phone's keyboard to behave, and nothing here needs a renderer — which
 * is what lets the boot flow show this screen before one exists.
 */
class CharacterCreate {
  readonly root: HTMLElement;
  private readonly cards = new Map<ClassId, HTMLElement>();
  private readonly begin: HTMLButtonElement;
  private readonly nameInput: HTMLInputElement;
  private selected: ClassId | null = null;

  constructor(options: CharacterCreateOptions) {
    injectHudStyles();
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

    options.parent.append(this.root);
  }

  private select(classId: ClassId): void {
    this.selected = classId;
    this.cards.forEach((card, id) => card.classList.toggle('is-selected', id === classId));
    this.begin.disabled = false;
  }

  destroy(): void {
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
