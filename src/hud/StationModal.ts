import { Overlay } from './Overlay';
import { el, row, sectionHeader } from './dom';
import { itemIconEl } from './hudArt';
import { bindItemCard } from './itemCard';
import { describeItemName } from '../data/items';
import { batchSize, recipesAt } from '../systems/CraftingSystem';
import { STATION_LABELS, STATION_SKILLS, type StationId } from '../data/recipes';
import { SKILLS } from '../data/skills';
import { skillLevel, type Skills } from '../systems/SkillSystem';
import type { Inventory } from '../systems/InventorySystem';
import { THEME } from '../ui/theme';
import type { RecipeId } from '../types/ids';

/** Everything the panel draws, all of it a copy the world still owns. */
export interface StationPanelState {
  inventory: Inventory;
  skills: Skills;
}

export interface StationHandlers {
  onMake: (recipeId: RecipeId) => void;
  onDismiss: () => void;
}

/**
 * What can be made at a station, and what each of it takes.
 *
 * This is the one crafting surface that needed a panel rather than a button in
 * the bag, and the reason is arithmetic rather than taste: cooking has one
 * recipe per raw item, so the bag *is* the menu — tap the fish, cook the fish.
 * Four iron bars are three different pieces of armour, and no bag cell can say
 * which one was meant.
 *
 * It is still a station rather than a counter. Nothing owns whether it is open
 * but how far away the player is standing, so it opens and closes off
 * `actions-changed` with no world session behind it — walking away is the whole
 * of closing it, which is the same rule the pan over a fire already lives by.
 *
 * It was the *forge's* panel until there was a second station, and everything
 * that made it the forge's is a lookup now: the title, the rows and the skill
 * the rows are levelled against all come off the station it was opened at.
 * Nothing here knows a forge from a tannery, which is what stops the next one
 * being a third copy of this file.
 */
export class StationModal extends Overlay {
  readonly station: StationId;
  private readonly body: HTMLElement;
  private readonly handlers: StationHandlers;

  constructor(station: StationId, handlers: StationHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.station = station;
    this.handlers = handlers;
    const box = el('div', 'hud-modal__box hud-modal__box--station');

    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', STATION_LABELS[station]));
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-station';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(state: StationPanelState): void {
    const skill = STATION_SKILLS[this.station];
    this.body.replaceChildren();
    this.body.append(sectionHeader(`At the ${STATION_LABELS[this.station].toLowerCase()}`));
    const level = skillLevel(state.skills, skill);
    for (const recipe of recipesAt(this.station)) {
      this.body.append(this.recipeRow(recipe.id, recipe.name, recipe, state, level));
    }
  }

  /**
   * One line: what it makes, what it takes, and whether either is out of reach.
   *
   * A row short of its level is drawn rather than hidden and still tapped, the
   * call the shop's shelf and the trainer's syllabus both make — the reason to
   * reach a level is the thing waiting at it, and the world answers a tap with
   * the full sentence.
   */
  private recipeRow(
    id: RecipeId,
    name: string,
    recipe: ReturnType<typeof recipesAt>[number],
    state: StationPanelState,
    level: number,
  ): HTMLElement {
    const locked = level < recipe.requiredLevel;
    const short = recipe.inputs.some(
      (input) => (state.inventory[input.itemId] ?? 0) < input.quantity,
    );

    const entry = row({
      className: 'hud-list-row',
      label: name,
      value: locked ? `Needs ${SKILLS[recipe.skill].name} ${recipe.requiredLevel}` : 'Make',
      valueClass: 'hud-list-row__value',
      icon: itemIconEl(recipe.outputItemId),
      onClick: () => this.handlers.onMake(id),
    });
    entry.root.dataset.recipe = id;
    // Asked about, a row is the thing it makes: what a helmet is worth wearing
    // is the question somebody at a forge has before spending the bars on one.
    bindItemCard(entry.root, recipe.outputItemId);
    entry.label.style.color = !locked && !short ? THEME.color.equippable : THEME.color.dim;
    entry.value.style.color = locked ? THEME.color.muted : THEME.color.levelUp;
    if (locked) {
      entry.root.dataset.locked = id;
    }

    // What it takes, with what is actually in the pack against it — the whole of
    // why a row that looks affordable is refused, said before the tap rather
    // than after it.
    const cost = recipe.inputs
      .map((input) => {
        const held = state.inventory[input.itemId] ?? 0;
        return `${describeItemName(input.itemId)} ×${input.quantity} (${held} in bag)`;
      })
      .join(', ');
    // How many a job makes, for the rows that make more than one — which is
    // most of what tells a log at the bench from a log on the fire.
    const batch = batchSize(recipe);
    const note = el('div', 'hud-list-row__note', batch > 1 ? `${cost} — makes ${batch}` : cost);
    if (short) {
      note.style.color = THEME.color.playerDamage;
    }

    const wrapper = el('div', 'hud-lesson');
    wrapper.append(entry.root, note);
    return wrapper;
  }
}
