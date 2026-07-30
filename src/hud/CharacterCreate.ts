import { el } from './dom';
import { weaponPreviewSvg } from './paperdoll';
import { injectHudStyles } from './styles';
import { CLASSES } from '../data/classes';
import type { ClassId } from '../types/ids';

const CLASS_IDS: ClassId[] = ['warrior', 'wizard'];
const DEFAULT_NAME = 'Adventurer';

export interface CharacterCreateOptions {
  parent: HTMLElement;
  onBegin: (name: string, classId: ClassId) => void;
}

/**
 * The first screen: a name, a class, and a button.
 *
 * Plain DOM rather than a Phaser scene — it was already half DOM, since the
 * name box had to be a real `<input>` and rode in on `add.dom`. Taking the rest
 * across is what lets `dom.createContainer` leave the game config, and it means
 * the only Phaser scene left is the one drawing the world.
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
        weaponPreviewSvg(definition.startingWeaponId),
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
