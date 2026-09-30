import { el } from './dom';
import { LoadSaveModal } from './LoadSaveModal';
import { injectHudStyles } from './styles';
import { drawPortrait } from './hudArt';
import { HAIR_RAMPS, SKIN_RAMPS, playerGetup, portrait } from '../art/outfit';
import { SHARED_RAMPS } from '../art/palette';
import { CLASSES } from '../data/classes';
import { DEFAULT_LOOK, HAIRSTYLES, HAIR_COLOURS, SKIN_TONES, type Look } from '../data/looks';
import { NO_GEAR } from '../systems/InventorySystem';
import { exhaustive } from '../types/exhaustive';
import type { CharacterState } from '../persistence/CharacterState';
import type { ClassId } from '../types/ids';

// Exhaustive rather than a plain list, so a new class is a compile error here
// rather than a class nobody is ever offered.
const CLASS_IDS = exhaustive<ClassId>()(['warrior', 'wizard', 'ranger']);
const DEFAULT_NAME = 'Adventurer';

/** How many CSS pixels a card's art pixel is drawn at: three, as a phone's world is. */
const PORTRAIT_SCALE = 3;
/** And the picture beside the look's choices, smaller so the two fit a phone side by side. */
const PREVIEW_SCALE = 2;

export interface CharacterCreateOptions {
  parent: HTMLElement;
  onBegin: (name: string, classId: ClassId, look: Look) => void;
  /** A character brought back from a save file or code instead of made here. */
  onLoad: (character: CharacterState) => void;
  /**
   * Who retired with version 1 on this device, the first time the screen is
   * shown after their save was dropped (decision 82), or null.
   */
  retired?: string | null;
}

type LookPart = keyof Look;

// Each part of a look, what the row is called, and what each choice is named
// and shown as: a swatch of the colour, or the name written out.
const LOOK_ROWS: readonly {
  part: LookPart;
  label: string;
  names: Readonly<Record<string, string>>;
  swatch?: (value: string) => string;
}[] = [
  {
    part: 'skin',
    label: 'Skin',
    names: SKIN_TONES,
    swatch: (value) => css(SHARED_RAMPS[SKIN_RAMPS[value as Look['skin']]][3]),
  },
  {
    part: 'hair',
    label: 'Hair',
    names: HAIR_COLOURS,
    swatch: (value) => css(SHARED_RAMPS[HAIR_RAMPS[value as Look['hair']]][2]),
  },
  { part: 'hairstyle', label: 'Style', names: HAIRSTYLES },
];

function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/**
 * The first screen: a name, a class, a look, and a button.
 *
 * Plain DOM, like the rest of the HUD. The name box has to be a real `<input>`
 * for a phone's keyboard to behave, and nothing here needs a renderer — which
 * is what lets the boot flow show this screen before one exists. Each class's
 * card is a picture of that class as it starts, in the look chosen below it,
 * drawn from the same art as the world (decision 107) and drawn again as the
 * look changes.
 *
 * It is also the first thing a new phone or browser shows, so bringing a save
 * back is offered here: a player moving devices should not have to make a
 * character only to replace it.
 */
class CharacterCreate {
  readonly root: HTMLElement;
  private readonly cards = new Map<ClassId, HTMLElement>();
  private readonly portraits = new Map<ClassId, HTMLCanvasElement>();
  // The class chosen (or the first, until one is) beside the choices, so a
  // look is seen as it is picked on a phone that has scrolled the cards away.
  private readonly preview = el('canvas', 'create__portrait create__preview');
  private readonly choices: HTMLButtonElement[] = [];
  private readonly begin: HTMLButtonElement;
  private readonly nameInput: HTMLInputElement;
  private readonly parent: HTMLElement;
  private loadSave: LoadSaveModal | null = null;
  private selected: ClassId | null = null;
  private look: Look = { ...DEFAULT_LOOK };

  constructor(options: CharacterCreateOptions) {
    injectHudStyles();
    this.parent = options.parent;
    this.root = el('div', 'create');
    this.root.append(el('h1', 'create__title', 'Create Your Character'));
    if (options.retired) this.root.append(el('p', 'create__retired', options.retired));

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
      const picture = el('canvas', 'create__portrait');
      this.portraits.set(classId, picture);
      card.append(
        el('div', 'create__card-name', definition.name),
        picture,
        el('div', 'create__card-text', definition.description),
      );
      card.addEventListener('click', () => this.select(classId));
      this.cards.set(classId, card);
      cards.append(card);
    }
    this.root.append(cards, this.lookRows());
    this.drawPortraits();

    this.begin = el('button', 'hud-button create__begin', 'Begin Adventure');
    this.begin.type = 'button';
    this.begin.dataset.action = 'begin';
    this.begin.disabled = true;
    this.begin.addEventListener('click', () => {
      if (!this.selected) {
        return;
      }
      const typed = this.nameInput.value.trim();
      options.onBegin(typed.length > 0 ? typed : DEFAULT_NAME, this.selected, { ...this.look });
    });
    this.root.append(this.begin);

    const load = el('button', 'hud-button create__load', 'Load a Save');
    load.type = 'button';
    load.dataset.action = 'open-load-save';
    load.addEventListener('click', () => this.openLoadSave(options.onLoad));
    this.root.append(load);

    options.parent.append(this.root);
  }

  /** A row of choices for each part of a look, the chosen one marked, beside a picture of it. */
  private lookRows(): HTMLElement {
    const box = el('div', 'create__look');
    const rows = el('div', 'create__look-rows');
    box.append(this.preview, rows);
    for (const row of LOOK_ROWS) {
      const line = el('div', 'create__look-row');
      const options = el('div', 'create__look-options');
      line.append(el('span', 'create__look-label', row.label), options);
      for (const [value, name] of Object.entries(row.names)) {
        const choice = el('button', 'create__choice', row.swatch ? '' : name);
        choice.type = 'button';
        choice.dataset.look = row.part;
        choice.dataset.value = value;
        choice.title = name;
        choice.setAttribute('aria-label', `${row.label}: ${name}`);
        if (row.swatch) {
          choice.classList.add('create__choice--swatch');
          choice.style.background = row.swatch(value);
        }
        choice.addEventListener('click', () => this.choose(row.part, value));
        this.choices.push(choice);
        options.append(choice);
      }
      rows.append(line);
    }
    this.markChoices();
    return box;
  }

  private choose(part: LookPart, value: string): void {
    this.look = { ...this.look, [part]: value };
    this.markChoices();
    this.drawPortraits();
  }

  private markChoices(): void {
    for (const choice of this.choices) {
      const part = choice.dataset.look as LookPart;
      const chosen = this.look[part] === choice.dataset.value;
      choice.classList.toggle('is-selected', chosen);
      choice.setAttribute('aria-pressed', String(chosen));
    }
  }

  /** Every class as it starts, in the look as it stands. */
  private drawPortraits(): void {
    const drawn: [ClassId, HTMLCanvasElement][] = [
      ...this.portraits,
      [this.selected ?? 'warrior', this.preview],
    ];
    for (const [classId, canvas] of drawn) {
      const definition = CLASSES[classId];
      const picture = portrait(
        playerGetup(classId, this.look, {
          ...NO_GEAR,
          weapon: definition.startingWeaponId,
          offhand: definition.startingOffhandId ?? null,
        }),
      );
      canvas.dataset.look = `${this.look.skin}:${this.look.hair}:${this.look.hairstyle}`;
      // A page with no 2D canvas (a test's) gets the card without the picture.
      drawPortrait(canvas, picture, canvas === this.preview ? PREVIEW_SCALE : PORTRAIT_SCALE);
    }
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
    this.drawPortraits();
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
