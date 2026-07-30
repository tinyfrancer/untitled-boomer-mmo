import { el, place } from './dom';
import { abilitiesFor } from '../systems/AbilitySystem';
import type { Rect } from '../ui/layout';
import type { AbilityState } from '../ui/uiEvents';
import type { AbilityId, ClassId } from '../types/ids';

interface AbilityButton {
  button: HTMLButtonElement;
  sweep: HTMLElement;
}

/**
 * The ability buttons, bottom left where a thumb reaches them. Deliberately not
 * bottom centre: the camera keeps the player centred, so the bottom middle of
 * the screen is where the ground and the signposts just south of them are
 * tapped. Keyboard players get 1 and 2 for the same two slots.
 */
export class ActionBar {
  readonly root: HTMLElement;
  private readonly buttons = new Map<AbilityId, AbilityButton>();

  constructor(classId: ClassId, onUse: (abilityId: AbilityId) => void) {
    this.root = el('div', 'hud-actions');
    abilitiesFor(classId).forEach((ability, index) => {
      const slot = el('div', 'hud-ability');

      const button = el('button', 'hud-ability__key', ability.name.replace(' ', '\n'));
      button.type = 'button';
      button.dataset.ability = ability.id;
      button.addEventListener('click', () => onUse(ability.id));

      const sweep = el('div', 'hud-ability__sweep');
      // The slot number doubles as the keyboard hint.
      const number = el('div', 'hud-ability__slot', `${index + 1}`);
      button.append(sweep, number);

      const cost = el(
        'div',
        'hud-ability__cost',
        ability.manaCost > 0 ? `${ability.manaCost} mana` : 'no cost',
      );
      slot.append(button, cost);
      this.buttons.set(ability.id, { button, sweep });
      this.root.append(slot);
    });
  }

  layout(rect: Rect): void {
    place(this.root, rect, 'position');
  }

  update(states: AbilityState[]): void {
    for (const state of states) {
      const entry = this.buttons.get(state.abilityId);
      if (!entry) continue;
      entry.sweep.style.height = `${state.cooldownRemaining * 100}%`;
      // Dim the whole button when it can't be pressed, whatever the reason.
      entry.button.disabled = !state.usable;
    }
  }

  /** The ability in slot `index`, for the number keys that mirror the bar. */
  abilityAt(index: number): AbilityId | undefined {
    return [...this.buttons.keys()][index];
  }
}
