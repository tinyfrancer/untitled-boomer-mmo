import { Sheet } from './Sheet';
import { el, sectionHeader } from './dom';
import { bindItemCard } from './itemCard';
import { itemIconEl } from './hudArt';
import { describeItemName } from '../data/items';
import type { IdleFoodMove, IdleFoodRow, IdlePotionRow } from '../systems/IdleFoodSystem';
import type { IdlePlan } from '../systems/IdlePlanSystem';
import { describePotionEffect, potionDuration } from '../systems/PotionSystem';
import { THEME } from '../ui/theme';
import type { ItemId } from '../types/ids';

export interface IdleSheetHandlers {
  /** Asked with what the button said, so a stale panel cannot flip the wrong way. */
  onSet(active: boolean): void;
  /** A food or a potion: the two share the one order and the one Keep. */
  onMoveFood(itemId: ItemId, move: IdleFoodMove): void;
  onKeepFood(itemId: ItemId, keep: boolean): void;
}

/**
 * What idle will do, said before it starts, and what it is doing while it runs
 * (decision 96): the job, what it pays, the food it eats and the potions it
 * drinks in the player's order, the arrows it spends, and what a closed game
 * pays and at most.
 *
 * Everything drawn comes out of `idlePlan`, so this file decides only how the
 * panel looks and which buttons ask for what. Like the skills book it draws only
 * while it is showing: the plan moves with every item picked up, and a hidden
 * panel redrawn each time would be work nobody sees.
 */
export class IdleSheet extends Sheet {
  private readonly button: HTMLButtonElement;
  private readonly handlers: IdleSheetHandlers;
  private plan: IdlePlan | null = null;
  private active = false;
  private showing = false;
  private stale = true;

  constructor(handlers: IdleSheetHandlers) {
    super('Idle', THEME.panelWidth.idle);
    this.handlers = handlers;
    this.button = el('button', 'hud-button hud-idle__button');
    this.button.type = 'button';
    this.button.addEventListener('click', () => this.handlers.onSet(!this.active));
    this.head.classList.add('hud-idle__head');
    this.head.append(this.button);
    this.drawButton();
  }

  update(plan: IdlePlan, active: boolean): void {
    this.plan = plan;
    this.active = active;
    this.drawButton();
    this.stale = true;
    if (this.showing) this.draw();
  }

  override setVisible(visible: boolean): void {
    super.setVisible(visible);
    this.showing = visible;
    if (visible && this.stale) this.draw();
  }

  // Written only when it changes: the plan is handed over on every item picked
  // up and every hit's XP, and a button rewritten to what it already says is
  // still a DOM write on a frame a slow phone cannot spare.
  private drawButton(): void {
    const action = this.active ? 'stop-idle' : 'start-idle';
    if (this.button.dataset.action === action) return;
    this.button.textContent = this.active ? 'Stop idle' : 'Start idle';
    this.button.dataset.action = action;
  }

  // A redraw keeps its place: food moved down a long list should stay in view.
  private draw(): void {
    const scroll = this.body.scrollTop;
    this.stale = false;
    this.body.replaceChildren(...(this.plan ? this.view(this.plan) : []));
    this.body.scrollTop = scroll;
  }

  private view(plan: IdlePlan): HTMLElement[] {
    const intro = el('div', 'hud-sheet__intro');
    intro.append(
      el(
        'p',
        undefined,
        this.active
          ? 'Idle is on. Moving, or tapping anything in the world, stops it.'
          : 'Idle plays on while you step away. Moving, or tapping anything in the world, stops it.',
      ),
    );
    const view: HTMLElement[] = [intro];
    if (plan.warning) {
      view.push(el('div', 'hud-idle__line hud-idle__warning', plan.warning));
    }
    view.push(sectionHeader(this.active ? 'Doing' : 'Will do'), ...lines([...plan.job, plan.xp]));
    view.push(sectionHeader('Food'), ...lines([plan.foodRule]));
    plan.food.forEach((row, index) => view.push(this.foodRow(row, index, plan.food.length)));
    if (plan.arrows.length > 0) {
      view.push(sectionHeader('Arrows'), ...lines(plan.arrows));
    }
    view.push(sectionHeader('Potions'), ...lines([plan.potionRule]));
    plan.potionRows.forEach((row, index) =>
      view.push(this.potionRow(row, index, plan.potionRows.length)),
    );
    view.push(...lines(plan.potions));
    view.push(sectionHeader('Away', 'with the game closed'), ...lines(plan.away));
    view.push(sectionHeader('Rested', 'for XP earned by hand'), ...lines(plan.rested));
    return view;
  }

  /**
   * A food in the bag, with the two buttons that move it and the one that keeps
   * it. Held or right-clicked it is the item's card, as every item row is.
   */
  private foodRow(food: IdleFoodRow, index: number, count: number): HTMLElement {
    const row = this.supplyRow(food, index === 0, index === count - 1, {
      kind: 'food',
      sub: food.keep ? 'Kept' : `Heals ${food.healAmount} Health`,
      verb: 'Eat',
      never: 'Never eaten by idle',
    });
    row.dataset.food = food.itemId;
    return row;
  }

  /** A potion in the bag, moved and kept the way a food is, saying what it does here. */
  private potionRow(potion: IdlePotionRow, index: number, count: number): HTMLElement {
    const does = `${describePotionEffect(potion.effectId)}, ${potionDuration(potion.effectId)}`;
    const row = this.supplyRow(potion, index === 0, index === count - 1, {
      kind: 'potion',
      sub: potion.keep ? 'Kept' : potion.works ? does : 'Does nothing for this: passed over',
      verb: 'Drink',
      never: 'Never drunk by idle',
    });
    row.dataset.potion = potion.itemId;
    return row;
  }

  private supplyRow(
    supply: { itemId: ItemId; count: number; keep: boolean },
    first: boolean,
    last: boolean,
    words: { kind: 'food' | 'potion'; sub: string; verb: string; never: string },
  ): HTMLElement {
    const wrapper = el('div', `hud-idle-food${supply.keep ? ' is-kept' : ''}`);

    const item = el('div', 'hud-idle-food__item');
    const text = el('div', 'hud-row__text');
    text.append(
      el('div', 'hud-idle-food__name', `${describeItemName(supply.itemId)} ×${supply.count}`),
      el('div', 'hud-list-row__sub', words.sub),
    );
    item.append(itemIconEl(supply.itemId), text);
    bindItemCard(item, supply.itemId);

    const { kind } = words;
    const earlier = this.foodButton('▲', `${kind}-earlier`, `${words.verb} sooner`);
    earlier.disabled = first;
    earlier.addEventListener('click', () => this.handlers.onMoveFood(supply.itemId, 'earlier'));
    const later = this.foodButton('▼', `${kind}-later`, `${words.verb} later`);
    later.disabled = last;
    later.addEventListener('click', () => this.handlers.onMoveFood(supply.itemId, 'later'));
    const keep = this.foodButton('Keep', `${kind}-keep`, words.never);
    keep.classList.toggle('is-lit', supply.keep);
    keep.addEventListener('click', () => this.handlers.onKeepFood(supply.itemId, !supply.keep));

    wrapper.append(item, earlier, later, keep);
    return wrapper;
  }

  private foodButton(text: string, action: string, title: string): HTMLButtonElement {
    const button = el('button', 'hud-button hud-idle-food__button', text);
    button.type = 'button';
    button.dataset.action = action;
    button.title = title;
    return button;
  }
}

function lines(texts: string[]): HTMLElement[] {
  return texts.map((text) => el('div', 'hud-idle__line', text));
}
