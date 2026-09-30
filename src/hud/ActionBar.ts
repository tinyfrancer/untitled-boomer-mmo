import { el, fillPercent, place } from './dom';
import { iconEl } from './hudArt';
import { abilityIconKey } from '../art/icons';
import type { AbilityDefinition } from '../data/abilities';
import type { Rect } from '../ui/layout';
import type { AbilityState } from '../ui/uiEvents';
import type { AbilityId } from '../types/ids';

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
  private readonly onUse: (abilityId: AbilityId) => void;

  constructor(onUse: (abilityId: AbilityId) => void) {
    this.root = el('div', 'hud-actions');
    this.onUse = onUse;
  }

  /**
   * What is on the bar, rebuilt whole.
   *
   * The bar no longer knows what a class has — abilities are bought one at a
   * time now — so it is handed the answer rather than deriving one, and it
   * takes the list in the order it should draw it. Rebuilding rather than
   * appending is what keeps the slot numbers contiguous: a button is a slot, and
   * a gap in them would be a keyboard shortcut that presses nothing.
   */
  setAbilities(abilities: AbilityDefinition[]): void {
    this.buttons.clear();
    this.root.replaceChildren();
    abilities.forEach((ability, index) => {
      const slot = el('div', 'hud-ability');

      // The picture on the slab and the name under it: the name is what the
      // button is called, so a reader and the checks that press it find it.
      const button = el('button', 'hud-ability__key');
      button.type = 'button';
      button.dataset.ability = ability.id;
      button.setAttribute('aria-label', ability.name);
      button.addEventListener('click', () => this.onUse(ability.id));

      const sweep = el('div', 'hud-ability__sweep');
      // The slot number doubles as the keyboard hint.
      const number = el('div', 'hud-ability__slot', `${index + 1}`);
      button.append(iconEl(abilityIconKey(ability.id)), sweep, number);
      // What a cast costs, on the slab, for the class that pays in mana; a blow
      // that costs nothing says nothing.
      if (ability.manaCost > 0) {
        button.append(el('div', 'hud-ability__cost', `${ability.manaCost} mana`));
      }

      slot.append(button, el('div', 'hud-ability__name', ability.name));
      this.buttons.set(ability.id, { button, sweep });
      this.root.append(slot);
    });
  }

  layout(rect: Rect): void {
    place(this.root, rect);
  }

  update(states: AbilityState[]): void {
    for (const state of states) {
      const entry = this.buttons.get(state.abilityId);
      if (!entry) continue;
      entry.sweep.style.height = fillPercent(state.cooldownRemaining);
      // Dim the whole button when it can't be pressed, whatever the reason.
      entry.button.disabled = !state.usable;
    }
  }

  /** The ability in slot `index`, for the number keys that mirror the bar. */
  abilityAt(index: number): AbilityId | undefined {
    return [...this.buttons.keys()][index];
  }
}
