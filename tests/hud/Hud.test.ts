import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hudMounted, mountHud, unmountHud } from '../../src/hud/Hud';
import { AwayReportModal } from '../../src/hud/AwayReportModal';
import { OptionsModal } from '../../src/hud/OptionsModal';
import type { Overlay } from '../../src/hud/Overlay';
import { ShopModal } from '../../src/hud/ShopModal';
import { SlotPicker } from '../../src/hud/SlotPicker';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { recordingBus, type Emitted } from '../world/harness';
import { carryCapacity, inventoryWeight } from '../../src/systems/EncumbranceSystem';
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import {
  ACTIONS_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  COOK_REQUESTED_EVENT,
  CURRENCY_CHANGED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  SHOP_OPENED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';
import type { OfflineAfkReport } from '../../src/systems/OfflineAfkSystem';
import type { EventBus } from '../../src/world/worldEvents';
import type { PendingNotification } from '../../src/world/GameContext';

/**
 * jsdom lays nothing out, so every element measures zero — which the HUD reads
 * as the narrowest possible phone. The breakpoint is an input to half of what
 * is asserted here (which sheet opens on boot, and whether a resize closes it),
 * so it is stated rather than inherited.
 */
function setViewport(width: number, height: number): void {
  for (const [name, value] of [
    ['clientWidth', width],
    ['clientHeight', height],
  ] as const) {
    Object.defineProperty(Element.prototype, name, { configurable: true, get: () => value });
  }
}

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };

const REPORT: OfflineAfkReport = {
  elapsedMs: 3_600_000,
  kills: 12,
  enemyId: 'rat',
  xp: 60,
  copper: 40,
  drops: { 'rat-bones': 3 },
  packFilled: false,
};

let parent: HTMLElement;
let events: EventBus;
let emitted: Emitted[];

function mount(overrides: Partial<CharacterState> = {}, notifications?: PendingNotification[]) {
  const character = { ...createNewCharacter('Tester', 'warrior'), ...overrides };
  mountHud({ parent, events, character, notifications });
  return character;
}

/** Which sheet the player is looking at — the invariant is that it is one. */
function openSheets(): string[] {
  return [...parent.querySelectorAll<HTMLElement>('.hud-sheet:not(.hud-hidden)')].map(
    (sheet) => sheet.dataset.sheet ?? '',
  );
}

function tab(id: string): HTMLButtonElement {
  const button = parent.querySelector<HTMLButtonElement>(`.hud-tabs__tab[data-tab="${id}"]`);
  if (!button) throw new Error(`no ${id} tab`);
  return button;
}

function press(key: string, target: EventTarget = window): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function modals(): HTMLElement[] {
  return [...parent.querySelectorAll<HTMLElement>('.hud-modal')];
}

beforeEach(() => {
  setViewport(PHONE.width, PHONE.height);
  parent = document.createElement('div');
  document.body.append(parent);
  emitted = [];
  events = recordingBus(emitted);
});

afterEach(() => {
  unmountHud();
  parent.remove();
});

describe('mounting', () => {
  it('mounts once and unmounts', () => {
    mount();
    expect(hudMounted()).toBe(true);
    expect(parent.querySelectorAll('.hud')).toHaveLength(1);

    // The HUD outlives every zone, so a second boot must not stack a second one.
    mount();
    expect(parent.querySelectorAll('.hud')).toHaveLength(1);

    unmountHud();
    expect(hudMounted()).toBe(false);
    expect(parent.querySelector('.hud')).toBeNull();
  });

  it('leaves a phone with a clear playfield and gives a roomy screen the sheet', () => {
    mount();
    expect(openSheets()).toEqual([]);
    unmountHud();

    setViewport(DESKTOP.width, DESKTOP.height);
    mount();
    expect(openSheets()).toEqual(['character']);
  });
});

describe('one sheet is open at a time', () => {
  beforeEach(() => mount());

  it('opens exactly one sheet per tab and swaps rather than stacks', () => {
    for (const id of ['character', 'inventory', 'quests', 'feats', 'log']) {
      tab(id).click();
      expect(openSheets()).toEqual([id]);
    }
  });

  it('closes the open sheet when its own tab is tapped again', () => {
    tab('inventory').click();
    tab('inventory').click();
    expect(openSheets()).toEqual([]);
  });

  it('lights the tab of whatever is open, and only that one', () => {
    tab('quests').click();
    const lit = [...parent.querySelectorAll<HTMLElement>('.hud-tabs__tab.is-selected')];
    expect(lit.map((button) => button.dataset.tab)).toEqual(['quests']);
  });

  it('opens no sheet for the tabs that are actions', () => {
    tab('inventory').click();
    tab('camp').click();
    expect(emitted.map((e) => e.event)).toContain(AFK_TOGGLE_REQUESTED_EVENT);
    expect(openSheets()).toEqual(['inventory']);

    tab('options').click();
    expect(openSheets()).toEqual(['inventory']);
    expect(modals()).toHaveLength(1);
  });
});

describe('the keyboard', () => {
  beforeEach(() => mount());

  it('opens a sheet on its tab key', () => {
    press('i');
    expect(openSheets()).toEqual(['inventory']);
    press('c');
    expect(openSheets()).toEqual(['character']);
  });

  it('never steals a letter from a text field', () => {
    const input = document.createElement('input');
    parent.append(input);
    press('i', input);
    expect(openSheets()).toEqual([]);
  });

  it('closes an open modal on Escape before it reaches the tabs', () => {
    tab('options').click();
    expect(modals()).toHaveLength(1);
    press('Escape');
    expect(modals()).toHaveLength(0);
  });
});

describe('the redraws that are derived rather than sent', () => {
  const weightLine = (): string =>
    parent.querySelector<HTMLElement>('.hud-weight')?.textContent ?? '';

  it('recounts the pack against a capacity nobody sent it', () => {
    mount();
    const strength = computeEffectiveStats(
      'warrior',
      createNewCharacter('T', 'warrior').gear,
      1,
    ).strength;
    expect(weightLine()).toBe(`0 / ${carryCapacity(strength)} carried`);

    const bag = { 'rat-bones': 3 };
    events.emit(INVENTORY_CHANGED_EVENT, bag);
    expect(weightLine()).toBe(
      `${Math.round(inventoryWeight(bag))} / ${carryCapacity(strength)} carried`,
    );
  });

  it('moves capacity with the strength a level buys', () => {
    mount();
    const before = weightLine();
    events.emit(LEVEL_UP_EVENT, 5);
    expect(weightLine()).not.toBe(before);
    const strength = computeEffectiveStats(
      'warrior',
      createNewCharacter('T', 'warrior').gear,
      5,
    ).strength;
    expect(weightLine()).toBe(`0 / ${carryCapacity(strength)} carried`);
  });

  it('moves capacity with the strength gear carries', () => {
    mount();
    const before = weightLine();
    events.emit(GEAR_CHANGED_EVENT, {
      helmet: null,
      chest: 'brown-chestplate',
      pants: 'brown-legs',
      weapon: 'rusty-sword',
    });
    expect(weightLine()).not.toBe(before);
  });

  it('redraws the paperdoll from the gear it is told about', () => {
    mount();
    tab('character').click();
    const slot = parent.querySelector<HTMLElement>('.hud-slot[data-slot="chest"]');
    expect(slot?.textContent).not.toContain('Brown Chestplate');
    events.emit(GEAR_CHANGED_EVENT, {
      helmet: null,
      chest: 'brown-chestplate',
      pants: null,
      weapon: 'rusty-sword',
    });
    expect(slot?.textContent).toContain('Brown Chestplate');
  });
});

describe('the shop', () => {
  const shop = (): HTMLElement | null => parent.querySelector('.hud-modal__box--shop');

  it('opens and closes with the world, not with a tab', () => {
    mount();
    expect(shop()).toBeNull();
    events.emit(SHOP_OPENED_EVENT);
    expect(shop()).not.toBeNull();
    events.emit(SHOP_CLOSED_EVENT);
    expect(shop()).toBeNull();
  });

  it('refreshes while open from the bag and the purse it does not own', () => {
    mount();
    events.emit(SHOP_OPENED_EVENT);
    expect(shop()?.textContent).not.toContain('Rat Bones');

    events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 2 });
    expect(shop()?.textContent).toContain('Rat Bones');

    events.emit(CURRENCY_CHANGED_EVENT, 1234);
    expect(shop()?.textContent).toContain('12s');
  });
});

describe('the character sheet asks for what it cannot do itself', () => {
  it('opens a picker on an empty slot and asks to unequip a filled one', () => {
    mount();
    tab('character').click();

    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    const picker = parent.querySelector('.hud-picker');
    expect(picker).not.toBeNull();

    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="weapon"]')?.click();
    expect(emitted.map((e) => e.event)).toContain(UNEQUIP_SLOT_REQUESTED_EVENT);
  });

  it('closes the picker when the sheet behind it closes', () => {
    mount({ inventory: { 'brown-helmet': 1 } });
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    expect(parent.querySelector('.hud-picker')).not.toBeNull();

    tab('inventory').click();
    expect(parent.querySelector('.hud-picker')).toBeNull();
  });

  it('equips through the bus rather than reaching for the character', () => {
    mount({ inventory: { 'brown-helmet': 1 } });
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    parent.querySelector<HTMLButtonElement>('.hud-picker button')?.click();
    expect(emitted.filter((e) => e.event === EQUIP_ITEM_REQUESTED_EVENT)).toHaveLength(1);
  });
});

/**
 * Five buttons, five requests, and nothing in between: the panel asks
 * `ItemActionsSystem` which buttons an item offers and the HUD turns the one
 * pressed into the event that asks for it. What is worth holding is the pairing
 * — an Eat that emitted the cook request would look right until it burnt.
 */
describe('the inventory panel forwards its buttons', () => {
  const BAG = { 'brown-helmet': 1, 'cooked-fish': 1, logs: 1, 'raw-fish': 1 };

  function pressAction(itemId: string, action: string): void {
    parent.querySelector<HTMLButtonElement>(`.hud-item[data-item="${itemId}"]`)?.click();
    const button = parent.querySelector<HTMLButtonElement>(`[data-item-action="${action}"]`);
    if (!button) throw new Error(`no ${action} button on ${itemId}`);
    button.click();
  }

  beforeEach(() => {
    mount({ inventory: BAG });
    tab('inventory').click();
  });

  it.each([
    ['brown-helmet', 'equip', EQUIP_ITEM_REQUESTED_EVENT],
    ['cooked-fish', 'eat', EAT_ITEM_REQUESTED_EVENT],
  ])('asks to %s the item it was pressed on', (itemId, action, event) => {
    pressAction(itemId, action);
    expect(emitted.filter((e) => e.event === event)).toEqual([{ event, args: [itemId] }]);
  });

  // The two that need the world to allow them first.
  it('asks to cook once there is a fire, and to sell once the shop is open', () => {
    events.emit(ACTIONS_CHANGED_EVENT, { nearFire: true });
    pressAction('raw-fish', 'cook');
    expect(emitted.at(-1)).toEqual({ event: COOK_REQUESTED_EVENT, args: ['raw-fish'] });

    events.emit(SHOP_OPENED_EVENT);
    pressAction('cooked-fish', 'sell');
    expect(emitted.at(-1)).toEqual({ event: SELL_ITEM_REQUESTED_EVENT, args: ['cooked-fish'] });
  });

  // The one button that is about where the player is standing rather than about
  // what was pressed, so its request carries nothing.
  it('asks for a fire without naming the logs it would burn', () => {
    pressAction('logs', 'light-fire');
    expect(emitted.at(-1)).toEqual({ event: LIGHT_FIRE_REQUESTED_EVENT, args: [] });
  });
});

describe('the away report', () => {
  const parked: PendingNotification = { kind: 'offline-afk', report: REPORT };

  it('shows what the camp earned on the boot that resolved it', () => {
    mount({}, [parked]);
    const modal = modals()[0];
    expect(modal?.textContent).toContain('12 kills');
  });

  it('shows nothing when the session was not parked', () => {
    mount({}, []);
    expect(modals()).toHaveLength(0);
  });
});

describe('destroy', () => {
  it('drops every subscription', () => {
    mount();
    tab('inventory').click();
    unmountHud();

    // The bus outlives the HUD — the session owns it — so a HUD that stayed
    // subscribed would keep drawing into a detached tree forever.
    expect(() => events.emit(INVENTORY_CHANGED_EVENT, { 'rat-bones': 1 })).not.toThrow();
    expect(document.querySelectorAll('.hud-weight')).toHaveLength(0);
  });

  it('stops listening to the keyboard', () => {
    mount();
    unmountHud();
    press('i');
    expect(document.querySelectorAll('.hud-sheet')).toHaveLength(0);
  });

  // All four overlays are appended to the HUD's own root, so removing it takes
  // them with it whether or not `destroy()` names them. That is what makes the
  // omission below invisible from here.
  it('takes every overlay out of the document', () => {
    mount({ inventory: { 'brown-helmet': 1 } });
    tab('character').click();
    parent.querySelector<HTMLButtonElement>('.hud-slot[data-slot="helmet"]')?.click();
    tab('options').click();
    events.emit(SHOP_OPENED_EVENT);
    expect(parent.querySelector('.hud-picker')).not.toBeNull();
    expect(modals()).toHaveLength(2);

    unmountHud();
    expect(document.querySelector('.hud-picker')).toBeNull();
    expect(document.querySelector('.hud-modal')).toBeNull();
  });
});

/**
 * All four overlays close the same way, which they did not before: three had
 * independently written copies of the flag and the guard, and the shop had none
 * at all — so `Hud` reached past it into `root.remove()` and `destroy()` left
 * it out. None of that was visible in the DOM, since every overlay hangs off
 * the root `destroy()` removes, so the lifecycle itself is what is asserted.
 */
describe('every overlay has the same lifecycle', () => {
  const noop = (): void => {};
  const overlays = (onClosed: () => void): Overlay[] => [
    new OptionsModal({ onResetCharacter: noop, onClose: onClosed }),
    new SlotPicker('helmet', [], new DOMRect(), PHONE, noop, onClosed),
    new AwayReportModal(REPORT, onClosed),
    new ShopModal(
      { onBuy: noop, onSell: noop, onAcceptQuest: noop, onTurnInQuest: noop, onDismiss: noop },
      onClosed,
    ),
  ];

  it('takes each one out of the tree and says so once', () => {
    for (const overlay of overlays(noop)) {
      document.body.append(overlay.root);
      overlay.close();
      expect(overlay.root.isConnected).toBe(false);
    }
  });

  it('closes idempotently: the second close does nothing and calls nothing', () => {
    let closes = 0;
    for (const overlay of overlays(() => closes++)) {
      overlay.close();
      expect(() => overlay.close()).not.toThrow();
    }
    expect(closes).toBe(4);
  });
});
